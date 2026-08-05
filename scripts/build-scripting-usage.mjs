/**
 * Join scripting globals to the interface controls that call them.
 *
 * 118 of the 151 scripting globals carry no description. The comments above
 * their registrations cannot supply one: they are largely copy-pasted, and
 * `npm run audit:scripting` publishes an audit of that rather than importing
 * them. See /guides/features/scripting/.
 *
 * There is a second source of truth that was already reviewed by a person, and
 * it was going unused. Every interface control on this site carries a
 * hand-written plain-language explanation, and 142 of them record the functions
 * their handler calls. Where one of those functions is a scripting global, the
 * control's explanation is direct evidence of what calling that global does:
 * pressing the button is calling the function.
 *
 * That is a weaker claim than a description of the global itself, and it is
 * kept weaker here. This does not synthesise a description. It records which
 * controls call the global, and leaves the reader to follow the link, which is
 * a real answer to "what does this do" without anybody inventing a sentence.
 *
 * Drift rule: generation fails when the two datasets were built from different
 * Dash-Web revisions, or when the join collapses, which is what a change to
 * either record shape looks like from here.
 *
 * Output: src/data/generated/scripting-usage.json, rendered at
 * /guides/features/scripting/.
 *
 *   npm run audit:scripting-usage
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import interfaceControls from '../src/data/generated/interface-controls.json' with { type: 'json' };
import scriptingGlobals from '../src/data/generated/scripting-globals.json' with { type: 'json' };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = path.join(root, 'src', 'data', 'generated', 'scripting-usage.json');

if (interfaceControls.repository.baseline !== scriptingGlobals.repository.baseline) {
  throw new Error(
    'Interface controls and scripting globals were generated from different Dash-Web revisions ' +
      `(${interfaceControls.repository.baseline} and ${scriptingGlobals.repository.baseline}). ` +
      'Run `npm run audit:all` so the join describes one version of the code.'
  );
}

const globalsByName = new Map(scriptingGlobals.globals.map((global) => [global.name, global]));

/** Every function a control's handler is recorded as calling. */
const calledBy = (control) =>
  new Set([
    ...(control.handler?.names ?? []),
    ...(control.handler?.resolved ?? []).map((entry) => entry?.name ?? entry).filter((name) => typeof name === 'string'),
  ]);

const usage = new Map();
let callSites = 0;
for (const control of interfaceControls.controls) {
  for (const name of calledBy(control)) {
    const global = globalsByName.get(name);
    if (!global) continue;
    callSites += 1;
    if (!usage.has(name)) usage.set(name, []);
    usage.get(name).push({
      id: control.id,
      label: control.label,
      region: control.region,
      group: control.group,
      // The reviewed sentence, quoted rather than rewritten. If it is wrong the
      // fix belongs on the control record, in one place.
      explanation: control.beginner,
      // The atlas renders one row per control with this id. It is the anchor a
      // reader lands on, not the raw control id, and `npm run links` checks it.
      page: `/reference/interface-controls/#control-index-${control.id}`,
      source: control.source,
    });
  }
}

const records = [...usage.entries()]
  .map(([name, controls]) => {
    const global = globalsByName.get(name);
    return {
      name,
      kind: global.kind,
      category: global.category,
      described: Boolean(global.description),
      source: global.source,
      // Same control listed twice would mean the handler names it twice, which
      // says nothing extra to a reader.
      controls: [...new Map(controls.map((control) => [control.id, control])).values()].sort((a, b) =>
        a.region.localeCompare(b.region) || a.label.localeCompare(b.label)
      ),
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

// A join that finds nothing is not a documentation finding, it is a broken
// parse: both datasets record these fields today, and a shape change is the
// only way this reaches zero.
if (!records.length) {
  throw new Error(
    'No scripting global is called by any documented interface control. Both datasets exist, so this is a ' +
      'record-shape change in interface-controls.json or scripting-globals.json rather than a fact about Dash.'
  );
}

const undescribedButCalled = records.filter((record) => !record.described);

const output = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  repository: interfaceControls.repository,
  methodology: {
    derivedFrom:
      'The generated interface-control atlas and the generated scripting-global inventory, both from the same pinned Dash-Web revision. A control contributes when the functions its handler calls include a registered scripting global.',
    driftRule:
      'Generation fails when the two datasets carry different baselines, or when no control resolves to any global, which is what a record-shape change looks like from here.',
    limits:
      'A control tells you what one particular call does, with its arguments already chosen. It is evidence about the global, not a specification of it: a global may accept parameters no button ever varies, and a global called by no control is not thereby unimportant.',
  },
  summary: {
    globals: scriptingGlobals.globals.length,
    describedAtRegistration: scriptingGlobals.globals.filter((global) => global.description).length,
    calledByAControl: records.length,
    undescribedButCalled: undescribedButCalled.length,
    controlsCallingAGlobal: new Set(records.flatMap((record) => record.controls.map((control) => control.id))).size,
    callSites,
  },
  usage: records,
};

await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(
  `Joined ${records.length} of ${output.summary.globals} scripting globals to ` +
    `${output.summary.controlsCallingAGlobal} interface controls across ${callSites} call sites. ` +
    `${undescribedButCalled.length} of them have no description of their own, so the control that calls them ` +
    'is now the only reviewed account of what they do.'
);
