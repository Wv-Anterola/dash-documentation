import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import report from '../src/data/generated/coverage-report.json' with { type: 'json' };

const surface = (id) => report.surfaces.find((entry) => entry.id === id);

/**
 * Non-regression floors, kept here rather than in the generator.
 *
 * A gate inside the generator would fail the build whenever a number dipped,
 * which buys a hastily written sentence instead of the right one. A floor in a
 * test still fails, but lowering one is a visible edit in a reviewed file that
 * somebody has to justify. Raise these when a gap is genuinely closed.
 */
const floors = {
  records: 850,
  tracedPct: 100,
  explainedPct: 75,
  fullyExplainedSurfaces: 8,
};

test('measures every generated surface the site publishes', () => {
  assert.equal(report.summary.surfaces, report.surfaces.length);
  assert.ok(report.surfaces.length >= 10);
  assert.equal(new Set(report.surfaces.map((entry) => entry.id)).size, report.surfaces.length);
  assert.ok(report.summary.records >= floors.records, `total records fell to ${report.summary.records}`);
});

test('covers every dataset that has a published endpoint', async () => {
  const endpoints = (await readdir(path.resolve('src/pages/assets/data')))
    .filter((name) => name.endsWith('.json.ts'))
    .map((name) => name.replace(/\.json\.ts$/, ''))
    .filter((name) => name !== 'index');
  const measured = new Set(report.surfaces.map((entry) => entry.id));
  // These are indexes and joins over other datasets rather than inventories of
  // their own, so counting explanations in them would double-count. Every
  // record in scripting-usage is a scripting global already counted under
  // scripting-globals, seen from the control that calls it.
  // `accessibility` is exempt for a different reason: it measures this site,
  // not Dash, so it has no records whose explanations could be counted.
  const exempt = new Set(['task-routes', 'exported-symbols', 'coverage-report', 'scripting-usage', 'accessibility']);
  for (const id of endpoints) {
    if (exempt.has(id)) continue;
    assert.ok(measured.has(id), `${id} is published but not measured by the coverage report`);
  }
});

test('every record is traced to source, without exception', () => {
  assert.equal(report.summary.tracedPct, floors.tracedPct);
  for (const entry of report.surfaces) {
    assert.equal(entry.traced, entry.records, `${entry.id} has records with no source location`);
  }
});

test('holds overall explanation coverage above its floor', () => {
  assert.ok(
    report.summary.explainedPct >= floors.explainedPct,
    `explanation coverage fell to ${report.summary.explainedPct}%, below the ${floors.explainedPct}% floor`
  );
  assert.ok(
    report.summary.fullyExplainedSurfaces >= floors.fullyExplainedSurfaces,
    `only ${report.summary.fullyExplainedSurfaces} surfaces are fully explained`
  );
});

test('keeps the surfaces that are meant to be complete complete', () => {
  for (const id of ['interface-controls', 'context-menus', 'keyboard-shortcuts', 'open-destinations', 'document-types', 'field-types', 'project-controls', 'inapp-doc-links']) {
    const entry = surface(id);
    assert.ok(entry, `${id} is no longer measured`);
    assert.equal(entry.explainedPct, 100, `${id} dropped to ${entry.explainedPct}% explained`);
  }
});

test('names the two known gaps rather than averaging them away', () => {
  const scripting = surface('scripting-globals');
  const routes = surface('http-routes');
  assert.ok(scripting.explainedPct < 100, 'if scripting globals are now fully described, retire this expectation');
  assert.ok(scripting.missingExamples.length > 0, 'a gap with no named examples is not a work queue');
  assert.ok(routes.explainedPct < 100, 'if every route now carries a comment, retire this expectation');
  assert.ok(routes.missingExamples.length > 0, 'a gap with no named examples is not a work queue');
  assert.ok(routes.note.length > 30, 'a partly explained surface must say what is and is not counted');
  assert.equal(report.summary.largestGap, 'scripting-globals');
  // The gaps must be at the top: the page is ordered as a work queue.
  assert.equal(report.surfaces[0].id, 'scripting-globals');
  assert.equal(report.surfaces[1].id, 'http-routes');
});

test('reports percentages that agree with its own counts', () => {
  for (const entry of report.surfaces) {
    const expected = Math.round((entry.explained / entry.records) * 1000) / 10;
    if (entry.hasExplanationField) assert.equal(entry.explainedPct, expected, `${entry.id} percentage disagrees with its counts`);
    assert.equal(entry.explained + entry.missing, entry.records, `${entry.id} explained and missing do not sum to its record count`);
    assert.ok(entry.missingExamples.length <= entry.missing);
    assert.ok(entry.behaviourName.length > 0);
  }
});
