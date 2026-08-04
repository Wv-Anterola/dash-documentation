import assert from 'node:assert/strict';
import test from 'node:test';
import controls from '../src/data/generated/interface-controls.json' with { type: 'json' };
import documents from '../src/data/generated/document-types.json' with { type: 'json' };
import scripting from '../src/data/generated/scripting-globals.json' with { type: 'json' };
import source from '../src/data/generated/source-reference.json' with { type: 'json' };

const byLabel = (label, region) => controls.controls.find((entry) => entry.label === label && (!region || entry.region === region));

test('pins the interface atlas to the integrated source baseline', () => {
  assert.equal(controls.repository.baseline, source.repository.baselineTip);
  assert.equal(controls.summary.controls, controls.controls.length);
  assert.ok(controls.summary.controls >= 200);
  assert.equal(controls.summary.regions, 8);
  assert.ok(controls.summary.groups >= 25);
  assert.ok(controls.summary.handlerResolvedControls >= 140);
  assert.equal(new Set(controls.controls.map((entry) => entry.id)).size, controls.controls.length);
});

test('keeps every control beginner-readable and source-auditable', () => {
  const sourceModules = new Set(source.modules.map((module) => module.path));
  for (const control of controls.controls) {
    assert.ok(control.id && control.label && control.region && control.group);
    assert.ok(control.beginner.length >= 20, `${control.id} lacks a plain explanation`);
    assert.ok(control.visibility.length >= 20, `${control.id} lacks a visibility contract`);
    assert.ok(control.interaction.length >= 12, `${control.id} lacks an interaction contract`);
    assert.ok(control.handler.stateOwner, `${control.id} lacks a state owner`);
    assert.ok(sourceModules.has(control.source.file), `${control.id} points outside the generated source inventory`);
    assert.match(control.source.url, new RegExp(`/blob/${controls.repository.baseline}/`));
    assert.match(control.source.url, /#L\d+$/);
  }
});

test('joins document-backed scripts to the scripting namespace', () => {
  const globals = new Set(scripting.globals.map((entry) => entry.name));
  for (const control of controls.controls) {
    for (const handler of control.handler.resolved) {
      assert.ok(globals.has(handler.name), `${control.id} resolves unknown handler ${handler.name}`);
      assert.ok(handler.signature && handler.purpose && handler.source?.url);
      assert.ok(Array.isArray(handler.calls) && Array.isArray(handler.writes));
    }
  }
  assert.ok(byLabel('Rotate', 'Context toolbar').handler.resolved.some((entry) => entry.name === 'imageRotate90'));
  assert.ok(byLabel('Undo', 'Canvas footer').handler.resolved.some((entry) => entry.name === 'undo'));
  assert.ok(byLabel('Pin', 'Context toolbar').handler.resolved.some((entry) => entry.name === 'pinWithView'));
});

test('covers every source-registry creator and critical interface region', () => {
  const creatorLabels = new Set(controls.controls.filter((entry) => entry.region === 'Tools palette').map((entry) => entry.label));
  assert.equal(creatorLabels.size, documents.paletteTemplates.length);
  for (const creator of documents.paletteTemplates) assert.ok(creatorLabels.has(creator.title));

  for (const [label, region] of [
    ['Home', 'Top bar'],
    ['Tile new tab', 'Tabs and tiles'],
    ['Help', 'Top bar'],
    ['Search', 'Sidebar'],
    ['Perspective', 'Context toolbar'],
    ['Smart Draw', 'Context toolbar'],
    ['Context menu', 'Document decorations'],
    ['Sharing and Permissions', 'Properties panel'],
    ['Toggle UI', 'Canvas footer'],
  ]) assert.ok(byLabel(label, region), `Missing ${region} control ${label}`);
});

test('traces the GoldenLayout tab and tile chrome Dash rebinds', () => {
  const chrome = controls.controls.filter((entry) => entry.region === 'Tabs and tiles');
  assert.ok(chrome.length >= 10, 'lost the tab and tile chrome contracts');
  assert.deepEqual([...new Set(chrome.map((entry) => entry.group))].sort(), ['Tab header', 'Tile chrome']);
  for (const control of chrome) {
    assert.equal(control.evidence, 'reviewed layout-chrome contract');
    assert.ok(control.technicalDetail, `${control.id} lacks the rebinding detail that makes this region worth tracing`);
    assert.ok(
      ['CollectionDockingView.tsx', 'TabDocView.tsx'].includes(control.source.file.split('/').pop()),
      `${control.id} is not anchored in the docking chrome`
    );
  }

  // The two controls whose upstream GoldenLayout name misdescribes what Dash does.
  const newTab = byLabel('Tile new tab', 'Tabs and tiles');
  assert.match(newTab.technicalDetail, /popout/i);
  assert.match(newTab.handlerExpression, /FreeformDocument/);
  const tileClose = byLabel('Tile close', 'Tabs and tiles');
  assert.match(tileClose.predicate, /contentItems\.length > 1/);

  // Closing a tab is recoverable, and the atlas has to say so.
  assert.match(byLabel('Tab close', 'Tabs and tiles').beginner, /Recently Closed/);
});
