import { readFile, readdir } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const roots = [
  'src',
  'scripts',
  'tests',
  'README.md',
  'astro.config.mjs',
  'playwright.config.mjs',
  'package.json',
  'CITATION.cff',
];
const textExtensions = new Set([
  '.astro', '.cff', '.css', '.js', '.jsx', '.json', '.md', '.mdx', '.mjs', '.py', '.ts', '.tsx',
]);
const mojibake = /[\uFFFD\u00C2]|\u00E2[^\s]/u;
const ignored = new Set([
  'src/data/generated/branch-audit.json',
  'src/data/generated/source-inventory.json',
  'src/data/generated/source-reference.json',
  'src/data/generated/source-modules.json',
  'src/data/generated/semantic-branches.json',
  'src/data/generated/historical-symbols.json',
  'src/data/generated/typedoc-api.json',
]);

async function walk(path) {
  const entries = await readdir(path, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (['node_modules', 'dist', '.astro'].includes(entry.name)) continue;
    const full = join(path, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else files.push(full);
  }
  return files;
}

const files = [];
for (const target of roots) {
  const full = join(root, target);
  if (extname(full)) files.push(full);
  else files.push(...await walk(full));
}

const failures = [];
for (const file of files) {
  const name = relative(root, file).replaceAll('\\', '/');
  if (!textExtensions.has(extname(file).toLowerCase()) || ignored.has(name)) continue;
  const text = await readFile(file, 'utf8');
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (mojibake.test(line)) failures.push({ name, line: index + 1, text: line.trim() });
  }
}

if (failures.length) {
  console.error(`Encoding validation found ${failures.length} mojibake/replacement-character lines:`);
  for (const failure of failures.slice(0, 100)) {
    console.error(`  ${failure.name}:${failure.line}  ${failure.text}`);
  }
  if (failures.length > 100) console.error(`  ... and ${failures.length - 100} more`);
  process.exitCode = 1;
} else {
  console.log(`Encoding validation passed for ${files.length} repository text files.`);
}
