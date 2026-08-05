/**
 * Builds the report of what this documentation does not know.
 *
 * Every generated reference here carries two different kinds of claim. One is
 * parsed: a signature, a file and line, a call, a field write. That kind is as
 * true as the parser, and it fails loudly when the source moves. The other is
 * written by a person: what the thing is for, what it means for you, when not
 * to use it. That kind cannot be generated, does not fail loudly, and is the
 * only kind most readers actually need.
 *
 * Publishing the ratio between them is uncomfortable and worth doing. A
 * documentation set that reports 100 percent coverage is measuring whether it
 * has a row per item, not whether the row helps. This one measures how many
 * rows a human has explained, names the surfaces where that number is low, and
 * lists the specific items still missing an explanation so the gap is a work
 * queue rather than a mood.
 *
 * Generation fails when a dataset it knows about disappears or changes the
 * field it reads. It does not fail on low coverage: the number is the finding.
 * Regression floors live in tests/coverage-report.test.mjs, where they are
 * visible and have to be edited deliberately.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const generated = path.join(root, 'src', 'data', 'generated');

/**
 * Each surface names the dataset, the array of records, the field that holds a
 * human explanation, and optionally a second field that holds parsed evidence
 * of behaviour. `explanationSource` says who writes the explanation, because
 * "Dash-Web has no doc comment here" and "nobody has written this page yet"
 * are different problems with different owners.
 */
const surfaces = [
  {
    id: 'interface-controls',
    name: 'Interface controls',
    dataset: 'interface-controls.json',
    records: 'controls',
    label: 'label',
    explanation: 'beginner',
    explanationSource: 'this documentation',
    behaviour: (row) => Boolean(row.handler?.resolved?.length),
    behaviourName: 'handler resolved to an implementation',
    page: '/reference/interface-controls/',
  },
  {
    id: 'context-menus',
    name: 'Right-click menu entries',
    dataset: 'context-menus.json',
    records: 'items',
    label: 'label',
    explanation: 'plain',
    explanationSource: 'this documentation',
    behaviour: (row) => Boolean(row.handler?.resolved?.length),
    behaviourName: 'handler resolved to an implementation',
    page: '/reference/context-menus/',
  },
  {
    id: 'keyboard-shortcuts',
    name: 'Keyboard shortcuts',
    dataset: 'keyboard-shortcuts.json',
    records: 'shortcuts',
    label: 'chordOther',
    explanation: 'plain',
    explanationSource: 'this documentation',
    behaviour: (row) => Boolean(row.effect),
    behaviourName: 'case body recovered',
    page: '/reference/keyboard-shortcuts/',
  },
  {
    id: 'open-destinations',
    name: 'Open destinations',
    dataset: 'open-destinations.json',
    records: 'destinations',
    label: 'value',
    explanation: 'plain',
    explanationSource: 'this documentation',
    behaviour: (row) => row.routed,
    behaviourName: 'claimed by a router',
    page: '/reference/open-destinations/',
  },
  {
    id: 'document-types',
    name: 'Document types',
    dataset: 'document-types.json',
    records: 'types',
    label: 'name',
    explanation: 'plainMeaning',
    explanationSource: 'this documentation',
    behaviour: (row) => Boolean(row.factories?.length),
    behaviourName: 'factory located',
    page: '/reference/document-types/',
  },
  {
    id: 'field-types',
    name: 'Serialized field types',
    dataset: 'field-types.json',
    records: 'registrations',
    label: 'tag',
    explanation: 'purpose',
    explanationSource: 'this documentation',
    behaviour: (row) => Boolean(row.hydration),
    behaviourName: 'hydration path recovered',
    page: '/reference/runtime-contracts/',
  },
  {
    id: 'project-controls',
    name: 'Project-specific controls',
    dataset: 'project-controls.json',
    records: 'controls',
    label: 'label',
    explanation: 'plain',
    explanationSource: 'this documentation',
    behaviour: (row) => Boolean(row.calls?.length),
    behaviourName: 'calls recovered',
    page: '/guides/features/trip-planner/',
  },
  {
    id: 'inapp-doc-links',
    name: 'Help links shipped in Dash',
    dataset: 'inapp-doc-links.json',
    records: 'links',
    label: 'requested',
    explanation: 'surfacePlain',
    explanationSource: 'this documentation',
    behaviour: (row) => Boolean(row.target),
    behaviourName: 'resolves to a page',
    page: '/contributing/inapp-links/',
  },
  {
    id: 'scripting-globals',
    name: 'Scripting globals',
    dataset: 'scripting-globals.json',
    records: 'globals',
    label: 'name',
    explanation: 'description',
    explanationSource: 'Dash-Web, at the registration site',
    behaviour: (row) => Boolean(row.effects?.writes?.length || row.effects?.calls?.length),
    behaviourName: 'calls or field writes recovered',
    page: '/guides/features/scripting/',
    note: 'The description is the second argument to ScriptingGlobals.add. It is part of the running application: Dash shows it to the person writing a script, so a missing one is a gap in the product, not only here.',
    // Not counted as explained. A control record says what one particular call
    // does with its arguments already chosen, which is evidence about the
    // global rather than a description of it. Counting it separately keeps the
    // headline number meaning one thing while still telling a reader that an
    // answer exists one link away.
    crossReference: {
      dataset: 'scripting-usage.json',
      records: 'usage',
      key: 'name',
      via: 'the interface control that calls it',
    },
  },
  {
    id: 'http-routes',
    name: 'HTTP routes',
    dataset: 'http-routes.json',
    records: 'routes',
    label: 'path',
    explanation: 'docComment',
    explanationSource: 'Dash-Web, as a comment above the registration',
    behaviour: (row) => Boolean(row.calls?.length),
    behaviourName: 'handler calls recovered',
    page: '/reference/http-service-interface/',
    note: 'Every route belongs to a family whose purpose is explained on the reference page, and every route now carries its recovered calls and the effects they imply. What is counted here is narrower: whether whoever wrote the route left a comment saying what it is for.',
  },
];

const failures = [];
const rows = [];

for (const surface of surfaces) {
  let data;
  try {
    data = JSON.parse(await readFile(path.join(generated, surface.dataset), 'utf8'));
  } catch (error) {
    failures.push(`${surface.id}: cannot read ${surface.dataset} (${error.message})`);
    continue;
  }
  const records = data[surface.records];
  if (!Array.isArray(records) || !records.length) {
    failures.push(`${surface.id}: ${surface.dataset} no longer holds a non-empty \`${surface.records}\` array`);
    continue;
  }
  if (surface.explanation && !(surface.explanation in records[0])) {
    failures.push(`${surface.id}: records no longer carry a \`${surface.explanation}\` field`);
    continue;
  }

  const explained = surface.explanation ? records.filter((row) => String(row[surface.explanation] ?? '').trim().length > 0) : [];
  const traced = records.filter((row) => row.source?.url || row.source?.file);
  const behaved = records.filter((row) => {
    try {
      return Boolean(surface.behaviour(row));
    } catch {
      return false;
    }
  });
  const missing = surface.explanation
    ? records.filter((row) => !String(row[surface.explanation] ?? '').trim())
    : records;

  if (!traced.length) failures.push(`${surface.id}: no record carries a source location`);

  /**
   * Records with no explanation of their own, but with a reviewed explanation
   * one link away. These stay outside `explained` on purpose; what they change
   * is the work queue, because a reader who lands on one is not stuck.
   */
  let reachable = new Set();
  if (surface.crossReference) {
    const { dataset, records: key, key: field } = surface.crossReference;
    try {
      const linked = JSON.parse(await readFile(path.join(generated, dataset), 'utf8'));
      const entries = linked[key];
      if (!Array.isArray(entries) || !entries.length) {
        failures.push(`${surface.id}: ${dataset} no longer holds a non-empty \`${key}\` array`);
      } else {
        reachable = new Set(entries.map((entry) => entry[field]).filter(Boolean));
      }
    } catch (error) {
      failures.push(`${surface.id}: cannot read ${dataset} (${error.message})`);
    }
  }
  const crossReferenced = missing.filter((row) => reachable.has(row[surface.label]));
  const unreachable = missing.filter((row) => !reachable.has(row[surface.label]));

  const pct = (part) => Math.round((part / records.length) * 1000) / 10;
  rows.push({
    id: surface.id,
    name: surface.name,
    page: surface.page,
    dataset: `/assets/data/${surface.dataset.replace(/\.json$/, '')}.json`,
    note: surface.note ?? '',
    explanationSource: surface.explanationSource,
    hasExplanationField: Boolean(surface.explanation),
    records: records.length,
    explained: explained.length,
    explainedPct: surface.explanation ? pct(explained.length) : 0,
    traced: traced.length,
    tracedPct: pct(traced.length),
    behaviourName: surface.behaviourName,
    behaved: behaved.length,
    behavedPct: pct(behaved.length),
    missing: missing.length,
    crossReferenced: crossReferenced.length,
    crossReferencedPct: surface.crossReference ? pct(crossReferenced.length) : 0,
    crossReferenceVia: surface.crossReference?.via ?? '',
    unreachable: unreachable.length,
    // A work queue, not an indictment. Capped so the page stays readable and
    // the full list stays one fetch away in the dataset itself. Records that
    // have no explanation anywhere come first: those are the ones where a
    // reader is genuinely stuck.
    missingExamples: [...unreachable, ...crossReferenced]
      .slice(0, 24)
      .map((row) => String(row[surface.label] ?? '').trim())
      .filter(Boolean),
  });
}

if (failures.length) throw new Error(`The coverage report drifted from the datasets it reads:\n  ${[...new Set(failures)].join('\n  ')}`);

const totals = rows.reduce(
  (sum, row) => ({
    records: sum.records + row.records,
    explained: sum.explained + row.explained,
    traced: sum.traced + row.traced,
    behaved: sum.behaved + row.behaved,
  }),
  { records: 0, explained: 0, traced: 0, behaved: 0 }
);

const output = {
  schemaVersion: 1,
  generatedAt: JSON.parse(await readFile(path.join(generated, 'interface-controls.json'), 'utf8')).generatedAt,
  repository: JSON.parse(await readFile(path.join(generated, 'interface-controls.json'), 'utf8')).repository,
  methodology: {
    explained: 'A record counts as explained when its plain-language field holds text. Length and quality are not judged: this measures presence, which is the part a machine can be trusted with',
    crossReferenced: 'A record with no explanation of its own, but with a reviewed explanation one link away. Counted apart from explained and never added to it: knowing which button calls a function is evidence about that function, not a description of it',
    traced: 'A record counts as traced when it carries a source location, which every generator is expected to produce for every record',
    behaviour: 'Each surface names one parsed signal that its records either have or lack, such as a resolved handler or a recovered hydration path',
    scope: 'Only the generated inventories are measured. Hand-written narrative pages are not, because there is nothing to count there that would mean anything',
    driftRule: 'Generation fails when a dataset disappears, empties, loses the explanation field this report reads, or stops carrying source locations. It never fails on low coverage: the number is the finding',
  },
  summary: {
    surfaces: rows.length,
    records: totals.records,
    explained: totals.explained,
    explainedPct: Math.round((totals.explained / totals.records) * 1000) / 10,
    traced: totals.traced,
    tracedPct: Math.round((totals.traced / totals.records) * 1000) / 10,
    crossReferenced: rows.reduce((sum, row) => sum + row.crossReferenced, 0),
    unexplainedAnywhere: rows.reduce((sum, row) => sum + row.unreachable, 0),
    fullyExplainedSurfaces: rows.filter((row) => row.explained === row.records).length,
    surfacesWithoutExplanationField: rows.filter((row) => !row.hasExplanationField).length,
    largestGap: rows.slice().sort((a, b) => b.missing - a.missing)[0]?.id ?? '',
  },
  surfaces: rows.sort((a, b) => b.missing - a.missing || a.name.localeCompare(b.name)),
};

const outputPath = path.join(generated, 'coverage-report.json');
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

console.log(
  `Wrote ${outputPath}\n` +
    `${output.summary.records} records across ${output.summary.surfaces} generated surfaces: ` +
    `${output.summary.tracedPct}% carry a source location, ${output.summary.explainedPct}% carry a human explanation. ` +
    `${output.summary.fullyExplainedSurfaces} surfaces are fully explained; the largest gap is ${output.summary.largestGap}.`
);
