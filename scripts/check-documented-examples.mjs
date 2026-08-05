/**
 * Resolve every field named in a documented example against the real dataset.
 *
 * A documented query that has gone stale does not look broken. `jq` on a field
 * that no longer exists prints nothing, and nothing is exactly what a correct
 * answer of "none" looks like, so a reader concludes there are no such records
 * and moves on. That is the worst failure a reference site can have, because it
 * is confidently wrong and completely silent.
 *
 * So every example is parsed rather than trusted: the endpoint it fetches, the
 * record array it iterates, and every `.field.path` it names are resolved
 * against the committed dataset that endpoint serves. An unknown field fails
 * the build.
 *
 * What this does not do is run the examples. It does not shell out to `jq` or
 * to `curl`, because a check that needs the network is a check that goes red
 * for reasons that have nothing to do with the documentation. Field existence
 * is the part that actually rots.
 *
 * Needs no build: it reads the MDX sources and the committed datasets.
 *
 *   node scripts/check-documented-examples.mjs
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docsRoot = path.join(root, 'src', 'content', 'docs');
const generated = path.join(root, 'src', 'data', 'generated');

const problems = [];
const complain = (message) => problems.push(message);

/**
 * Field names that belong to `jq` rather than to the data. `.[]` and friends
 * are syntax; `first`, `sort`, and `index` are builtins that follow a pipe and
 * would otherwise be read as record fields.
 */
const jqBuiltins = new Set([
  'first', 'last', 'sort', 'sort_by', 'length', 'keys', 'values', 'index', 'test', 'select',
  'map', 'add', 'unique', 'reverse', 'min', 'max', 'tostring', 'tonumber', 'join', 'split',
  'any', 'all', 'empty', 'not', 'type', 'has', 'contains', 'group_by', 'to_entries', 'from_entries',
]);

const walk = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else if (/\.mdx?$/.test(entry.name)) files.push(full);
  }
  return files;
};

const datasetCache = new Map();
async function dataset(id) {
  if (!datasetCache.has(id)) {
    try {
      datasetCache.set(id, JSON.parse(await readFile(path.join(generated, `${id}.json`), 'utf8')));
    } catch {
      datasetCache.set(id, null);
    }
  }
  return datasetCache.get(id);
}

/**
 * Does `path` exist on any record in `records`?
 *
 * Any, not all: these datasets are deliberately sparse. A control may carry a
 * handler and its neighbour may not, and an example selecting on the field is
 * correct precisely because only some records have it.
 */
function resolves(records, fieldPath) {
  // `.controls[0].label` is one path, not a path and a stray field. The index
  // is dropped because the walk below descends into an array either way; what
  // matters is that the named key exists on whatever is in there.
  const segments = fieldPath.replace(/\[\d*\]/g, '').split('.').filter(Boolean);
  return records.some((record) => {
    let node = record;
    for (const segment of segments) {
      if (node === null || typeof node !== 'object') return false;
      if (Array.isArray(node)) node = node[0];
      if (node === undefined || node === null || !(segment in node)) return false;
      node = node[segment];
    }
    return true;
  });
}

let examples = 0;
let fieldsChecked = 0;

for (const file of await walk(docsRoot)) {
  const page = `/${path.relative(docsRoot, file).replaceAll('\\', '/').replace(/\.mdx?$/, '').replace(/\/index$/, '')}`;
  const source = await readFile(file, 'utf8');

  for (const block of source.matchAll(/```(?:sh|bash|console)\n([\s\S]*?)```/g)) {
    const code = block[1];
    // One example is one endpoint plus the pipeline that reads it. Splitting on
    // the fetch keeps a block of several examples from cross-checking fields
    // between unrelated datasets.
    const chunks = code.split(/(?=curl\s)/).filter((chunk) => /assets\/data\/[a-z-]+\.json/.test(chunk));
    for (const chunk of chunks) {
      const id = /assets\/data\/([a-z-]+)\.json/.exec(chunk)[1];
      const data = await dataset(id);
      if (!data) {
        complain(`${page}: an example fetches /assets/data/${id}.json, which is not a committed dataset`);
        continue;
      }
      examples += 1;

      // `.records[]` names the array the example walks. Everything after it is
      // a field on one of those records.
      const arrayMatch = /'\s*\.([a-zA-Z_][\w]*)\[\]/.exec(chunk) ?? /\.([a-zA-Z_][\w]*)\[\]/.exec(chunk);
      if (!arrayMatch) {
        complain(`${page}: the example for ${id} does not name a record array, so nothing about it can be verified`);
        continue;
      }
      const records = data[arrayMatch[1]];
      if (!Array.isArray(records) || !records.length) {
        complain(`${page}: the example for ${id} reads \`.${arrayMatch[1]}[]\`, which is not a non-empty array in that dataset`);
        continue;
      }

      const after = chunk.slice(chunk.indexOf(arrayMatch[0]) + arrayMatch[0].length);
      // Matched as one path so that `.controls[0].label` is checked against the
      // control, not against the record that holds the controls.
      for (const reference of after.matchAll(/\.([a-zA-Z_][\w]*(?:\[\d*\])?(?:\.[a-zA-Z_][\w]*(?:\[\d*\])?)*)/g)) {
        const fieldPath = reference[1];
        if (jqBuiltins.has(fieldPath.split(/[.[]/)[0])) continue;
        fieldsChecked += 1;
        if (!resolves(records, fieldPath)) {
          complain(
            `${page}: the example for ${id} reads \`.${fieldPath}\`, which no record in \`${arrayMatch[1]}\` has. ` +
              'The published command would return nothing, which reads as an answer of "none".'
          );
        }
      }
    }
  }
}

/**
 * Every published dataset should carry a worked example. A dataset nobody has
 * shown a use for is a dataset nobody will use.
 */
const endpoints = (await readdir(path.join(root, 'src', 'pages', 'assets', 'data')))
  .filter((name) => name.endsWith('.json.ts') && name !== 'index.json.ts')
  .map((name) => name.replace(/\.json\.ts$/, ''));
const demonstrated = new Set([...datasetCache.keys()].filter((id) => datasetCache.get(id)));
for (const id of endpoints) {
  if (!demonstrated.has(id)) complain(`/assets/data/${id}.json is published but no page shows a worked query against it`);
}

console.log(`Checked ${fieldsChecked} field references across ${examples} documented examples covering ${demonstrated.size} of ${endpoints.length} published datasets`);
if (problems.length) {
  console.log(`\n### Problems: ${problems.length}`);
  for (const problem of problems) console.log('   ', problem);
  process.exit(1);
}
console.log('Every field named in a documented example exists in the dataset that example fetches.');
