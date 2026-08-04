import assert from 'node:assert/strict';
import test from 'node:test';
import projects from '../src/data/generated/project-controls.json' with { type: 'json' };
import source from '../src/data/generated/source-reference.json' with { type: 'json' };

const trip = projects.projects.find((entry) => entry.id === 'trip-planner');
const byLabel = (label) => projects.controls.find((control) => control.label === label);

test('pins every project control to its own branch, never to master', () => {
  assert.equal(projects.summary.controls, projects.controls.length);
  assert.ok(projects.summary.controls >= 25);
  assert.equal(new Set(projects.controls.map((control) => control.id)).size, projects.controls.length);

  for (const project of projects.projects) {
    assert.match(project.branchTip, /^[0-9a-f]{40}$/);
    assert.notEqual(project.branchTip, source.repository.baselineTip);
  }
  for (const control of projects.controls) {
    assert.match(control.source.url, /#L\d+$/);
    assert.ok(
      !control.source.url.includes(source.repository.baselineTip),
      `${control.id} resolves to the master baseline instead of its project branch`
    );
  }
});

test('states plainly that these controls are not on the mainline', () => {
  assert.match(projects.disclosure, /not merged|feature branch|branch, not/i);
  assert.equal(projects.summary.unmergedProjects, projects.projects.length);
  assert.equal(trip.mergedIntoMaster, false);
});

test('recovers the project workflow rather than assuming it', () => {
  assert.deepEqual(
    trip.phases.map((phase) => phase.label),
    ['Plan', 'Prepare', 'Today', 'Recap']
  );
  // The third phase is called `execute` in source and "Today" on screen; the
  // reference has to carry both or a reader cannot connect them.
  assert.equal(trip.phases[2].id, 'execute');
  assert.ok(trip.surfaces.length >= 3);
  assert.ok(trip.surfaces.every((surface) => surface.plain.length >= 20));
});

test('keeps every control readable and traceable', () => {
  for (const control of projects.controls) {
    assert.ok(control.label && control.panel && control.surface);
    assert.ok(['literal', 'stateful', 'generated'].includes(control.labelKind));
    assert.ok(control.plain.length >= 20, `${control.id} lacks a plain explanation`);
    assert.ok(control.availability.length >= 20, `${control.id} lacks an availability contract`);
    assert.ok(control.handlerExpression, `${control.id} has no handler`);
    assert.equal(typeof control.leavesDash, 'boolean');
  }
});

test('resolves the labels that change with state', () => {
  // One button, five readings, decided by the active phase.
  const phaseAction = projects.controls.find((control) => control.labelExpression === 'primary.text');
  assert.ok(phaseAction, 'lost the phase-focus primary action');
  assert.ok(phaseAction.labelVariants.includes('Open live map'));
  assert.ok(phaseAction.labelVariants.includes('Copy share link'));
  assert.ok(phaseAction.labelVariants.length >= 5);

  // Busy/idle pairs must be named by their resting label, not their spinner text.
  const refresh = byLabel('Refresh prices');
  assert.ok(refresh);
  assert.ok(refresh.labelVariants.includes('Searching...'));

  // The phase tabs are one control generated per phase.
  const tabs = projects.controls.find((control) => control.controlType === 'Workflow tab');
  assert.ok(tabs);
  assert.deepEqual(tabs.labelVariants, ['Plan', 'Prepare', 'Today', 'Recap']);
});

test('flags the controls that leave Dash', () => {
  assert.ok(projects.summary.leaveDash >= 3);
  for (const label of ['Push trip to Google Calendar', 'Share with companion(s)', 'Export to phone calendar (.ics)']) {
    const control = byLabel(label);
    assert.ok(control, `Missing external control ${label}`);
    assert.equal(control.leavesDash, true, `${label} must be flagged as leaving Dash`);
  }
  assert.equal(byLabel('Start trip').leavesDash, false);
});

test('separates greyed-out controls from unrendered ones', () => {
  assert.ok(projects.summary.conditionallyDisabled >= 8);
  for (const control of projects.controls.filter((entry) => entry.disabledWhen)) {
    assert.match(control.availability, /^Present but greyed out while /);
  }
  for (const control of projects.controls.filter((entry) => !entry.disabledWhen && entry.guards.length)) {
    assert.match(control.availability, /^Rendered only when/);
  }
});
