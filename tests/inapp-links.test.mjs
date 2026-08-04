import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import links from '../src/data/generated/inapp-doc-links.json' with { type: 'json' };

const reachable = links.links.filter((link) => link.reachable);

test('finds every documentation link the client ships', () => {
  assert.equal(links.summary.links, links.links.length);
  assert.ok(links.links.length >= 18, 'Dash should not silently lose its help links');
  assert.equal(links.summary.reachable, reachable.length);
  assert.equal(new Set(links.links.map((link) => link.id)).size, links.links.length);
  assert.ok(links.summary.files >= 7);
});

test('attributes every link to a reviewed surface a user can reach', () => {
  for (const link of links.links) {
    assert.ok(link.surface.length > 0, `${link.source.file}:${link.source.line} has no surface`);
    assert.ok(link.surfacePlain.length >= 20, `${link.surface} has no plain explanation`);
    assert.match(link.source.url, /\/blob\/[0-9a-f]{40}\/.*#L\d+$/);
  }
  const surfaces = new Set(links.links.map((link) => link.surface));
  assert.equal(surfaces.size, links.summary.surfaces);
  assert.ok(surfaces.has('Document right-click menu, Help entry'));
});

test('records a URL that only exists inside a comment as unreachable', () => {
  const commented = links.links.filter((link) => !link.reachable);
  assert.ok(commented.length >= 1, 'the parse must not silently drop a commented-out link');
  for (const link of commented) assert.equal(link.owner, 'commented out');
});

test('every reachable link still resolves to a page on this site', () => {
  const broken = reachable.filter((link) => link.status === 'unresolved' || link.status === 'redirect-to-nowhere');
  assert.deepEqual(
    broken.map((link) => `${link.requested} (${link.source.file}:${link.source.line})`),
    [],
    'a help button in Dash now lands nowhere; fix the URL in Dash-Web'
  );
  assert.equal(links.summary.unresolved, 0);
});

test('every fragment a link asks for still exists on the page it lands on', () => {
  const missing = reachable.filter((link) => link.fragmentStatus === 'missing');
  assert.deepEqual(
    missing.map((link) => `${link.requested}#${link.fragment}`),
    [],
    'a help button lands on the right page but a dead anchor'
  );
  assert.equal(links.summary.missingFragments, 0);
  // The two links that carry a fragment are the ones worth protecting.
  const withFragment = reachable.filter((link) => link.fragment);
  assert.ok(withFragment.length >= 4);
  for (const link of withFragment) assert.equal(link.fragmentStatus, 'present');
});

test('resolves targets against the real page list, not a guess', async () => {
  const docsRoot = path.resolve('src/content/docs');
  const routes = new Set();
  const walk = async (dir, prefix = '') => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        await walk(path.join(dir, entry.name), `${prefix}${entry.name}/`);
        continue;
      }
      if (!/\.mdx?$/.test(entry.name)) continue;
      const slug = entry.name.replace(/\.mdx?$/, '').toLowerCase();
      routes.add(slug === 'index' ? `/${prefix}` : `/${prefix}${slug}/`);
    }
  };
  await walk(docsRoot);
  for (const link of reachable) {
    assert.ok(routes.has(link.target), `${link.requested} resolves to ${link.target}, which is not a page`);
    assert.ok(link.targetTitle.length > 0, `${link.target} resolved without a title`);
  }
});

test('separates a route that needs the host to add a trailing slash', () => {
  const needsSlash = reachable.filter((link) => link.status === 'needs-trailing-slash');
  assert.equal(links.summary.needsTrailingSlash, needsSlash.length);
  for (const link of needsSlash) {
    assert.ok(!link.requested.endsWith('/'), `${link.requested} was classified as needing a slash but already has one`);
    assert.ok(link.target.endsWith('/'));
  }
  // The redirect table is the promise these links depend on; if it collapses,
  // most of them stop resolving before any of the checks above notice why.
  assert.ok(links.redirectTableSize >= 50, 'the redirect table that carries these links has shrunk');
});

test('keeps a machine-readable copy of the astro config it resolved against', async () => {
  const config = await readFile(path.resolve('astro.config.mjs'), 'utf8');
  assert.match(config, /trailingSlash: 'always'/, 'the trailing-slash classification assumes this setting');
  assert.match(config, /redirects: {/, 'the resolver reads the redirect table out of this file');
});
