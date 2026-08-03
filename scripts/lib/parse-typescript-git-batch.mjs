/**
 * Parse a bounded batch of Git blobs in a short-lived process.
 *
 * TypeScript's parser keeps internal arenas for the process lifetime. Exiting
 * after each historical batch is the only reliable way to keep a complete
 * 16k-commit audit within a predictable memory envelope.
 */
import { spawnSync } from 'node:child_process';
import { parseTypeScriptBlob, parseTypeScriptHistoryBlob } from './source-analysis.mjs';

const dashRoot = process.argv[2];
if (!dashRoot) throw new Error('Dash repository path argument is required.');
process.stdin.setEncoding('utf8');
let input = '';
for await (const chunk of process.stdin) input += chunk;
const rows = input.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));

const child = spawnSync(
  'git',
  ['-c', `safe.directory=${dashRoot.replaceAll('\\', '/')}`, 'cat-file', '--batch'],
  {
    cwd: dashRoot,
    input: `${rows.map((row) => row.sha).join('\n')}\n`,
    encoding: null,
    maxBuffer: 1024 * 1024 * 1024,
    windowsHide: true,
  }
);
if (child.status !== 0) throw new Error(child.stderr?.toString('utf8') || 'git cat-file failed');

const blobs = new Map();
let offset = 0;
while (offset < child.stdout.length) {
  const headerEnd = child.stdout.indexOf(10, offset);
  if (headerEnd < 0) break;
  const header = child.stdout.subarray(offset, headerEnd).toString('utf8');
  offset = headerEnd + 1;
  const match = header.match(/^([0-9a-f]+)\s+blob\s+(\d+)$/);
  if (!match) throw new Error(`Unexpected cat-file header: ${header}`);
  const size = Number(match[2]);
  blobs.set(match[1], child.stdout.subarray(offset, offset + size).toString('utf8'));
  offset += size + 1;
}

for (const row of rows) {
  const parser = row.mode === 'history' ? parseTypeScriptHistoryBlob : parseTypeScriptBlob;
  const analysis = parser({ ...row, text: blobs.get(row.sha) });
  process.stdout.write(`${JSON.stringify({
    sha: analysis.sha,
    path: analysis.path,
    symbols: analysis.symbols,
    errors: analysis.errors,
    diagnostics: analysis.diagnostics,
  })}\n`);
}
