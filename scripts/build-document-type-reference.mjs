import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
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

function sourceAt(file) {
  return git('show', `${baseline}:${file}`);
}

function sourceUrl(file, line) {
  return `${remote}/blob/${baseline}/${file}#L${line}`;
}

function parse(file, source = sourceAt(file)) {
  return {
    source,
    sourceFile: ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS),
  };
}

function lineOf(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function propertyName(member, sourceFile) {
  if (!member.name) return undefined;
  if (ts.isComputedPropertyName(member.name)) return member.name.expression.getText(sourceFile);
  return member.name.getText(sourceFile).replace(/^['"]|['"]$/g, '');
}

function property(object, name, sourceFile) {
  return object?.properties.find((member) =>
    (ts.isPropertyAssignment(member) || ts.isShorthandPropertyAssignment(member)) && propertyName(member, sourceFile) === name
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

function resolvedLiteral(node, sourceFile) {
  const direct = literal(node);
  if (direct !== undefined || !node || !ts.isIdentifier(node)) return direct;
  let result;
  const visit = (child) => {
    if (result !== undefined) return;
    if (ts.isVariableDeclaration(child) && ts.isIdentifier(child.name) && child.name.text === node.text) {
      result = literal(child.initializer);
      return;
    }
    ts.forEachChild(child, visit);
  };
  visit(sourceFile);
  return result;
}

function documentTypeName(node) {
  if (!node) return undefined;
  if (ts.isPropertyAccessExpression(node) && node.expression.getText() === 'DocumentType') return node.name.text;
  let result;
  const visit = (child) => {
    if (!result && ts.isPropertyAccessExpression(child) && child.expression.getText() === 'DocumentType') {
      result = child.name.text;
      return;
    }
    ts.forEachChild(child, visit);
  };
  visit(node);
  return result;
}

function compact(node, sourceFile, limit = 220) {
  if (!node) return undefined;
  const value = node.getText(sourceFile).replace(/\s+/g, ' ').trim();
  return value.length > limit ? `${value.slice(0, limit - 1)}…` : value;
}

function objectEntries(node, sourceFile) {
  if (!node || !ts.isObjectLiteralExpression(node)) return [];
  return node.properties.map((member) => {
    if (ts.isSpreadAssignment(member)) return { key: `...${compact(member.expression, sourceFile, 80)}`, value: 'spread' };
    const key = propertyName(member, sourceFile);
    const value = initializer(member);
    return { key: key ?? compact(member, sourceFile, 80), value: compact(value, sourceFile, 160) ?? 'method' };
  });
}

const taxonomy = {
  NONE: ['sentinel', 'sentinel', 'No document', 'Represents the absence of a document type; it is excluded from prototype initialization.'],
  RTF: ['content', 'surface', 'Formatted text', 'Stores ProseMirror-compatible rich text, annotations, and text-specific layout state.'],
  IMG: ['content', 'surface', 'Image', 'Stores an ImageField and renders image, crop, annotation, and manipulation behavior.'],
  WEB: ['content', 'surface', 'Web page', 'Stores a WebField URL and renders the browser/proxy-backed web surface.'],
  HTML: ['content', 'surface', 'HTML page', 'Stores an HtmlField and renders authored or imported HTML content.'],
  COL: ['container', 'surface', 'Collection', 'Stores child Docs in one list while _type_collection selects the spatial or structured subview.'],
  KVP: ['structure', 'supporting', 'Key/value view', 'Renders fields from another document through a key/value layout; normally selected as a view, not created as standalone content.'],
  VID: ['media', 'surface', 'Video', 'Stores a VideoField and renders temporal playback and annotation controls.'],
  AUDIO: ['media', 'surface', 'Audio', 'Stores an AudioField and renders audio playback, waveform, and recording-related state.'],
  REC: ['media', 'supporting', 'Recording playback', 'Uses the video renderer for a persisted recording document.'],
  PDF: ['content', 'surface', 'PDF', 'Stores a PdfField and renders paged reading, navigation, selection, and annotation behavior.'],
  INK: ['content', 'surface', 'Ink stroke', 'Stores an InkField plus stroke geometry, color, marker, and mask properties.'],
  DIAGRAM: ['analysis', 'surface', 'Diagram', 'Stores diagram source text and renders it through the diagram surface.'],
  SCREENSHOT: ['capture', 'surface', 'Screen capture', 'Represents an interactive screen-capture surface before or after image creation.'],
  FONTICON: ['control', 'surface', 'Icon', 'Renders an icon as a document so it can participate in layout, linking, and scripts.'],
  SEARCH: ['utility', 'surface', 'Search', 'Stores a persistent query/result context and renders search controls and results.'],
  IMAGEGROUPER: ['research', 'surface', 'Image grouper', 'Hosts image clustering and labeling interactions.'],
  FACECOLLECTION: ['research', 'surface', 'Face collection', 'Stores and renders a collection organized around detected faces.'],
  UFACE: ['research', 'supporting', 'Unique face', 'Represents one deduplicated face group inside the face-collection workflow.'],
  LABEL: ['control', 'surface', 'Label', 'Renders simple document-backed text without the full rich-text editor.'],
  BUTTON: ['control', 'surface', 'Button', 'Reuses the label renderer while exposing a document-backed scripted action surface.'],
  WEBCAM: ['capture', 'surface', 'Webcam', 'Hosts live camera capture and recording controls.'],
  CONFIG: ['system', 'system', 'Configuration record', 'Stores reconstructable view state without producing a normal view delegate or visible renderer.'],
  SCRIPTING: ['automation', 'surface', 'Script editor', 'Stores a ScriptField and renders the editor used to compile document behavior.'],
  CHAT: ['intelligence', 'surface', 'Chat workspace', 'Stores chat-level state and renders retrieval/model interaction around documents.'],
  CHATMSG: ['intelligence', 'supporting', 'Chat message', 'Stores one serialized assistant or user message linked back to its chat.'],
  EQUATION: ['analysis', 'surface', 'Equation', 'Stores equation text and renders editing, evaluation, and math display behavior.'],
  FUNCPLOT: ['analysis', 'surface', 'Function plot', 'Stores supporting documents and renders a mathematical plot.'],
  MAP: ['spatial', 'surface', 'Map', 'Stores map children and renders the Mapbox-backed spatial workspace.'],
  VIEWER3D: ['spatial', 'surface', '3D model viewer', 'Stores a Viewer3DField and renders an imported 3D model.'],
  SKETCH3D: ['spatial', 'surface', '3D sketch', 'Stores 3D sketch state and renders the sketching surface.'],
  DATAVIZ: ['analysis', 'surface', 'Data visualization', 'Stores a CsvField and chart/table configuration used by the visualization surface.'],
  ANNOPALETTE: ['annotation', 'surface', 'Annotation palette', 'Stores reusable annotation or sticker documents and renders their palette.'],
  LOADING: ['transient', 'supporting', 'Loading placeholder', 'Temporarily occupies a document identity while an asynchronous import is completed.'],
  LINK: ['relationship', 'supporting', 'Link', 'Stores two document anchors as a first-class, navigable relationship.'],
  PRES: ['presentation', 'surface', 'Presentation trail', 'Stores an ordered set of presentation steps and renders trail playback and editing.'],
  PRESSLIDE: ['presentation', 'supporting', 'Presentation slide', 'Defines the prototype used for an individual presentation step or slide.'],
  COMPARISON: ['composition', 'surface', 'Comparison', 'Stores front/back or paired document state; flashcards are a configured comparison variant.'],
  PUSHPIN: ['spatial', 'supporting', 'Map pin', 'Stores coordinates and child content rendered as a map marker.'],
  MAPROUTE: ['spatial', 'supporting', 'Map route', 'Stores route-associated children and map route state; its prototype intentionally has an empty layout.'],
  SCRIPTDB: ['system', 'system', 'Global script database', 'Names the singleton prototype-backed store for shared scripts.'],
  GROUPDB: ['system', 'system', 'Global group database', 'Names the singleton prototype-backed store for sharing groups.'],
  JOURNAL: ['workflow', 'surface', 'Daily journal', 'Combines rich-text-like content with journal-specific prompts and organization.'],
  TASK: ['workflow', 'surface', 'Task', 'Stores task text and task-specific state in a dedicated renderer.'],
  SCRAPBOOK: ['workflow', 'surface', 'Scrapbook', 'Stores a list of collected documents in a scrapbook-specific interface.'],
  LIFECOACH: ['workflow', 'surface', 'Life-coach workspace', 'Hosts the life-coach research workflow and its document context.'],
  LCEVENT: ['workflow', 'supporting', 'Life event', 'Represents an event record composed inside the life-coach workflow.'],
  POLICY_TESTIMONY: ['workflow', 'surface', 'Policy testimony', 'Stores testimony text and research-specific analysis state.'],
  POLICY_CHECKER: ['workflow', 'surface', 'Policy checker', 'Stores policy input and renders the policy-analysis workflow.'],
  VIDGEN: ['intelligence', 'surface', 'Video generator', 'Stores scene and generation state for the model-assisted video workflow.'],
  AGENT: ['intelligence', 'surface', 'Acting agent', 'Stores agent workspace state and renders tool-using model interactions.'],
};

const documentTypesPath = 'src/client/documents/DocumentTypes.ts';
const documentsPath = 'src/client/documents/Documents.ts';
const mainPath = 'src/client/views/Main.tsx';
const currentUserPath = 'src/client/util/CurrentUserUtils.ts';

const { sourceFile: enumFile } = parse(documentTypesPath);
const enumTypes = [];
const collectionViewTypes = [];
for (const statement of enumFile.statements) {
  if (!ts.isEnumDeclaration(statement)) continue;
  const target = statement.name.text === 'DocumentType' ? enumTypes : statement.name.text === 'CollectionViewType' ? collectionViewTypes : undefined;
  if (!target) continue;
  for (const member of statement.members) {
    target.push({
      name: member.name.getText(enumFile),
      value: literal(member.initializer) ?? compact(member.initializer, enumFile),
      source: { file: documentTypesPath, line: lineOf(enumFile, member), url: sourceUrl(documentTypesPath, lineOf(enumFile, member)) },
    });
  }
}

const templateFiles = git('grep', '-l', '-E', 'TemplateMap\\.set|export const TemplateMap', baseline, '--', 'src/client')
  .split(/\r?\n/)
  .map((row) => row.replace(new RegExp(`^${baseline}:`), ''))
  .filter(Boolean)
  .sort();

const prototypeRegistrations = [];
function addPrototype(type, template, file, sourceFile, registrationNode, registrationStyle) {
  if (!type || !template || !ts.isObjectLiteralExpression(template)) return;
  const layout = initializer(property(template, 'layout', sourceFile));
  const view = ts.isObjectLiteralExpression(layout) ? initializer(property(layout, 'view', sourceFile)) : undefined;
  const dataField = ts.isObjectLiteralExpression(layout) ? initializer(property(layout, 'dataField', sourceFile)) : undefined;
  const options = initializer(property(template, 'options', sourceFile));
  const data = initializer(property(template, 'data', sourceFile));
  const line = lineOf(sourceFile, registrationNode);
  prototypeRegistrations.push({
    type,
    renderer: compact(view, sourceFile, 100) ?? 'unknown',
    dataField: resolvedLiteral(dataField, sourceFile) ?? compact(dataField, sourceFile, 80) ?? 'data',
    prototypeData: compact(data, sourceFile, 140),
    options: objectEntries(options, sourceFile),
    registrationStyle,
    source: { file, line, url: sourceUrl(file, line) },
  });
}

for (const file of templateFiles) {
  const { sourceFile } = parse(file);
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(sourceFile) === 'TemplateMap' && ts.isNewExpression(node.initializer)) {
      const entries = node.initializer.arguments?.[0];
      if (entries && ts.isArrayLiteralExpression(entries)) {
        for (const entry of entries.elements) {
          if (!ts.isArrayLiteralExpression(entry) || entry.elements.length < 2) continue;
          addPrototype(documentTypeName(entry.elements[0]), entry.elements[1], file, sourceFile, entry, 'initial-map');
        }
      }
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'set' && node.expression.expression.getText(sourceFile).endsWith('TemplateMap')) {
      addPrototype(documentTypeName(node.arguments[0]), node.arguments[1], file, sourceFile, node, 'module-registration');
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
}

const { sourceFile: mainFile } = parse(mainPath);
const rendererRegistry = [];
let rendererRegistrySource;
const visitMain = (node) => {
  if (ts.isCallExpression(node) && node.expression.getText(mainFile) === 'DocumentContentsView.Init') {
    const registry = node.arguments[1];
    rendererRegistrySource = { file: mainPath, line: lineOf(mainFile, node), url: sourceUrl(mainPath, lineOf(mainFile, node)) };
    if (registry && ts.isObjectLiteralExpression(registry)) {
      for (const member of registry.properties) {
        const key = propertyName(member, mainFile);
        const value = initializer(member);
        if (!key || !value) continue;
        const line = lineOf(mainFile, member);
        rendererRegistry.push({ name: key, component: compact(value, mainFile, 100), source: { file: mainPath, line, url: sourceUrl(mainPath, line) } });
      }
    }
  }
  ts.forEachChild(node, visitMain);
};
visitMain(mainFile);

const { sourceFile: documentsFile } = parse(documentsPath);
const parameterDefault = (fn, name) => {
  const parameter = fn.parameters.find((item) => item.name.getText(documentsFile) === name);
  return literal(parameter?.initializer);
};
const factoryRows = [];
let instanceSource;
let initializeSource;
let prototypeLookupSource;
let buildPrototypeSource;

function callerEvidence(name) {
  const id = `${documentsPath}#${name}`;
  const calls = sourceReference.graph.calls.filter((call) => call.targetIds.includes(id));
  return {
    count: calls.length,
    examples: calls.slice(0, 3).map((call) => ({
      owner: call.from,
      source: { file: call.path, line: call.line, url: sourceUrl(call.path, call.line) },
    })),
  };
}

function instanceCallIn(fn) {
  let found;
  const visit = (node) => {
    if (!found && ts.isCallExpression(node) && node.expression.getText(documentsFile) === 'InstanceFromProto') found = node;
    ts.forEachChild(node, visit);
  };
  visit(fn.body);
  return found;
}

function prototypeGetIn(fn) {
  let found;
  const visit = (node) => {
    if (!found && ts.isCallExpression(node) && node.expression.getText(documentsFile) === 'Prototypes.get') found = node;
    ts.forEachChild(node, visit);
  };
  visit(fn.body);
  return found;
}

for (const statement of documentsFile.statements) {
  if (!ts.isModuleDeclaration(statement) || statement.name.getText(documentsFile) !== 'Docs') continue;
  const docsBlock = statement.body;
  if (!docsBlock || !ts.isModuleBlock(docsBlock)) continue;
  for (const namespace of docsBlock.statements) {
    if (ts.isModuleDeclaration(namespace) && namespace.name.getText(documentsFile) === 'Prototypes' && namespace.body && ts.isModuleBlock(namespace.body)) {
      for (const member of namespace.body.statements) {
        if (!ts.isFunctionDeclaration(member) || !member.name) continue;
        const source = { file: documentsPath, line: lineOf(documentsFile, member), url: sourceUrl(documentsPath, lineOf(documentsFile, member)) };
        if (member.name.text === 'initialize') initializeSource = source;
        if (member.name.text === 'get') prototypeLookupSource = source;
        if (member.name.text === 'buildPrototype') buildPrototypeSource = source;
      }
    }
    if (!ts.isModuleDeclaration(namespace) || namespace.name.getText(documentsFile) !== 'Create' || !namespace.body || !ts.isModuleBlock(namespace.body)) continue;
    for (const fn of namespace.body.statements) {
      if (!ts.isFunctionDeclaration(fn) || !fn.name || !fn.body) continue;
      if (fn.name.text === 'InstanceFromProto') {
        instanceSource = { file: documentsPath, line: lineOf(documentsFile, fn), url: sourceUrl(documentsPath, lineOf(documentsFile, fn)) };
        continue;
      }
      const instance = instanceCallIn(fn);
      const lookup = prototypeGetIn(fn);
      if (!instance && !lookup) continue;
      const type = documentTypeName(instance?.arguments[0] ?? lookup?.arguments[0]);
      if (!type) continue;
      const fieldArg = instance?.arguments[4];
      let primaryField = instance ? 'data' : undefined;
      let primaryFieldMode = instance ? 'default' : 'prototype-reference';
      if (fieldArg && fieldArg.getText(documentsFile) !== 'undefined') {
        if (ts.isStringLiteralLike(fieldArg)) {
          primaryField = fieldArg.text || undefined;
          primaryFieldMode = fieldArg.text ? 'literal' : 'none';
        } else if (ts.isIdentifier(fieldArg)) {
          const defaultValue = parameterDefault(fn, fieldArg.text);
          primaryField = defaultValue ?? fieldArg.text;
          primaryFieldMode = defaultValue ? 'parameter-default' : 'runtime-parameter';
        } else {
          primaryField = compact(fieldArg, documentsFile, 80);
          primaryFieldMode = 'expression';
        }
      }
      const options = instance?.arguments[2];
      const caller = callerEvidence(fn.name.text);
      const line = lineOf(documentsFile, fn);
      const optionText = compact(options, documentsFile, 600) ?? '';
      factoryRows.push({
        name: fn.name.text,
        namespace: 'Docs.Create',
        type,
        mode: instance ? (instance.arguments[7]?.kind === ts.SyntaxKind.TrueKeyword ? 'data-only-instance' : 'view-and-data-instance') : 'prototype-reference',
        signature: `${fn.name.text}(${fn.parameters.map((parameter) => compact(parameter, documentsFile, 160)).join(', ')})`,
        primaryField,
        primaryFieldMode,
        dataExpression: compact(instance?.arguments[1], documentsFile, 180),
        optionFields: objectEntries(options, documentsFile),
        collectionViewType: optionText.match(/CollectionViewType\.([A-Za-z0-9_]+)/)?.[1],
        indexedCallers: caller.count,
        callerExamples: caller.examples,
        source: { file: documentsPath, line, url: sourceUrl(documentsPath, line) },
      });
    }
  }
}

for (const statement of documentsFile.statements) {
  if (!ts.isModuleDeclaration(statement) || statement.name.getText(documentsFile) !== 'Docs' || !statement.body || !ts.isModuleBlock(statement.body)) continue;
  for (const namespace of statement.body.statements) {
    if (!ts.isModuleDeclaration(namespace) || namespace.name.getText(documentsFile) !== 'Prototypes' || !namespace.body || !ts.isModuleBlock(namespace.body)) continue;
    for (const fn of namespace.body.statements) {
      if (!ts.isFunctionDeclaration(fn) || !fn.name || !fn.body || !/^Main.*Document$/.test(fn.name.text)) continue;
      const lookup = prototypeGetIn(fn);
      const type = documentTypeName(lookup?.arguments[0]);
      if (!type) continue;
      const caller = callerEvidence(fn.name.text);
      const line = lineOf(documentsFile, fn);
      factoryRows.push({
        name: fn.name.text,
        namespace: 'Docs.Prototypes',
        type,
        mode: 'prototype-reference',
        signature: `${fn.name.text}(${fn.parameters.map((parameter) => compact(parameter, documentsFile, 160)).join(', ')})`,
        primaryField: undefined,
        primaryFieldMode: 'prototype-reference',
        dataExpression: undefined,
        optionFields: [],
        collectionViewType: undefined,
        indexedCallers: caller.count,
        callerExamples: caller.examples,
        source: { file: documentsPath, line, url: sourceUrl(documentsPath, line) },
      });
    }
  }
}

const { sourceFile: currentUserFile } = parse(currentUserPath);
const paletteTemplates = [];
const paletteDescriptors = new Map();
let paletteTemplateSource;
let paletteDescriptorSource;

const visitCurrentUser = (node) => {
  if (ts.isVariableDeclaration(node) && node.name.getText(currentUserFile) === 'emptyThings' && ts.isArrayLiteralExpression(node.initializer)) {
    paletteTemplateSource = { file: currentUserPath, line: lineOf(currentUserFile, node), url: sourceUrl(currentUserPath, lineOf(currentUserFile, node)) };
    for (const element of node.initializer.elements) {
      if (!ts.isObjectLiteralExpression(element)) continue;
      const keyNode = initializer(property(element, 'key', currentUserFile));
      const creatorNode = initializer(property(element, 'creator', currentUserFile));
      const optionsNode = initializer(property(element, 'opts', currentUserFile));
      const key = literal(keyNode);
      if (!key || !creatorNode) continue;
      const creator = compact(creatorNode, currentUserFile, 220);
      const factory = creator.match(/Docs\.Create\.([A-Za-z0-9_]+)/)?.[1] ?? (ts.isIdentifier(creatorNode) ? creatorNode.text : 'custom composition');
      const line = lineOf(currentUserFile, element);
      paletteTemplates.push({
        key,
        factory,
        creator,
        optionFields: objectEntries(optionsNode, currentUserFile),
        source: { file: currentUserPath, line, url: sourceUrl(currentUserPath, line) },
      });
    }
  }
  if (ts.isObjectLiteralExpression(node) && property(node, 'dragFactory', currentUserFile) && property(node, 'toolTip', currentUserFile)) {
    const title = literal(initializer(property(node, 'title', currentUserFile)));
    const tooltip = literal(initializer(property(node, 'toolTip', currentUserFile)));
    const dragFactory = compact(initializer(property(node, 'dragFactory', currentUserFile)), currentUserFile, 120) ?? '';
    const key = dragFactory.match(/doc\.empty([A-Za-z0-9_]+)/)?.[1];
    if (key) {
      const line = lineOf(currentUserFile, node);
      paletteDescriptorSource ??= { file: currentUserPath, line, url: sourceUrl(currentUserPath, line) };
      paletteDescriptors.set(key, { title, tooltip });
    }
  }
  ts.forEachChild(node, visitCurrentUser);
};
visitCurrentUser(currentUserFile);

const localCreatorTypes = new Map();
const visitLocalCreators = (node) => {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
    const factories = new Set();
    const collect = (child) => {
      if (ts.isPropertyAccessExpression(child) && child.expression.getText(currentUserFile) === 'Docs.Create') factories.add(child.name.text);
      ts.forEachChild(child, collect);
    };
    collect(node.initializer);
    if (factories.size) {
      localCreatorTypes.set(node.name.text, [...new Set([...factories].flatMap((name) => factoryRows.filter((factory) => factory.name === name).map((factory) => factory.type)))]);
    }
  }
  ts.forEachChild(node, visitLocalCreators);
};
visitLocalCreators(currentUserFile);

for (const template of paletteTemplates) {
  const descriptor = paletteDescriptors.get(template.key);
  template.title = descriptor?.title ?? template.key;
  template.tooltip = descriptor?.tooltip;
  const types = [...new Set([
    ...factoryRows.filter((factory) => factory.name === template.factory).map((factory) => factory.type),
    ...(localCreatorTypes.get(template.factory) ?? []),
  ])];
  template.documentTypes = types;
}

const prototypesByType = new Map();
for (const registration of prototypeRegistrations) {
  const rows = prototypesByType.get(registration.type) ?? [];
  rows.push(registration);
  prototypesByType.set(registration.type, rows);
}

const registryNames = new Set(rendererRegistry.map((entry) => entry.name));
const usedRendererNames = new Set(prototypeRegistrations.map((registration) => registration.renderer));
const types = enumTypes.map((entry) => {
  const editorial = taxonomy[entry.name];
  if (!editorial) throw new Error(`DocumentType.${entry.name} has no reviewed taxonomy entry`);
  const registrations = prototypesByType.get(entry.name) ?? [];
  const prototype = registrations.at(-1);
  const factories = factoryRows.filter((factory) => factory.type === entry.name);
  let lifecycle = 'prototype-only';
  if (entry.name === 'NONE') lifecycle = 'sentinel';
  else if (!prototype) lifecycle = 'missing-prototype';
  else if (factories.some((factory) => factory.mode === 'data-only-instance')) lifecycle = 'data-only-factory';
  else if (factories.some((factory) => factory.mode === 'view-and-data-instance')) lifecycle = 'factory-backed';
  else if (factories.some((factory) => factory.mode === 'prototype-reference')) lifecycle = 'prototype-resource';
  return {
    ...entry,
    category: editorial[0],
    audience: editorial[1],
    plainMeaning: editorial[2],
    technicalRole: editorial[3],
    lifecycle,
    prototype: prototype
      ? {
          ...prototype,
          rendererRegistered: prototype.renderer === 'EmptyBox' || registryNames.has(prototype.renderer),
          registrations,
        }
      : undefined,
    factories,
    paletteEntries: paletteTemplates.filter((template) => template.documentTypes.includes(entry.name)).map((template) => template.title),
  };
});

const missingPrototype = types.filter((type) => !type.prototype && type.name !== 'NONE');
const unregisteredRenderers = types.filter((type) => type.prototype && !type.prototype.rendererRegistered);
const layoutOnlyComponents = rendererRegistry.filter((component) => !usedRendererNames.has(component.name));
const duplicatePrototypeTypes = [...prototypesByType]
  .filter(([, registrations]) => registrations.length > 1)
  .map(([type, registrations]) => ({ type, registrations: registrations.length }));

const output = {
  schemaVersion: 1,
  generatedAt: sourceReference.generatedAt,
  repository: { remote, baseline },
  methodology: {
    enumParser: 'TypeScript compiler AST over DocumentType and CollectionViewType',
    prototypeParser: 'TypeScript compiler AST over the initial TemplateMap and every TemplateMap.set registration under src/client',
    factoryParser: 'TypeScript compiler AST over Docs.Create and calls to InstanceFromProto or Prototypes.get',
    paletteParser: 'TypeScript compiler AST over CurrentUserUtils emptyThings and creator descriptors',
    callerEvidence: 'Resolved static call edges from the source-generated API graph; dynamic calls may not appear',
    templateCandidateFiles: templateFiles.length,
  },
  summary: {
    enumTypes: types.length,
    prototypeRegistrations: prototypeRegistrations.length,
    prototypeTypes: prototypesByType.size,
    factoryFunctions: factoryRows.length,
    factoryBackedTypes: types.filter((type) => type.lifecycle === 'factory-backed' || type.lifecycle === 'data-only-factory').length,
    paletteTemplates: paletteTemplates.length,
    rendererComponents: rendererRegistry.length,
    layoutOnlyComponents: layoutOnlyComponents.length,
    collectionViewTypes: collectionViewTypes.length,
    duplicatePrototypeTypes: duplicatePrototypeTypes.length,
  },
  construction: {
    commonViewKeys: ['x', 'y', 'isSystem', 'overlayX', 'overlayY', 'zIndex', 'embedContainer', 'every underscore-prefixed option'],
    commonDataFields: [
      { field: 'acl_Guest', why: 'Persist the initial guest permission on the shared data owner.' },
      { field: 'isSystem', why: 'Carry system ownership from the view-only option split to the data owner.' },
      { field: 'isDataDoc', why: 'Mark the shared delegate target explicitly.' },
      { field: 'author', why: 'Record the creating user identity.' },
      { field: 'author_date', why: 'Record creation time.' },
      { field: '<field>_modificationDate', why: 'Initialize the primary content field timestamp.' },
      { field: '<field>', why: 'Store the factory-supplied typed value under the selected primary key.' },
      { field: '<field>_annotations', why: 'Pre-create the annotation list so AddOnly users can append without creating a forbidden field.' },
      { field: '<field>_sidebar', why: 'Pre-create the primary field sidebar list.' },
    ],
    commonViewFields: [
      { field: 'author', why: 'Record who created the contextual delegate.' },
      { field: 'acl_Guest', why: 'Allow the view delegate to have a context-local guest ACL.' },
      { field: 'x, y, size, overlay, z-index, and other _ fields', why: 'Keep placement and presentation contextual instead of shared with every delegate.' },
    ],
    audioLinkExceptions: ['LINK', 'CONFIG', 'LABEL'],
    source: instanceSource,
  },
  startup: {
    sequence: [
      'Imported renderer modules execute TemplateMap registrations.',
      'loadUserDocument calls Prototypes.initialize after the client/server identity handshake.',
      'initialize batch-loads <serialized-type>Proto IDs, builds missing prototypes, and fills PrototypeMap.',
      'Factories retrieve a prototype, create a data delegate, then normally create a view delegate.',
      'DocumentContentsView resolves the inherited layout string and parses it with the registered component map.',
    ],
    sources: {
      initialize: initializeSource,
      prototypeLookup: prototypeLookupSource,
      buildPrototype: buildPrototypeSource,
      instanceFactory: instanceSource,
      rendererRegistry: rendererRegistrySource,
      paletteTemplates: paletteTemplateSource,
      paletteDescriptors: paletteDescriptorSource,
    },
  },
  duplicatePrototypeTypes,
  missingPrototypeTypes: missingPrototype.map((type) => type.name),
  unregisteredRendererTypes: unregisteredRenderers.map((type) => type.name),
  collectionViewTypes,
  rendererRegistry,
  layoutOnlyComponents,
  paletteTemplates,
  types,
};

const outputPath = path.join(root, 'src', 'data', 'generated', 'document-types.json');
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

console.log(
  `Wrote ${outputPath}\n` +
    `${types.length} enum types; ${prototypesByType.size} prototype types from ${prototypeRegistrations.length} registrations; ` +
    `${factoryRows.length} factories; ${paletteTemplates.length} palette templates; ${rendererRegistry.length} renderer components.`
);
