import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import map from '../src/data/generated/pipeline-map.json' with { type: 'json' };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));

test('accounts for every script in the repository', async () => {
  const files = (await readdir(path.join(root, 'scripts'))).filter((name) => name.endsWith('.mjs'));
  const mapped = new Set([...map.generators, ...map.checks].map((entry) => path.basename(entry.script)));
  for (const file of files) {
    assert.ok(mapped.has(file), `scripts/${file} is missing from the pipeline map`);
  }
  assert.equal(mapped.size, files.length);
});

test('every mapped script can actually be run', () => {
  for (const entry of [...map.generators, ...map.checks]) {
    assert.ok(packageJson.scripts[entry.command], `${entry.script} claims \`npm run ${entry.command}\`, which does not exist`);
  }
});

test('every script explains itself', () => {
  for (const entry of [...map.generators, ...map.checks]) {
    // Long enough to be a sentence about purpose rather than a restated filename.
    assert.ok(entry.summary.length >= 30, `${entry.script} has a summary of only ${entry.summary.length} characters`);
  }
});

test('no check is defined that nothing runs', () => {
  for (const check of map.checks) {
    assert.notEqual(check.runsIn, 'nothing', `npm run ${check.command} is never executed`);
  }
  // The fast half has to stay fast, which means it has to stay build-free.
  for (const check of map.checks.filter((entry) => entry.runsIn === 'preflight')) {
    assert.equal(check.needsBuild, false, `${check.command} is in preflight but needs a build`);
  }
  assert.ok(map.summary.checksInPreflight >= 3, 'preflight has stopped covering the build-free checks');
});

test('stages respect what each generator reads', () => {
  const producerOf = new Map();
  for (const generator of map.generators) {
    for (const dataset of generator.writes) producerOf.set(dataset, generator);
  }
  for (const generator of map.generators) {
    for (const dataset of generator.reads) {
      const upstream = producerOf.get(dataset);
      if (!upstream || upstream === generator) continue;
      assert.ok(
        upstream.stage < generator.stage,
        `${generator.command} is stage ${generator.stage} but reads ${dataset}.json from ${upstream.command} at stage ${upstream.stage}`
      );
    }
  }
});

test('audit:all regenerates everything, in an order that works', () => {
  const chain = [...packageJson.scripts['audit:all'].matchAll(/npm run ([a-z:-]+)/g)].map((match) => match[1]);
  const position = new Map(chain.map((name, index) => [name, index]));
  for (const generator of map.generators) {
    if (!generator.command.startsWith('audit:')) continue;
    assert.ok(position.has(generator.command), `audit:all does not run ${generator.command}`);
  }
  for (const generator of map.generators) {
    for (const dataset of generator.reads) {
      const upstream = map.generators.find((entry) => entry.writes.includes(dataset));
      if (!upstream || upstream === generator) continue;
      if (!position.has(upstream.command) || !position.has(generator.command)) continue;
      assert.ok(
        position.get(upstream.command) < position.get(generator.command),
        `audit:all runs ${generator.command} before ${upstream.command}, which writes the ${dataset}.json it reads`
      );
    }
  }
});

test('published datasets point at pages that exist', async () => {
  const docs = path.join(root, 'src', 'content', 'docs');
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
  const routes = new Set(
    (await walk(docs)).map((file) => {
      const relative = path.relative(docs, file).replaceAll('\\', '/').replace(/\.mdx?$/, '');
      return relative === 'index' ? '/' : `/${relative.replace(/\/index$/, '')}/`;
    })
  );
  for (const generator of map.generators) {
    for (const published of generator.publishedAs) {
      assert.ok(routes.has(published.page), `${generator.command} is published at ${published.page}, which has no page`);
    }
  }
});

test('states what it could not find, rather than implying full coverage', () => {
  assert.equal(typeof map.summary.generatorsWithoutTest, 'number');
  const untested = map.generators.filter((entry) => !entry.tests.length);
  assert.equal(untested.length, map.summary.generatorsWithoutTest);
  assert.ok(map.methodology.driftRule.length > 60);
});
