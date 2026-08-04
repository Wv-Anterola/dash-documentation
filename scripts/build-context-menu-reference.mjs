/**
 * Builds the source-traced right-click (context) menu reference.
 *
 * Dash never declares its right-click menus as one static table. Every menu is
 * assembled at the moment of the click: each component that participates in the
 * hit-tested React subtree pushes its own entries into the single
 * `ContextMenu.Instance` singleton, and components reuse each other's top-level
 * groups by looking them up with `findByDescription`. That means the menu a
 * person sees is a runtime composition, and no single file lists it.
 *
 * This generator recovers that composition statically. It parses every source
 * file that touches `ContextMenu`, finds the `ContextMenuProps` object literals,
 * reconstructs submenu nesting through both inline `subitems` arrays and the
 * `const xItems = group?.subitems ?? []; xItems.push({...})` idiom, records the
 * guard expressions that decide whether an entry is contributed at all, and
 * joins each entry's `event` callback to the generated scripting-global and
 * exported-symbol indexes.
 */
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import exportedSymbols from '../src/data/generated/exported-symbols.json' with { type: 'json' };
import scriptingGlobals from '../src/data/generated/scripting-globals.json' with { type: 'json' };
import sourceReference from '../src/data/generated/source-reference.json' with { type: 'json' };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.resolve(process.env.DASH_SOURCE_ROOT ?? path.join(root, '..', 'Dash-Web'));
const baseline = sourceReference.repository.baselineTip;
const remote = sourceReference.repository.remote.replace(/^git@github\.com:/, 'https://github.com/').replace(/\.git$/, '');

function git(...args) {
  return execFileSync('git', ['-c', `safe.directory=${sourceRoot.replaceAll('\\', '/')}`, '-C', sourceRoot, ...args], {
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
    windowsHide: true,
  });
}

function sourceUrl(file, line) {
  return `${remote}/blob/${baseline}/${file}#L${line}`;
}

const files = git('grep', '-l', 'ContextMenu', baseline, '--', 'src/*.ts', 'src/*.tsx')
  .split(/\r?\n/)
  .filter(Boolean)
  .map((entry) => entry.replace(/^[0-9a-f]+:/, ''))
  // The menu machinery itself declares the props type; it contributes no entries.
  .filter((file) => !/views\/ContextMenu(Item)?\.tsx$/.test(file));

if (!files.length) throw new Error('No Dash-Web sources reference ContextMenu; the menu subsystem moved or the baseline is wrong.');

/* ------------------------------------------------------------------ *
 * Small AST helpers
 * ------------------------------------------------------------------ */

function nameOf(member, sourceFile) {
  if (!member?.name) return undefined;
  if (ts.isComputedPropertyName(member.name)) return member.name.expression.getText(sourceFile);
  return member.name.getText(sourceFile).replace(/^['"`]|['"`]$/g, '');
}

function property(object, key, sourceFile) {
  return object.properties.find(
    (member) => (ts.isPropertyAssignment(member) || ts.isShorthandPropertyAssignment(member) || ts.isMethodDeclaration(member)) && nameOf(member, sourceFile) === key
  );
}

function initializer(member) {
  if (!member) return undefined;
  if (ts.isPropertyAssignment(member)) return member.initializer;
  if (ts.isShorthandPropertyAssignment(member)) return member.name;
  if (ts.isMethodDeclaration(member)) return member;
  return undefined;
}

function compact(node, sourceFile, limit = 320) {
  if (!node) return '';
  const value = node.getText(sourceFile).replace(/\s+/g, ' ').trim();
  return value.length > limit ? `${value.slice(0, limit - 1)}…` : value;
}

function slug(value) {
  return (
    String(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'item'
  );
}

/**
 * Finds the `.map(x => …)` / `.forEach(x => …)` this node is generated inside,
 * so a runtime-generated entry can honestly say what it is generated per.
 */
function generatorFor(node, sourceFile) {
  let current = node;
  let child = node;
  while (current.parent) {
    child = current;
    current = current.parent;
    if (ts.isCallExpression(current) && ts.isPropertyAccessExpression(current.expression) && ['map', 'forEach', 'flatMap'].includes(current.expression.name.text)) {
      const callback = current.arguments.find((argument) => ts.isArrowFunction(argument) || ts.isFunctionExpression(argument));
      if (callback) {
        return {
          each: callback.parameters[0]?.name.getText(sourceFile) ?? 'item',
          over: compact(current.expression.expression, sourceFile, 160),
        };
      }
    }
    if (ts.isFunctionLike(current) && !ts.isArrowFunction(current) && current !== child) break;
  }
  return undefined;
}

/** The nearest enclosing function-like node, used to scope local-variable lookups. */
function enclosingFunction(node) {
  let current = node.parent;
  while (current && !ts.isFunctionLike(current) && !ts.isSourceFile(current)) current = current.parent;
  return current;
}

/**
 * Resolves an identifier description such as `category` or
 * `documentationDescription` to the string literals actually assigned to it,
 * either by local assignment or by the arguments its enclosing function is
 * called with. Dash uses both, and the visible label is the resolved string.
 */
function resolveIdentifierLabel(node, sourceFile) {
  const target = node.text;
  const scope = enclosingFunction(node);
  const values = new Set();
  if (scope) {
    const visit = (child) => {
      if (ts.isVariableDeclaration(child) && ts.isIdentifier(child.name) && child.name.text === target && child.initializer && ts.isStringLiteralLike(child.initializer)) {
        values.add(child.initializer.text.trim());
      }
      if (
        ts.isBinaryExpression(child) &&
        child.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        ts.isIdentifier(child.left) &&
        child.left.text === target &&
        ts.isStringLiteralLike(child.right)
      ) {
        values.add(child.right.text.trim());
      }
      ts.forEachChild(child, visit);
    };
    visit(scope);

    // Parameter of a named helper: look at how the file calls that helper.
    const index = scope.parameters?.findIndex((parameter) => parameter.name.getText(sourceFile) === target) ?? -1;
    const scopeName = nameOf(scope, sourceFile) ?? (ts.isVariableDeclaration(scope.parent) ? nameOf(scope.parent, sourceFile) : undefined);
    if (index >= 0 && scopeName) {
      const findCalls = (child) => {
        if (ts.isCallExpression(child)) {
          const callee = ts.isPropertyAccessExpression(child.expression) ? child.expression.name.text : child.expression.getText(sourceFile);
          const argument = child.arguments[index];
          if (callee === scopeName && argument && ts.isStringLiteralLike(argument)) values.add(argument.text.trim());
        }
        ts.forEachChild(child, findCalls);
      };
      findCalls(sourceFile);
    }
  }
  return [...values].filter(Boolean);
}

function spaceOut(identifier) {
  return identifier
    .replace(/[_$]/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .trim();
}

const RUNTIME_SLOT = '…';

/**
 * Expands a description expression into the exact strings it can evaluate to.
 * String concatenation becomes a cross product, a ternary becomes a branch, and
 * anything that depends on a runtime value becomes a single ellipsis slot, so
 * a caller can tell "two fixed labels" apart from "one label per document".
 */
function expandLabel(node, sourceFile, depth = 0) {
  if (!node || depth > 6) return [RUNTIME_SLOT];
  if (ts.isParenthesizedExpression(node)) return expandLabel(node.expression, sourceFile, depth + 1);
  if (ts.isStringLiteralLike(node)) return [node.text];
  if (ts.isConditionalExpression(node)) {
    return [...expandLabel(node.whenTrue, sourceFile, depth + 1), ...expandLabel(node.whenFalse, sourceFile, depth + 1)];
  }
  if (ts.isTemplateExpression(node)) {
    let combos = [node.head.text];
    for (const span of node.templateSpans) {
      const parts = expandLabel(span.expression, sourceFile, depth + 1);
      combos = combos.flatMap((prefix) => parts.map((part) => `${prefix}${part}${span.literal.text}`));
      if (combos.length > 8) return [RUNTIME_SLOT];
    }
    return combos;
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = expandLabel(node.left, sourceFile, depth + 1);
    const right = expandLabel(node.right, sourceFile, depth + 1);
    if (left.length * right.length > 8) return [RUNTIME_SLOT];
    return left.flatMap((prefix) => right.map((suffix) => `${prefix}${suffix}`));
  }
  if (ts.isIdentifier(node)) {
    const resolved = resolveIdentifierLabel(node, sourceFile);
    return resolved.length ? resolved : [RUNTIME_SLOT];
  }
  return [RUNTIME_SLOT];
}

/**
 * Turns a `description` initializer into a stable label plus, when the label is
 * computed, the readable variants a person can actually see.
 *
 * Three label kinds exist in Dash, and conflating them would misdescribe the
 * menu. A `literal` label is the same string every time. A `stateful` label
 * such as `` `${doc._chromeHidden ? 'Show' : 'Hide'} Chrome` `` names the state
 * you will move to, so every branch is a real label for one entry. A
 * `generated` label is produced per runtime document, so the menu has as many
 * of that entry as the user has matching documents.
 */
function describeLabel(node, sourceFile) {
  if (!node) return undefined;
  if (ts.isStringLiteralLike(node)) return { label: node.text.trim(), variants: [], kind: 'literal' };

  const raw = compact(node, sourceFile);
  const expansions = [...new Set(expandLabel(node, sourceFile).map((value) => value.replace(/\s+/g, ' ').trim()).filter(Boolean))];
  const settled = expansions.filter((value) => !value.includes(RUNTIME_SLOT));

  if (settled.length && settled.length === expansions.length) {
    return settled.length === 1
      ? { label: settled[0], variants: [], kind: 'literal', expression: raw }
      : { label: settled[0], variants: settled, kind: 'stateful', expression: raw };
  }

  const generator = generatorFor(node, sourceFile);
  if (generator) {
    return {
      label: `One entry per ${spaceOut(generator.each)}`,
      variants: settled,
      kind: 'generated',
      expression: raw,
      generatedFrom: generator.over,
    };
  }

  // A fixed prefix or suffix around a runtime value still names the entry.
  const stem = settled.length ? settled[0] : expansions.map((value) => value.replaceAll(RUNTIME_SLOT, '').trim()).filter(Boolean)[0] ?? '';
  return {
    label: stem && stem.length > 1 ? `${stem} …` : `Runtime label from ${compact(node, sourceFile, 60)}`,
    variants: settled,
    kind: 'generated',
    expression: raw,
  };
}

/** A ContextMenuProps literal always names an entry and either acts or nests. */
function isMenuItemLiteral(node, sourceFile) {
  if (!ts.isObjectLiteralExpression(node)) return false;
  if (!property(node, 'description', sourceFile)) return false;
  return ['event', 'subitems', 'icon'].some((key) => property(node, key, sourceFile));
}

/* ------------------------------------------------------------------ *
 * Guards: what has to be true before an entry is contributed at all
 * ------------------------------------------------------------------ */

const guardPhrases = [
  [/!\s*Doc\.noviceMode/, 'Developer mode is on'],
  [/Doc\.noviceMode/, 'Novice mode is on'],
  [/!\s*Doc\.IsSystem\(/, 'the document is not a Dash system document'],
  [/Doc\.IsSystem\(/, 'the document is a Dash system document'],
  [/GetEffectiveAcl[^)]*\)\s*===\s*AclAdmin/, 'you have admin access to it'],
  [/GetEffectiveAcl/, 'your effective access level allows it'],
  [/isSelected|IsSelected/, 'the document is selected'],
  [/annotationOn/, 'the document is (or is not) an annotation, per the guard'],
  [/ActiveDashboard/, 'a dashboard is active'],
  [/instanceof Doc/, 'the referenced field actually holds a document'],
  [/\.length/, 'the referenced list is non-empty'],
  [/ExploreMode/, 'Explore mode matches the guard'],
];

function readableGuard(expressions) {
  const phrases = [];
  for (const expression of expressions) {
    for (const [pattern, phrase] of guardPhrases) {
      if (pattern.test(expression)) {
        phrases.push(phrase);
        break;
      }
    }
  }
  return [...new Set(phrases)];
}

/** Collects `if (…)`, `… && push(…)`, and `cond ? … : …` conditions up the tree. */
function guardsFor(node, sourceFile) {
  const guards = [];
  let current = node;
  let child = node;
  while (current.parent) {
    child = current;
    current = current.parent;
    if (ts.isIfStatement(current) && current.thenStatement.pos <= child.pos && child.end <= current.thenStatement.end) {
      guards.push(compact(current.expression, sourceFile, 200));
    } else if (ts.isIfStatement(current) && current.elseStatement && current.elseStatement.pos <= child.pos && child.end <= current.elseStatement.end) {
      guards.push(`!(${compact(current.expression, sourceFile, 180)})`);
    } else if (ts.isBinaryExpression(current) && current.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken && current.right === child) {
      guards.push(compact(current.left, sourceFile, 200));
    } else if (ts.isConditionalExpression(current) && current.whenTrue === child) {
      guards.push(compact(current.condition, sourceFile, 200));
    } else if (ts.isConditionalExpression(current) && current.whenFalse === child) {
      guards.push(`!(${compact(current.condition, sourceFile, 180)})`);
    } else if (ts.isFunctionLike(current) && !ts.isArrowFunction(current)) {
      break;
    }
  }
  return guards.reverse();
}

/** The class + method a menu contribution is written in. */
function ownerFor(node, sourceFile) {
  let current = node;
  let member;
  let container;
  while (current.parent) {
    current = current.parent;
    if (!member && (ts.isMethodDeclaration(current) || ts.isFunctionDeclaration(current) || (ts.isPropertyDeclaration(current) && current.initializer && ts.isArrowFunction(current.initializer)) || ts.isVariableDeclaration(current))) {
      const found = nameOf(current, sourceFile);
      if (found) member = found;
    }
    if (ts.isClassDeclaration(current) || ts.isClassExpression(current)) {
      container = current.name?.getText(sourceFile);
      break;
    }
  }
  return { container: container ?? path.basename(node.getSourceFile().fileName).replace(/\.tsx?$/, ''), member: member ?? 'module scope' };
}

/* ------------------------------------------------------------------ *
 * Menu surfaces: the gesture that opens each menu
 * ------------------------------------------------------------------ */

const surfaces = [
  {
    id: 'document',
    name: 'Any document',
    gesture: 'Right-click a document, or use the Context menu button on the selected-document action bar.',
    entry: { file: 'src/client/views/nodes/DocumentView.tsx', needle: 'cm.displayMenu(' },
    match: (file) => file === 'src/client/views/nodes/DocumentView.tsx' || file === 'src/client/documents/DocUtils.ts' || file === 'src/client/views/DocumentButtonBar.tsx' || file === 'src/client/views/DocumentDecorations.tsx',
    plain: 'Appears for essentially every document, because DocumentView wraps every rendered document.',
  },
  {
    id: 'collection',
    name: 'A collection and its renderers',
    gesture: 'Right-click a collection, or the empty background inside one.',
    entry: { file: 'src/client/views/collections/CollectionView.tsx', needle: 'onContextMenu = (e: React.MouseEvent)' },
    match: (file) => /views\/collections\/(CollectionView|CollectionSubView|CollectionStackingView|CollectionNoteTakingView|CollectionTreeView|TreeView|collectionGrid\/CollectionGridView|collectionFreeForm\/CollectionFreeFormView)\.tsx$/.test(file),
    plain: 'Collection entries are added on top of the document entries, because a collection is also a document.',
  },
  {
    id: 'freeform-marquee',
    name: 'A freeform marquee selection',
    gesture: 'Drag a marquee on a freeform canvas, then right-click (or release with the menu gesture).',
    entry: { file: 'src/client/views/collections/collectionFreeForm/MarqueeView.tsx', needle: 'cm.displayMenu(' },
    match: (file) => /MarqueeView\.tsx$/.test(file),
    plain: 'These entries act on the marquee’s enclosed documents as a group rather than on one selection.',
  },
  {
    id: 'schema',
    name: 'A schema table',
    gesture: 'Right-click a schema column header, row, or cell.',
    entry: { file: 'src/client/views/collections/collectionSchema/CollectionSchemaView.tsx', needle: 'ContextMenu.Instance.displayMenu(' },
    match: (file) => /collectionSchema\//.test(file),
    plain: 'Schema entries change the table structure or the row document behind a line of the table.',
  },
  {
    id: 'column',
    name: 'A stacking or note-board column',
    gesture: 'Right-click a column heading in a stacking collection or note board.',
    entry: { file: 'src/client/views/collections/CollectionStackingViewFieldColumn.tsx', needle: 'ContextMenu.Instance.displayMenu(' },
    match: (file) => /(CollectionStackingViewFieldColumn|CollectionNoteTakingViewColumn)\.tsx$/.test(file),
    plain: 'Column entries change how one group of children is titled, sorted, or created into.',
  },
  {
    id: 'dashboard',
    name: 'The dashboard itself',
    gesture: 'Right-click the dashboard background, or click the dashboard title in the top bar.',
    entry: { file: 'src/client/views/DashboardView.tsx', needle: 'ContextMenu.Instance.displayMenu(' },
    match: (file) => /DashboardView\.tsx$/.test(file),
    plain: 'Dashboard entries act on the whole workspace, not on one selected document.',
  },
  {
    id: 'renderer',
    name: 'A type-specific renderer',
    gesture: 'Right-click inside a PDF, video, image, web page, audio, 3D, chart, comparison, equation, calendar, or scripting document.',
    entry: { file: 'src/client/views/nodes/PDFBox.tsx', needle: 'ContextMenu.Instance.addItem' },
    match: (file) => /views\/nodes\//.test(file),
    plain: 'These entries only exist while the pointer is inside that kind of content.',
  },
  {
    id: 'text',
    name: 'Formatted text and text shortcuts',
    gesture: 'Right-click inside formatted text, or type the `:` / `::` shortcut on a canvas.',
    entry: { file: 'src/client/views/nodes/formattedText/FormattedTextBox.tsx', needle: 'ContextMenu' },
    match: (file) => /formattedText\//.test(file),
    plain: 'The same menu machinery backs the typed shortcut menus, which is why they look and search alike.',
  },
  {
    id: 'ink',
    name: 'An ink stroke',
    gesture: 'Right-click a drawn stroke.',
    entry: { file: 'src/client/views/InkingStroke.tsx', needle: 'addItem' },
    match: (file) => /InkingStroke\.tsx$/.test(file),
    plain: 'Ink entries act on the stroke geometry rather than on a document body.',
  },
  {
    id: 'timeline',
    name: 'An animation timeline region',
    gesture: 'Right-click a region on the animation timeline.',
    entry: { file: 'src/client/views/animationtimeline/Region.tsx', needle: 'addItem' },
    match: (file) => /animationtimeline\//.test(file),
    plain: 'Timeline entries edit keyframe timing for the region under the pointer.',
  },
  {
    id: 'field',
    name: 'A key/value field row',
    gesture: 'Right-click a row in the metadata (key/value) view.',
    entry: { file: 'src/client/views/nodes/KeyValuePair.tsx', needle: 'ContextMenu.Instance.displayMenu(' },
    match: (file) => /KeyValue(Pair|Box)\.tsx$/.test(file),
    plain: 'Field entries change one typed field on the document behind the row.',
  },
];

const fallbackSurface = {
  id: 'other',
  name: 'Other menu contributors',
  gesture: 'Opened by the component that registers the entry.',
  plain: 'These contributions are reachable from the component named in the trace.',
};

function surfaceFor(file) {
  return surfaces.find((surface) => surface.match(file)) ?? fallbackSurface;
}

/* ------------------------------------------------------------------ *
 * Parse
 * ------------------------------------------------------------------ */

const items = [];
const usedIds = new Map();

function uniqueId(surfaceId, label) {
  const base = slug(`${surfaceId}-${label}`);
  const seen = usedIds.get(base) ?? 0;
  usedIds.set(base, seen + 1);
  return seen ? `${base}-${seen + 1}` : base;
}

/**
 * Records which local variable holds a group's `subitems` array, so that
 * `moreItems.push({...})` can be attributed to the `More...` group that later
 * receives `subitems: moreItems`.
 */
function collectSubitemVariables(sourceFile) {
  const owners = new Map();
  const lookups = new Map();
  const visit = (node) => {
    if (ts.isObjectLiteralExpression(node) && isMenuItemLiteral(node, sourceFile)) {
      const described = describeLabel(initializer(property(node, 'description', sourceFile)), sourceFile);
      const subitems = initializer(property(node, 'subitems', sourceFile));
      if (described && subitems && ts.isIdentifier(subitems)) owners.set(subitems.text, described.label);
    }
    // const moreItems = more?.subitems ?? [];  /  const items = cm.findByDescription('X')?.subitems ?? []
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const text = compact(node.initializer, sourceFile, 200);
      const found = /findByDescription\(\s*'([^']+)'/.exec(text);
      if (found) lookups.set(node.name.text, found[1]);
      else if (/\?\.subitems/.test(text)) {
        const via = /(\w+)\?\.subitems/.exec(text);
        if (via) lookups.set(node.name.text, via[1]);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  // Resolve `const options = cm.findByDescription('Options...'); const optionItems = options?.subitems ?? [];`
  for (const [variable, via] of lookups) {
    if (lookups.has(via)) lookups.set(variable, lookups.get(via));
  }
  return { owners, lookups };
}

function parentFor(node, sourceFile, { owners, lookups }) {
  let current = node;
  let child = node;
  while (current.parent) {
    child = current;
    current = current.parent;
    // Inline nesting: { description: 'Group', subitems: [ {…} ] }
    if (ts.isPropertyAssignment(current) && nameOf(current, sourceFile) === 'subitems') {
      const object = current.parent;
      if (ts.isObjectLiteralExpression(object)) {
        const described = describeLabel(initializer(property(object, 'description', sourceFile)), sourceFile);
        if (described) return described.label;
      }
    }
    // Deferred nesting: xItems.push({…}) / xItems.splice(0, 0, {…})
    if (ts.isCallExpression(current) && ts.isPropertyAccessExpression(current.expression) && ['push', 'splice', 'unshift'].includes(current.expression.name.text)) {
      const target = current.expression.expression;
      if (ts.isIdentifier(target)) {
        if (owners.has(target.text)) return owners.get(target.text);
        if (lookups.has(target.text)) return lookups.get(target.text);
      }
    }
    // Generated nesting: `const xItems = docs.map(d => ({…}))` where xItems is a group's subitems.
    if (ts.isVariableDeclaration(current) && ts.isIdentifier(current.name)) {
      if (owners.has(current.name.text)) return owners.get(current.name.text);
      if (lookups.has(current.name.text)) return lookups.get(current.name.text);
    }
    if (ts.isFunctionLike(current) && !ts.isArrowFunction(current)) break;
  }
  return '';
}

/** Distinguishes a top-level group registration from a leaf entry. */
function registrationFor(node, sourceFile) {
  let current = node;
  while (current.parent) {
    current = current.parent;
    if (ts.isCallExpression(current) && ts.isPropertyAccessExpression(current.expression)) {
      const method = current.expression.name.text;
      if (method === 'addItem') return 'addItem';
      if (['push', 'unshift', 'splice'].includes(method)) return 'subitem';
    }
    if (ts.isPropertyAssignment(current) && nameOf(current, sourceFile) === 'subitems') return 'subitem';
    if (ts.isFunctionLike(current) && !ts.isArrowFunction(current)) break;
  }
  return 'literal';
}

// Control flow, casts, and undo wrappers are noise in a "what does this do" trace.
const handlerIgnored = new Set([
  'if', 'for', 'return', 'map', 'filter', 'forEach', 'push', 'unshift', 'splice', 'includes', 'toString', 'undefined',
  'Number', 'String', 'Boolean', 'function', 'catch', 'then', 'setTimeout', 'console', 'log', 'require',
  'Cast', 'StrCast', 'NumCast', 'BoolCast', 'DateCast', 'ScriptCast', 'DocCast', 'DocListCast', 'DocListCastAsync',
  'undoable', 'runInAction', 'action', 'observable', 'toLowerCase', 'toUpperCase', 'replace', 'trim', 'join', 'split',
]);

function handlerNames(expression) {
  return [...String(expression).matchAll(/\b([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*\(/g)]
    .map((match) => match[1])
    .filter((name) => !handlerIgnored.has(name.split('.').pop() ?? name))
    .filter((name, index, all) => all.indexOf(name) === index)
    .slice(0, 12);
}

for (const file of files) {
  const source = git('show', `${baseline}:${file}`);
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const variables = collectSubitemVariables(sourceFile);

  const visit = (node) => {
    if (isMenuItemLiteral(node, sourceFile)) {
      const described = describeLabel(initializer(property(node, 'description', sourceFile)), sourceFile);
      if (described?.label) {
        const eventNode = initializer(property(node, 'event', sourceFile));
        const subitemsNode = initializer(property(node, 'subitems', sourceFile));
        const iconNode = initializer(property(node, 'icon', sourceFile));
        const registration = registrationFor(node, sourceFile);
        const guards = guardsFor(node, sourceFile);
        const surface = surfaceFor(file);
        const owner = ownerFor(node, sourceFile);
        const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
        const eventExpression = compact(eventNode, sourceFile);
        const hasSubitems = Boolean(subitemsNode);
        items.push({
          id: uniqueId(surface.id, described.label),
          surface: surface.id,
          surfaceName: surface.name,
          label: described.label,
          labelVariants: described.variants,
          labelKind: described.kind,
          labelExpression: described.expression ?? '',
          generatedFrom: described.generatedFrom ?? '',
          parent: parentFor(node, sourceFile, variables),
          kind: hasSubitems ? 'group' : eventExpression ? 'action' : 'label',
          icon: iconNode && ts.isStringLiteralLike(iconNode) ? iconNode.text : compact(iconNode, sourceFile, 60),
          registration,
          // `ContextMenuProps.undoable` exists but no Dash entry sets it; the
          // codebase batches inside the handler with undoable()/RunInBatch instead.
          undoableProp: compact(initializer(property(node, 'undoable', sourceFile)), sourceFile, 20) === 'true',
          undoable: /\b(undoable|UndoManager\.RunInBatch|UndoManager\.StartBatch|UndoBatch)\b/.test(eventExpression),
          inlineSubmenu: compact(initializer(property(node, 'noexpand', sourceFile)), sourceFile, 20) === 'true',
          dividerAfter: Boolean(initializer(property(node, 'addDivider', sourceFile))),
          guards,
          guardSummary: readableGuard(guards),
          eventExpression,
          handlerNames: handlerNames(eventExpression),
          owner,
          source: { file, line, url: sourceUrl(file, line) },
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
}

if (!items.length) throw new Error('Parsed no context-menu entries; the ContextMenuProps shape changed.');

/* ------------------------------------------------------------------ *
 * Drift rule: reviewed entry points must still exist
 * ------------------------------------------------------------------ */

const missingEntryPoints = [];
for (const surface of surfaces) {
  const source = git('show', `${baseline}:${surface.entry.file}`);
  if (!source.includes(surface.entry.needle)) missingEntryPoints.push(`${surface.entry.file} no longer contains ${JSON.stringify(surface.entry.needle)}`);
}
if (missingEntryPoints.length) throw new Error(`Context-menu surface evidence drifted:\n  ${missingEntryPoints.join('\n  ')}`);

/* ------------------------------------------------------------------ *
 * Join handlers to the generated indexes
 * ------------------------------------------------------------------ */

const globalByName = new Map(scriptingGlobals.globals.map((entry) => [entry.name, entry]));

const exportedByName = new Map();
for (const row of exportedSymbols.rows) {
  if (!exportedByName.has(row.name)) exportedByName.set(row.name, row);
  if (row.qualifiedName && !exportedByName.has(row.qualifiedName)) exportedByName.set(row.qualifiedName, row);
}

// The full module index carries class-qualified members such as
// `DocumentView.SetLightboxDoc`, which the exported-symbol table does not.
const moduleSymbolByQualifiedName = new Map();
const moduleSymbolByName = new Map();
for (const module of sourceReference.modules) {
  if (!module.path.startsWith('src/')) continue;
  for (const symbol of module.symbols ?? []) {
    if (!['function', 'method', 'property', 'getter', 'class', 'variable'].includes(symbol.kind)) continue;
    const record = { ...symbol, module: module.path };
    if (symbol.qualifiedName && !moduleSymbolByQualifiedName.has(symbol.qualifiedName)) moduleSymbolByQualifiedName.set(symbol.qualifiedName, record);
    if (!moduleSymbolByName.has(symbol.name)) moduleSymbolByName.set(symbol.name, record);
  }
}

function resolveHandler(name) {
  const bare = name.split('.').pop() ?? name;
  // `this._props.pinToPres` is a prop callback; the meaningful key is its tail.
  const qualified = name.replace(/^this\./, '').replace(/^_props\./, '');

  const global = globalByName.get(name) ?? globalByName.get(bare);
  if (global) {
    return {
      name,
      origin: 'scripting global',
      signature: global.signature ?? global.name,
      purpose: global.description ?? '',
      writes: global.effects?.writes ?? [],
      calls: (global.effects?.calls ?? []).slice(0, 8),
      url: `${remote}/blob/${baseline}/${global.path}#L${global.line}`,
    };
  }

  const symbol = moduleSymbolByQualifiedName.get(name) ?? moduleSymbolByQualifiedName.get(qualified) ?? exportedByName.get(name) ?? exportedByName.get(qualified) ?? moduleSymbolByName.get(bare);
  if (symbol) {
    return {
      name,
      origin: symbol.exported === false ? 'module-internal symbol' : 'exported symbol',
      signature: symbol.signature || symbol.qualifiedName || symbol.name,
      purpose: symbol.documentation || symbol.description || '',
      writes: [],
      calls: (symbol.calls ?? []).slice(0, 8),
      url: symbol.sourceUrl,
    };
  }
  return undefined;
}

/* ------------------------------------------------------------------ *
 * Plain-language explanations
 * ------------------------------------------------------------------ */

const reviewedPlain = {
  'document|Close': 'Removes the document from this view. Recently Closed keeps it, so this is not a delete.',
  'document|Share': 'Opens sharing for this document so you can choose who may see or edit it.',
  'document|Zip Export': 'Downloads the document, and what it contains, as a zip archive.',
  'document|Show Metadata': 'Opens the document’s raw fields in a key/value pane on the right.',
  'document|Copy ID': 'Copies the document’s server path so you can reference it elsewhere.',
  'document|Enter Portal': 'Turns the document into a doorway that opens its link target when clicked.',
  'document|Open in Lightbox': 'Opens the document full-screen over the workspace without moving it.',
  'document|Bring to Front': 'Draws the document above its overlapping neighbours on a freeform canvas.',
  'document|Send to Back': 'Draws the document beneath its overlapping neighbours on a freeform canvas.',
  'document|Pin': 'Adds the document to the active presentation trail as a step.',
  'document|Set Time...': 'Opens the scheduling dialog for this document.',
  'document|Import Folder...': 'Reads a folder from your computer into this collection as documents.',
  'collection|Export Image Hierarchy': 'Writes the collection’s nested images out to your file system.',
  'collection|View Child Layout': 'Opens the layout document that the collection applies to its children.',
  'dashboard|Options...': 'Groups the dashboard-wide settings.',
};

function plainLanguage(item) {
  const reviewed = reviewedPlain[`${item.surface}|${item.label}`];
  if (reviewed) return reviewed;
  if (item.labelKind === 'generated') {
    return `Not one fixed entry. Dash builds one of these for every item in ${item.generatedFrom || 'the list named in the trace'}, so how many you see depends on your own documents.`;
  }
  if (item.kind === 'group') return `Opens a submenu of related actions rather than doing something by itself.`;
  if (!item.eventExpression) return `Labels a section of the menu; it does not perform an action.`;
  const verbs = [
    [/^Delete|^Remove|^Clear/i, 'Removes the named thing from this view. Check whether it is recoverable before relying on it.'],
    [/^Open|^View|^Show/i, 'Opens or reveals the named thing without changing the document’s content.'],
    [/^Copy|^Duplicate/i, 'Makes a copy; the original stays where it is.'],
    [/^Export|^Download|^Zip/i, 'Writes data out of Dash to a file or the clipboard.'],
    [/^Edit|^Set|^Change|^Make/i, 'Changes stored state on the document or view named in the trace.'],
    [/^Add|^Create|^New/i, 'Creates something new; nothing existing is replaced.'],
    [/^Toggle|^Enable|^Disable|^Hide/i, 'Switches a setting on or off. The label reflects the state you will move to.'],
  ];
  const matched = verbs.find(([pattern]) => pattern.test(item.label));
  if (matched) return matched[1];
  return `Runs the handler shown in the technical trace against ${item.surfaceName.toLowerCase()}.`;
}

const availabilityFallback = 'Contributed whenever this component is part of what you right-clicked.';

for (const item of items) {
  const resolved = item.handlerNames.map(resolveHandler).filter(Boolean);
  item.handler = {
    names: item.handlerNames,
    resolved: resolved.slice(0, 4),
    stateOwner: resolved[0]?.writes?.length ? resolved[0].writes.slice(0, 4).join(', ') : `${item.owner.container}.${item.owner.member}`,
  };
  item.plain = plainLanguage(item);
  item.availability = item.guardSummary.length
    ? `Contributed when ${item.guardSummary.join(' and ')}.`
    : item.guards.length
      ? `Contributed only when its guard holds: ${item.guards[item.guards.length - 1]}`
      : availabilityFallback;
  item.interaction = item.kind === 'group' ? (item.inlineSubmenu ? 'Click to replace the menu with this group’s entries in place.' : 'Hover or click to open this group as a flyout.') : 'Click once to run it.';
  item.undoNote = item.undoable
    ? 'The handler wraps its work in a named undo batch, so one undo reverses the whole entry.'
    : 'No undo batch is visible at the registration site. Undo may still work if the state it writes is itself batched.';
  delete item.handlerNames;
  delete item.guardSummary;
}

/* ------------------------------------------------------------------ *
 * Compose
 * ------------------------------------------------------------------ */

const sharedGroups = new Map();
for (const item of items) {
  if (!item.parent) continue;
  const seen = sharedGroups.get(item.parent) ?? new Set();
  seen.add(item.source.file);
  sharedGroups.set(item.parent, seen);
}
const cooperativeGroups = [...sharedGroups]
  .filter(([, contributors]) => contributors.size > 1)
  .map(([group, contributors]) => ({ group, contributors: [...contributors].sort() }))
  .sort((a, b) => b.contributors.length - a.contributors.length || a.group.localeCompare(b.group));

const surfaceOrder = [...surfaces.map((surface) => surface.id), fallbackSurface.id];
items.sort((a, b) => surfaceOrder.indexOf(a.surface) - surfaceOrder.indexOf(b.surface) || a.source.file.localeCompare(b.source.file) || a.source.line - b.source.line);

const surfaceSummaries = [...surfaces, fallbackSurface]
  .map((surface) => {
    const owned = items.filter((item) => item.surface === surface.id);
    return {
      id: surface.id,
      name: surface.name,
      gesture: surface.gesture,
      plain: surface.plain,
      entries: owned.length,
      groups: new Set(owned.filter((item) => item.kind === 'group').map((item) => item.label)).size,
      contributors: [...new Set(owned.map((item) => item.source.file))].sort(),
    };
  })
  .filter((surface) => surface.entries);

const output = {
  schemaVersion: 1,
  generatedAt: sourceReference.generatedAt,
  repository: { remote, baseline },
  methodology: {
    parser: 'TypeScript compiler AST over every Dash-Web source that references ContextMenu',
    itemShape: 'Object literals carrying a ContextMenuProps description plus an event, subitems, or icon',
    nesting: 'Inline subitems arrays plus the deferred `const xItems = group?.subitems ?? []; xItems.push({…})` idiom, resolved through findByDescription lookups',
    guards: 'Enclosing if-conditions, && short-circuits, and ternary branches recorded verbatim and summarised in plain language',
    handlerJoin: 'Event callbacks joined to the generated scripting-global index first, then the exported-symbol index',
    driftRule: 'Generation fails when a reviewed menu entry point disappears from its source file',
  },
  summary: {
    entries: items.length,
    surfaces: surfaceSummaries.length,
    groups: items.filter((item) => item.kind === 'group').length,
    actions: items.filter((item) => item.kind === 'action').length,
    nested: items.filter((item) => item.parent).length,
    literalLabels: items.filter((item) => item.labelKind === 'literal').length,
    statefulLabels: items.filter((item) => item.labelKind === 'stateful').length,
    generatedLabels: items.filter((item) => item.labelKind === 'generated').length,
    guarded: items.filter((item) => item.guards.length).length,
    undoable: items.filter((item) => item.undoable).length,
    undoablePropUsed: items.filter((item) => item.undoableProp).length,
    handlerResolved: items.filter((item) => item.handler.resolved.length).length,
    contributingFiles: new Set(items.map((item) => item.source.file)).size,
    cooperativeGroups: cooperativeGroups.length,
  },
  surfaces: surfaceSummaries,
  cooperativeGroups,
  items,
};

const outputPath = path.join(root, 'src', 'data', 'generated', 'context-menus.json');
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

console.log(
  `Wrote ${outputPath}\n` +
    `${output.summary.entries} menu entries across ${output.summary.surfaces} surfaces from ${output.summary.contributingFiles} contributing files; ` +
    `${output.summary.nested} nested, ${output.summary.guarded} guarded, ${output.summary.handlerResolved} handler-resolved, ` +
    `${output.summary.cooperativeGroups} groups built cooperatively by more than one component.`
);
