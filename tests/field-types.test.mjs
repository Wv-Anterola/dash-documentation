import assert from 'node:assert/strict';
import test from 'node:test';
import fields from '../src/data/generated/field-types.json' with { type: 'json' };
import source from '../src/data/generated/source-modules.json' with { type: 'json' };

const byTag = (tag) => fields.registrations.find((entry) => entry.tag === tag);

test('pins every serialized field type to the integrated source baseline', () => {
  assert.equal(fields.repository.baseline, source.repository.baselineTip);
  assert.equal(fields.registrations.length, 21);
  assert.equal(new Set(fields.registrations.map((entry) => entry.tag)).size, 21);
  assert.equal(fields.summary.categories, 8);
  assert.equal(fields.summary.repairHooks, 5);
  assert.equal(fields.summary.scriptingGlobals, 16);

  for (const entry of fields.registrations) {
    assert.ok(entry.label && entry.category && entry.purpose && entry.hydration && entry.copy);
    assert.ok(entry.storedMembers.length > 0);
    if (entry.tag !== 'Doc') assert.ok(entry.conversions.some((method) => method.name === 'Copy'));
    assert.match(entry.source.url, new RegExp(`/blob/${fields.repository.baseline}/`));
    assert.match(entry.registration.source.url, new RegExp(`/blob/${fields.repository.baseline}/`));
    for (const member of entry.storedMembers) {
      assert.ok(member.name && member.owner && member.schema);
      assert.match(member.source.url, new RegExp(`/blob/${fields.repository.baseline}/`));
    }
  }
});

test('keeps primitive pass-through and inherited URL storage explicit', () => {
  assert.deepEqual(fields.primitives.map((entry) => entry.type), ['string', 'number', 'boolean']);
  for (const tag of ['audio', 'csv', 'image', 'pdf', 'video', 'viewer3d', 'web', 'youtube']) {
    const entry = byTag(tag);
    assert.equal(entry.base, 'URLField');
    assert.equal(entry.storedMembers.length, 1);
    assert.equal(entry.storedMembers[0].name, 'url');
    assert.equal(entry.storedMembers[0].owner, 'URLField');
    assert.ok(entry.scriptingGlobal);
  }
});

test('preserves identity, lazy-reference, and executable repair paths', () => {
  assert.equal(Reflect.get(byTag('Doc').registration, 'constructorArgs'), "['id']");
  assert.ok(byTag('Doc').storedMembers.some((member) => member.name === '__id'));
  assert.ok(byTag('Doc').storedMembers.some((member) => member.name === '__fieldTuples'));
  assert.match(Reflect.get(byTag('proxy').registration, 'repairHook'), /deserializeProxy/);
  assert.match(Reflect.get(byTag('prefetch_proxy').registration, 'repairHook'), /prefetchValue/);
  assert.match(Reflect.get(byTag('script').registration, 'repairHook'), /deserializeScript/);
  assert.match(Reflect.get(byTag('computed').registration, 'repairHook'), /deserializeScript/);
  assert.ok(byTag('computed').baseChain.includes('ScriptField'));
  assert.ok(byTag('prefetch_proxy').baseChain.includes('ProxyField'));
});

test('records nested-change and copy boundaries without implying deep copies', () => {
  assert.deepEqual(byTag('schemaheader').mutationMethods.map((method) => method.name), [
    'setHeading', 'setColor', 'setType', 'setWidth', 'setDesc', 'setCollapsed',
  ]);
  assert.ok(byTag('list').mutationMethods.some((method) => method.name === '__fieldTuples'));
  assert.match(byTag('cursor').copy, /same data object/);
  assert.match(byTag('date').copy, /same Date object/);
  assert.match(byTag('prefetch_proxy').copy, /ProxyField rather than preserving/);
});
