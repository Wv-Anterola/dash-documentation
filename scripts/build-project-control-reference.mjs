/**
 * Builds the source-traced reference for project-specific controls.
 *
 * A Dash "project" is a workspace preset that adds its own controls without
 * adding new global concepts. Those controls are the ones a reader is least
 * likely to find documented anywhere, because they are not in the global
 * registries the interface atlas parses, and they are not right-click entries.
 *
 * They also sit on feature branches rather than on `master`, so this generator
 * deliberately pins each project to its own branch tip and records that the
 * branch is unmerged. Presenting branch-only work as if it were shipped would
 * be the exact failure mode this file exists to avoid: every row carries the
 * branch it came from, and generation fails if a project's branch turns out to
 * be missing or its named controls disappear.
 */
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import sourceReference from '../src/data/generated/source-reference.json' with { type: 'json' };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.resolve(process.env.DASH_SOURCE_ROOT ?? path.join(root, '..', 'Dash-Web'));
const masterTip = sourceReference.repository.baselineTip;
const remote = sourceReference.repository.remote.replace(/^git@github\.com:/, 'https://github.com/').replace(/\.git$/, '');

function git(...args) {
  return execFileSync('git', ['-c', `safe.directory=${sourceRoot.replaceAll('\\', '/')}`, '-C', sourceRoot, ...args], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  });
}

function tryGit(...args) {
  try {
    return git(...args);
  } catch {
    return undefined;
  }
}

const projects = [
  {
    id: 'trip-planner',
    name: 'Trip Planner',
    branch: 'origin/wv-anterola-trip-planner',
    guide: '/guides/features/trip-planner/',
    summary: 'A dashboard preset that assembles a trip document, a map, and a planner tool into one phased workflow.',
    // Surfaces, in the order a person meets them.
    surfaces: [
      { file: 'src/client/views/nodes/Trip/TripBox.tsx', name: 'Trip overview', plain: 'The document that holds the trip: its phase tabs, setup, inbox, health, itinerary, bookings, and connections.' },
      { file: 'src/client/views/nodes/MapBox/TripPlannerBox.tsx', name: 'Planner tool', plain: 'The tool docked beside the map, where you search for places and edit the stop order.' },
      { file: 'src/client/views/nodes/MapBox/TripPlannerIntegrationsPanel.tsx', name: 'Integrations panel', plain: 'The panel that reports which external travel and research services are configured.' },
    ],
    // Reviewed evidence: these must still exist or generation fails.
    required: [
      ['src/client/views/nodes/Trip/TripBox.tsx', "type TripPhase = 'plan' | 'prepare' | 'execute' | 'recap';"],
      ['src/client/views/nodes/Trip/TripBox.tsx', 'const PHASE_LABEL: Record<TripPhase, string>'],
      ['src/client/views/nodes/Trip/TripBox.tsx', 'role="tablist" aria-label="Trip workflow"'],
    ],
  },
];

/* ------------------------------------------------------------------ *
 * AST helpers
 * ------------------------------------------------------------------ */

function compact(node, sourceFile, limit = 300) {
  if (!node) return '';
  const value = node.getText(sourceFile).replace(/\s+/g, ' ').trim();
  return value.length > limit ? `${value.slice(0, limit - 1)}…` : value;
}

function attribute(element, name) {
  const attributes = ts.isJsxSelfClosingElement(element) ? element.attributes : element.openingElement.attributes;
  return attributes.properties.find((property) => ts.isJsxAttribute(property) && property.name.getText() === name);
}

function attributeValue(element, name, sourceFile) {
  const found = attribute(element, name);
  if (!found?.initializer) return found ? true : undefined;
  if (ts.isStringLiteral(found.initializer)) return found.initializer.text;
  if (ts.isJsxExpression(found.initializer)) return compact(found.initializer.expression, sourceFile);
  return undefined;
}

/** The expression node behind an attribute, so a computed label can be expanded. */
function attributeNode(element, name) {
  const found = attribute(element, name);
  if (!found?.initializer) return undefined;
  if (ts.isStringLiteral(found.initializer)) return found.initializer;
  if (ts.isJsxExpression(found.initializer)) return found.initializer.expression;
  return undefined;
}

const RUNTIME_SLOT = '…';

/**
 * Reads a module-level `const NAME: Record<…> = { key: 'Label' }` table, so a
 * label written as `PHASE_LABEL[p]` can be reported as the labels a person
 * actually sees rather than as an expression.
 */
function recordTables(sourceFile) {
  const tables = new Map();
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && ts.isObjectLiteralExpression(node.initializer)) {
      const values = node.initializer.properties
        .filter((property) => ts.isPropertyAssignment(property) && ts.isStringLiteralLike(property.initializer))
        .map((property) => property.initializer.text);
      if (values.length && values.length === node.initializer.properties.length) tables.set(node.name.text, values);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return tables;
}

/** The `const x = …` declaration for a name, within the render method using it. */
function findLocalDeclaration(node, name) {
  let scope = node.parent;
  while (scope && !ts.isPropertyDeclaration(scope) && !ts.isMethodDeclaration(scope) && !ts.isSourceFile(scope)) scope = scope.parent;
  let found;
  const visit = (child) => {
    if (!found && ts.isVariableDeclaration(child) && ts.isIdentifier(child.name) && child.name.text === name && child.initializer) found = child.initializer;
    if (!found) ts.forEachChild(child, visit);
  };
  if (scope) visit(scope);
  return found;
}

/** Every object literal a `cond ? {…} : cond ? {…} : {…}` chain can produce. */
function objectBranches(node, depth = 0) {
  if (!node || depth > 6) return [];
  if (ts.isParenthesizedExpression(node)) return objectBranches(node.expression, depth + 1);
  if (ts.isObjectLiteralExpression(node)) return [node];
  if (ts.isConditionalExpression(node)) return [...objectBranches(node.whenTrue, depth + 1), ...objectBranches(node.whenFalse, depth + 1)];
  return [];
}

// Guards the identifier/property resolution below against a self-referential local.
const resolving = new Set();

/** Expands a label expression into the strings it can evaluate to. */
function expandLabel(node, sourceFile, tables, depth = 0) {
  if (!node || depth > 8) return [RUNTIME_SLOT];
  if (ts.isJsxText(node)) return [node.text.trim()];
  if (ts.isParenthesizedExpression(node)) return expandLabel(node.expression, sourceFile, tables, depth + 1);
  if (ts.isStringLiteralLike(node)) return [node.text];
  if (ts.isConditionalExpression(node)) {
    return [...expandLabel(node.whenTrue, sourceFile, tables, depth + 1), ...expandLabel(node.whenFalse, sourceFile, tables, depth + 1)];
  }
  if (ts.isTemplateExpression(node)) {
    let combos = [node.head.text];
    for (const span of node.templateSpans) {
      const parts = expandLabel(span.expression, sourceFile, tables, depth + 1);
      combos = combos.flatMap((prefix) => parts.map((part) => `${prefix}${part}${span.literal.text}`));
      if (combos.length > 8) return [RUNTIME_SLOT];
    }
    return combos;
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = expandLabel(node.left, sourceFile, tables, depth + 1);
    const right = expandLabel(node.right, sourceFile, tables, depth + 1);
    if (left.length * right.length > 8) return [RUNTIME_SLOT];
    return left.flatMap((prefix) => right.map((suffix) => `${prefix}${suffix}`));
  }
  if (ts.isElementAccessExpression(node) && ts.isIdentifier(node.expression) && tables.has(node.expression.text)) {
    return tables.get(node.expression.text);
  }
  if (ts.isIdentifier(node) && !resolving.has(node.text)) {
    const declaration = findLocalDeclaration(node, node.text);
    if (declaration) {
      resolving.add(node.text);
      try {
        const resolved = expandLabel(declaration, sourceFile, tables, 0).filter((value) => !value.includes(RUNTIME_SLOT));
        if (resolved.length) return resolved;
      } finally {
        resolving.delete(node.text);
      }
    }
  }
  // `primary.text`, where `primary` is a local `cond ? { text: … } : { text: … }`.
  if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && !resolving.has(node.expression.text)) {
    const declaration = findLocalDeclaration(node, node.expression.text);
    const branches = objectBranches(declaration);
    if (branches.length) {
      resolving.add(node.expression.text);
      try {
        const wanted = node.name.text;
        const values = branches.flatMap((branch) => {
          const property = branch.properties.find((member) => ts.isPropertyAssignment(member) && member.name.getText(sourceFile) === wanted);
          return property ? expandLabel(property.initializer, sourceFile, tables, depth + 1) : [];
        });
        const resolved = values.filter((value) => !value.includes(RUNTIME_SLOT));
        if (resolved.length) return resolved;
      } finally {
        resolving.delete(node.expression.text);
      }
    }
  }
  return [RUNTIME_SLOT];
}

/** The `.map(x => …)` a control is generated inside, if any. */
function generatorFor(node, sourceFile) {
  let current = node;
  while (current.parent) {
    current = current.parent;
    if (ts.isCallExpression(current) && ts.isPropertyAccessExpression(current.expression) && ['map', 'flatMap'].includes(current.expression.name.text)) {
      const callback = current.arguments.find((argument) => ts.isArrowFunction(argument));
      if (callback) return { each: callback.parameters[0]?.name.getText(sourceFile) ?? 'item', over: compact(current.expression.expression, sourceFile, 120) };
    }
    if (ts.isPropertyDeclaration(current) || ts.isMethodDeclaration(current)) break;
  }
  return undefined;
}

/** The visible name for a control, plus the other strings the same control can read as. */
function describeControlLabel(node, sourceFile, tables, { designButton }) {
  const labelNode = designButton ? attributeNode(node, 'text') : literalChildNode(node);
  const ariaNode = attributeNode(node, 'aria-label');
  const chosen = labelNode ?? ariaNode;
  if (!chosen) return undefined;

  const expression = compact(chosen, sourceFile);
  const expansions = [...new Set(expandLabel(chosen, sourceFile, tables).map((value) => value.replace(/\s+/g, ' ').trim()).filter(Boolean))];
  const settled = expansions.filter((value) => !value.includes(RUNTIME_SLOT));
  const generator = generatorFor(node, sourceFile);

  if (settled.length && settled.length === expansions.length) {
    if (settled.length === 1) return { label: settled[0], variants: [], kind: 'literal', expression };
    // One control per item, with a known label per item: list them.
    if (generator) return { label: settled.join(' · '), variants: settled, kind: 'generated', expression, generatedFrom: generator.over };
    // A busy/idle pair: name the control by its resting label, not its progress text.
    const resting = settled.find((value) => !/(\.\.\.|…)$/.test(value)) ?? settled[0];
    return { label: resting, variants: settled, kind: 'stateful', expression };
  }

  // The label still depends on runtime data. Keep the reading a person sees
  // first, with the runtime part shown as an ellipsis.
  const readable = expansions.map((value) => value.replaceAll(RUNTIME_SLOT, '…').replace(/\s+/g, ' ').trim()).filter((value) => value && value !== '…');
  if (readable.length) {
    return { label: readable[0], variants: readable.slice(1), kind: 'generated', expression, generatedFrom: generator?.over ?? '' };
  }
  if (generator) {
    return {
      label: `One control per ${generator.each.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase()}`,
      variants: [],
      kind: 'generated',
      expression,
      generatedFrom: generator.over,
    };
  }
  return { label: `Runtime label from ${compact(chosen, sourceFile, 50)}`, variants: [], kind: 'generated', expression };
}

function tagName(element) {
  return (ts.isJsxSelfClosingElement(element) ? element.tagName : element.openingElement.tagName).getText();
}

/** The first meaningful child expression of a plain `<button>`, literal or computed. */
function literalChildNode(element) {
  if (!ts.isJsxElement(element)) return undefined;
  for (const child of element.children) {
    if (ts.isJsxText(child) && child.text.trim()) return child;
    if (ts.isJsxExpression(child) && child.expression) return child.expression;
  }
  return undefined;
}

/** The `renderXTab`/`renderYPanel` method a control is declared inside. */
function renderScope(node, sourceFile) {
  let current = node;
  while (current.parent) {
    current = current.parent;
    if ((ts.isPropertyDeclaration(current) || ts.isMethodDeclaration(current)) && current.name) {
      return current.name.getText(sourceFile);
    }
  }
  return 'render';
}

function guardsFor(node, sourceFile) {
  const guards = [];
  let current = node;
  while (current.parent) {
    const child = current;
    current = current.parent;
    if (ts.isBinaryExpression(current) && current.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken && current.right === child) {
      guards.push(compact(current.left, sourceFile, 160));
    } else if (ts.isConditionalExpression(current) && current.whenTrue === child) {
      guards.push(compact(current.condition, sourceFile, 160));
    } else if (ts.isConditionalExpression(current) && current.whenFalse === child) {
      guards.push(`!(${compact(current.condition, sourceFile, 140)})`);
    } else if (ts.isPropertyDeclaration(current) || ts.isMethodDeclaration(current)) {
      break;
    }
  }
  return guards.reverse();
}

const callIgnored = new Set(['StrCast', 'NumCast', 'Cast', 'DocCast', 'DocListCast', 'map', 'filter', 'forEach', 'includes', 'trim', 'toString', 'then', 'action']);

function callsIn(node, sourceFile) {
  const names = [];
  const visit = (child) => {
    if (ts.isCallExpression(child)) {
      const text = compact(child.expression, sourceFile, 80).replace(/^this\./, '');
      const tail = text.split('.').pop() ?? text;
      if (!callIgnored.has(tail) && !text.startsWith('(')) names.push(text);
    }
    ts.forEachChild(child, visit);
  };
  visit(node);
  return [...new Set(names)].slice(0, 6);
}

function humanizeScope(scope) {
  return scope
    .replace(/^render/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\bTrip\b\s*/g, '')
    .trim() || 'Main view';
}

function slug(value) {
  return (
    String(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'control'
  );
}

/* ------------------------------------------------------------------ *
 * Parse each project
 * ------------------------------------------------------------------ */

const controls = [];
const usedIds = new Map();
const projectSummaries = [];

for (const project of projects) {
  const tip = tryGit('rev-parse', project.branch)?.trim();
  if (!tip) throw new Error(`Project branch ${project.branch} is not available; fetch it or remove the project from this generator.`);
  const mergedIntoMaster = tryGit('merge-base', '--is-ancestor', tip, masterTip) !== undefined;

  const sourceAt = (file) => {
    const text = tryGit('show', `${tip}:${file}`);
    if (text === undefined) throw new Error(`${project.name}: ${file} is missing from ${project.branch}`);
    return text;
  };

  for (const [file, needle] of project.required) {
    if (!sourceAt(file).includes(needle)) throw new Error(`${project.name}: reviewed evidence disappeared from ${file}: ${JSON.stringify(needle)}`);
  }

  // The workflow phases are the spine of the project; read them rather than assume them.
  const overviewSource = sourceAt(project.surfaces[0].file);
  const phaseMatch = /type TripPhase = ([^;]+);/.exec(overviewSource);
  const phases = phaseMatch ? [...phaseMatch[1].matchAll(/'([^']+)'/g)].map((match) => match[1]) : [];
  const phaseLabels = {};
  const labelBlock = /const PHASE_LABEL: Record<TripPhase, string> = \{([\s\S]*?)\};/.exec(overviewSource);
  if (labelBlock) {
    for (const entry of labelBlock[1].matchAll(/(\w+):\s*'([^']+)'/g)) phaseLabels[entry[1]] = entry[2];
  }

  let projectControls = 0;
  for (const surface of project.surfaces) {
    const text = sourceAt(surface.file);
    const sourceFile = ts.createSourceFile(surface.file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const tables = recordTables(sourceFile);

    const visit = (node) => {
      if (ts.isJsxSelfClosingElement(node) || ts.isJsxElement(node)) {
        const tag = tagName(node);
        const designButton = tag === 'Button';
        if (designButton || tag === 'button') {
          const onClick = attributeValue(node, 'onClick', sourceFile) ?? '';
          const described = describeControlLabel(node, sourceFile, tables, { designButton });
          if (described?.label && onClick) {
            const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
            const scope = renderScope(node, sourceFile);
            const inactive = designButton ? attributeValue(node, 'inactive', sourceFile) : attributeValue(node, 'disabled', sourceFile);
            const ariaLabel = attributeValue(node, 'aria-label', sourceFile);
            const role = attributeValue(node, 'role', sourceFile);
            const base = slug(`${project.id}-${described.label}`);
            const seen = usedIds.get(base) ?? 0;
            usedIds.set(base, seen + 1);
            controls.push({
              id: seen ? `${base}-${seen + 1}` : base,
              project: project.id,
              projectName: project.name,
              surface: surface.name,
              panel: humanizeScope(scope),
              scope,
              label: described.label,
              labelVariants: described.variants,
              labelKind: described.kind,
              labelExpression: described.expression,
              generatedFrom: described.generatedFrom ?? '',
              controlType: role === 'tab' ? 'Workflow tab' : designButton ? 'Action button' : 'Inline button',
              ariaLabel: typeof ariaLabel === 'string' ? ariaLabel : '',
              disabledWhen: typeof inactive === 'string' ? inactive : '',
              guards: guardsFor(node, sourceFile),
              handlerExpression: onClick,
              calls: callsIn(node, sourceFile),
              source: { file: surface.file, line, url: `${remote}/blob/${tip}/${surface.file}#L${line}` },
            });
            projectControls += 1;
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }

  if (!projectControls) throw new Error(`${project.name}: parsed no project controls; the surface components changed shape.`);

  projectSummaries.push({
    id: project.id,
    name: project.name,
    branch: project.branch,
    branchTip: tip,
    mergedIntoMaster,
    guide: project.guide,
    summary: project.summary,
    phases: phases.map((phase) => ({ id: phase, label: phaseLabels[phase] ?? phase })),
    surfaces: project.surfaces.map((surface) => ({
      name: surface.name,
      plain: surface.plain,
      file: surface.file,
      controls: controls.filter((control) => control.project === project.id && control.surface === surface.name).length,
    })),
    controls: projectControls,
  });
}

/* ------------------------------------------------------------------ *
 * Plain language
 * ------------------------------------------------------------------ */

// Labels that stay computed after expansion, named by review rather than guessed.
const reviewedLabels = {
  "trip-planner|StrCast(doc.title, String(doc.type || 'document'))": 'One button per linked resource',
  'trip-planner|tab.label': 'One tab per booking result mode',
  "trip-planner|StrCast(mapDoc.title, 'Trip Map')": 'One button per candidate map',
};

const reviewedPlain = {
  'trip-planner|Mark booked': 'Records that you have actually booked this option. It stores your confirmation, it does not make a reservation for you.',
  'trip-planner|Save option': 'Keeps a quoted option on the trip so you can compare it later. It does not book anything.',
  'trip-planner|Open planner': 'Brings the planner tool and its map into view beside the trip.',
  'trip-planner|Edit basics': 'Returns to the Plan phase so you can change origin, destination, dates, or travellers.',
  'trip-planner|Add to inbox': 'Extracts structured trip details from the text you pasted and files them as candidates to accept or dismiss.',
  'trip-planner|Attach': 'Attaches the candidate to the trip as a resource instead of applying it as an itinerary change.',
  'trip-planner|Dismiss': 'Removes the candidate from the inbox without changing the trip.',
  'trip-planner|Refresh prices': 'Re-queries the configured travel provider for current quotes. Availability and price come from that provider, not from Dash.',
  'trip-planner|Push trip to Google Calendar': 'Writes the itinerary into your Google Calendar. This leaves Dash and requires the Google integration to be connected.',
  'trip-planner|Share with companion(s)': 'Shares the created Google calendar with the people on the trip.',
  'trip-planner|Export to phone calendar (.ics)': 'Downloads the itinerary as an .ics file you can import anywhere. Nothing is sent to an external service.',
  'trip-planner|Start trip': 'Marks the trip active, which changes what the phase panels emphasise.',
  'trip-planner|Trip completed': 'Marks the trip finished and moves the emphasis to the Recap phase.',
  'trip-planner|Review in Plan': 'Jumps back to the Plan phase with the current readiness issue in view.',
  'trip-planner|Generate itinerary': 'Turns the reviewed inbox candidates into itinerary stops. Candidates you have not reviewed are left alone.',
  'trip-planner|Generate from reviewed items': 'The Plan phase primary action. Its label and behavior change with the phase you are in, which is why the same button reads five different ways.',
  'trip-planner|Prefill trip': 'Applies the candidate the way its kind implies: trip details prefill the setup, bookings and stops are created, anything else is attached as a resource.',
  'trip-planner|Open map …': 'Brings the linked trip map into view. Greyed out until a map is linked.',
  'trip-planner|Open planner …': 'Brings the linked planner tool into view. Greyed out until a planner is linked.',
  'trip-planner|One button per linked resource': 'One button per resource attached to the trip, each opening that document. The count depends on your own trip.',
  'trip-planner|One tab per booking result mode': 'Filters the booking results to one kind. Tabs with no results are not rendered at all, so the tab set changes with the search.',
  'trip-planner|One button per candidate map': 'One button per map Dash could link to this trip. Choosing one links it; it does not copy the map.',
  'trip-planner|Plan · Prepare · Today · Recap': 'The four workflow phases. Switching phase changes what the trip emphasises; nothing is deleted or hidden from the underlying documents.',
  'trip-planner|Create map for this trip': 'Creates a new map document and links it to the trip.',
  'trip-planner|Open Map': 'Opens the map this planner is attached to.',
  'trip-planner|Open Trip Planner': 'Opens the planner tool for this trip.',
};

const externalPattern = /(GoogleCalendar|googleCalendar|fetchBooking|TravelApi|ResearchApi|deepLink|Ics|window\.open)/;

for (const control of controls) {
  const reviewedLabel = reviewedLabels[`${control.project}|${control.labelExpression}`];
  if (reviewedLabel) control.label = reviewedLabel;
  control.plain =
    reviewedPlain[`${control.project}|${control.label}`] ??
    (control.controlType === 'Workflow tab'
      ? `Switches the trip to this workflow phase. Phases change what is emphasised; they do not delete or hide trip data.`
      : `Runs ${control.calls[0] ?? 'the handler shown in the trace'} on the trip document. Nothing outside the trip is changed.`);
  control.availability = control.disabledWhen
    ? `Present but greyed out while ${control.disabledWhen}.`
    : control.guards.length
      ? `Rendered only when its guard holds: ${control.guards[control.guards.length - 1]}`
      : 'Rendered whenever its panel is open.';
  control.leavesDash = externalPattern.test(`${control.handlerExpression} ${control.calls.join(' ')}`);
}

const output = {
  schemaVersion: 1,
  generatedAt: sourceReference.generatedAt,
  repository: { remote, masterTip },
  disclosure:
    'Every control below is generated from a project feature branch, not from master. Rows are pinned to that branch tip and each project records whether it has been merged. Nothing here should be read as shipped behavior on the mainline.',
  methodology: {
    parser: 'TypeScript compiler AST over each project surface component on its own branch tip',
    controlShape: 'JSX Button elements carrying a text prop, and plain button elements with literal text or an aria-label, in either case with an onClick',
    panels: 'Grouped by the render method the control is declared in, which is how each project organises its workflow',
    availability: 'Disabled conditions taken from inactive/disabled props; render conditions taken from enclosing && and ternary guards',
    driftRule: 'Generation fails when a project branch is missing, a surface file disappears, reviewed workflow evidence changes, or a surface stops yielding controls',
  },
  summary: {
    projects: projectSummaries.length,
    controls: controls.length,
    surfaces: projectSummaries.reduce((total, project) => total + project.surfaces.length, 0),
    panels: new Set(controls.map((control) => `${control.project}:${control.panel}`)).size,
    conditionallyDisabled: controls.filter((control) => control.disabledWhen).length,
    guarded: controls.filter((control) => control.guards.length).length,
    leaveDash: controls.filter((control) => control.leavesDash).length,
    unmergedProjects: projectSummaries.filter((project) => !project.mergedIntoMaster).length,
  },
  projects: projectSummaries,
  controls,
};

const outputPath = path.join(root, 'src', 'data', 'generated', 'project-controls.json');
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

console.log(
  `Wrote ${outputPath}\n` +
    `${output.summary.controls} project controls across ${output.summary.projects} project(s), ` +
    `${output.summary.surfaces} surfaces and ${output.summary.panels} panels; ` +
    `${output.summary.conditionallyDisabled} can be greyed out, ${output.summary.leaveDash} reach outside Dash; ` +
    `${output.summary.unmergedProjects} project(s) are not merged into master.`
);
