import assert from 'node:assert/strict';
import test from 'node:test';
import controls from '../src/data/generated/interface-controls.json' with { type: 'json' };
import globals from '../src/data/generated/scripting-globals.json' with { type: 'json' };
import usage from '../src/data/generated/scripting-usage.json' with { type: 'json' };

const globalsByName = new Map(globals.globals.map((entry) => [entry.name, entry]));
const controlsById = new Map(controls.controls.map((entry) => [entry.id, entry]));

test('describes one version of the code', () => {
  assert.equal(usage.repository.baseline, globals.repository.baseline);
  assert.equal(usage.repository.baseline, controls.repository.baseline);
});

test('every joined name is a real scripting global', () => {
  for (const record of usage.usage) {
    assert.ok(globalsByName.has(record.name), `${record.name} is not a registered scripting global`);
    assert.equal(record.described, Boolean(globalsByName.get(record.name).description));
  }
});

test('every cited control exists and really calls the global', () => {
  for (const record of usage.usage) {
    assert.ok(record.controls.length, `${record.name} was joined with no controls`);
    for (const cited of record.controls) {
      const control = controlsById.get(cited.id);
      assert.ok(control, `${record.name} cites control ${cited.id}, which is not in the atlas`);
      const called = new Set([
        ...(control.handler?.names ?? []),
        ...(control.handler?.resolved ?? []).map((entry) => entry?.name ?? entry),
      ]);
      assert.ok(called.has(record.name), `${cited.id} is listed as calling ${record.name} but its handler does not name it`);
    }
  }
});

test('quotes the control explanation rather than writing a new one', () => {
  for (const record of usage.usage) {
    for (const cited of record.controls) {
      // The explanation must be the control's own reviewed sentence, character
      // for character. A paraphrase here would be an unreviewed claim wearing
      // a reviewed one's attribution.
      assert.equal(cited.explanation, controlsById.get(cited.id).beginner);
      assert.ok(cited.explanation.length > 10, `${cited.id} contributes an explanation too short to be one`);
    }
  }
});

test('lists each control once per global', () => {
  for (const record of usage.usage) {
    const ids = record.controls.map((control) => control.id);
    assert.equal(new Set(ids).size, ids.length, `${record.name} lists a control more than once`);
  }
});

test('links to a control anchor the interface page actually renders', () => {
  for (const record of usage.usage) {
    for (const cited of record.controls) {
      assert.equal(cited.page, `/reference/interface-controls/#control-index-${cited.id}`);
    }
  }
});

test('states what the join does not establish', () => {
  assert.ok(usage.methodology.limits.includes('evidence about the global'));
  assert.ok(usage.methodology.driftRule.length > 60);
});

test('keeps the counts the pages quote', () => {
  assert.equal(usage.summary.globals, globals.globals.length);
  assert.equal(usage.summary.calledByAControl, usage.usage.length);
  assert.equal(usage.summary.undescribedButCalled, usage.usage.filter((record) => !record.described).length);
  // A floor, not a pin. Tracing more controls should raise this, not break it.
  assert.ok(usage.summary.undescribedButCalled >= 35, `only ${usage.summary.undescribedButCalled} undescribed globals are reachable through a control`);
});
