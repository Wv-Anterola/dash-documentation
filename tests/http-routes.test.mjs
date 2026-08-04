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
    groups: routes.groups.length,
    documented: routes.routes.filter((route) => route.docComment).length,
    withCalls: routes.routes.filter((route) => route.calls.length).length,
    touchDatabase: routes.routes.filter((route) => route.effects.database).length,
    touchFilesystem: routes.routes.filter((route) => route.effects.filesystem).length,
    reachOutward: routes.routes.filter((route) => route.effects.network || route.effects.externalModel).length,
    runProcesses: routes.routes.filter((route) => route.effects.process).length,
  });
});

test('explains every route family and leaves no purpose without routes', () => {
  const present = new Set(routes.routes.map((route) => route.group));
  assert.equal(routes.groups.length, present.size);
  for (const family of routes.groups) {
    assert.ok(present.has(family.name), `${family.name} has a purpose but no routes`);
    assert.ok(family.purpose.length >= 40, `${family.name} has no usable purpose`);
    assert.equal(family.routes, routes.routes.filter((route) => route.group === family.name).length);
    assert.ok(family.files.length >= 1);
  }
});

test('recovers what a route author wrote rather than inventing it', () => {
  // A third of the registrations carry a comment. The rest genuinely do not,
  // and an empty string is the honest record of that.
  const documented = routes.routes.filter((route) => route.docComment);
  assert.ok(documented.length >= 30, `only ${documented.length} routes carry a recovered comment`);
  assert.ok(documented.length < routes.routes.length, 'if every route is documented now, raise this expectation');
  for (const route of documented) {
    assert.ok(route.docComment.length <= 600);
    assert.ok(!route.docComment.includes('*/'), `${route.path} kept its comment delimiters`);
    assert.ok(!/^\s*@/.test(route.docComment), `${route.path} leads with a tag line rather than prose`);
  }
});

test('classifies side effects from the handler, not from the path', () => {
  const destructive = find('GET', '/delete/:target');
  assert.equal(destructive.effects.database, true, 'the delete route drops schemas');
  assert.equal(destructive.effects.filesystem, true, 'the delete route removes the files directory');
  assert.ok(destructive.calls.includes('Database.Instance.dropSchema'));
  assert.ok(destructive.calls.includes('WebSocket.doDelete'));

  // Control lines: a route that only reads should not be marked as writing.
  const version = find('GET', '/version');
  assert.equal(version.effects.database, false);
  assert.equal(version.effects.network, false);

  for (const route of routes.routes) {
    assert.equal(Object.keys(route.effects).length, 5);
    for (const value of Object.values(route.effects)) assert.equal(typeof value, 'boolean');
    // Control-flow keywords are not calls and must never appear as evidence.
    for (const call of route.calls) {
      assert.ok(!['switch', 'while', 'async', 'await', 'function', 'catch', 'if', 'for'].includes(call), `${route.path} lists \`${call}\` as a call`);
    }
  }
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
