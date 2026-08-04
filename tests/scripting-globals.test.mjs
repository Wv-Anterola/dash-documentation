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
    registrationsWithComment: 12,
    mislabelledByReusedComment: 7,
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

test('audits reused registration comments instead of importing them', () => {
  const audit = scripting.commentAudit;
  assert.ok(audit, 'the registration-comment audit is missing');
  assert.ok(audit.registrationsWithComment >= 10, `only ${audit.registrationsWithComment} registrations carry a comment`);
  assert.ok(audit.distinctComments < audit.registrationsWithComment, 'if every comment is unique now, revisit whether they can be used');

  // The finding this audit exists for: one comment above eight unrelated
  // globals. If Dash-Web fixes those lines, this expectation should be
  // retired rather than loosened.
  const worst = audit.reusedComments[0];
  assert.ok(worst, 'no reused comment found; the parser or the source has changed');
  assert.ok(worst.appliedTo.length >= 8, `the reused comment now covers ${worst.appliedTo.length} globals`);
  assert.deepEqual(worst.plausiblyDescribes, ['toggleOverlay']);
  assert.ok(worst.appliedTo.includes('setBackgroundColor'));
  assert.ok(worst.appliedTo.includes('setView'));
  assert.equal(audit.mislabelled, worst.appliedTo.length - 1);

  // The whole point: a recovered comment must never become a description.
  for (const entry of scripting.globals) {
    if (!entry.registrationComment) continue;
    assert.notEqual(entry.description, entry.registrationComment, `${entry.name} imported its registration comment as a description`);
  }
});

test('keeps the description count honest about the largest gap', () => {
  const described = scripting.globals.filter((entry) => entry.description);
  assert.equal(scripting.summary.explicitDescriptions, described.length);
  assert.ok(described.length < scripting.globals.length / 2, 'if most globals are described now, update the coverage prose');
  // Evidence has to stand in where the description is absent.
  const undescribed = scripting.globals.filter((entry) => !entry.description);
  const withEvidence = undescribed.filter((entry) => entry.effects?.calls?.length || entry.effects?.writes?.length);
  assert.ok(withEvidence.length / undescribed.length > 0.6, 'most undescribed globals must at least carry parsed evidence');
});
