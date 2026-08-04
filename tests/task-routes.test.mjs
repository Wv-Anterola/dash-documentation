import assert from 'node:assert/strict';
import test from 'node:test';
import controls from '../src/data/generated/interface-controls.json' with { type: 'json' };
import menus from '../src/data/generated/context-menus.json' with { type: 'json' };
import shortcuts from '../src/data/generated/keyboard-shortcuts.json' with { type: 'json' };
import routes from '../src/data/generated/task-routes.json' with { type: 'json' };

const task = (id) => routes.tasks.find((entry) => entry.id === id);
const anchorOf = (route) => route.anchor;

test('keeps a usable number of everyday tasks', () => {
  assert.equal(routes.summary.tasks, routes.tasks.length);
  assert.ok(routes.tasks.length >= 12);
  assert.equal(new Set(routes.tasks.map((entry) => entry.id)).size, routes.tasks.length);
  assert.ok(routes.summary.tasksWithThreeKinds >= 2, 'at least a few tasks should be reachable all three ways');
});

test('every route still resolves in the inventory it points at', () => {
  const controlIds = new Set(controls.controls.map((row) => `control-${row.id}`));
  const menuIds = new Set(menus.items.map((row) => `menu-${row.id}`));
  const shortcutIds = new Set(shortcuts.shortcuts.map((row) => `shortcut-${row.id}`));

  for (const entry of routes.tasks) {
    assert.ok(entry.routes.length >= 2, `${entry.id} needs at least two routes to be worth listing`);
    for (const route of entry.routes) {
      const anchor = anchorOf(route);
      const known = route.kind === 'control' ? controlIds : route.kind === 'menu' ? menuIds : shortcutIds;
      assert.ok(known.has(anchor), `${entry.id}: ${route.label} points at a missing ${route.kind} entry`);
      assert.ok(route.plain && route.where, `${entry.id}: ${route.label} lost its explanation or location`);
      assert.match(route.source, /\/blob\/[0-9a-f]{40}\/.*#L\d+$/);
    }
  }
});

test('carries the reviewed explanation of each route, not just a link', () => {
  for (const entry of routes.tasks) {
    assert.ok(entry.intent.length >= 10, `${entry.id} lacks a readable intent`);
    assert.ok(entry.plain.length >= 30, `${entry.id} lacks a plain explanation`);
  }
  assert.ok(routes.summary.tasksWithCaution >= 8, 'most multi-route tasks have a real difference worth stating');
});

test('states the differences that make routes non-equivalent', () => {
  // These three are the confusions the page exists to prevent.
  assert.match(task('remove-from-view').plain, /not deleting/i);
  assert.match(task('group-documents').caution, /collection/i);
  assert.match(task('export-something').caution, /identifier string|__Dash/);
});

test('shows both platform chords wherever they differ', () => {
  const shortcutRoutes = routes.tasks.flatMap((entry) => entry.routes.filter((route) => route.kind === 'shortcut'));
  assert.ok(shortcutRoutes.length >= 15);
  for (const route of shortcutRoutes) {
    assert.ok(route.macLabel, `${route.label} has no macOS chord`);
  }
  const search = task('find-something').routes.find((route) => route.kind === 'shortcut');
  assert.equal(search.label, 'Ctrl + F');
  assert.equal(search.macLabel, 'Cmd + F');
  assert.match(task('find-something').caution, /Cmd \+ F/);
});
