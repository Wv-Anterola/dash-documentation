/**
 * Builds the source-traced reference for where a document opens.
 *
 * Every Dash control that shows you a document eventually calls `addDocTab`
 * with an `OpenWhere` string. That string is not a location: it is a routing
 * key. It is split on `:` into a base verb, a modifier, and an optional panel
 * name, and then handed to whichever router happens to be above the caller in
 * the React tree. Four routers claim different subsets of the verbs and pass
 * the rest upward, so the same `OpenWhere` value can mean "put it on this
 * canvas" in one place and "open a tab on the right" in another.
 *
 * Two overrides sit above all of that and are the reason people report that
 * Dash "ignored" where they asked for something:
 *
 * - If the lightbox is open, the top-level router rewrites *every* destination
 *   to `lightbox` before it looks at the one you passed.
 * - If the document carries a `dockingConfig`, it is a dashboard, and it
 *   replaces the entire workspace no matter what destination was requested.
 *
 * This generator parses the enums, all five routers, and the split algebra in
 * `CollectionDockingView.AddSplit` with the TypeScript compiler, then joins in
 * every call site in the client so each destination can say who uses it. The
 * reviewed prose is keyed to source needles: if a routing case or a layout
 * branch stops matching, generation fails rather than publishing a stale map.
 */
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import sourceReference from '../src/data/generated/source-reference.json' with { type: 'json' };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.resolve(process.env.DASH_SOURCE_ROOT ?? path.join(root, '..', 'Dash-Web'));
const baseline = sourceReference.repository.baselineTip;
const remote = sourceReference.repository.remote.replace(/^git@github\.com:/, 'https://github.com/').replace(/\.git$/, '');

const enumPath = 'src/client/views/nodes/OpenWhere.ts';
const dockingPath = 'src/client/views/collections/CollectionDockingView.tsx';

function git(...args) {
  return execFileSync('git', ['-c', `safe.directory=${sourceRoot.replaceAll('\\', '/')}`, '-C', sourceRoot, ...args], {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    windowsHide: true,
  });
}

const sourceCache = new Map();
function sourceAt(file) {
  if (!sourceCache.has(file)) sourceCache.set(file, git('show', `${baseline}:${file}`));
  return sourceCache.get(file);
}

const parseCache = new Map();
function parse(file) {
  if (!parseCache.has(file)) {
    parseCache.set(
      file,
      ts.createSourceFile(file, sourceAt(file), ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
    );
  }
  return parseCache.get(file);
}

const sourceUrl = (file, line) => `${remote}/blob/${baseline}/${file}#L${line}`;
const lineOf = (sourceFile, node) => sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;

function compact(node, sourceFile, limit = 240) {
  if (!node) return '';
  const value = node.getText(sourceFile).replace(/\s+/g, ' ').trim();
  return value.length > limit ? `${value.slice(0, limit - 1)}…` : value;
}

const failures = [];
const fail = (message) => failures.push(message);

/* ------------------------------------------------------------------ *
 * The two enums
 * ------------------------------------------------------------------ */

function readEnums() {
  const sourceFile = parse(enumPath);
  const found = new Map();
  ts.forEachChild(sourceFile, (node) => {
    if (!ts.isEnumDeclaration(node)) return;
    const members = node.members.map((member) => ({
      member: member.name.getText(sourceFile),
      value: ts.isStringLiteralLike(member.initializer) ? member.initializer.text : compact(member.initializer, sourceFile, 60),
      line: lineOf(sourceFile, member),
      comment: (sourceFile.text.slice(member.end, sourceFile.text.indexOf('\n', member.end)).match(/\/\/\s*(.+)$/)?.[1] ?? '').trim(),
    }));
    found.set(node.name.text, members);
  });
  for (const name of ['OpenWhere', 'OpenWhereMod']) {
    if (!found.has(name)) fail(`${enumPath} no longer declares the ${name} enum`);
  }
  return found;
}

/* ------------------------------------------------------------------ *
 * Routers: a named function whose body switches on the split location
 * ------------------------------------------------------------------ */

/**
 * Reviewed routers, in the order a request climbs through them. `needle` must
 * still appear in the extracted body; `scrutinee` must still be what the
 * switch tests. Both are drift tripwires.
 */
const routerContracts = [
  {
    id: 'freeform',
    file: 'src/client/views/collections/collectionFreeForm/CollectionFreeFormView.tsx',
    symbol: 'addDocTab',
    name: 'Freeform canvas router',
    rank: 1,
    plain:
      'The innermost router. It is the only place that can put a document onto the canvas you are looking at instead of into a tab, and the only place that honours a collection marked as its own lightbox. Anything it does not claim is passed to the router above it.',
    scrutinee: 'where',
    needle: 'isAnnotationOverlay',
    fallthrough: 'this._props.addDocTab(docsIn, location, layoutString)',
  },
  {
    id: 'linked',
    file: 'src/client/views/collections/CollectionSubView.tsx',
    symbol: 'addLinkedDocTab',
    name: 'Collection shortcut',
    rank: 2,
    plain:
      'Shared by carousels, card decks, and the freeform canvas. Before anything opens, it checks whether the document is already a child of this collection: if it is, the request is satisfied by unhiding it in place, and no tab is created. Adding `:always` is what defeats this.',
    scrutinee: null,
    needle: 'childDocList?.includes(doc)',
    fallthrough: 'this._props.addDocTab(docsIn, location)',
  },
  {
    id: 'tab',
    file: 'src/client/views/collections/TabDocView.tsx',
    symbol: 'addDocTab',
    name: 'Tab router',
    rank: 3,
    plain:
      'Runs when the request comes from inside a docked tab. It is identical to the top-level router except that it knows which tile it is in, so `add`, `replace`, `insert`, and `toggle` act relative to that tile rather than the workspace root.',
    scrutinee: 'whereFields[0]',
    needle: 'this.stack',
    fallthrough: null,
  },
  {
    id: 'main',
    file: 'src/client/views/MainView.tsx',
    symbol: 'addDocTabFunc_impl',
    name: 'Top-level router',
    rank: 4,
    plain:
      'The fallback every other router eventually reaches, and the one used directly by the sidebar, the properties panel, and the creator menus. It has no tile context, so splits are measured against the workspace root.',
    scrutinee: 'DocumentView.LightboxDoc() ? OpenWhere.lightbox : whereFields[0]',
    needle: 'LightboxDoc()',
    fallthrough: null,
  },
  {
    id: 'lightbox',
    file: 'src/client/views/LightboxView.tsx',
    symbol: 'AddDocTab',
    name: 'Lightbox terminal',
    rank: 5,
    plain:
      'Not a router: the end of the line for `lightbox`. It floats one document over the workspace and queues that document’s annotations as the forward history for the next and previous buttons.',
    scrutinee: null,
    needle: 'SetLightboxDoc',
    fallthrough: null,
  },
];

function findSymbol(sourceFile, symbol) {
  let match;
  const visit = (node) => {
    if (match) return;
    const name =
      (ts.isPropertyDeclaration(node) || ts.isMethodDeclaration(node) || ts.isVariableDeclaration(node)) && node.name
        ? node.name.getText(sourceFile)
        : ts.isFunctionDeclaration(node) && node.name
          ? node.name.text
          : '';
    if (name === symbol) match = node;
    else ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return match;
}

function firstSwitch(node) {
  let match;
  const visit = (child) => {
    if (match) return;
    if (ts.isSwitchStatement(child)) match = child;
    else ts.forEachChild(child, visit);
  };
  ts.forEachChild(node, visit);
  return match;
}

/** Reviewed plain-language gloss for each routing case, keyed router:case. */
const caseProse = {
  'freeform:OpenWhere.inParent': 'Adds the document to this canvas as a child. No tab is opened and nothing moves to another tile.',
  'freeform:OpenWhere.inParentFromScreen':
    'Adds the document to this canvas, converting its screen position into canvas coordinates first, then removing it from whatever it was embedded in. This is how a document is dragged out of a pile or a nested collection onto the canvas beneath it.',
  'freeform:OpenWhere.lightbox':
    'If this collection is flagged as its own lightbox, the document is shown inside this collection rather than over the whole workspace. Otherwise the request drops to the collection shortcut.',
  'freeform:undefined': 'An empty destination is treated the same as `lightbox`.',
  'tab:OpenWhere.lightbox': 'Floats the document over the workspace.',
  'tab:OpenWhere.close': 'Closes the tab showing this document in this tile.',
  'tab:OpenWhere.replace': 'Swaps the contents of the active tab in this tile, or of the named panel if one was given.',
  'tab:OpenWhere.toggle': 'Closes the document if it is already open anywhere, otherwise opens it. The opened tab is deliberately not selected.',
  'tab:OpenWhere.insert': 'Adds the document alongside an existing tab for it, rather than starting a new tile.',
  'tab:OpenWhere.add': 'Adds a tab, splitting this tile on the requested side.',
  'main:OpenWhere.lightbox': 'Floats the document over the workspace.',
  'main:OpenWhere.close': 'Closes the tab showing this document.',
  'main:OpenWhere.toggle': 'Closes the document if it is already open anywhere, otherwise opens it. The opened tab is deliberately not selected, so the backlinks menu can preview a target without stealing the selection.',
  'main:OpenWhere.replace': 'Swaps the contents of the named panel, or of the active tab if no panel was named.',
  'main:OpenWhere.insert': 'Adds the document alongside an existing tab for it, rather than starting a new tile.',
  'main:OpenWhere.add': 'Adds a tab, splitting the workspace root on the requested side.',
};

function readRouter(contract) {
  const sourceFile = parse(contract.file);
  const declaration = findSymbol(sourceFile, contract.symbol);
  if (!declaration) {
    fail(`${contract.file} no longer declares ${contract.symbol}`);
    return null;
  }
  const body = compact(declaration, sourceFile, 100000);
  if (!body.includes(contract.needle)) fail(`${contract.name}: the reviewed marker \`${contract.needle}\` is gone from ${contract.symbol}`);
  if (contract.fallthrough && !body.includes(contract.fallthrough.replace(/\s+/g, ' '))) {
    fail(`${contract.name}: no longer forwards unclaimed destinations via \`${contract.fallthrough}\``);
  }

  const cases = [];
  const switchStatement = contract.scrutinee ? firstSwitch(declaration) : null;
  if (contract.scrutinee) {
    if (!switchStatement) {
      fail(`${contract.name}: ${contract.symbol} no longer switches on a destination`);
    } else {
      const scrutinee = compact(switchStatement.expression, sourceFile, 120);
      // Dash-Web is prettier-ignored in these routers, so spacing around the
      // ternary is not stable. Compare the tokens, not the whitespace.
      if (scrutinee.replace(/\s+/g, '') !== contract.scrutinee.replace(/\s+/g, '')) {
        fail(`${contract.name}: switch scrutinee changed from \`${contract.scrutinee}\` to \`${scrutinee}\``);
      }
      let pending = [];
      for (const clause of switchStatement.caseBlock.clauses) {
        const label = ts.isDefaultClause(clause) ? 'default' : compact(clause.expression, sourceFile, 80);
        if (!clause.statements.length) {
          pending.push(label);
          continue;
        }
        const labels = [...pending, label];
        pending = [];
        cases.push({
          labels,
          label: labels.join(' / '),
          handles: labels.filter((value) => value.startsWith('OpenWhere.')).map((value) => value.replace('OpenWhere.', '')),
          effect: clause.statements.map((statement) => compact(statement, sourceFile, 300)).join(' '),
          plain: labels.map((value) => caseProse[`${contract.id}:${value}`]).find(Boolean) ?? '',
          line: lineOf(sourceFile, clause),
        });
      }
    }
  }
  for (const entry of cases) {
    if (!entry.plain && entry.label !== 'default') fail(`${contract.name}: routing case \`${entry.label}\` has no reviewed explanation`);
  }

  return {
    id: contract.id,
    name: contract.name,
    rank: contract.rank,
    plain: contract.plain,
    symbol: contract.symbol,
    scrutinee: contract.scrutinee ?? '',
    forwardsTo: contract.fallthrough ?? '',
    cases,
    source: { file: contract.file, line: lineOf(sourceFile, declaration), url: sourceUrl(contract.file, lineOf(sourceFile, declaration)) },
  };
}

/* ------------------------------------------------------------------ *
 * Overrides that outrank the requested destination
 * ------------------------------------------------------------------ */

const overrideContracts = [
  {
    id: 'lightbox-capture',
    name: 'An open lightbox captures everything',
    file: 'src/client/views/MainView.tsx',
    needle: 'DocumentView.LightboxDoc() ? OpenWhere.lightbox',
    plain:
      'While the lightbox is showing a document, the top-level router rewrites every requested destination to `lightbox`. Following a link that asks for a tab on the right will replace the lightbox contents instead. Dismiss the lightbox first if you want the tab.',
    beats: 'every destination',
  },
  {
    id: 'dashboard-swap',
    name: 'A dashboard replaces the workspace',
    file: 'src/client/views/MainView.tsx',
    needle: 'doc.dockingConfig && !keyValue',
    plain:
      'A document that carries a `dockingConfig` is a dashboard. Opening one switches the whole workspace to it, whatever destination was asked for. Adding the `keyValue` modifier is the exception: it opens the dashboard document’s raw fields in a tab instead of switching to it.',
    beats: 'every destination except keyValue',
  },
  {
    id: 'docking-swap',
    name: 'Splits refuse to nest a dashboard',
    file: dockingPath,
    needle: "document?._type_collection === CollectionViewType.Docking && !keyValue",
    plain:
      '`AddSplit` and `InsertSplit` repeat the dashboard check independently, so a dashboard reached through a tile split also swaps the workspace rather than becoming a tab inside the current one.',
    beats: 'add, insert',
  },
  {
    id: 'reuse-existing-tab',
    name: 'An already-open tab is reused',
    file: dockingPath,
    needle: 'tab.header.parent.setActiveContentItem(tab.contentItem)',
    plain:
      '`AddSplit` looks for a tab already showing this document with the same layout before it creates anything. If one exists, that tab is brought to the front and no split happens: this is why asking twice for a document on the right only ever produces one tab.',
    beats: 'add and its modifiers',
  },
];

function readOverrides() {
  return overrideContracts.map((contract) => {
    const text = sourceAt(contract.file).replace(/\s+/g, ' ');
    const needle = contract.needle.replace(/\s+/g, ' ');
    if (!text.includes(needle)) fail(`Override "${contract.name}": the reviewed marker \`${contract.needle}\` is gone from ${contract.file}`);
    const rawLines = sourceAt(contract.file).split(/\r?\n/);
    const compactNeedle = contract.needle.replace(/\s+/g, '');
    const index = rawLines.findIndex((line) => line.replace(/\s+/g, '').includes(compactNeedle));
    const line = index === -1 ? 1 : index + 1;
    return {
      id: contract.id,
      name: contract.name,
      plain: contract.plain,
      beats: contract.beats,
      expression: contract.needle,
      source: { file: contract.file, line, url: sourceUrl(contract.file, line) },
    };
  });
}

/* ------------------------------------------------------------------ *
 * The split algebra inside AddSplit
 * ------------------------------------------------------------------ */

/** Reviewed branch order for AddSplit's layout decision. Needles are tripwires. */
const layoutContracts = [
  {
    id: 'into-current-tile',
    needle: '!pullSide && stack',
    plain: 'No side was asked for and the caller is inside a tile, so the document becomes another tab in that tile and is activated.',
  },
  {
    id: 'empty-workspace',
    needle: 'glayRoot.contentItems.length === 0',
    plain: 'The workspace is empty, so the document becomes the first tile.',
  },
  {
    id: 'single-tile',
    needle: 'glayRoot.contentItems[0].isStack',
    plain: 'The workspace is a single tile with no rows or columns around it, so the side is ignored and the document becomes another tab in it.',
  },
  {
    id: 'single-nested-tile',
    needle: 'glayRoot.contentItems[0].contentItems[0].contentItems.length === 0',
    plain: 'The workspace has one empty tile inside one container. The document goes into that tile rather than splitting an empty layout.',
  },
  {
    id: 'row-layout',
    needle: 'instance._goldenLayout.root.contentItems[0].isRow',
    plain:
      'The workspace is arranged left to right. Left and right insert a new tile into that row directly. Top and bottom cannot, so the entire row is wrapped in a new column and the two halves are set to 50 percent each.',
  },
  {
    id: 'column-layout',
    needle: 'collayout.parent.replaceChild(collayout, newRow)',
    plain:
      'The workspace is arranged top to bottom. Top and bottom insert into that column directly. Left and right wrap the whole column in a new row and split it 50 / 50.',
  },
];

function readLayoutAlgebra() {
  const text = sourceAt(dockingPath);
  const flat = text.replace(/\s+/g, ' ');
  const lines = text.split(/\r?\n/);
  return layoutContracts.map((contract) => {
    const needle = contract.needle.replace(/\s+/g, ' ');
    if (!flat.includes(needle)) fail(`Split algebra "${contract.id}": the reviewed branch \`${contract.needle}\` is gone from ${dockingPath}`);
    const compactNeedle = contract.needle.replace(/\s+/g, '');
    const index = lines.findIndex((line) => line.replace(/\s+/g, '').includes(compactNeedle));
    const line = index === -1 ? 1 : index + 1;
    return {
      id: contract.id,
      condition: contract.needle,
      plain: contract.plain,
      source: { file: dockingPath, line, url: sourceUrl(dockingPath, line) },
    };
  });
}

/* ------------------------------------------------------------------ *
 * Every call site in the client
 * ------------------------------------------------------------------ */

function enclosingName(node, sourceFile) {
  const parts = [];
  for (let cursor = node.parent; cursor; cursor = cursor.parent) {
    if (ts.isClassDeclaration(cursor) && cursor.name) parts.unshift(cursor.name.text);
    else if ((ts.isMethodDeclaration(cursor) || ts.isPropertyDeclaration(cursor)) && cursor.name && parts.length < 2) parts.unshift(cursor.name.getText(sourceFile));
    else if (ts.isFunctionDeclaration(cursor) && cursor.name && parts.length < 2) parts.unshift(cursor.name.text);
    else if (ts.isVariableDeclaration(cursor) && ts.isIdentifier(cursor.name) && parts.length < 2) parts.unshift(cursor.name.text);
  }
  return [...new Set(parts)].slice(-2).join('.');
}

function nearestCall(node, sourceFile) {
  for (let cursor = node.parent; cursor; cursor = cursor.parent) {
    if (ts.isCallExpression(cursor)) return compact(cursor, sourceFile, 150);
    if (ts.isPropertyAssignment(cursor) || ts.isJsxAttribute(cursor)) return compact(cursor, sourceFile, 150);
  }
  return '';
}

function readCallSites() {
  let listing = '';
  try {
    listing = git('grep', '-l', '-e', 'OpenWhere', baseline, '--', 'src');
  } catch {
    fail('git grep found no OpenWhere references in the client');
    return new Map();
  }
  const files = listing
    .split(/\r?\n/)
    .filter(Boolean)
    .map((entry) => entry.slice(entry.indexOf(':') + 1))
    .filter((file) => /\.tsx?$/.test(file) && file !== enumPath);

  const byMember = new Map();
  for (const file of files) {
    const sourceFile = parse(file);
    const visit = (node) => {
      if (
        ts.isPropertyAccessExpression(node) &&
        ts.isIdentifier(node.expression) &&
        (node.expression.text === 'OpenWhere' || node.expression.text === 'OpenWhereMod')
      ) {
        const key = `${node.expression.text}.${node.name.text}`;
        const line = lineOf(sourceFile, node);
        if (!byMember.has(key)) byMember.set(key, []);
        byMember.get(key).push({
          owner: enclosingName(node, sourceFile) || path.basename(file, path.extname(file)),
          call: nearestCall(node, sourceFile),
          source: { file, line, url: sourceUrl(file, line) },
        });
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
  return byMember;
}

/* ------------------------------------------------------------------ *
 * Reviewed prose for each enum member
 * ------------------------------------------------------------------ */

const destinationProse = {
  lightbox: {
    plain: 'Float the document over the workspace, dimming everything behind it.',
    detail:
      'Inside a collection that is flagged as its own lightbox, the document is shown within that collection instead. Inside any collection that already contains the document, the request is satisfied by unhiding it in place and no lightbox opens at all.',
  },
  lightboxAlways: {
    plain: 'Float the document over the workspace, even if it is already visible where you are.',
    detail: 'The `always` modifier defeats the collection shortcut that would otherwise satisfy the request in place.',
  },
  insert: { plain: 'Add the document beside an existing tab for it rather than starting a new tile.', detail: 'Falls back to `add` when no such tab exists.' },
  insertRight: { plain: 'Insert beside an existing tab, appended after it.', detail: 'Left and top insert at position zero; right and bottom append.' },
  add: { plain: 'Open the document in a tab.', detail: 'With no side, it joins the tile the request came from, or the workspace’s first tile when there is no tile context.' },
  addLeft: { plain: 'Open the document in a tab to the left.', detail: 'In a top-to-bottom workspace this wraps the whole layout in a new row and splits it in half.' },
  addRight: { plain: 'Open the document in a tab to the right.', detail: 'The most common destination in Dash: link following, search results, and most menu entries use it.' },
  addBottom: { plain: 'Open the document in a tab below.', detail: 'In a left-to-right workspace this wraps the whole layout in a new column and splits it in half.' },
  close: { plain: 'Close the tab showing this document.', detail: 'Closing is not deleting. Unless the document is still embedded elsewhere, it is added to Recently Closed.' },
  toggle: { plain: 'Close the document if it is open anywhere, otherwise open it.', detail: 'The tab it opens is deliberately left unselected.' },
  toggleRight: { plain: 'Close the document if it is open anywhere, otherwise open it on the right.', detail: 'Used where a panel should flip on and off without stealing the selection.' },
  replace: { plain: 'Swap the contents of the current tab rather than adding one.', detail: 'With a panel name, the named panel is swapped and created on the right if it does not exist yet.' },
  replaceRight: { plain: 'Swap the contents of the tab on the right, creating it if needed.', detail: 'Keeps a single preview tab instead of accumulating one per click.' },
  replaceLeft: { plain: 'Swap the contents of the tab on the left, creating it if needed.', detail: 'Keeps a single preview tab instead of accumulating one per click.' },
  inParent: { plain: 'Put the document on the canvas you are looking at.', detail: 'Only the freeform canvas router understands this. Anywhere else it falls through to `add` and opens a tab.' },
  inParentFromScreen: {
    plain: 'Move the document onto the canvas you are looking at, keeping it under the pointer.',
    detail: 'Screen coordinates are converted to canvas coordinates and the document is removed from whatever it was embedded in. This is the drag-out-of-a-pile path.',
  },
  overlay: { plain: 'Open the document as a floating window over the workspace.', detail: 'No `addDocTab` router has a case for this: it is reached through the `openDoc` scripting global, which adds the document to your overlay list.' },
  addRightKeyvalue: { plain: 'Open the document’s raw fields in a tab on the right.', detail: 'Shows the key/value table instead of the document’s own layout, which is how a dashboard can be inspected without switching to it.' },
};

const modifierProse = {
  none: 'No side. The document joins the tile the request came from.',
  left: 'Split to the left of the current tile, or of the workspace when there is no tile context.',
  right: 'Split to the right. The default side when a split is needed and none was named.',
  top: 'Split above. In a left-to-right workspace this rebuilds the layout as a column.',
  bottom: 'Split below. In a left-to-right workspace this rebuilds the layout as a column.',
  keyvalue: 'Render the document as a key/value table of its raw fields instead of its own layout.',
  always: 'Force the destination instead of reusing a view that already shows the document.',
};

/* ------------------------------------------------------------------ *
 * Assemble
 * ------------------------------------------------------------------ */

const enums = readEnums();
const routers = routerContracts.map(readRouter).filter(Boolean);
const overrides = readOverrides();
const layout = readLayoutAlgebra();
const callSites = readCallSites();

const slug = (value) => value.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

const destinations = (enums.get('OpenWhere') ?? []).map((entry) => {
  const prose = destinationProse[entry.member];
  if (!prose) fail(`OpenWhere.${entry.member} has no reviewed explanation`);
  const [base, ...rest] = entry.value.split(':');
  const modifier = rest.find((part) => ['left', 'right', 'top', 'bottom', 'always'].includes(part)) ?? '';
  const uses = callSites.get(`OpenWhere.${entry.member}`) ?? [];
  const claimedBy = routers
    .filter((router) => router.cases.some((entry2) => entry2.handles.includes(entry.member) || entry2.handles.includes(base)))
    .map((router) => router.id);
  return {
    id: `where-${slug(entry.member)}`,
    member: entry.member,
    value: entry.value,
    base,
    modifier,
    keyValue: entry.value.split(':').includes('keyValue'),
    plain: prose?.plain ?? '',
    detail: prose?.detail ?? '',
    comment: entry.comment,
    claimedBy,
    routed: claimedBy.length > 0,
    useCount: uses.length,
    uses: uses.slice(0, 12),
    source: { file: enumPath, line: entry.line, url: sourceUrl(enumPath, entry.line) },
  };
});

const modifiers = (enums.get('OpenWhereMod') ?? []).map((entry) => {
  if (!modifierProse[entry.member]) fail(`OpenWhereMod.${entry.member} has no reviewed explanation`);
  const uses = callSites.get(`OpenWhereMod.${entry.member}`) ?? [];
  return {
    id: `mod-${slug(entry.member)}`,
    member: entry.member,
    value: entry.value,
    plain: modifierProse[entry.member] ?? '',
    comment: entry.comment,
    useCount: uses.length,
    uses: uses.slice(0, 8),
    source: { file: enumPath, line: entry.line, url: sourceUrl(enumPath, entry.line) },
  };
});

for (const destination of destinations) {
  if (!destination.routed && !['overlay', 'inParent', 'inParentFromScreen'].includes(destination.member)) {
    fail(`OpenWhere.${destination.member} is no longer claimed by any router, and is not one of the known unrouted destinations`);
  }
}
if (!destinations.length) fail('No OpenWhere destinations were recovered');
if (failures.length) {
  throw new Error(`The open-destination map drifted from Dash-Web:\n  ${[...new Set(failures)].join('\n  ')}`);
}

const output = {
  schemaVersion: 1,
  generatedAt: sourceReference.generatedAt,
  repository: { remote: sourceReference.repository.remote, baseline: sourceReference.repository.baselineTip },
  methodology: {
    enums: 'Both destination enums parsed from OpenWhere.ts with the TypeScript compiler, values and trailing comments included',
    routers: 'Each router located by name, its switch scrutinee compared against the reviewed contract, and its case clauses recovered verbatim',
    overrides: 'Reviewed precedence rules pinned to source expressions that must still appear in the routing files',
    layout: 'The branch order inside CollectionDockingView.AddSplit pinned to its reviewed conditions',
    callSites: 'Every OpenWhere and OpenWhereMod property access in the client, with its enclosing declaration and call expression',
    driftRule:
      'Generation fails when an enum member loses its explanation, a router stops switching on the reviewed expression, an override or layout branch disappears, or a routed destination stops being claimed',
  },
  summary: {
    destinations: destinations.length,
    modifiers: modifiers.length,
    routers: routers.length,
    routingCases: routers.reduce((total, router) => total + router.cases.length, 0),
    overrides: overrides.length,
    layoutBranches: layout.length,
    callSites: [...callSites.values()].reduce((total, uses) => total + uses.length, 0),
    unroutedDestinations: destinations.filter((destination) => !destination.routed).length,
    mostUsed: destinations.slice().sort((a, b) => b.useCount - a.useCount)[0]?.member ?? '',
  },
  overrides,
  routers: routers.sort((a, b) => a.rank - b.rank),
  layout,
  destinations,
  modifiers,
};

const outputPath = path.join(root, 'src', 'data', 'generated', 'open-destinations.json');
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

console.log(
  `Wrote ${outputPath}\n` +
    `${output.summary.destinations} destinations and ${output.summary.modifiers} modifiers across ${output.summary.routers} routers ` +
    `(${output.summary.routingCases} routing cases, ${output.summary.overrides} overrides, ${output.summary.layoutBranches} layout branches); ` +
    `${output.summary.callSites} call sites traced, most-used destination is ${output.summary.mostUsed}.`
);
