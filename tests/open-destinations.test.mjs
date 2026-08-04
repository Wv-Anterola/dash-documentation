import assert from 'node:assert/strict';
import test from 'node:test';
import destinations from '../src/data/generated/open-destinations.json' with { type: 'json' };

const where = (member) => destinations.destinations.find((entry) => entry.member === member);
const router = (id) => destinations.routers.find((entry) => entry.id === id);

test('recovers both destination enums in full', () => {
  assert.equal(destinations.summary.destinations, destinations.destinations.length);
  assert.equal(destinations.summary.modifiers, destinations.modifiers.length);
  assert.ok(destinations.destinations.length >= 18, 'OpenWhere should not shrink silently');
  assert.ok(destinations.modifiers.length >= 7);
  assert.equal(new Set(destinations.destinations.map((entry) => entry.id)).size, destinations.destinations.length);
  assert.equal(new Set(destinations.modifiers.map((entry) => entry.id)).size, destinations.modifiers.length);
});

test('every destination carries a reviewed explanation and a real source line', () => {
  for (const entry of [...destinations.destinations, ...destinations.modifiers]) {
    assert.ok(entry.plain.length >= 20, `${entry.member} lacks a plain explanation`);
    assert.match(entry.source.url, /\/blob\/[0-9a-f]{40}\/.*#L\d+$/);
    assert.equal(entry.source.file, 'src/client/views/nodes/OpenWhere.ts');
  }
});

test('splits a destination string into its verb and modifier', () => {
  assert.equal(where('addRight').base, 'add');
  assert.equal(where('addRight').modifier, 'right');
  assert.equal(where('addRightKeyvalue').keyValue, true);
  assert.equal(where('addRightKeyvalue').base, 'add');
  assert.equal(where('lightboxAlways').modifier, 'always');
  assert.equal(where('add').modifier, '');
});

test('keeps the router chain ordered from innermost to outermost', () => {
  const ranks = destinations.routers.map((entry) => entry.rank);
  assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b));
  assert.equal(router('freeform').rank, 1);
  assert.equal(router('main').rank, 4);
  assert.ok(router('freeform').forwardsTo, 'the canvas router must forward what it does not claim');
  assert.ok(router('linked').forwardsTo, 'the collection shortcut must forward what it does not claim');
});

test('every routing case explains itself', () => {
  let cases = 0;
  for (const entry of destinations.routers) {
    for (const routingCase of entry.cases) {
      cases += 1;
      assert.ok(routingCase.effect.length > 0, `${entry.id}: ${routingCase.label} lost its body`);
      if (routingCase.label !== 'default') {
        assert.ok(routingCase.plain.length >= 20, `${entry.id}: ${routingCase.label} lacks a plain explanation`);
      }
    }
  }
  assert.equal(cases, destinations.summary.routingCases);
  assert.ok(cases >= 12);
});

test('records the two overrides that surprise people most', () => {
  const ids = destinations.overrides.map((entry) => entry.id);
  assert.ok(ids.includes('lightbox-capture'));
  assert.ok(ids.includes('dashboard-swap'));
  const lightbox = destinations.overrides.find((entry) => entry.id === 'lightbox-capture');
  assert.match(lightbox.plain, /lightbox/i);
  assert.equal(lightbox.beats, 'every destination');
  for (const override of destinations.overrides) {
    assert.match(override.source.url, /\/blob\/[0-9a-f]{40}\/.*#L\d+$/);
    assert.ok(override.expression.length > 0);
  }
});

test('keeps the split algebra in evaluation order', () => {
  assert.equal(destinations.layout.length, destinations.summary.layoutBranches);
  assert.ok(destinations.layout.length >= 6);
  assert.equal(destinations.layout[0].id, 'into-current-tile');
  const ids = destinations.layout.map((entry) => entry.id);
  assert.ok(ids.indexOf('row-layout') < ids.indexOf('column-layout'));
  for (const branch of destinations.layout) {
    assert.ok(branch.plain.length >= 30, `${branch.id} lacks a plain explanation`);
    assert.equal(branch.source.file, 'src/client/views/collections/CollectionDockingView.tsx');
  }
});

test('joins call sites so a destination can name who asks for it', () => {
  assert.ok(destinations.summary.callSites >= 100);
  assert.equal(destinations.summary.mostUsed, 'addRight');
  assert.ok(where('addRight').useCount >= 20);
  for (const use of where('addRight').uses) {
    assert.ok(use.owner.length > 0);
    assert.match(use.source.url, /\/blob\/[0-9a-f]{40}\/.*#L\d+$/);
  }
});

test('overlay is the only destination no addDocTab router claims', () => {
  const unrouted = destinations.destinations.filter((entry) => !entry.routed).map((entry) => entry.member);
  assert.deepEqual(unrouted, ['overlay']);
  assert.equal(destinations.summary.unroutedDestinations, unrouted.length);
  // The canvas router is the only one that can place a document without a tab.
  assert.deepEqual(where('inParent').claimedBy, ['freeform']);
  assert.deepEqual(where('inParentFromScreen').claimedBy, ['freeform']);
  // Everything a tile can do, the workspace root can do too.
  assert.deepEqual(where('addRight').claimedBy, ['tab', 'main']);
});
