import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve('src');
const endpointDir = path.join(root, 'pages', 'assets', 'data');
const generatedDir = path.join(root, 'data', 'generated');

const endpoints = (await readdir(endpointDir))
  .filter((name) => name.endsWith('.json.ts'))
  .map((name) => name.replace(/\.json\.ts$/, ''));
const manifest = await readFile(path.join(endpointDir, 'index.json.ts'), 'utf8');

test('publishes an endpoint for every dataset it advertises, and vice versa', () => {
  const published = endpoints.filter((name) => name !== 'index');
  assert.ok(published.length >= 9, 'the reference datasets should be individually addressable');
  for (const name of published) {
    assert.ok(manifest.includes(`id: '${name}'`), `${name} has an endpoint but is missing from the manifest`);
    assert.ok(manifest.includes(`/assets/data/${name}.json`), `${name} is not addressed in the manifest`);
  }
  const advertised = [...manifest.matchAll(/id: '([^']+)'/g)].map((match) => match[1]);
  for (const id of advertised) {
    assert.ok(published.includes(id), `manifest advertises ${id} with no endpoint behind it`);
  }
});

test('serves every endpoint from a committed generated dataset', async () => {
  const generated = new Set((await readdir(generatedDir)).map((name) => name.replace(/\.json$/, '')));
  for (const name of endpoints.filter((entry) => entry !== 'index')) {
    assert.ok(generated.has(name), `${name} endpoint has no committed dataset`);
    const source = await readFile(path.join(endpointDir, `${name}.json.ts`), 'utf8');
    assert.match(source, /export const prerender = true;/, `${name} endpoint must be prerendered, not server-rendered`);
    assert.match(source, /application\/json/, `${name} endpoint must declare a JSON content type`);
  }
});

test('every published dataset carries an immutable, line-addressable provenance', async () => {
  for (const name of endpoints.filter((entry) => entry !== 'index')) {
    const data = JSON.parse(await readFile(path.join(generatedDir, `${name}.json`), 'utf8'));
    assert.equal(typeof data.schemaVersion, 'number', `${name} has no schema version`);
    // A dataset may measure this site instead of Dash, in which case there is
    // no Dash-Web commit to pin it to and it has to say so in the data rather
    // than simply omit the field.
    if (!data.repository) {
      assert.equal(data.describes, 'this documentation site', `${name} has no repository provenance and does not say what it describes`);
      assert.ok(data.methodology?.derivedFrom, `${name} describes this site but does not say what it was derived from`);
      continue;
    }
    const commit = data.repository.baselineTip ?? data.repository.masterTip ?? data.repository.baseline;
    assert.match(String(commit), /^[0-9a-f]{40}$/, `${name} is not pinned to an immutable commit`);
  }
});
