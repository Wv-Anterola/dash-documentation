/**
 * Describe this repository's own build pipeline, from its own files.
 *
 * There are eighteen generators, eight checks, nineteen unit test files, and
 * twenty-one committed datasets. Someone arriving at that has to read all of it
 * to learn which script produces the file a failing check is complaining about.
 * A hand-written map of the same thing would be wrong within a month.
 *
 * So this derives the map instead: each script's own header comment for what it
 * is, its imports and writes for what it consumes and produces, the dataset
 * manifest for which page renders it, package.json for the command that runs it
 * and whether that command is part of the gate, and the test files for what
 * asserts it.
 *
 * Drift rule: generation fails when a script cannot be run by any npm command,
 * when a script has no header comment explaining itself, or when a check is not
 * reachable from `verify` and is not declared as running on a schedule. Each of
 * those is a way for this repository to grow a part nobody can find.
 *
 *   node scripts/build-pipeline-map.mjs
 */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scriptsRoot = path.join(root, 'scripts');
const testsRoot = path.join(root, 'tests');
const manifestPath = path.join(root, 'src', 'pages', 'assets', 'data', 'index.json.ts');
const outputPath = path.join(root, 'src', 'data', 'generated', 'pipeline-map.json');

/**
 * Checks that deliberately sit outside `verify`, with the reason. A check kept
 * off the push path is a decision, not an oversight, and it has to be written
 * down somewhere that fails when it stops being true.
 */
const scheduled = {
  'links:external': 'Weekly, via .github/workflows/link-rot.yml. It probes other people\'s servers, and a push that fails because a university page was briefly down teaches everyone to ignore a red build.',
};

/** First paragraph of a file's leading block comment, unwrapped into a sentence. */
const headerSummary = (source) => {
  const block = /^\/\*\*([\s\S]*?)\*\//.exec(source.trimStart());
  if (!block) return '';
  const lines = block[1]
    .split('\n')
    .map((line) => line.replace(/^\s*\*\s?/, '').trimEnd());
  const paragraph = [];
  for (const line of lines) {
    if (!line.trim()) {
      if (paragraph.length) break;
      continue;
    }
    paragraph.push(line.trim());
  }
  return paragraph.join(' ').trim();
};

/**
 * Drop comment lines before looking for dataset names.
 *
 * This generator reads scripts, and scripts explain themselves in prose that
 * names the files they touch. Without this it read its own header comment and
 * reported a dataset called `x`.
 */
const withoutComments = (source) =>
  source
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\/?\*)/.test(line))
    .join('\n');

/** Generated datasets a script reads, however it reaches them. */
const datasetsRead = (source) => {
  const names = new Set();
  for (const match of source.matchAll(/data\/generated\/([a-z-]+)\.json/g)) names.add(match[1]);
  for (const match of source.matchAll(/path\.join\(generated,\s*'([a-z-]+)\.json'/g)) names.add(match[1]);
  // The joined form, used where a script builds its input path rather than
  // importing it. Whatever the script writes is subtracted by the caller.
  for (const match of source.matchAll(/'generated',\s*'([a-z-]+)\.json'/g)) names.add(match[1]);
  return names;
};

/**
 * Generated datasets a script writes.
 *
 * Resolved through the binding rather than off the path, because the same
 * expression shape is used for inputs and outputs: one generator computes a
 * path to a dataset it reads and a path to the one it produces on adjacent
 * lines. A dataset counts as written only when the variable holding its path is
 * handed to a write call.
 */
const datasetsWritten = (source) => {
  const bindings = new Map();
  const pathBinding = /const (\w+)\s*=\s*(?:path\.)?(?:join|resolve)\([^\n]*?'([a-z-]+)\.json'\s*\)/g;
  for (const match of source.matchAll(pathBinding)) {
    const [line, name, dataset] = [match[0], match[1], match[2]];
    if (/'generated'|\bgenerated,|\boutputRoot\b/.test(line)) bindings.set(name, dataset);
  }
  const names = new Set();
  for (const [name, dataset] of bindings) {
    // Not every producer calls writeFile: the TypeDoc wrapper hands its path to
    // the library, which emits the file itself.
    if (new RegExp(`(?:write|generate|emit)\\w*\\(\\s*(?:[^)]*?,\\s*)?${name}\\b`, 'i').test(source)) names.add(dataset);
  }
  return names;
};

const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const npmScripts = packageJson.scripts;

/** Every npm command whose body eventually runs this script file. */
const commandsRunning = (file) =>
  Object.entries(npmScripts)
    .filter(([, body]) => body.includes(`scripts/${file}`))
    .map(([name]) => name);

/** Expand an npm script through its `npm run` references. */
const reachableFrom = (name, seen = new Set()) => {
  if (seen.has(name)) return seen;
  seen.add(name);
  for (const match of (npmScripts[name] ?? '').matchAll(/npm run ([a-z:-]+)/g)) reachableFrom(match[1], seen);
  return seen;
};
const verifyChain = reachableFrom('verify');
const preflightChain = reachableFrom('preflight');

const testFiles = (await readdir(testsRoot)).filter((name) => name.endsWith('.test.mjs'));
const testSources = new Map();
for (const name of testFiles) testSources.set(name, await readFile(path.join(testsRoot, name), 'utf8'));

/** Test files that read a given dataset. */
const testsCovering = (datasets) =>
  testFiles
    .filter((name) => [...datasets].some((dataset) => testSources.get(name).includes(`generated/${dataset}.json`)))
    .sort();

/**
 * The dataset manifest already records which page renders each dataset and
 * which command regenerates it. Reading it here rather than restating it keeps
 * one answer to that question.
 */
const manifestSource = await readFile(manifestPath, 'utf8');
const publishedByDataset = new Map();
for (const entry of manifestSource.matchAll(/\{\s*\n\s*id: '([^']+)',([\s\S]*?)\n  \},/g)) {
  const body = entry[2];
  const field = (key) => new RegExp(`${key}: '([^']*)'`).exec(body)?.[1];
  publishedByDataset.set(field('path')?.replace(/^.*\/([a-z-]+)\.json$/, '$1') ?? entry[1], {
    id: entry[1],
    title: field('title'),
    page: field('page'),
    endpoint: field('path'),
  });
}

const files = (await readdir(scriptsRoot)).filter((name) => name.endsWith('.mjs')).sort();
const generators = [];
const checks = [];
const problems = [];

for (const file of files) {
  const source = await readFile(path.join(scriptsRoot, file), 'utf8');
  const summary = headerSummary(source);
  const commands = commandsRunning(file);

  if (!summary) problems.push(`scripts/${file} has no header comment saying what it is for`);
  if (!commands.length) problems.push(`scripts/${file} cannot be run by any npm command, so nobody will find it`);

  if (file.startsWith('build-')) {
    const code = withoutComments(source);
    const writes = [...datasetsWritten(code)].sort();
    const reads = [...datasetsRead(code)].filter((name) => !writes.includes(name)).sort();
    const published = writes.map((name) => publishedByDataset.get(name)).filter(Boolean);
    generators.push({
      script: `scripts/${file}`,
      command: commands.find((name) => name.startsWith('audit:')) ?? commands[0],
      allCommands: commands.sort(),
      summary,
      reads,
      writes,
      publishedAs: published.map((entry) => ({ page: entry.page, endpoint: entry.endpoint, title: entry.title })),
      tests: testsCovering(new Set(writes)),
    });
    continue;
  }

  if (file.startsWith('check-')) {
    const command = commands[0];
    const runsIn = preflightChain.has(command)
      ? 'preflight'
      : verifyChain.has(command)
        ? 'verify'
        : scheduled[command]
          ? 'scheduled'
          : 'nothing';
    if (runsIn === 'nothing') {
      problems.push(`scripts/${file} runs as \`npm run ${command}\` but nothing runs that command, so it checks nothing`);
    }
    checks.push({
      script: `scripts/${file}`,
      command,
      summary,
      runsIn,
      note: scheduled[command] ?? null,
      needsBuild: verifyChain.has(command) && !preflightChain.has(command),
    });
  }
}

/**
 * The map is only worth reading if it matches the repository. A dataset the map
 * claims but that is not on disk means the parsing above went wrong; a dataset
 * on disk that no generator claims means something writes into the generated
 * directory by a route this cannot see, and the map would quietly under-report
 * it.
 */
/**
 * `audit:all` is the one command that regenerates everything, and it is a
 * hand-written chain. A generator placed in it before the one it reads from
 * silently produces a dataset from stale input, which no later check can see.
 * Comparing the chain against the dependency graph is what stops that.
 */
const chain = [...(npmScripts['audit:all'] ?? '').matchAll(/npm run ([a-z:-]+)/g)].map((match) => match[1]);
const positionOf = new Map(chain.map((name, index) => [name, index]));
for (const generator of generators) {
  if (!generator.command.startsWith('audit:')) continue;
  if (!positionOf.has(generator.command)) {
    problems.push(`\`npm run ${generator.command}\` is not in the audit:all chain, so a full regeneration skips it`);
    continue;
  }
  for (const dataset of generator.reads) {
    const upstream = generators.find((entry) => entry.writes.includes(dataset));
    if (!upstream || upstream === generator || !positionOf.has(upstream.command)) continue;
    if (positionOf.get(upstream.command) > positionOf.get(generator.command)) {
      problems.push(
        `audit:all runs ${generator.command} before ${upstream.command}, but ${generator.command} reads ${dataset}.json, which ${upstream.command} writes`
      );
    }
  }
}

const claimed = new Set(generators.flatMap((entry) => entry.writes));
const onDisk = (await readdir(path.join(root, 'src', 'data', 'generated')))
  .filter((name) => name.endsWith('.json'))
  .map((name) => name.replace(/\.json$/, ''));
for (const name of claimed) {
  if (!onDisk.includes(name)) problems.push(`the map claims a dataset ${name}.json that is not in src/data/generated/`);
}
for (const name of onDisk) {
  if (!claimed.has(name)) problems.push(`src/data/generated/${name}.json is committed but no generator claims to write it`);
}

if (problems.length) {
  console.error('Pipeline map cannot be built:');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

/**
 * How deep each generator sits in the dependency graph, so the map can say what
 * order to run things in rather than leaving a reader to work it out from
 * nineteen sets of imports. Stage 1 reads only Dash-Web; everything else waits
 * for the datasets it consumes.
 */
const producerOf = new Map();
for (const generator of generators) for (const dataset of generator.writes) producerOf.set(dataset, generator);
const depthOf = (generator, seen = new Set()) => {
  if (seen.has(generator.script)) return 0; // A cycle would be a bug, not a stage.
  seen.add(generator.script);
  const upstream = generator.reads.map((dataset) => producerOf.get(dataset)).filter((entry) => entry && entry !== generator);
  return upstream.length ? 1 + Math.max(...upstream.map((entry) => depthOf(entry, new Set(seen)))) : 0;
};
for (const generator of generators) generator.stage = depthOf(generator) + 1;

const output = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  methodology: {
    derivedFrom:
      'The scripts, tests, dataset manifest, and package.json in this repository. Each script contributes its own header comment, its imports and writes, and the npm command that runs it.',
    driftRule:
      'Generation fails when a script cannot be run by any npm command, when a script has no header comment, or when a check is reachable from neither `verify` nor the scheduled list.',
    scheduledChecks: Object.keys(scheduled),
  },
  summary: {
    generators: generators.length,
    checks: checks.length,
    datasets: new Set(generators.flatMap((entry) => entry.writes)).size,
    publishedDatasets: generators.reduce((total, entry) => total + entry.publishedAs.length, 0),
    testFiles: testFiles.length,
    checksInPreflight: checks.filter((entry) => entry.runsIn === 'preflight').length,
    checksNeedingBuild: checks.filter((entry) => entry.needsBuild).length,
    generatorsWithoutTest: generators.filter((entry) => !entry.tests.length).length,
  },
  generators,
  checks,
};

await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(
  `Mapped ${generators.length} generators producing ${output.summary.datasets} datasets ` +
    `(${output.summary.publishedDatasets} published as endpoints), ${checks.length} checks ` +
    `(${output.summary.checksInPreflight} needing no build), and ${testFiles.length} unit test files. ` +
    `${output.summary.generatorsWithoutTest} generators have no test that reads their output.`
);
