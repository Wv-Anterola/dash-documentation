import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import documentTypes from '../src/data/generated/document-types.json' with { type: 'json' };
import scriptingGlobals from '../src/data/generated/scripting-globals.json' with { type: 'json' };
import sourceReference from '../src/data/generated/source-reference.json' with { type: 'json' };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.resolve(process.env.DASH_SOURCE_ROOT ?? path.join(root, '..', 'Dash-Web'));
const baseline = sourceReference.repository.baselineTip;
const remote = sourceReference.repository.remote
  .replace(/^git@github\.com:/, 'https://github.com/')
  .replace(/\.git$/, '');

function git(...args) {
  return execFileSync('git', ['-c', `safe.directory=${sourceRoot.replaceAll('\\', '/')}`, '-C', sourceRoot, ...args], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  });
}

const sourceCache = new Map();
function sourceAt(file) {
  if (!sourceCache.has(file)) sourceCache.set(file, git('show', `${baseline}:${file}`));
  return sourceCache.get(file);
}

function sourceUrl(file, line) {
  return `${remote}/blob/${baseline}/${file}#L${line}`;
}

function parse(file) {
  const source = sourceAt(file);
  return {
    source,
    sourceFile: ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS),
  };
}

function lineOf(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function nameOf(member, sourceFile) {
  if (!member?.name) return undefined;
  if (ts.isComputedPropertyName(member.name)) return member.name.expression.getText(sourceFile);
  return member.name.getText(sourceFile).replace(/^['"]|['"]$/g, '');
}

function property(object, name, sourceFile) {
  return object?.properties.find((member) =>
    (ts.isPropertyAssignment(member) || ts.isShorthandPropertyAssignment(member)) && nameOf(member, sourceFile) === name
  );
}

function initializer(member) {
  if (!member) return undefined;
  if (ts.isPropertyAssignment(member)) return member.initializer;
  if (ts.isShorthandPropertyAssignment(member)) return member.name;
  return undefined;
}

function literal(node) {
  if (!node) return undefined;
  if (ts.isStringLiteralLike(node) || ts.isNumericLiteral(node)) return node.text;
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  return undefined;
}

function compact(node, sourceFile, limit = 260) {
  if (!node) return undefined;
  const value = node.getText(sourceFile).replace(/\s+/g, ' ').trim();
  return value.length > limit ? `${value.slice(0, limit - 1)}…` : value;
}

function objectValue(object, key, sourceFile) {
  const node = initializer(property(object, key, sourceFile));
  return literal(node) ?? compact(node, sourceFile);
}

function nestedObjectValue(object, parent, key, sourceFile) {
  const parentNode = initializer(property(object, parent, sourceFile));
  return parentNode && ts.isObjectLiteralExpression(parentNode) ? objectValue(parentNode, key, sourceFile) : undefined;
}

function slug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'control';
}

const currentUserPath = 'src/client/util/CurrentUserUtils.ts';
const topBarPath = 'src/client/views/topbar/TopBar.tsx';
const documentButtonBarPath = 'src/client/views/DocumentButtonBar.tsx';
const dockingPath = 'src/client/views/collections/CollectionDockingView.tsx';
const tabDocViewPath = 'src/client/views/collections/TabDocView.tsx';
const propertiesPath = 'src/client/views/PropertiesView.tsx';
const { sourceFile: currentUserFile } = parse(currentUserPath);

const methods = new Map();
const collectMethods = (node) => {
  if (ts.isMethodDeclaration(node) && node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.StaticKeyword)) {
    const name = nameOf(node, currentUserFile);
    if (name) methods.set(name, node);
  }
  ts.forEachChild(node, collectMethods);
};
collectMethods(currentUserFile);

function returnedArray(methodName) {
  const method = methods.get(methodName);
  let result;
  const visit = (node) => {
    if (!result && ts.isReturnStatement(node) && ts.isArrayLiteralExpression(node.expression)) result = node.expression;
    if (
      !result &&
      ts.isReturnStatement(node) &&
      node.expression &&
      ts.isCallExpression(node.expression) &&
      ts.isPropertyAccessExpression(node.expression.expression) &&
      node.expression.expression.name.text === 'map' &&
      ts.isArrayLiteralExpression(node.expression.expression.expression)
    ) result = node.expression.expression.expression;
    if (!result) ts.forEachChild(node, visit);
  };
  if (method) visit(method);
  if (!result) throw new Error(`Could not find array return in CurrentUserUtils.${methodName}`);
  return result;
}

const controls = [];
const usedIds = new Map();
function uniqueId(region, group, label) {
  const base = slug(`${region}-${group}-${label}`);
  const seen = usedIds.get(base) ?? 0;
  usedIds.set(base, seen + 1);
  return seen ? `${base}-${seen + 1}` : base;
}

function addControl(row) {
  const normalized = {
    parent: '',
    icon: '',
    tooltip: '',
    controlType: 'control',
    interaction: 'Click or tap.',
    visibility: 'Available when its containing surface is open.',
    predicate: '',
    handlerExpression: '',
    handlerNames: [],
    beginner: row.tooltip ? `${String(row.tooltip).replace(/[.]$/, '')}.` : `Uses the ${row.label} control.`,
    evidence: 'source registry',
    ...row,
  };
  normalized.id ??= uniqueId(normalized.region, normalized.group, normalized.label);
  controls.push(normalized);
  return normalized;
}

function controlTypeName(value = '') {
  return String(value).replace(/^ButtonType\./, '') || 'control';
}

function interactionFor(type, hasDoubleClick) {
  const base = {
    ClickButton: 'Click or tap once.',
    ToggleButton: 'Click or tap once to switch the setting on or off.',
    MultiToggleButton: 'Click the group, then choose one of its child controls.',
    ColorButton: 'Click, then choose a color.',
    NumberSliderButton: 'Drag the slider or enter a number.',
    NumberDropdownButton: 'Open the number list or enter a number.',
    DropdownList: 'Open the list and choose one value.',
    EditText: 'Click the value, type, then confirm the edit.',
    TextButton: 'Click or tap the displayed value.',
  }[controlTypeName(type)] ?? 'Click or tap.';
  return hasDoubleClick ? `${base} A double-click runs the documented alternate action.` : base;
}

function selectionName(toolType = '') {
  const aliases = {
    'DocumentType.COL': 'a collection',
    'DocumentType.RTF': 'formatted text',
    'DocumentType.EQUATION': 'an equation',
    'DocumentType.WEB': 'a web document',
    'DocumentType.VID': 'a video',
    'DocumentType.IMG': 'an image',
    'CollectionViewType.Freeform': 'a freeform collection or child',
    'CollectionViewType.Stacking': 'a stacking collection',
    'CollectionViewType.NoteTaking': 'a note board',
    'CollectionViewType.Schema': 'a schema view',
  };
  return aliases[toolType] ?? (toolType ? `the ${toolType} tool context` : 'the matching document or view');
}

function visibilityFor({ expertMode, toolType, hidden }, parentVisibility) {
  const conditions = [];
  if (parentVisibility && !/^Available /i.test(parentVisibility)) {
    conditions.push(parentVisibility.replace(/^Appears when\s+/i, '').replace(/[.]$/, ''));
  }
  if (expertMode === true || String(hidden).includes('IsNoviceMode()')) conditions.push('Developer mode is on');
  if (String(hidden).includes('IsExploreMode()')) conditions.push('Explore mode is off');
  if (String(hidden).includes('IsNoneSelected()')) conditions.push('at least one document is selected');
  if (String(hidden).includes('SelectedDocType')) conditions.push(`${selectionName(toolType)} is selected`);
  if (String(hidden).includes('activeInkTool')) conditions.push('an ink tool is active');
  if (String(hidden).includes('NotRadiusEraser')) conditions.push('the area eraser is active');
  return conditions.length ? `Appears when ${[...new Set(conditions)].join(' and ')}.` : 'Available whenever the context toolbar is visible.';
}

function handlerNames(expression = '') {
  const ignored = new Set(['return', 'if', 'map', 'filter', 'includes', 'toString', 'new', 'undefined']);
  return [...String(expression).matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)]
    .map((match) => match[1])
    .filter((name, index, all) => !ignored.has(name) && all.indexOf(name) === index);
}

function parseControlObject(object, { region, group, parent = '', parentVisibility = '' }) {
  const label = objectValue(object, 'title', currentUserFile);
  if (typeof label !== 'string' || !label) return;
  const tooltip = objectValue(object, 'toolTip', currentUserFile) ?? '';
  const icon = objectValue(object, 'icon', currentUserFile) ?? '';
  const controlType = objectValue(object, 'btnType', currentUserFile) ?? (initializer(property(object, 'subMenu', currentUserFile)) ? 'ButtonType.MultiToggleButton' : 'control');
  const toolType = objectValue(object, 'toolType', currentUserFile) ?? '';
  const expertMode = objectValue(object, 'expertMode', currentUserFile);
  const hidden = nestedObjectValue(object, 'funcs', 'hidden', currentUserFile) ?? '';
  const openWhen = nestedObjectValue(object, 'funcs', 'linearView_isOpen', currentUserFile) ?? '';
  const onClick = nestedObjectValue(object, 'scripts', 'onClick', currentUserFile) ?? '';
  const onChange = nestedObjectValue(object, 'scripts', 'script', currentUserFile) ?? '';
  const onDoubleClick = nestedObjectValue(object, 'scripts', 'onDoubleClick', currentUserFile) ?? '';
  const expression = [onClick, onChange, onDoubleClick].filter(Boolean).join(' | ');
  let visibility = visibilityFor({ expertMode, toolType, hidden }, parentVisibility);
  const childVisibility = String(openWhen).includes('SelectedDocType')
    ? visibilityFor({ expertMode, toolType, hidden: `${hidden} ${openWhen}` }, parentVisibility)
    : visibility;
  if (!String(hidden).includes('SelectedDocType') && String(openWhen).includes('SelectedDocType')) {
    visibility = `${visibility} Its child row expands when ${selectionName(toolType)} is selected.`;
  }
  const line = lineOf(currentUserFile, object);
  const row = addControl({
    region,
    group,
    parent,
    label,
    tooltip,
    icon,
    controlType: controlTypeName(controlType),
    interaction: interactionFor(controlType, Boolean(onDoubleClick)),
    visibility,
    predicate: [hidden, openWhen, expertMode === true ? 'expertMode: true' : ''].filter(Boolean).join(' | '),
    handlerExpression: expression,
    handlerNames: handlerNames(expression),
    beginner: tooltip ? `${String(tooltip).replace(/[.]$/, '')}.` : `Opens the ${label} control group.`,
    evidence: 'document-backed registry',
    source: { file: currentUserPath, line, url: sourceUrl(currentUserPath, line) },
  });

  const reviewedOverrides = {
    'Primary toolbar|Perspective': { beginner: 'Chooses how the selected collection is laid out without replacing or copying its children.' },
    'Primary toolbar|Pin': { beginner: 'Adds the selected view to the active presentation trail.' },
    'Primary toolbar|Header': { beginner: 'Changes the selected document’s title-bar color, not its content background.' },
    'Primary toolbar|Border': { beginner: 'Changes the outline color around the selected document.' },
    'Primary toolbar|B.Width': { beginner: 'Changes how thick the selected document’s border is; zero hides it.' },
    'Primary toolbar|Overlay': { beginner: 'Switches overlay behavior for a floating document inside a freeform collection.' },
    'Doc|Bottom': {
      beginner: 'Moves the selected freeform document behind the other documents.',
      technicalDetail: 'The handler is sendToBack(). The registered tooltip says “Make doc topmost,” which conflicts with both the label and handler and should be corrected in Dash-Web.',
    },
    'Doc|Top': {
      beginner: 'Moves the selected freeform document in front of the other documents.',
      technicalDetail: 'The handler is bringToFront(). The registered tooltip says “Make doc bottommost,” which conflicts with both the label and handler and should be corrected in Dash-Web.',
    },
    'Image|Rotate': { beginner: 'Turns the selected image 90 degrees.' },
    'Image|NoBkgd': { beginner: 'Runs background removal on the selected image.' },
    'Image|MaskFgd': { beginner: 'Uses the selected image’s foreground as a mask.' },
    'Ink|Smart Draw': { beginner: 'Uses the drawing gesture as an AI-assisted drawing request.' },
  }[`${group}|${label}`];
  if (reviewedOverrides) Object.assign(row, reviewedOverrides);

  const subMenu = initializer(property(object, 'subMenu', currentUserFile));
  if (subMenu && ts.isArrayLiteralExpression(subMenu)) parseArray(subMenu, { region, group: label, parent: label, parentVisibility: childVisibility });
  else if (subMenu && ts.isCallExpression(subMenu) && ts.isPropertyAccessExpression(subMenu.expression)) {
    parseMethod(subMenu.expression.name.text, { region, group: label, parent: label, parentVisibility: childVisibility });
  }
  return row;
}

function parseArray(array, context) {
  for (const element of array.elements) {
    if (ts.isObjectLiteralExpression(element)) parseControlObject(element, context);
  }
}

function parseMethod(methodName, context) {
  parseArray(returnedArray(methodName), context);
  if (methodName === 'filterTools') {
    const method = methods.get('filterBtnDesc');
    const line = method ? lineOf(currentUserFile, method) : lineOf(currentUserFile, returnedArray(methodName));
    for (const [label, icon] of [['Star', 'star'], ['Like', 'heart'], ['Todo', 'bolt'], ['Idea', 'cloud'], ['Chat', 'robot']]) {
      const expression = 'setTagFilter(this.toolType, _added_, _readOnly_)';
      addControl({
        region: context.region,
        group: context.group,
        parent: context.parent,
        label,
        icon,
        tooltip: `Click to toggle visibility of ${label}-tagged documents`,
        controlType: 'ToggleButton',
        interaction: interactionFor('ToggleButton', false),
        visibility: `${context.parentVisibility} The default tag set is used only when no active dashboard supplies a custom set.`,
        predicate: 'Doc.UserDoc().activeDashboard ? custom tag buttons : Star/Like/Todo/Idea/Chat',
        handlerExpression: expression,
        handlerNames: ['setTagFilter'],
        beginner: `Shows or hides documents tagged ${label}; it does not delete them.`,
        evidence: 'dynamic registry factory',
        source: { file: currentUserPath, line, url: sourceUrl(currentUserPath, line) },
      });
    }
  }
}

parseMethod('contextMenuTools', { region: 'Context toolbar', group: 'Primary toolbar' });

function parseSidebar() {
  const array = returnedArray('leftSidebarMenuBtnDescriptions');
  for (const element of array.elements) {
    if (!ts.isObjectLiteralExpression(element)) continue;
    const label = objectValue(element, 'title', currentUserFile);
    if (!label) continue;
    const tooltip = objectValue(element, 'toolTip', currentUserFile) ?? label;
    const hidden = objectValue(element, 'hidden', currentUserFile) ?? nestedObjectValue(element, 'funcs', 'hidden', currentUserFile) ?? '';
    const target = objectValue(element, 'target', currentUserFile) ?? '';
    const line = lineOf(currentUserFile, element);
    const visibility = hidden === true
      ? 'Hidden as a standalone sidebar button; another surface can still use its target collection.'
      : String(hidden).includes('IsNoviceMode')
        ? 'Appears when Developer mode is on.'
        : 'Appears in the persistent left sidebar.';
    addControl({
      region: 'Sidebar',
      group: 'Panel buttons',
      label,
      tooltip,
      icon: objectValue(element, 'icon', currentUserFile) ?? '',
      controlType: 'MenuButton',
      interaction: 'Click once to open this panel. Click the active button again to close it.',
      visibility,
      predicate: String(hidden),
      handlerExpression: 'selectMainMenu(this)',
      handlerNames: ['selectMainMenu'],
      beginner: `${String(tooltip).replace(/\s*[⌘].*$/, '')} opens beside the workspace; opening it does not replace or delete canvas documents.`,
      technicalDetail: `The button targets ${target} and delegates open/close behavior to selectMainMenu(this).`,
      evidence: 'document-backed registry',
      source: { file: currentUserPath, line, url: sourceUrl(currentUserPath, line) },
    });
  }
}
parseSidebar();

function parseDockedButtons() {
  const method = methods.get('setupDockedButtons');
  let array;
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(currentUserFile) === 'btnDescs' && ts.isArrayLiteralExpression(node.initializer)) array = node.initializer;
    if (!array) ts.forEachChild(node, visit);
  };
  if (method) visit(method);
  if (!array) throw new Error('Could not find setupDockedButtons btnDescs');
  for (const element of array.elements) {
    if (!ts.isObjectLiteralExpression(element)) continue;
    const opts = initializer(property(element, 'opts', currentUserFile));
    if (!ts.isObjectLiteralExpression(opts)) continue;
    const sourceLabel = objectValue(opts, 'title', currentUserFile);
    if (!sourceLabel) continue;
    const label = {
      undoStack: 'Undo / redo history',
      linker: 'Link in progress',
      'currently playing': 'Currently playing',
    }[sourceLabel] ?? sourceLabel;
    const tooltip = objectValue(opts, 'toolTip', currentUserFile) ?? label;
    const expression = nestedObjectValue(element, 'scripts', 'onClick', currentUserFile) ?? '';
    const line = lineOf(currentUserFile, element);
    const reviewed = {
      undoStack: 'Opens the named undo and redo history so you can inspect earlier action batches.',
      linker: 'Shows that a link gesture has started and is waiting for a destination.',
      'currently playing': 'Shows the media item that is currently playing.',
      Branching: 'Opens or represents the branching-trail workflow.',
      'Toggle UI': 'Hides or restores interface buttons to make more room for the workspace.',
    }[sourceLabel];
    addControl({
      region: 'Canvas footer',
      group: 'Docked controls',
      label,
      tooltip,
      icon: objectValue(opts, 'icon', currentUserFile) ?? '',
      controlType: expression ? 'ClickButton' : 'Embedded status control',
      interaction: expression ? 'Click or tap once.' : 'Read or open the embedded status view.',
      visibility: 'Appears in the expandable control strip at the bottom of the Dash window.',
      handlerExpression: expression || objectValue(opts, 'layout', currentUserFile) || '',
      handlerNames: handlerNames(expression),
      beginner: reviewed ?? `${String(tooltip).replace(/[.]$/, '')}.`,
      technicalDetail: sourceLabel === label ? undefined : `The source registry title is ${sourceLabel}; this atlas expands it into a readable label without changing the implementation identity.`,
      evidence: 'document-backed registry',
      source: { file: currentUserPath, line, url: sourceUrl(currentUserPath, line) },
    });
  }
}
parseDockedButtons();

function findLine(file, needle, occurrence = 1) {
  const lines = sourceAt(file).split(/\r?\n/);
  let found = 0;
  for (let index = 0; index < lines.length; index += 1) {
    if (!lines[index].includes(needle)) continue;
    found += 1;
    if (found === occurrence) return index + 1;
  }
  throw new Error(`Could not find source evidence ${JSON.stringify(needle)} in ${file}`);
}

function addReviewed(row) {
  const line = findLine(row.file, row.needle, row.occurrence);
  return addControl({
    evidence: 'reviewed JSX contract',
    controlType: 'Button',
    source: { file: row.file, line, url: sourceUrl(row.file, line) },
    ...row,
    file: undefined,
    needle: undefined,
    occurrence: undefined,
  });
}

[
  { label: 'Home', needle: 'onClick={this.navigateToHome}', tooltip: 'Return to dashboard home', beginner: 'Leaves the open dashboard and shows Dash home. The dashboard stays saved.', visibility: 'Appears only while a dashboard is active.', handlerExpression: 'navigateToHome → CaptureThumbnail → Doc.ActivePage = home → closeActiveDashboard', handlerNames: [], technicalDetail: 'Captures a thumbnail when possible, changes Doc.ActivePage, then closes the active dashboard view.' },
  { label: 'Explore', needle: 'text="Explore"', tooltip: 'Browsing mode for directly navigating to documents', beginner: 'Switches from editing things to opening and moving through things.', visibility: 'Appears only while a dashboard is active.', handlerExpression: 'SnappingManager.SetExploreMode(!SnappingManager.ExploreMode)', handlerNames: [], technicalDetail: 'Flips SnappingManager.ExploreMode; the button colors reflect the current boolean state.' },
  { label: 'Dashboard title', needle: 'tooltip="Open Dashboards"', tooltip: 'Open the active dashboard menu', beginner: 'The dashboard name is also a button. Click it to open dashboard actions.', visibility: 'Appears only while a dashboard is active.', handlerExpression: 'DocumentView.getDocumentView(...).showContextMenu(...)', handlerNames: [], technicalDetail: 'Resolves the active dashboard view and opens its document context menu near the pointer.' },
  { label: 'Share / View Original', needle: "text={GetEffectiveAcl(Doc.ActiveDashboard) === AclAdmin ? 'Share' : 'View Original'}", tooltip: 'Open dashboard sharing or its original', beginner: 'Admins see Share. Other viewers see View Original. The same button opens the sharing surface for the active dashboard.', visibility: 'Appears only while a dashboard is active; its label depends on the effective ACL.', predicate: 'GetEffectiveAcl(Doc.ActiveDashboard) === AclAdmin', handlerExpression: 'SharingManager.Instance.open(undefined, Doc.ActiveDashboard)', handlerNames: [], technicalDetail: 'Passes the active dashboard to the singleton SharingManager.' },
  { label: 'Issue reporter', needle: 'tooltip="Issue Reporter', tooltip: 'Open the issue reporter', beginner: 'Opens the place to report a bug or request an improvement.', handlerExpression: 'ReportManager.Instance.open', handlerNames: [], technicalDetail: 'Calls the ReportManager singleton open action.' },
  { label: 'Help', needle: 'toolTip="Help"', tooltip: 'Open help choices', beginner: 'Opens a small menu with documentation, the tutorial, and an AI help chat.', handlerExpression: 'Dropdown items', handlerNames: [] },
  { label: 'Documentation', parent: 'Help', group: 'Help menu', needle: "val: 'documentation'", tooltip: 'Open Dash documentation', beginner: 'Opens this documentation site in a new browser tab.', handlerExpression: "window.open('https://brown-dash.github.io/Dash-Documentation/', '_blank')", handlerNames: [] },
  { label: 'Tutorial', parent: 'Help', group: 'Help menu', needle: "val: 'tutorial'", tooltip: 'Show the built-in tutorial', beginner: 'Turns Dash’s contextual tutorial messages back on.', handlerExpression: 'Doc.IsInfoUIDisabled = false', handlerNames: [], technicalDetail: 'Writes the user-facing tutorial disable flag on Doc.' },
  { label: 'Ask AI!', parent: 'Help', group: 'Help menu', needle: "val: 'tutorialagent'", tooltip: 'Create a Dash help assistant', beginner: 'Creates a new chat that is already told to answer questions about Dash, then opens it on the right.', handlerExpression: 'Docs.Create.ChatDocument(...) → DocumentViewInternal.addDocTabFunc(..., OpenWhere.addRight)', handlerNames: [], technicalDetail: 'Creates a CHAT document with is_dash_doc_assistant and adds it to the right docking location.' },
  { label: 'Settings', needle: 'tooltip="Settings', tooltip: 'Open Dash settings', beginner: 'Opens account, appearance, and Novice/Developer mode settings.', handlerExpression: 'SettingsManager.Instance.openMgr', handlerNames: [] },
  { label: 'Server heart', needle: "tooltip={'Server is '", tooltip: 'Inspect server health and version state', beginner: 'A whole heart means Dash can reach the server. A broken heart means it cannot. Click it for server details.', handlerExpression: 'ServerStats.Instance.open', handlerNames: [], technicalDetail: 'PingManager supplies reachability, SnappingManager.ServerVersion supplies the server version, and ServerStats owns the detail surface.' },
].forEach((row) => addReviewed({ region: 'Top bar', group: row.group ?? 'Persistent controls', file: topBarPath, interaction: 'Click or tap once.', visibility: 'Always visible in the top bar.', ...row }));

[
  { label: 'Links and link count', needle: '<DocumentLinksButton View={this.view0} AlwaysOn InMenu ShowCount />', tooltip: 'Open links or start a link', beginner: 'Shows this document’s links. You can inspect an existing connection or begin connecting this document to another one.', handlerExpression: 'DocumentLinksButton', handlerNames: [] },
  { label: 'Search for link target', needle: '<Tooltip title={<div>search for target</div>}>', tooltip: 'Search for a link destination', beginner: 'Use this when the document you want to connect is not visible on the canvas.', handlerExpression: 'toggleLinkSearch', handlerNames: [], technicalDetail: 'Toggles DocumentButtonBar._showLinkPopup and renders LinkPopup.' },
  { label: 'Open linked trail', needle: '<Tooltip title={<div>open linked trail</div>}>', tooltip: 'Open or create the document’s linked trail', beginner: 'Finds the presentation trail attached to this document. If none exists, Dash can make one and link it.', handlerExpression: 'toggleTrail', handlerNames: [], technicalDetail: 'Gets an anchor, creates or copies a trail when needed, links it with DocUtils.MakeLink, sets Doc.ActivePresentation, and docks the trail right.' },
  { label: 'Follow primary link', needle: '<Tooltip title={<div>follow primary link when Document clicked</div>}>', tooltip: 'Make document clicks follow its primary link', beginner: 'Turns the document into a doorway: clicking it follows its main connection instead of only selecting it.', handlerExpression: 'DocumentView.toggleFollowLink', handlerNames: [] },
  { label: 'Finish link: layout', needle: "{linkBtn(true, false, 'window-maximize')}", tooltip: 'Finish a link and save target layout state', beginner: 'Completes the link and remembers how the target was arranged.', visibility: 'Appears only while a link from another document is waiting for an endpoint.', handlerExpression: 'DocumentLinksButton.finishLinkClick(..., { pinDocLayout: true })', handlerNames: [] },
  { label: 'Finish link: content', needle: "{linkBtn(false, true, 'address-card')}", tooltip: 'Finish a link and save target content/view state', beginner: 'Completes the link and remembers what the target was showing.', visibility: 'Appears only while a link from another document is waiting for an endpoint.', handlerExpression: 'DocumentLinksButton.finishLinkClick(..., { dataannos: true, dataview: true })', handlerNames: [] },
  { label: 'Finish link: layout and content', needle: "{linkBtn(true, true, 'id-card')}", tooltip: 'Finish a link and save both kinds of state', beginner: 'Completes the link and remembers both where the target was and what it was showing.', visibility: 'Appears only while a link from another document is waiting for an endpoint.', handlerExpression: 'DocumentLinksButton.finishLinkClick(..., { pinDocLayout: true, dataannos: true, dataview: true })', handlerNames: [] },
  { label: 'Customize layout / drag embedding', needle: 'Tap to Customize Layout. Drag an embedding', tooltip: 'Open the layout template menu or drag an embedding', beginner: 'Tap to change the document’s layout. Drag to place another view of the same document.', visibility: 'Hidden in Novice mode.', predicate: 'Doc.noviceMode ? null : templateButton', handlerExpression: 'Popup(TemplateMenu) | DragManager.StartDocumentDrag(... dropActionType.embed)', handlerNames: [] },
  { label: 'Pin to trail', needle: 'Pin Document ${DocumentView.Selected().length', tooltip: 'Pin the selected document to a presentation trail', beginner: 'Adds this document as a stop in a presentation trail.', handlerExpression: 'DocumentView.PinDoc', handlerNames: [] },
  { label: 'Pin layout', needle: "{pinBtn(true, false, 'window-maximize')}", tooltip: 'Pin and remember layout state', beginner: 'Adds the document to a trail and remembers its layout.', handlerExpression: 'DocumentView.PinDoc(... { pinDocLayout: true })', handlerNames: [] },
  { label: 'Pin content view', needle: "{pinBtn(false, true, 'address-card')}", tooltip: 'Pin and remember content/view state', beginner: 'Adds the document to a trail and remembers what it was showing.', handlerExpression: 'DocumentView.PinDoc(... { dataview: true })', handlerNames: [] },
  { label: 'Pin layout and content', needle: "{pinBtn(true, true, 'id-card')}", tooltip: 'Pin and remember layout plus content/view state', beginner: 'Adds the document to a trail and remembers both kinds of state.', handlerExpression: 'DocumentView.PinDoc(... { pinDocLayout: true, dataview: true })', handlerNames: [] },
  { label: 'Schedule in calendar', needle: "{pinBtn(false, false, 'calendar')}", tooltip: 'Schedule the selected document', beginner: 'Opens the calendar workflow instead of adding a normal trail step.', handlerExpression: 'CalendarManager.Instance.open(this.view0, targetDoc)', handlerNames: [] },
  { label: 'Edit with AI', needle: 'className="dash-ai-editor-button">Edit with AI', tooltip: 'Open the renderer’s AI editor', beginner: 'Opens the AI editing tool supported by this kind of document. Dragging can start Smart Draw in its parent view.', visibility: 'Appears only when the selected renderer reports HasAIEditor.', predicate: 'this.view0?.HasAIEditor', handlerExpression: 'DocumentView.toggleAIEditor | SmartDrawHandler.Instance.startDragging', handlerNames: [] },
  { label: 'Show tags', needle: 'className="dash-keyword-button">Show tags', tooltip: 'Show or hide tags', beginner: 'Displays the labels attached to the selected document. It does not add or remove the tags.', visibility: 'Appears unless the selected component explicitly returns false from showTags().', predicate: 'ComponentView.showTags?.() !== false', handlerExpression: 'layoutDoc._layout_showTags = true | undefined', handlerNames: [] },
  { label: 'Document sharing', needle: 'Open Sharing Manager', tooltip: 'Open sharing for the selected document', beginner: 'Chooses who may see or edit this document.', visibility: 'Appears only when documentLinksButton_fullMenu is enabled.', predicate: 'Doc.UserDoc().documentLinksButton_fullMenu', handlerExpression: 'SharingManager.Instance.open(this.view0, targetDoc)', handlerNames: [] },
  { label: 'Context menu', needle: 'Open Context Menu', tooltip: 'Open all actions for the selected document', beginner: 'Opens the same larger action menu you can normally get by right-clicking the document.', handlerExpression: 'openContextMenu → simulateMouseClick', handlerNames: [] },
].forEach((row) => addReviewed({ region: 'Document decorations', group: 'Selected-document action bar', file: documentButtonBarPath, interaction: 'Click or tap once.', visibility: 'Appears when a document is selected and its decorations are visible.', ...row }));

[
  ['Fields & Tags', 'title="Fields & Tags"', 'Inspect or edit the selected document’s typed data fields and tags.', 'Novice mode shows a reduced field editor; Developer mode exposes the expanded editor.'],
  ['Options', 'title="Options"', 'Change common appearance and interaction settings for the selected layout.', 'The section renders PropertiesButtons for the current selection.'],
  ['Linked To', 'title="Linked To"', 'Inspect links connected to the selected document.', 'The list comes from the selected link anchor; removing a link does not remove either endpoint document.'],
  ['Appearance', 'title="Appearance"', 'Edit supported appearance details for selected ink or grouped strokes.', 'The ink editor appears only when supported strokes are selected.'],
  ['Firefly', 'title="Firefly"', 'Generate an image from compatible selected drawing content.', 'DrawingFillHandler owns the image-generation action and reference-strength value.'],
  ['Transform', 'title="Transform"', 'Change width, height, x, y, and related layout geometry.', 'These values belong to the selected layout context, not necessarily the shared data document.'],
  ['Other Contexts', 'title="Other Contexts"', 'Open other collections that show the same underlying document.', 'Contexts are delegates or embeddings of the same data, not automatically independent copies.'],
  ['Sharing and Permissions', 'title="Sharing and Permissions"', 'Inspect and change access for the selected document or layout.', 'Hidden in Novice mode. ACL edits are applied through the sharing table.'],
  ['Filters', 'title="Filters"', 'Choose which children of a collection are visible.', 'FilterPanel writes collection filter state; filtering is not deletion.'],
  ['Layout', 'title="Layout"', 'Inspect the raw layout preview and layout-level configuration.', 'Hidden in Novice mode because it exposes implementation-facing layout state.'],
  ['Visibility', 'Visibility', 'Choose when a selected presentation item appears and for how long.', 'Appears only in presentation editing with at least one selected item.'],
  ['Progressivize', 'Progressivize', 'Control progressive reveal for selected presentation items.', 'Appears only in presentation editing with at least one selected item.'],
  ['Media', 'Media', 'Configure media playback behavior for a selected presentation item.', 'Appears only in presentation editing with at least one selected item.'],
  ['Media options', "type === DocumentType.AUDIO ? 'file-audio' : 'file-video'", 'Configure audio- or video-specific options for the selected presentation item.', 'Appears only for selected AUDIO or VID presentation content.'],
  ['Transitions', 'Transitions', 'Choose how a selected presentation item transitions.', 'Appears only in presentation editing with at least one selected item.'],
].forEach(([label, needle, beginner, technicalDetail]) => addReviewed({
  region: 'Properties panel',
  group: label === 'Visibility' || ['Progressivize', 'Media', 'Media options', 'Transitions'].includes(label) ? 'Presentation properties' : 'Document properties',
  file: propertiesPath,
  label,
  needle,
  tooltip: label,
  beginner,
  technicalDetail,
  interaction: 'Click the section heading to expand or collapse it, then use the controls inside.',
  visibility: technicalDetail.startsWith('Appears') || technicalDetail.startsWith('Hidden') ? technicalDetail : 'Appears when a compatible document is selected.',
  handlerExpression: 'PropertiesView observable section state and section-specific editor',
  handlerNames: [],
}));

/**
 * The tab and tile chrome is the one region of Dash whose controls are not
 * Dash's own components: GoldenLayout draws them, and Dash rebinds their click
 * handlers afterwards. Two of them therefore do something other than what their
 * upstream name implies, which is exactly why they need tracing rather than a
 * hand-written table.
 */
[
  {
    label: 'Tab title',
    file: tabDocViewPath,
    needle: 'titleEle.onchange = (e: InputEvent) => {',
    tooltip: 'Rename the tab',
    controlType: 'EditText',
    interaction: 'Click the title, type, then commit the edit. Drag the tab to move it to another tile.',
    beginner: 'The tab name is the document’s title. Editing it renames the document everywhere, not just on this tab.',
    handlerExpression: "undoable(() => { doc.$title = value }, 'edit tab title')",
    technicalDetail: 'The title element is GoldenLayout’s own input. Dash replaces its onchange with an undoable write to doc.$title and resizes the input to the title length.',
  },
  {
    label: 'Tab type icon',
    file: tabDocViewPath,
    needle: '<Tooltip title="click for menu, drag to embed in document">',
    tooltip: 'click for menu, drag to embed in document',
    beginner: 'The small icon shows what kind of document the tab holds. Clicking it opens that document’s menu; dragging it places another view of the same document somewhere else.',
    visibility: 'Appears once per tab, only while the tab header has not already been given its own controls.',
    predicate: 'tab.element[0].children[1].children.length === 1',
    handlerExpression: 'setupMoveUpEvents → DragManager.StartDocumentDrag | DocumentView.SelectView + simulateMouseClick',
    technicalDetail: 'One pointer-down handler serves both gestures: a move becomes a document drag whose abort closes the split, and a click selects the view and simulates a click on the deepest content element to raise its menu.',
  },
  {
    label: 'Tab lightbox icon',
    file: tabDocViewPath,
    needle: '<Tooltip title="click to open in lightbox">',
    tooltip: 'click to open in lightbox',
    beginner: 'Opens the tab’s document full-screen over the workspace. The tab stays where it is.',
    handlerExpression: 'addDocTab(doc, OpenWhere.lightboxAlways)',
    technicalDetail: 'An iconified document is de-iconified first, reusing an existing free embedding when one exists rather than creating a second one.',
  },
  {
    label: 'Tab close',
    file: dockingPath,
    needle: "className.includes('lm_maximise') || className.includes('lm_close_tab')",
    tooltip: 'Close this tab',
    beginner: 'Removes the tab from the workspace. The document is kept in Recently Closed unless it is still open somewhere else, so this is not a delete.',
    handlerExpression: 'tabDestroyed → Doc.AddDocToList(MyRecentlyClosed) → Doc.RemoveDocFromList(dashboard)',
    technicalDetail: 'Closing routes through tabDestroyed. Presentation documents and key/value tabs are excluded from the Recently Closed write, and a document that is still embedded elsewhere is not added to Recently Closed at all.',
  },
  {
    label: 'Tile close',
    file: dockingPath,
    needle: ".find('.lm_close') // get the close icon",
    tooltip: 'Close this tile',
    beginner: 'Closes the whole tile and every tab in it. Dash refuses to close the last remaining tile.',
    visibility: 'Appears on each tile header. Its action is refused when the tile is the only one left.',
    predicate: '(!stack.parent.isRoot && !stack.parent.parent.isRoot) || stack.parent.contentItems.length > 1',
    handlerExpression: "UndoManager.StartBatch('close stack') → stack.remove() → stateChanged()",
    technicalDetail: 'Dash unbinds GoldenLayout’s own close handler and substitutes its own. The refusal path raises a browser alert reading “cant delete the last stack”, which is a raw implementation string rather than reviewed interface copy.',
  },
  {
    label: 'Tile maximize',
    file: dockingPath,
    needle: ".find('.lm_maximise') // get the close icon",
    tooltip: 'Maximize or restore this tile',
    controlType: 'ToggleButton',
    beginner: 'Expands the tile to fill the workspace, and expands back when clicked again. Nothing is moved or closed.',
    handlerExpression: 'GoldenLayout toggleMaximise → requestAnimationFrame(stateChanged)',
    technicalDetail: 'Dash adds a handler rather than replacing GoldenLayout’s, so the upstream maximize still runs and Dash only persists the resulting layout. CollectionDockingView.HasFullScreen reads _maximisedItem, and CloseFullScreen restores it.',
  },
  {
    label: 'Tile new tab',
    file: dockingPath,
    needle: ".find('.lm_popout') // get the popout icon",
    tooltip: 'Add a new tab to this tile',
    beginner: 'Adds a new empty freeform canvas as a tab in this tile, named Untitled Tab with the next number.',
    handlerExpression: "addNewDoc → Docs.Create.FreeformDocument([], { title: 'Untitled Tab N' }) → CollectionDockingView.AddSplit",
    technicalDetail: 'This is GoldenLayout’s popout control with its click handler unbound and replaced. It does not pop the tile into a browser window; the upstream icon name is the only trace of that behavior. The counter lives on the active dashboard as $myPaneCount.',
  },
  {
    label: 'Empty tile background',
    file: dockingPath,
    needle: "ele?.className === 'empty-tabs-message'",
    tooltip: 'Add the first tab to an empty tile',
    controlType: 'Click target',
    beginner: 'Clicking the message in an empty tile creates the same new canvas tab the plus control would.',
    visibility: 'Appears only while a tile has no tabs.',
    predicate: 'stack.contentItems.length === 0',
    handlerExpression: 'addNewDoc',
    technicalDetail: 'The hit test looks for the empty-tabs-message element under the pointer rather than binding a handler to it.',
  },
  {
    label: 'Tab drag between tiles',
    file: dockingPath,
    needle: 'tabDragStart = (proxy: any, finishDrag?: (aborted: boolean) => void) => {',
    tooltip: 'Move a tab to another tile or split',
    controlType: 'Drag target',
    interaction: 'Press the tab and drag it to another tile, edge, or the canvas.',
    beginner: 'Moves the tab. Dropping it on a tile edge splits that tile; aborting the drag puts the layout back exactly as it was.',
    handlerExpression: "UndoManager.StartBatch('tab move') → DragManager.CompleteWindowDrag",
    technicalDetail: 'An aborted drag cancels the undo batch and rebuilds GoldenLayout from the saved configuration, so a cancelled move leaves no undo entry.',
  },
  {
    label: 'Drag a document into the tab bar',
    file: dockingPath,
    needle: 'public StartOtherDrag = (e: { pageX: number; pageY: number }, dragDocs: Doc[]',
    tooltip: 'Dock a canvas document as a tab',
    controlType: 'Drag target',
    interaction: 'Drag a document off a freeform canvas and onto the tab bar or a tile edge.',
    beginner: 'Turns a document on the canvas into its own tab. Dragging several at once docks them as a row.',
    handlerExpression: 'StartOtherDrag → DashboardView.makeDocumentConfig → GoldenLayout createDragSource',
    technicalDetail: 'A single document becomes one config; several become a row config. The drag is handed to a synthetic GoldenLayout drag source, which is why the gesture changes character mid-drag.',
  },
].forEach((row) =>
  addReviewed({
    region: 'Tabs and tiles',
    group: row.file === tabDocViewPath ? 'Tab header' : 'Tile chrome',
    controlType: 'Button',
    interaction: 'Click or tap once.',
    visibility: 'Appears on the tab and tile chrome that frames the workspace.',
    evidence: 'reviewed layout-chrome contract',
    handlerNames: [],
    ...row,
  })
);

for (const creator of documentTypes.paletteTemplates) {
  addControl({
    region: 'Tools palette',
    group: 'Document creators',
    label: creator.title,
    tooltip: creator.tooltip ?? `Create ${creator.title}`,
    controlType: 'Creator button',
    interaction: 'Click to create in the default destination, or drag to choose the position.',
    visibility: 'Availability follows the current Tools palette registry and any Novice-mode hidden predicate on its descriptor.',
    handlerExpression: `copyDragFactory → ${creator.factory}`,
    handlerNames: ['copyDragFactory', 'openDoc'],
    beginner: `Makes a new ${creator.title} from Dash’s ${creator.factory} template${creator.documentTypes?.length ? ` (${creator.documentTypes.join(', ')})` : ''}.`,
    technicalDetail: `The source registry keeps an empty template document and copies it on click or drag. Factory expression: ${creator.creator}.`,
    evidence: 'creator registry',
    source: creator.source,
  });
}

const globalByName = new Map(scriptingGlobals.globals.map((entry) => [entry.name, entry]));
const ownerOverrides = {
  setActiveTool: 'Doc.ActiveTool / Doc.ActiveInk / Doc.ActiveEraser and SnappingManager gesture state',
  setInkProperty: 'active ink defaults and selected ink documents',
  setFontAttr: 'RichTextMenu and selected rich-text content',
  toggleCharStyle: 'RichTextMenu and selected rich-text content',
  showFreeform: 'the selected document or collection layout',
  setTagFilter: 'the selected collection’s child filter list',
  pinWithView: 'the active presentation trail and selected view',
  setView: 'the selected collection’s active perspective',
  webSetURL: 'the selected web document and WebBox',
  undo: 'UndoManager undo and redo stacks',
  redo: 'UndoManager undo and redo stacks',
};

function inferredOwner(handler, row) {
  if (!handler) return row.technicalDetail ?? 'The component or manager named by the handler expression.';
  if (ownerOverrides[handler.name]) return ownerOverrides[handler.name];
  if (handler.effects?.writes?.length) return handler.effects.writes.slice(0, 4).join(', ');
  if (/^image/i.test(handler.name)) return 'the selected image document and its ImageBox renderer';
  if (/^web/i.test(handler.name)) return 'the selected web document and its WebBox renderer';
  if (/^video/i.test(handler.name)) return 'the selected video document and its video renderer';
  if (/^equation_/i.test(handler.name)) return 'the selected equation document and equation renderer';
  if (/schema/i.test(handler.name)) return 'the selected schema collection and schema view';
  if (/template/i.test(handler.name)) return 'the current user document’s default-template fields';
  if (/front|back|zorder|raise/i.test(handler.name)) return 'the selected freeform document’s layout ordering fields';
  return handler.effects?.calls?.[0] ?? row.technicalDetail ?? 'The component or manager named by the handler expression.';
}

for (const row of controls) {
  const names = [...new Set([...(row.handlerNames ?? []), ...handlerNames(row.handlerExpression)])];
  const resolved = names.map((name) => globalByName.get(name)).filter(Boolean);
  const primary = resolved[0];
  row.handler = {
    names,
    resolved: resolved.map((entry) => ({
      name: entry.name,
      signature: entry.signature,
      purpose: entry.purpose,
      writes: entry.effects?.writes ?? [],
      calls: entry.effects?.calls ?? [],
      source: entry.source,
    })),
    stateOwner: inferredOwner(primary, row),
  };
  if (row.beginner.length < 20) {
    const target = {
      Align: 'the selected paragraph alignment',
      Board: 'the selected note board',
      Eqn: 'the selected equation',
      Eraser: 'the active eraser mode',
      Filter: 'which collection children are visible',
      Image: 'the selected image',
      Ink: 'the active drawing tool',
      Lists: 'the selected text list',
      Schema: 'the selected schema view',
      Sort: 'the selected collection order',
      Stack: 'the selected stack layout',
      Styles: 'the selected text style',
      Text: 'the selected formatted text',
      View: 'the selected collection view',
      Web: 'the selected web document',
    }[row.group] ?? (row.region === 'Canvas footer' ? 'the current workspace action history' : 'the current selection');
    row.beginner = `${row.beginner.replace(/[.]$/, '')}. It changes ${target}.`;
  }
  delete row.handlerNames;
}

const regionOrder = ['Top bar', 'Sidebar', 'Context toolbar', 'Document decorations', 'Properties panel', 'Tabs and tiles', 'Tools palette', 'Canvas footer'];
controls.sort((a, b) =>
  regionOrder.indexOf(a.region) - regionOrder.indexOf(b.region) ||
  Number(Boolean(a.parent)) - Number(Boolean(b.parent)) ||
  a.source.line - b.source.line ||
  a.label.localeCompare(b.label)
);
const regions = [...new Set(controls.map((row) => row.region))];
const controlTypes = [...new Set(controls.map((row) => row.controlType))].sort();
const resolvedHandlers = controls.filter((row) => row.handler.resolved.length).length;
const nestedControls = controls.filter((row) => row.parent).length;

const output = {
  schemaVersion: 1,
  generatedAt: sourceReference.generatedAt,
  repository: { remote, baseline },
  methodology: {
    registryParser: 'TypeScript compiler AST over CurrentUserUtils context-menu, submenu, sidebar, creator, and docked-control registries',
    jsxContracts: 'Reviewed visible-control contracts whose evidence needles must exist in TopBar, DocumentButtonBar, and PropertiesView',
    handlerJoin: 'Script function names joined to the source-generated scripting-global index for signatures, calls, and writes',
    driftRule: 'Generation fails when a reviewed source needle or required registry disappears',
  },
  summary: {
    controls: controls.length,
    regions: regions.length,
    groups: new Set(controls.map((row) => `${row.region}:${row.group}`)).size,
    nestedControls,
    handlerResolvedControls: resolvedHandlers,
    directComponentContracts: controls.filter((row) => row.evidence === 'reviewed JSX contract').length,
    registryControls: controls.filter((row) => row.evidence.includes('registry')).length,
  },
  regions,
  controlTypes,
  controls,
};

const outputPath = path.join(root, 'src', 'data', 'generated', 'interface-controls.json');
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

console.log(
  `Wrote ${outputPath}\n` +
    `${output.summary.controls} controls across ${output.summary.regions} regions and ${output.summary.groups} groups; ` +
    `${output.summary.handlerResolvedControls} controls joined to scripting-global implementations.`
);
