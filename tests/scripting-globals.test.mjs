import assert from 'node:assert/strict';
import test from 'node:test';
import scripting from '../src/data/generated/scripting-globals.json' with { type: 'json' };
import source from '../src/data/generated/source-modules.json' with { type: 'json' };

const byName = (name) => scripting.globals.find((entry) => entry.name === name);

test('pins the complete case-sensitive scripting namespace to integrated source', () => {
  assert.equal(scripting.repository.baseline, source.repository.baselineTip);
  assert.equal(scripting.globals.length, 151);
  assert.equal(new Set(scripting.globals.map((entry) => entry.name)).size, 151);
  assert.deepEqual(scripting.summary, {
    staticGlobals: 151,
    decoratedClasses: 16,
    functions: 129,
    constructors: 20,
    objects: 2,
    explicitDescriptions: 33,
    categories: 12,
    dynamicRegistrationSites: 2,
  });
  assert.deepEqual(scripting.caseInsensitiveNameCollisions, [['SchemaHeaderField', 'schemaHeaderField']]);
});

test('keeps every static entry source-pinned and mechanically inspectable', () => {
  const sourceModules = new Set(source.modules.map((module) => module.path));
  const registrations = new Set(['call', 'named-call', 'decorator']);
  const modes = new Set(['action', 'query', 'constructor', 'object']);
  const purposeSources = new Set(['source-description', 'documentation-override', 'identifier-inference']);

  for (const entry of scripting.globals) {
    assert.ok(entry.name && entry.signature && entry.purpose && entry.category && entry.owner);
    assert.ok(registrations.has(entry.registration));
    assert.ok(modes.has(entry.mode));
    assert.ok(purposeSources.has(entry.purposeSource));
    assert.ok(sourceModules.has(entry.source.file));
    assert.match(entry.source.url, new RegExp(`/blob/${scripting.repository.baseline}/`));
    assert.match(entry.source.url, /#L\d+$/);
    assert.ok(Array.isArray(entry.effects.calls));
    assert.ok(Array.isArray(entry.effects.writes));
    assert.equal(typeof entry.effects.returns, 'number');
  }
});

test('separates static registration from saved functions created at runtime', () => {
  assert.equal(byName('constructor'), undefined);
  assert.equal(byName('f'), undefined);
  assert.equal(scripting.globals.filter((entry) => entry.registration === 'decorator').length, 16);
  assert.equal(scripting.dynamicRegistrations.length, 2);
  for (const site of scripting.dynamicRegistrations) {
    assert.equal(site.expression, 'f');
    assert.equal(site.owner, 'addScriptToGlobals');
    assert.equal(site.source.file, 'src/client/util/ScriptManager.ts');
    assert.match(site.reason, /runtime/);
  }
});

test('preserves the core query, action, constructor, and namespace roles', () => {
  for (const name of [
    'Docs', 'List', 'Doc', 'ScriptField', 'ComputedField', 'selectedDocs', 'undo', 'redo',
    'setBackgroundColor', 'followLink', 'replayWorkspace', 'imageRemoveBackground',
    'dashCallChat', 'GoogleAuthenticationManager',
  ]) assert.ok(byName(name), `Missing reviewed scripting global ${name}`);

  assert.equal(byName('Docs').mode, 'object');
  assert.equal(byName('selectedDocs').mode, 'query');
  assert.equal(byName('undo').mode, 'action');
  assert.equal(byName('Doc').mode, 'constructor');
  assert.equal(byName('schemaHeaderField').kind, 'function');
  assert.equal(byName('SchemaHeaderField').kind, 'class');
  assert.equal(byName('makeScript').purposeSource, 'documentation-override');
  assert.match(byName('makeScript').purpose, /persistent ScriptField/);
});
