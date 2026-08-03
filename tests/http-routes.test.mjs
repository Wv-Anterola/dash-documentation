import assert from 'node:assert/strict';
import test from 'node:test';
import routes from '../src/data/generated/http-routes.json' with { type: 'json' };
import source from '../src/data/generated/source-modules.json' with { type: 'json' };

const find = (method, path) =>
  routes.routes.find((route) => route.method === method && route.path === path);

test('pins the HTTP inventory to the same integrated source baseline', () => {
  assert.equal(routes.repository.baseline, source.repository.baselineTip);
  assert.ok(routes.routes.length >= 100);
  assert.ok(new Set(routes.routes.map((route) => route.group)).size >= 15);
  assert.ok(routes.methodology.supervisedCandidateFiles >= 1);
  assert.ok(routes.methodology.directCandidateFiles >= 1);
  assert.deepEqual(routes.methodology.directOwnerNames, ['app', 'server']);
  for (const route of routes.routes) {
    assert.match(route.source.url, new RegExp(`/blob/${routes.repository.baseline}/`));
    assert.ok(route.source.url.endsWith(`#L${route.source.line}`));
  }
});

test('recomputes route summary and duplicate registrations exactly', () => {
  const counts = new Map();
  for (const route of routes.routes) {
    const key = `${route.method} ${route.path}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const duplicates = [...counts]
    .filter(([, count]) => count > 1)
    .map(([key]) => key)
    .sort();

  assert.deepEqual([...routes.duplicateMethodPaths].sort(), duplicates);
  assert.deepEqual(routes.summary, {
    routes: routes.routes.length,
    supervised: routes.routes.filter((route) => route.layer === 'supervised').length,
    direct: routes.routes.filter((route) => route.layer === 'direct-express').length,
    public: routes.routes.filter((route) => route.access.includes('public')).length,
    admin: routes.routes.filter((route) => route.access === 'admin-in-release').length,
    duplicateMethodPaths: duplicates.length,
  });
});

test('preserves high-impact access paths and request inputs', () => {
  const saveTool = find('POST', '/saveDynamicTool');
  assert.equal(saveTool?.layer, 'direct-express');
  assert.equal(saveTool?.access, 'direct-no-route-manager');
  assert.deepEqual(saveTool?.inputs.body, ['toolCode', 'toolName']);

  assert.equal(find('GET', '/getDynamicTools')?.access, 'direct-no-route-manager');
  assert.equal(find('GET', '/getDynamicTool/:toolName')?.access, 'direct-no-route-manager');
  assert.equal(find('GET', '/delete')?.access, 'admin-in-release');
  assert.equal(find('GET', '/delete/:target')?.access, 'admin-in-release');
  assert.equal(find('GET', '/resolvedPorts')?.access, 'session-or-public-handler');
  assert.deepEqual(find('POST', '/proxyFetch')?.inputs.body, ['url']);
});
