import assert from 'node:assert/strict';
import test from 'node:test';
import menus from '../src/data/generated/context-menus.json' with { type: 'json' };
import source from '../src/data/generated/source-reference.json' with { type: 'json' };

const byLabel = (label, surface) => menus.items.find((entry) => entry.label === label && (!surface || entry.surface === surface));
const surfaceOf = (id) => menus.surfaces.find((entry) => entry.id === id);

test('pins the menu atlas to the integrated source baseline', () => {
  assert.equal(menus.repository.baseline, source.repository.baselineTip);
  assert.equal(menus.summary.entries, menus.items.length);
  assert.ok(menus.summary.entries >= 200);
  assert.ok(menus.summary.surfaces >= 8);
  assert.ok(menus.summary.contributingFiles >= 25);
  assert.equal(new Set(menus.items.map((entry) => entry.id)).size, menus.items.length);
  assert.equal(
    menus.summary.literalLabels + menus.summary.statefulLabels + menus.summary.generatedLabels,
    menus.items.length
  );
});

test('keeps every entry readable and source-auditable', () => {
  const sourceModules = new Set(source.modules.map((module) => module.path));
  for (const item of menus.items) {
    assert.ok(item.id && item.label && item.surface && item.surfaceName);
    assert.ok(['literal', 'stateful', 'generated'].includes(item.labelKind), `${item.id} has an unclassified label kind`);
    assert.ok(['action', 'group', 'label'].includes(item.kind), `${item.id} has an unclassified entry kind`);
    assert.ok(item.plain.length >= 20, `${item.id} lacks a plain explanation`);
    assert.ok(item.availability.length >= 20, `${item.id} lacks an availability contract`);
    assert.ok(item.interaction.length >= 12, `${item.id} lacks an interaction contract`);
    assert.ok(item.undoNote.length >= 20, `${item.id} lacks an undo statement`);
    assert.ok(item.handler.stateOwner, `${item.id} lacks a state owner`);
    assert.ok(sourceModules.has(item.source.file), `${item.id} points outside the generated source inventory`);
    assert.match(item.source.url, new RegExp(`/blob/${menus.repository.baseline}/`));
    assert.match(item.source.url, /#L\d+$/);
  }
});

test('reconstructs submenu nesting across both registration idioms', () => {
  // Inline `subitems: [...]` nesting.
  assert.equal(byLabel('Notetaking', 'collection').parent, 'Add a Perspective...');
  // Deferred `const zorderItems = zorders?.subitems ?? []; zorderItems.push(...)` nesting.
  assert.equal(byLabel('Send to Back', 'document').parent, 'Z Order...');
  assert.equal(byLabel('Bring to Front', 'document').parent, 'Z Order...');
  // Nesting recovered through a findByDescription lookup in another component.
  assert.equal(byLabel('Export Image Hierarchy', 'collection').parent, 'More...');

  assert.ok(menus.summary.nested >= 150);
  for (const item of menus.items) {
    if (!item.parent) continue;
    assert.ok(menus.items.some((entry) => entry.label === item.parent && entry.kind === 'group'), `${item.id} nests under an unregistered group`);
  }
});

test('classifies labels by how they are produced', () => {
  const chrome = menus.items.find((entry) => entry.labelVariants.includes('Show Chrome') && entry.labelVariants.includes('Hide Chrome'));
  assert.ok(chrome, 'lost the Show/Hide Chrome state-dependent label');
  assert.equal(chrome.labelKind, 'stateful');

  const generated = menus.items.filter((entry) => entry.labelKind === 'generated');
  assert.ok(generated.length >= 5);
  for (const item of generated) {
    assert.ok(item.labelExpression, `${item.id} claims a generated label without recording its expression`);
  }

  for (const item of menus.items.filter((entry) => entry.labelKind === 'literal')) {
    assert.equal(item.labelVariants.length, 0, `${item.id} is fixed but carries variants`);
  }
});

test('records the guards that decide whether an entry is contributed', () => {
  assert.ok(menus.summary.guarded >= 140);
  const novice = menus.items.filter((entry) => entry.guards.some((guard) => guard.includes('noviceMode')));
  assert.ok(novice.length >= 40, 'lost the Novice/Developer mode guard evidence');
  for (const item of novice) assert.match(item.availability, /(Developer|Novice) mode is on/);

  const clusters = byLabel('Hide Clusters', 'collection');
  assert.ok(clusters);
  assert.deepEqual(clusters.guards, ['!Doc.noviceMode']);
});

test('proves the menu is composed cooperatively rather than declared once', () => {
  const options = menus.cooperativeGroups.find((group) => group.group === 'Options...');
  assert.ok(options);
  assert.ok(options.contributors.length >= 15, 'Options... is the widest rendezvous point in the menu');
  for (const group of ['Appearance...', 'More...', 'OnClick...', 'Help...']) {
    const record = menus.cooperativeGroups.find((entry) => entry.group === group);
    assert.ok(record && record.contributors.length >= 3, `${group} is no longer built by three or more components`);
  }
});

test('states undo honestly instead of implying coverage', () => {
  // ContextMenuProps declares an `undoable` flag that no Dash entry sets; the
  // reversible entries are the ones whose own handler opens a batch.
  assert.equal(menus.summary.undoablePropUsed, 0);
  assert.ok(menus.summary.undoable >= 5);
  for (const item of menus.items) {
    assert.equal(item.undoable, /\b(undoable|UndoManager\.RunInBatch|UndoManager\.StartBatch|UndoBatch)\b/.test(item.eventExpression));
  }
});

test('covers every menu surface a person can actually open', () => {
  for (const id of ['document', 'collection', 'schema', 'column', 'dashboard', 'renderer', 'ink']) {
    const surface = surfaceOf(id);
    assert.ok(surface, `Missing menu surface ${id}`);
    assert.ok(surface.entries > 0, `Menu surface ${id} lost every traced entry`);
    assert.ok(surface.gesture.length >= 20, `Menu surface ${id} does not say how it is opened`);
    assert.ok(surface.contributors.length >= 1);
  }
  assert.ok(surfaceOf('renderer').contributors.length >= 12, 'type-specific renderers are the widest menu contributor set');
  assert.ok(byLabel('Enter Portal', 'document'));
  assert.ok(byLabel('Delete Dashboard (disabled)', 'dashboard'));
});
