import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyPath,
  parseTypeScriptBlob,
  parseTypeScriptHistoryBlob,
  sourceUrl,
} from '../scripts/lib/source-analysis.mjs';

test('classifies source, tests, config, generated, vendored, data, media, and research artifacts', () => {
  assert.equal(classifyPath('src/client/App.tsx'), 'source');
  assert.equal(classifyPath('test/app.spec.ts'), 'test');
  assert.equal(classifyPath('webpack.config.mjs'), 'build-config');
  assert.equal(classifyPath('package.json'), 'build-config');
  assert.equal(classifyPath('public/models/weights-manifest.json'), 'data');
  assert.equal(classifyPath('dist/app.js'), 'generated');
  assert.equal(classifyPath('vendor/library.js'), 'vendored');
  assert.equal(classifyPath('fixtures/records.csv'), 'test');
  assert.equal(classifyPath('public/logo.svg'), 'media');
  assert.equal(classifyPath('research/results.bib'), 'research-artifact');
});

test('extracts declarations, docs, enum values, source ranges, imports, and calls semantically', () => {
  const result = parseTypeScriptBlob({
    sha: 'abc',
    path: 'src/example.ts',
    text: [
      "import { helper } from './helper';",
      '/** Public contract. */',
      'export interface Options { value: string }',
      'export enum Mode { One, Two = "two" }',
      'export function run(options: Options): string {',
      '  return helper(options.value);',
      '}',
    ].join('\n'),
  });
  assert.deepEqual(result.imports, ['./helper']);
  assert.equal(result.errors.length, 0);
  assert.equal(result.symbols.find((symbol) => symbol.name === 'Options')?.exported, true);
  assert.equal(result.symbols.find((symbol) => symbol.name === 'value')?.exported, false);
  assert.equal(result.symbols.find((symbol) => symbol.name === 'Options')?.documentation, 'Public contract.');
  assert.deepEqual(result.enums.Mode.map((member) => member.name), ['One', 'Two']);
  assert.equal(result.calls.some((call) => call.from === 'run' && call.to === 'helper'), true);
  assert.equal(result.symbols.find((symbol) => symbol.name === 'run')?.lineStart, 5);
});

test('builds immutable GitHub source URLs with commit and line range', () => {
  assert.equal(
    sourceUrl(
      'git@github.com:brown-dash/Dash-Web.git',
      'e7473b5d1076d5b77f6e580c4367afd8c4958033',
      'src/Import & Export/file.ts',
      12,
      18
    ),
    'https://github.com/brown-dash/Dash-Web/blob/e7473b5d1076d5b77f6e580c4367afd8c4958033/src/Import%20%26%20Export/file.ts#L12-L18'
  );
});

test('extracts historical symbol identity without retaining full call-graph detail', () => {
  const result = parseTypeScriptHistoryBlob({
    sha: 'abc123',
    path: 'src/example.ts',
    text: 'export class Board { move(item: string) { return place(item); } }',
  });

  assert.deepEqual(
    result.symbols.map(({ qualifiedName, kind }) => ({ qualifiedName, kind })),
    [
      { qualifiedName: 'Board', kind: 'class' },
      { qualifiedName: 'Board.move', kind: 'method' },
    ]
  );
  assert.equal(result.errors.length, 0);
  assert.equal('calls' in result, false);
});

test('keeps semantic signatures for branch deltas while omitting canonical graph detail', () => {
  const result = parseTypeScriptBlob({
    sha: 'def456',
    path: 'src/branch.ts',
    mode: 'delta',
    text: '/** Moves a card. */ export function move(card: string) { return place(card); }',
  });

  assert.match(result.symbols[0].signature, /move\(card: string\)/);
  assert.equal(result.symbols[0].documentation, 'Moves a card.');
  assert.deepEqual(result.calls, []);
  assert.deepEqual(result.imports, []);
});
