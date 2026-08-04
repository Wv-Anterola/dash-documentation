import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import index from '../src/data/generated/exported-symbols.json' with { type: 'json' };
import reference from '../src/data/generated/source-modules.json' with { type: 'json' };

const slug = (value) => value
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

const exported = reference.modules.flatMap((module) =>
  module.symbols.filter((symbol) => symbol.exported).map((symbol) => ({ module, symbol }))
);

test('indexes every exported declaration from the semantic source baseline', () => {
  assert.equal(exported.length, 2264);
  assert.equal(exported.length, reference.methodology.exportedSymbolCount);
  assert.equal(index.rows.length, exported.length);
  assert.equal(index.summary.exports, exported.length);
  assert.equal(new Set(exported.map(({ module }) => module.path)).size, 552);
  assert.deepEqual(
    [...new Set(exported.map(({ symbol }) => symbol.kind))].sort(),
    ['class', 'enum', 'function', 'interface', 'method', 'type', 'variable'],
  );

  for (const name of ['CompileScript', 'Doc', 'DocumentType', 'RouteManager']) {
    assert.ok(exported.some(({ symbol }) => symbol.name === name), `${name} is missing from the exported index`);
  }
});

test('gives every module and repeated declaration a collision-safe deep link', () => {
  const moduleSlugs = reference.modules.map((module) => slug(module.path));
  assert.equal(new Set(moduleSlugs).size, moduleSlugs.length);

  for (const module of reference.modules) {
    const counts = new Map();
    const anchors = module.symbols.map((symbol) => {
      const base = slug(symbol.qualifiedName);
      const occurrence = (counts.get(base) ?? 0) + 1;
      counts.set(base, occurrence);
      return occurrence === 1 ? base : `${base}-${occurrence}`;
    });

    assert.ok(anchors.every(Boolean), `${module.path} contains an empty symbol anchor`);
    assert.equal(new Set(anchors).size, anchors.length, `${module.path} contains duplicate symbol anchors`);
  }

  assert.equal(new Set(index.rows.map((row) => row.id)).size, index.rows.length);
  for (const row of index.rows) {
    assert.match(row.contractPath, /^\/technical\/api\/modules\/[a-z0-9-]+\/#[-a-z0-9]+$/);
    assert.ok(row.sourceUrl.includes(reference.repository.baselineTip));
  }
});

test('keeps reviewed, source-described, and declaration-only evidence distinct', async () => {
  const overlaySource = await readFile(new URL('../src/data/symbolOverlays.ts', import.meta.url), 'utf8');
  const reviewedIds = new Set(
    [...overlaySource.matchAll(/^\s{2}'([^']+)':\s*\{/gm)].map((match) => match[1]),
  );
  const reviewed = exported.filter(({ symbol }) => reviewedIds.has(symbol.id));
  const sourceDescribed = exported.filter(({ symbol }) => !reviewedIds.has(symbol.id) && symbol.documentation);
  const declarationOnly = exported.filter(({ symbol }) => !reviewedIds.has(symbol.id) && !symbol.documentation);

  assert.ok(reviewed.length >= 35, 'reviewed exported contracts unexpectedly fell below the established floor');
  assert.ok(sourceDescribed.length > 250, 'source-described exports unexpectedly fell below the established floor');
  assert.equal(reviewed.length + sourceDescribed.length + declarationOnly.length, exported.length);
  assert.ok(declarationOnly.length > 0, 'declaration-only evidence must remain explicit instead of being inferred');
  assert.deepEqual(index.summary, {
    exports: exported.length,
    modules: new Set(exported.map(({ module }) => module.path)).size,
    reviewed: reviewed.length,
    sourceDescribed: sourceDescribed.length,
    declarationOnly: declarationOnly.length,
    kinds: new Set(exported.map(({ symbol }) => symbol.kind)).size,
  });
});
