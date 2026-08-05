import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import report from '../src/data/generated/accessibility.json' with { type: 'json' };
import { contrast, parseColor, reviewedPairs } from '../scripts/lib/contrast.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('computes contrast the way WCAG defines it', () => {
  // Anchored against the two ratios the specification fixes exactly, so a
  // rewrite of the luminance maths cannot pass by being self-consistent.
  assert.equal(Math.round(contrast([0, 0, 0], [255, 255, 255]) * 100) / 100, 21);
  assert.equal(contrast([120, 120, 120], [120, 120, 120]), 1);
  assert.deepEqual(parseColor('#fff'), [255, 255, 255]);
  assert.deepEqual(parseColor('rgb(18, 52, 86)'), [18, 52, 86]);
  assert.deepEqual(parseColor('hsl(0 0% 0%)'), [0, 0, 0]);
  assert.equal(parseColor('not a colour'), null);
});

test('measures every reviewed pair in every theme', () => {
  assert.equal(report.measurements.length, reviewedPairs.length);
  assert.equal(report.summary.measurements, report.measurements.length * report.summary.themes.length);
  for (const measurement of report.measurements) {
    for (const theme of report.summary.themes) {
      const result = measurement.themes[theme];
      assert.ok(result, `${measurement.name} was not measured in the ${theme} theme`);
      assert.ok(result.ratio >= 1 && result.ratio <= 21, `${measurement.name} reports an impossible ratio of ${result.ratio}`);
      assert.equal(result.passes, result.ratio >= measurement.required);
    }
  }
});

test('every measured pair meets the threshold its role requires', () => {
  for (const measurement of report.measurements) {
    for (const theme of report.summary.themes) {
      assert.ok(
        measurement.themes[theme].passes,
        `${measurement.name} is ${measurement.themes[theme].ratio}:1 in ${theme}, below the ${measurement.required}:1 its role needs`
      );
    }
  }
  assert.equal(report.summary.passing, report.summary.measurements);
});

test('names a WCAG criterion, or says plainly that none applies', () => {
  for (const measurement of report.measurements) {
    assert.ok(measurement.criterion.length > 20, `${measurement.name} does not say which criterion it is measured against`);
    if (measurement.role === 'decoration') {
      assert.match(measurement.criterion, /No WCAG threshold applies/);
    } else {
      assert.match(measurement.criterion, /WCAG 2\.1 AA/);
    }
  }
});

test('every reviewed pair names tokens the stylesheet defines', async () => {
  const css = await readFile(path.join(root, 'src', 'styles', 'dash.css'), 'utf8');
  for (const measurement of report.measurements) {
    for (const token of [measurement.foreground, measurement.background]) {
      assert.ok(css.includes(`${token}:`), `${token} is measured but the stylesheet never declares it`);
    }
  }
});

test('publishes what it does not test, in usable detail', () => {
  assert.ok(report.notTested.length >= 5, 'the untested list has shrunk to the point of being decorative');
  assert.equal(report.summary.areasNotTested, report.notTested.length);
  for (const gap of report.notTested) {
    assert.ok(gap.area.length > 3);
    // Both halves are required. A gap that only says what is missing invites
    // the reader to assume nothing at all is covered; one that only says what
    // is covered is the overclaim this list exists to prevent.
    assert.ok(gap.checked.length > 40, `${gap.area} does not say what is covered`);
    assert.ok(gap.notChecked.length > 40, `${gap.area} does not say what is not covered`);
  }
});

test('says how it was derived and what breaks it', () => {
  assert.equal(report.describes, 'this documentation site');
  assert.match(report.methodology.standard, /WCAG 2\.1/);
  assert.ok(report.methodology.derivedFrom.includes('dash.css'));
  assert.ok(report.methodology.driftRule.length > 60);
});
