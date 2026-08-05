/**
 * Reject mojibake anywhere in the repository's text.
 *
 * A file that was written as UTF-8 and read back as Latin-1 does not fail to
 * build; it renders, with an apostrophe turned into three characters. That
 * survives review because it looks like a typo rather than an encoding fault,
 * and it spreads whenever the file is edited again on the machine that caused
 * it.
 *
 * This walks the authored text of the repository and fails on the replacement
 * character and on the byte sequences a UTF-8 to Latin-1 round trip produces.
 * The large generated source archives are exempt: they contain the literal
 * contents of Dash-Web files, including whatever encoding those files carry,
 * and correcting them here would misquote the source.
 *
 *   npm run encoding
 */
import { readFile, readdir } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const roots = [
  'src',
  'scripts',
  'tests',
  'README.md',
  'CONTRIBUTING.md',
  '.github',
  'astro.config.mjs',
  'playwright.config.mjs',
  'package.json',
  'CITATION.cff',
];
const textExtensions = new Set([
  '.astro', '.cff', '.css', '.js', '.jsx', '.json', '.md', '.mdx', '.mjs', '.py', '.ts', '.tsx', '.yml',
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
