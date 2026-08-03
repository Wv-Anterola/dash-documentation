import assert from 'node:assert/strict';
import test from 'node:test';
import documents from '../src/data/generated/document-types.json' with { type: 'json' };
import source from '../src/data/generated/source-modules.json' with { type: 'json' };

const byName = (name) => documents.types.find((type) => type.name === name);

test('pins every document lifecycle record to the integrated source baseline', () => {
  assert.equal(documents.repository.baseline, source.repository.baselineTip);
  assert.equal(documents.types.length, 51);
  assert.equal(documents.summary.prototypeTypes, 50);
  assert.equal(documents.summary.prototypeRegistrations, 51);
  assert.equal(documents.summary.factoryFunctions, 65);
  assert.equal(documents.summary.paletteTemplates, 36);
  assert.equal(documents.summary.rendererComponents, 54);
  assert.equal(documents.collectionViewTypes.length, 21);

  for (const type of documents.types) {
    assert.ok(type.category && type.audience && type.plainMeaning && type.technicalRole);
    assert.match(type.source.url, new RegExp(`/blob/${documents.repository.baseline}/`));
    assert.ok(type.source.url.endsWith(`#L${type.source.line}`));
    if (type.prototype) {
      assert.equal(type.prototype.rendererRegistered, true);
      assert.match(type.prototype.source.url, new RegExp(`/blob/${documents.repository.baseline}/`));
    }
    for (const factory of type.factories) {
      assert.match(factory.source.url, new RegExp(`/blob/${documents.repository.baseline}/`));
      assert.ok(factory.namespace === 'Docs.Create' || factory.namespace === 'Docs.Prototypes');
    }
  }
});

test('preserves the intentional nonstandard construction paths', () => {
  assert.equal(byName('NONE').lifecycle, 'sentinel');
  assert.equal(byName('NONE').prototype, undefined);
  assert.equal(byName('KVP').lifecycle, 'prototype-only');
  assert.deepEqual(byName('KVP').factories, []);
  assert.equal(byName('CONFIG').lifecycle, 'data-only-factory');
  assert.equal(byName('CONFIG').factories[0].name, 'ConfigDocument');
  assert.equal(Reflect.get(byName('CONFIG').factories[0], 'primaryField'), undefined);
  assert.equal(byName('PRESSLIDE').lifecycle, 'prototype-resource');
  assert.equal(Reflect.get(byName('IMG').factories[0], 'primaryField'), 'data');
  assert.equal(byName('SCRIPTDB').factories[0].namespace, 'Docs.Prototypes');
  assert.equal(byName('GROUPDB').factories[0].namespace, 'Docs.Prototypes');
  assert.deepEqual(documents.missingPrototypeTypes, []);
  assert.deepEqual(documents.unregisteredRendererTypes, []);
});

test('retains duplicate prototype evidence and creator-to-type mappings', () => {
  assert.deepEqual(documents.duplicatePrototypeTypes, [{ type: 'DATAVIZ', registrations: 2 }]);
  const dataViz = byName('DATAVIZ').prototype.registrations;
  assert.equal(dataViz.length, 2);
  assert.ok(dataViz[0].options.some((option) => option.key === 'acl'));
  assert.ok(!dataViz[1].options.some((option) => option.key === 'acl'));

  const palette = new Map(documents.paletteTemplates.map((entry) => [entry.title, entry]));
  assert.deepEqual(palette.get('Math').documentTypes, ['EQUATION']);
  assert.deepEqual(palette.get('Flashcard').documentTypes, ['COMPARISON']);
  assert.deepEqual(palette.get('Col').documentTypes, ['COL']);
  assert.deepEqual(palette.get('Chat Assist').documentTypes, ['CHAT']);
  assert.deepEqual(palette.get('Mermaids').documentTypes, ['RTF']);
});

test('maps collection factories without pretending every view has a constructor', () => {
  const collection = byName('COL');
  const variants = new Map(collection.factories.filter((factory) => factory.collectionViewType).map((factory) => [factory.collectionViewType, factory.name]));
  assert.equal(variants.get('Freeform'), 'FreeformDocument');
  assert.equal(variants.get('Schema'), 'SchemaDocument');
  assert.equal(variants.get('Calendar'), 'CalendarDocument');
  assert.equal(variants.get('NoteTaking'), 'NoteTakingDocument');
  assert.ok(!variants.has('Grid'));
  assert.ok(!variants.has('Graph'));
});
