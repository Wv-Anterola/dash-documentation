import assert from 'node:assert/strict';
import test from 'node:test';
import keyboard from '../src/data/generated/keyboard-shortcuts.json' with { type: 'json' };
import source from '../src/data/generated/source-reference.json' with { type: 'json' };

const byChord = (chord, scope) => keyboard.shortcuts.find((row) => row.chordOther === chord && (!scope || row.scope === scope));
const routeFor = (handler) => keyboard.platformRouting.routes.find((route) => route.handler === handler);

test('pins the shortcut reference to the integrated source baseline', () => {
  assert.equal(keyboard.repository.baseline, source.repository.baselineTip);
  assert.equal(keyboard.summary.shortcuts, keyboard.shortcuts.length);
  assert.ok(keyboard.summary.shortcuts >= 50);
  assert.equal(keyboard.summary.scopes, 3);
  assert.equal(new Set(keyboard.shortcuts.map((row) => row.id)).size, keyboard.shortcuts.length);
});

test('keeps every shortcut readable and source-auditable', () => {
  const sourceModules = new Set(source.modules.map((module) => module.path));
  for (const row of keyboard.shortcuts) {
    assert.ok(row.chordMac && row.chordOther, `${row.id} lacks a chord for one platform`);
    assert.ok(row.plain.length >= 20, `${row.id} lacks a plain explanation`);
    assert.ok(row.browserDefault, `${row.id} does not say what happens to the browser default`);
    assert.ok(['global', 'freeform-canvas', 'marquee-selection'].includes(row.scope));
    assert.ok(sourceModules.has(row.source.file), `${row.id} points outside the generated source inventory`);
    assert.match(row.source.url, new RegExp(`/blob/${keyboard.repository.baseline}/`));
    assert.match(row.source.url, /#L\d+$/);
  }
});

test('decodes the four-bit modifier router, including the macOS branch', () => {
  assert.deepEqual(keyboard.platformRouting.bitOrder, ['Shift', 'Ctrl', 'Alt', 'Cmd']);
  assert.equal(keyboard.summary.routedModifierCombinations, 5);

  assert.deepEqual(routeFor('unmodified').macModifiers, []);
  assert.deepEqual(routeFor('ctrl').otherModifiers, ['Ctrl']);
  assert.deepEqual(routeFor('ctrl').macModifiers, ['Cmd']);
  assert.deepEqual(routeFor('ctrl_shift').otherModifiers, ['Shift', 'Ctrl']);
  assert.deepEqual(routeFor('ctrl_shift').macModifiers, ['Shift', 'Cmd']);
  assert.deepEqual(routeFor('shift').macModifiers, ['Shift']);

  // The finding the page is built on: macOS routes the Control key to the Alt
  // handler, and leaves the Option key unrouted entirely.
  assert.deepEqual(routeFor('alt').otherModifiers, ['Alt']);
  assert.deepEqual(routeFor('alt').macModifiers, ['Ctrl']);
  assert.ok(keyboard.platformRouting.unroutedMac.includes('0010'), 'macOS Option-alone must remain unrouted');
  assert.equal(keyboard.summary.platformDivergentHandlers, 3);
  assert.equal(keyboard.summary.unroutedModifierCombinationsMac, 11);
});

test('separates the same letter under different modifiers', () => {
  const search = byChord('Ctrl + F', 'global');
  const float = byChord('Alt + F', 'global');
  assert.ok(search && float);
  assert.match(search.plain, /search/i);
  assert.match(float.plain, /float/i);
  // On macOS these become Cmd+F and Ctrl+F, which is why they must not share text.
  assert.equal(search.chordMac, 'Cmd + F');
  assert.equal(float.chordMac, 'Ctrl + F');

  const undo = byChord('Ctrl + Z', 'global');
  const redo = byChord('Shift + Ctrl + Z', 'global');
  assert.match(undo.plain, /Undoes/);
  assert.match(redo.plain, /Redoes/);
});

test('records fall-through cases and keeps their shared body', () => {
  const collect = byChord('C', 'marquee-selection');
  const stack = byChord('T', 'marquee-selection');
  assert.ok(collect && stack, 'the c/t fall-through pair must both be listed');
  // `case 'c': case 't':` share one body, so both rows must carry it and point at it.
  assert.equal(collect.effect, stack.effect);
  assert.equal(collect.source.line, stack.source.line);
  assert.ok(collect.effect.includes('collection('));

  const del = byChord('Delete', 'marquee-selection');
  const back = byChord('Backspace', 'marquee-selection');
  assert.ok(del && back);
  assert.equal(del.effect, back.effect);
});

test('states whether Dash takes a chord away from the browser', () => {
  assert.ok(keyboard.summary.blocksBrowserDefault >= 20);
  const reload = byChord('Ctrl + R', 'global');
  assert.equal(reload.eventControl.preventDefault, false);
  assert.match(reload.browserDefault, /browser default still runs/);

  const paste = byChord('Ctrl + V', 'global');
  assert.equal(paste.eventControl.preventDefault, false);

  for (const row of keyboard.shortcuts) {
    assert.equal(row.eventControl.preventDefault, row.browserDefault.startsWith('Dash blocks'), `${row.id} states a browser default that contradicts its preventDefault`);
  }
});

test('marks claimed-but-inert cases instead of hiding them', () => {
  assert.equal(keyboard.summary.reservedButEmpty, 2);
  for (const row of keyboard.shortcuts.filter((entry) => entry.empty)) {
    assert.match(row.plain, /inert/);
  }
  assert.ok(byChord('Space', 'global').empty, 'Space is a commented-out case and must stay flagged');
  assert.ok(byChord('Enter', 'global').empty, 'Enter is a commented-out case and must stay flagged');
});

test('covers the canvas fallback branch that swallows ordinary typing', () => {
  const fallback = keyboard.shortcuts.find((row) => row.key === '(any other printable key)');
  assert.ok(fallback, 'the typing-starts-a-note branch must be documented');
  assert.equal(fallback.scope, 'freeform-canvas');
  assert.match(fallback.plain, /text note/);
});
