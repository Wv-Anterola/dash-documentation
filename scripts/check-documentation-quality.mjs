import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docsRoot = path.join(root, 'src', 'content', 'docs');

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(target));
    else if (/\.mdx?$/i.test(entry.name)) files.push(target);
  }
  return files;
}

function frontmatter(source, filename) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { error: `${filename}: missing frontmatter` };
  const value = (key) => {
    const field = match[1].match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1]?.trim();
    return field?.replace(/^(['"])(.*)\1$/, '$2');
  };
  return { title: value('title'), description: value('description') };
}

function markdownImages(source) {
  return [...source.matchAll(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g)].map(
    ([, alt, src]) => ({ alt: alt.trim(), src })
  );
}

function duplicateSectionHeadings(source) {
  const headings = [...source.matchAll(/^(#{2,4})\s+(.+)$/gm)].map((match) =>
    match[2]
      .replace(/[`*_]/g, '')
      .replace(/\[[^\]]+\]\([^)]+\)/g, '')
      .trim()
      .toLowerCase()
  );
  return headings.filter((heading, index) => headings.indexOf(heading) !== index);
}

const files = await walk(docsRoot);
const errors = [];
const titles = new Map();
let images = 0;

for (const filename of files) {
  const relative = path.relative(root, filename).replaceAll('\\', '/');
  const source = await readFile(filename, 'utf8');
  const proseSource = source
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`\r\n]+`/g, '');
  const data = frontmatter(source, relative);
  if (data.error) {
    errors.push(data.error);
    continue;
  }
  if (!data.title) errors.push(`${relative}: frontmatter title is required`);
  if (!data.description || data.description.length < 40) {
    errors.push(`${relative}: description must state the page's purpose in at least 40 characters`);
  }
  if (data.title) {
    const owners = titles.get(data.title.toLowerCase()) ?? [];
    owners.push(relative);
    titles.set(data.title.toLowerCase(), owners);
  }

  for (const image of markdownImages(proseSource)) {
    images++;
    const decorativeIcon = !image.alt && image.src.includes('/assets/icons/');
    if (!image.alt && !decorativeIcon) errors.push(`${relative}: ${image.src} has empty alt text`);
    if (/^https?:\/\//i.test(image.src)) {
      errors.push(`${relative}: hot-linked media is not reproducible (${image.src})`);
    }
    if (/\b(?:doc\d+|inkedit\d+)\b|\b(?:open trails pane|creating link|generate animations)\b/i.test(image.alt)) {
      errors.push(`${relative}: image alt text describes a filename instead of the interaction (${image.alt})`);
    }
  }

  const repeatedHeadings = [...new Set(duplicateSectionHeadings(source))];
  for (const heading of repeatedHeadings) {
    errors.push(`${relative}: duplicate section heading creates an ambiguous anchor (${heading})`);
  }

  if (/\uFFFD|\u00C3.|\u00E2[^\s]/u.test(source)) {
    errors.push(`${relative}: probable mojibake or replacement character in authored text`);
  }

  if (!relative.includes('/contributing/') && !relative.includes('/research/release-history')) {
    const metaPatterns = [
      /when checked on \d{1,2}\s+[A-Z][a-z]+\s+20\d{2}/i,
      /original version of this page/i,
      /this page used to/i,
      /legacy tips page/i,
    ];
    for (const pattern of metaPatterns) {
      if (pattern.test(source)) errors.push(`${relative}: reader-facing content contains documentation-process commentary (${pattern})`);
    }
  }
}

for (const [title, owners] of titles) {
  if (owners.length > 1) errors.push(`Duplicate page title "${title}": ${owners.join(', ')}`);
}

const overlaySource = await readFile(path.join(root, 'src', 'data', 'symbolOverlays.ts'), 'utf8');
const referenceSource = await readFile(path.join(root, 'src', 'data', 'generated', 'source-reference.json'), 'utf8');
const httpReferenceSource = await readFile(path.join(root, 'src', 'data', 'generated', 'http-routes.json'), 'utf8');
const documentReferenceSource = await readFile(path.join(root, 'src', 'data', 'generated', 'document-types.json'), 'utf8');
const fieldReferenceSource = await readFile(path.join(root, 'src', 'data', 'generated', 'field-types.json'), 'utf8');
const scriptingReferenceSource = await readFile(path.join(root, 'src', 'data', 'generated', 'scripting-globals.json'), 'utf8');
const exportedReferenceSource = await readFile(path.join(root, 'src', 'data', 'generated', 'exported-symbols.json'), 'utf8');
const interfaceControlReferenceSource = await readFile(path.join(root, 'src', 'data', 'generated', 'interface-controls.json'), 'utf8');
const contextMenuReferenceSource = await readFile(path.join(root, 'src', 'data', 'generated', 'context-menus.json'), 'utf8');
const sourceReference = JSON.parse(referenceSource);
const httpReference = JSON.parse(httpReferenceSource);
const documentReference = JSON.parse(documentReferenceSource);
const fieldReference = JSON.parse(fieldReferenceSource);
const scriptingReference = JSON.parse(scriptingReferenceSource);
const exportedReference = JSON.parse(exportedReferenceSource);
const interfaceControlReference = JSON.parse(interfaceControlReferenceSource);
const contextMenuReference = JSON.parse(contextMenuReferenceSource);
const overlayIds = [...overlaySource.matchAll(/^\s{2}'([^']+)':\s*\{/gm)].map((match) => match[1]);
for (const id of overlayIds) {
  if (!referenceSource.includes(`"id": "${id}"`)) {
    errors.push(`Runtime contract overlay has no matching source symbol: ${id}`);
  }
}

const allowedMethods = new Set(['GET', 'POST', 'PATCH', 'DELETE']);
const allowedLayers = new Set(['supervised', 'direct-express']);
const allowedAccess = new Set([
  'session',
  'session-or-public-handler',
  'admin-in-release',
  'direct-no-route-manager',
  'public-auth-flow',
  'public-shell-or-asset',
]);
const routeKeys = new Map();
const completeRegistrations = new Set();
const sourceModules = new Set(sourceReference.modules.map((module) => module.path));
const scriptingGlobalNames = new Set(scriptingReference.globals.map((entry) => entry.name));
const exportedSymbols = sourceReference.modules.flatMap((module) =>
  module.symbols.filter((symbol) => symbol.exported).map((symbol) => ({ module, symbol }))
);
const symbolSlug = (value) => value
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

if (exportedSymbols.length !== sourceReference.methodology.exportedSymbolCount) {
  errors.push(`Exported symbol summary is stale (${sourceReference.methodology.exportedSymbolCount} versus ${exportedSymbols.length})`);
}
const moduleSlugs = sourceReference.modules.map((module) => symbolSlug(module.path));
if (new Set(moduleSlugs).size !== moduleSlugs.length) {
  errors.push('Generated module paths do not produce unique API route slugs');
}
for (const module of sourceReference.modules) {
  const anchorCounts = new Map();
  const anchors = [];
  for (const symbol of module.symbols) {
    const base = symbolSlug(symbol.qualifiedName);
    const occurrence = (anchorCounts.get(base) ?? 0) + 1;
    anchorCounts.set(base, occurrence);
    anchors.push(occurrence === 1 ? base : `${base}-${occurrence}`);
  }
  if (new Set(anchors).size !== anchors.length) {
    errors.push(`${module.path}: generated symbol anchors are not unique`);
  }
}
for (const { module, symbol } of exportedSymbols) {
  const label = `${module.path}#${symbol.qualifiedName}`;
  if (!symbol.name || !symbol.qualifiedName || !symbol.kind || !symbol.signature || !symbol.id) {
    errors.push(`${label}: exported declaration is missing searchable identity data`);
  }
  if (!Number.isInteger(symbol.lineStart) || !Number.isInteger(symbol.lineEnd) || symbol.lineEnd < symbol.lineStart) {
    errors.push(`${label}: exported declaration has an invalid source range`);
  }
  if (!symbol.sourceUrl.includes(sourceReference.repository.baselineTip) || !symbol.sourceUrl.includes(`#L${symbol.lineStart}`)) {
    errors.push(`${label}: exported declaration source is mutable or not line-addressed`);
  }
}

if (exportedReference.repository.baselineTip !== sourceReference.repository.baselineTip) {
  errors.push('Exported symbol index and generated source reference use different baseline revisions');
}
if (exportedReference.rows.length !== exportedSymbols.length) {
  errors.push(`Exported symbol client index is stale (${exportedReference.rows.length} versus ${exportedSymbols.length})`);
}
const recomputedExportedSummary = {
  exports: exportedReference.rows.length,
  modules: new Set(exportedReference.rows.map((row) => row.module)).size,
  reviewed: exportedReference.rows.filter((row) => row.evidence === 'reviewed').length,
  sourceDescribed: exportedReference.rows.filter((row) => row.evidence === 'source').length,
  declarationOnly: exportedReference.rows.filter((row) => row.evidence === 'declaration').length,
  kinds: new Set(exportedReference.rows.map((row) => row.kind)).size,
};
if (JSON.stringify(exportedReference.summary) !== JSON.stringify(recomputedExportedSummary)) {
  errors.push('Exported symbol client summary is stale relative to its generated rows');
}
if (new Set(exportedReference.rows.map((row) => row.id)).size !== exportedReference.rows.length) {
  errors.push('Exported symbol client index contains duplicate row identities');
}
for (const row of exportedReference.rows) {
  if (!row.contractPath.startsWith('/technical/api/modules/') || !row.contractPath.includes('/#')) {
    errors.push(`${row.id}: exported symbol contract target is malformed`);
  }
  if (!sourceModules.has(row.module) || !row.sourceUrl.includes(sourceReference.repository.baselineTip)) {
    errors.push(`${row.id}: exported symbol module or immutable source is not in the generated baseline`);
  }
}

const exportedSymbolsPage = await readFile(path.join(docsRoot, 'technical', 'exported-symbols.mdx'), 'utf8');
const astroConfigSource = await readFile(path.join(root, 'astro.config.mjs'), 'utf8');
if (!exportedSymbolsPage.includes('<ExportedSymbolReference />') || !exportedSymbolsPage.includes('dash-exported-symbol-reference.svg')) {
  errors.push('Exported symbol page lost its searchable reference or unique explanatory visual');
}
if (!astroConfigSource.includes("slug: 'technical/exported-symbols'")) {
  errors.push('Exported symbol reference is no longer discoverable in the primary navigation');
}

if (interfaceControlReference.repository.baseline !== sourceReference.repository.baselineTip) {
  errors.push('Interface control reference and generated source reference use different baseline revisions');
}
if (interfaceControlReference.summary.controls !== interfaceControlReference.controls.length || interfaceControlReference.controls.length < 200) {
  errors.push('Interface control inventory is stale or fell below the reviewed 200-control floor');
}
if (interfaceControlReference.summary.regions !== 8 || new Set(interfaceControlReference.controls.map((row) => row.region)).size !== 8) {
  errors.push('Interface control inventory no longer covers all eight reviewed interface regions');
}
if (new Set(interfaceControlReference.controls.map((row) => row.id)).size !== interfaceControlReference.controls.length) {
  errors.push('Interface control inventory contains duplicate row identities');
}
for (const row of interfaceControlReference.controls) {
  if (!row.label || !row.beginner || !row.visibility || !row.interaction || !row.handler?.stateOwner) {
    errors.push(`${row.id}: interface control contract is missing visible, beginner, conditional, interaction, or state-owner evidence`);
  }
  if (!sourceModules.has(row.source?.file) || !row.source?.url?.includes(sourceReference.repository.baselineTip) || !row.source?.url?.endsWith(`#L${row.source?.line}`)) {
    errors.push(`${row.id}: interface control source is absent, mutable, or not line-addressed`);
  }
  for (const handler of row.handler?.resolved ?? []) {
    if (!scriptingGlobalNames.has(handler.name) || !handler.signature || !handler.source?.url) {
      errors.push(`${row.id}: resolved interface handler ${handler.name} is absent from the scripting-global contract`);
    }
  }
}
const interfaceControlsPage = await readFile(path.join(docsRoot, 'reference', 'interface-controls.mdx'), 'utf8');
if (!interfaceControlsPage.includes('<InterfaceControlReference />') || !interfaceControlsPage.includes('dash-control-action-trace.svg')) {
  errors.push('Interface control page lost its searchable contract index or unique action-trace visual');
}

if (contextMenuReference.repository.baseline !== sourceReference.repository.baselineTip) {
  errors.push('Context menu reference and generated source reference use different baseline revisions');
}
if (contextMenuReference.summary.entries !== contextMenuReference.items.length || contextMenuReference.items.length < 200) {
  errors.push('Context menu inventory is stale or fell below the reviewed 200-entry floor');
}
if (new Set(contextMenuReference.items.map((row) => row.id)).size !== contextMenuReference.items.length) {
  errors.push('Context menu inventory contains duplicate entry identities');
}
// Every documented surface must still have at least one traced contribution,
// and the cooperative-group rendezvous points are the claim this page rests on.
const contextMenuSurfaces = new Set(contextMenuReference.items.map((row) => row.surface));
for (const surface of ['document', 'collection', 'schema', 'column', 'dashboard', 'renderer', 'ink']) {
  if (!contextMenuSurfaces.has(surface)) errors.push(`Context menu surface lost every traced entry: ${surface}`);
}
for (const group of ['Options...', 'Appearance...', 'More...', 'OnClick...', 'Help...']) {
  const record = contextMenuReference.cooperativeGroups.find((entry) => entry.group === group);
  if (!record || record.contributors.length < 3) {
    errors.push(`Cooperative menu group is no longer built by three or more components: ${group}`);
  }
}
const contextMenuLabelKinds = new Set(['literal', 'stateful', 'generated']);
for (const row of contextMenuReference.items) {
  if (!row.label || !row.plain || !row.availability || !row.interaction || !row.handler?.stateOwner) {
    errors.push(`${row.id}: context menu entry is missing its label, explanation, availability, interaction, or state owner`);
  }
  if (!contextMenuLabelKinds.has(row.labelKind)) {
    errors.push(`${row.id}: context menu entry has an unclassified label kind`);
  }
  if (!sourceModules.has(row.source?.file) || !row.source?.url?.includes(sourceReference.repository.baselineTip) || !row.source?.url?.endsWith(`#L${row.source?.line}`)) {
    errors.push(`${row.id}: context menu source is absent, mutable, or not line-addressed`);
  }
  for (const handler of row.handler?.resolved ?? []) {
    if (!handler.signature || !handler.url) {
      errors.push(`${row.id}: resolved menu handler ${handler.name} has no signature or source address`);
    }
  }
}
// The undo claim on the page is that no entry uses the ContextMenuProps flag.
if (contextMenuReference.summary.undoablePropUsed !== 0) {
  errors.push('Context menu page states that no entry sets ContextMenuProps.undoable, but the inventory now finds one');
}
const contextMenusPage = await readFile(path.join(docsRoot, 'reference', 'context-menus.mdx'), 'utf8');
if (!contextMenusPage.includes('<ContextMenuReference />')) {
  errors.push('Context menu page lost its searchable entry index');
}
if (!astroConfigSource.includes("slug: 'reference/context-menus'")) {
  errors.push('Context menu atlas is no longer discoverable in the primary navigation');
}

if (documentReference.repository.baseline !== sourceReference.repository.baselineTip) {
  errors.push('Document type reference and generated source reference use different baseline revisions');
}
if (documentReference.types.length !== 51 || documentReference.summary.enumTypes !== 51) {
  errors.push(`Document type inventory changed from the reviewed 51-value enum (${documentReference.types.length} rows)`);
}
if (documentReference.summary.prototypeTypes !== 50 || documentReference.summary.prototypeRegistrations !== 51) {
  errors.push('Document prototype inventory no longer matches the reviewed 50-type / 51-registration model');
}
if (documentReference.summary.factoryFunctions < 65 || documentReference.summary.paletteTemplates < 36) {
  errors.push('Document construction or creator-template coverage fell below the reviewed baseline');
}
if (documentReference.summary.rendererComponents < 54 || documentReference.summary.collectionViewTypes !== 21) {
  errors.push('Renderer or CollectionViewType coverage fell below the reviewed baseline');
}
if (documentReference.missingPrototypeTypes.length || documentReference.unregisteredRendererTypes.length) {
  errors.push('A non-sentinel document type lost its prototype or registered renderer path');
}
if (JSON.stringify(documentReference.duplicatePrototypeTypes) !== JSON.stringify([{ type: 'DATAVIZ', registrations: 2 }])) {
  errors.push('Reviewed duplicate prototype-registration evidence changed');
}

const documentTypeNames = new Set(documentReference.types.map((type) => type.name));
for (const type of documentReference.types) {
  const label = `DocumentType.${type.name}`;
  if (!type.name || !type.value || !type.category || !type.audience || !type.plainMeaning || !type.technicalRole) {
    errors.push(`${label}: generated lifecycle row is missing required identity or reviewed explanation`);
  }
  if (!sourceModules.has(type.source.file) || !type.source.url.includes(documentReference.repository.baseline) || !type.source.url.endsWith(`#L${type.source.line}`)) {
    errors.push(`${label}: enum source is absent, mutable, or not line-addressed`);
  }
  if (type.name === 'NONE') {
    if (type.prototype || type.lifecycle !== 'sentinel') errors.push(`${label}: NONE must remain a prototype-free sentinel`);
    continue;
  }
  if (!type.prototype) {
    errors.push(`${label}: non-sentinel type has no prototype registration`);
    continue;
  }
  if (!type.prototype.rendererRegistered) errors.push(`${label}: prototype renderer is unavailable to the layout parser`);
  for (const registration of type.prototype.registrations) {
    if (!sourceModules.has(registration.source.file) || !registration.source.url.includes(documentReference.repository.baseline)) {
      errors.push(`${label}: prototype registration source is absent or not baseline-pinned`);
    }
  }
  for (const factory of type.factories) {
    if (!sourceModules.has(factory.source.file) || !factory.source.url.includes(documentReference.repository.baseline)) {
      errors.push(`${label}: factory source is absent or not baseline-pinned`);
    }
    if (factory.primaryField === 'undefined') errors.push(`${label}: explicit JavaScript undefined was misclassified as a field name`);
  }
}

for (const template of documentReference.paletteTemplates) {
  if (!template.title || !template.factory || !template.source?.url) errors.push(`Creator template ${template.key}: incomplete generated mapping`);
  if (template.documentTypes.some((type) => !documentTypeNames.has(type))) errors.push(`Creator template ${template.key}: references an unknown document type`);
}

const recomputedDocumentSummary = {
  enumTypes: documentReference.types.length,
  prototypeRegistrations: documentReference.types.reduce((count, type) => count + (type.prototype?.registrations.length ?? 0), 0),
  prototypeTypes: documentReference.types.filter((type) => type.prototype).length,
  factoryFunctions: documentReference.types.reduce((count, type) => count + type.factories.length, 0),
  factoryBackedTypes: documentReference.types.filter((type) => type.lifecycle === 'factory-backed' || type.lifecycle === 'data-only-factory').length,
  paletteTemplates: documentReference.paletteTemplates.length,
  rendererComponents: documentReference.rendererRegistry.length,
  layoutOnlyComponents: documentReference.layoutOnlyComponents.length,
  collectionViewTypes: documentReference.collectionViewTypes.length,
  duplicatePrototypeTypes: documentReference.duplicatePrototypeTypes.length,
};
if (JSON.stringify(documentReference.summary) !== JSON.stringify(recomputedDocumentSummary)) {
  errors.push('Document type summary is stale relative to its generated lifecycle rows');
}

if (fieldReference.repository.baseline !== sourceReference.repository.baselineTip) {
  errors.push('Field type reference and generated source reference use different baseline revisions');
}
const expectedFieldTags = [
  'Doc', 'RichTextField', 'audio', 'computed', 'csv', 'cursor', 'date', 'html', 'icon', 'image', 'ink',
  'list', 'pdf', 'prefetch_proxy', 'proxy', 'schemaheader', 'script', 'video', 'viewer3d', 'web', 'youtube',
].sort();
const generatedFieldTags = fieldReference.registrations.map((entry) => entry.tag).sort();
if (JSON.stringify(generatedFieldTags) !== JSON.stringify(expectedFieldTags)) {
  errors.push(`Serialized field registry changed from the reviewed 21-tag set (${generatedFieldTags.join(', ')})`);
}
if (JSON.stringify(fieldReference.primitives.map((entry) => entry.type)) !== JSON.stringify(['string', 'number', 'boolean'])) {
  errors.push('Primitive field universe changed from string, number, and boolean');
}
for (const entry of fieldReference.registrations) {
  const label = `Serialized field ${entry.tag}`;
  if (!entry.className || !entry.label || !entry.category || !entry.purpose || !entry.hydration || !entry.copy) {
    errors.push(`${label}: generated row is missing runtime identity or reviewed behavior`);
  }
  if (!sourceModules.has(entry.source.file) || !entry.source.url.includes(fieldReference.repository.baseline)) {
    errors.push(`${label}: class source is absent or not baseline-pinned`);
  }
  if (!entry.registration.source.url.includes(fieldReference.repository.baseline) || !entry.storedMembers.length) {
    errors.push(`${label}: registration source or effective serialized-member inventory is incomplete`);
  }
  for (const member of entry.storedMembers) {
    if (!member.name || !member.owner || !member.schema || !sourceModules.has(member.source.file) || !member.source.url.includes(fieldReference.repository.baseline)) {
      errors.push(`${label}: stored member evidence is incomplete or mutable`);
    }
  }
  if (entry.tag !== 'Doc' && !entry.conversions.some((method) => method.name === 'Copy')) errors.push(`${label}: effective Copy contract is missing`);
}

const repairTags = fieldReference.registrations.filter((entry) => entry.registration.repairHook).map((entry) => entry.tag).sort();
if (JSON.stringify(repairTags) !== JSON.stringify(['Doc', 'computed', 'prefetch_proxy', 'proxy', 'script'])) {
  errors.push('Reviewed post-hydration repair paths changed');
}
const docWireType = fieldReference.registrations.find((entry) => entry.tag === 'Doc');
const computedWireType = fieldReference.registrations.find((entry) => entry.tag === 'computed');
const prefetchWireType = fieldReference.registrations.find((entry) => entry.tag === 'prefetch_proxy');
if (docWireType?.registration.constructorArgs !== "['id']" || !docWireType.storedMembers.some((member) => member.name === '__fieldTuples')) {
  errors.push('Doc hydration no longer records its identity constructor argument and serialized field map');
}
if (!computedWireType?.baseChain.includes('ScriptField') || !prefetchWireType?.baseChain.includes('ProxyField')) {
  errors.push('Computed or prefetched field inheritance changed without review');
}
for (const tag of ['audio', 'csv', 'image', 'pdf', 'video', 'viewer3d', 'web', 'youtube']) {
  const mediaType = fieldReference.registrations.find((entry) => entry.tag === tag);
  if (mediaType?.storedMembers.length !== 1 || mediaType.storedMembers[0].name !== 'url' || mediaType.storedMembers[0].owner !== 'URLField') {
    errors.push(`Serialized field ${tag}: inherited URL storage contract changed`);
  }
}
const recomputedFieldSummary = {
  primitiveTypes: fieldReference.primitives.length,
  registeredTags: fieldReference.registrations.length,
  categories: new Set(fieldReference.registrations.map((entry) => entry.category)).size,
  objectFieldTags: fieldReference.registrations.filter((entry) => entry.className !== 'Doc').length,
  referenceTags: fieldReference.registrations.filter((entry) => entry.category === 'identity' || entry.category === 'reference').length,
  repairHooks: repairTags.length,
  scriptingGlobals: fieldReference.registrations.filter((entry) => entry.scriptingGlobal).length,
};
if (JSON.stringify(fieldReference.summary) !== JSON.stringify(recomputedFieldSummary)) {
  errors.push('Field type summary is stale relative to its generated registry rows');
}

if (scriptingReference.repository.baseline !== sourceReference.repository.baselineTip) {
  errors.push('Scripting global reference and generated source reference use different baseline revisions');
}
const scriptingNames = scriptingReference.globals.map((entry) => entry.name);
if (scriptingReference.globals.length !== 151 || new Set(scriptingNames).size !== 151) {
  errors.push(`Static scripting namespace changed from the reviewed 151 case-sensitive names (${scriptingReference.globals.length} rows)`);
}
const recomputedScriptingSummary = {
  staticGlobals: scriptingReference.globals.length,
  decoratedClasses: scriptingReference.globals.filter((entry) => entry.registration === 'decorator').length,
  functions: scriptingReference.globals.filter((entry) => entry.kind === 'function').length,
  constructors: scriptingReference.globals.filter((entry) => entry.kind === 'class').length,
  objects: scriptingReference.globals.filter((entry) => entry.kind === 'namespace-or-object').length,
  explicitDescriptions: scriptingReference.globals.filter((entry) => entry.description).length,
  categories: new Set(scriptingReference.globals.map((entry) => entry.category)).size,
  dynamicRegistrationSites: scriptingReference.dynamicRegistrations.length,
};
if (JSON.stringify(scriptingReference.summary) !== JSON.stringify(recomputedScriptingSummary)) {
  errors.push('Scripting global summary is stale relative to its generated registry rows');
}
const recomputedCategoryCounts = Object.fromEntries(
  scriptingReference.categories.map((category) => [category, scriptingReference.globals.filter((entry) => entry.category === category).length]),
);
if (JSON.stringify(scriptingReference.categoryCounts) !== JSON.stringify(recomputedCategoryCounts)) {
  errors.push('Scripting capability-family counts are stale relative to the generated namespace');
}
if (JSON.stringify(scriptingReference.caseInsensitiveNameCollisions) !== JSON.stringify([['SchemaHeaderField', 'schemaHeaderField']])) {
  errors.push('The reviewed case-sensitive SchemaHeaderField factory/constructor boundary changed');
}
const allowedScriptingRegistrations = new Set(['call', 'named-call', 'decorator']);
const allowedScriptingModes = new Set(['action', 'query', 'constructor', 'object']);
const allowedScriptingPurposeSources = new Set(['source-description', 'documentation-override', 'identifier-inference']);
for (const entry of scriptingReference.globals) {
  const label = `Scripting global ${entry.name}`;
  if (!entry.name || !entry.signature || !entry.purpose || !entry.category || !entry.owner) {
    errors.push(`${label}: generated row is missing its callable contract or reviewed explanation`);
  }
  if (!allowedScriptingRegistrations.has(entry.registration) || !allowedScriptingModes.has(entry.mode)) {
    errors.push(`${label}: registration mechanism or runtime role is unknown`);
  }
  if (!allowedScriptingPurposeSources.has(entry.purposeSource)) {
    errors.push(`${label}: explanation provenance is missing or unknown`);
  }
  if (!sourceModules.has(entry.source.file) || !entry.source.url.includes(scriptingReference.repository.baseline) || !entry.source.url.endsWith(`#L${entry.source.line}`)) {
    errors.push(`${label}: registration source is absent, mutable, or not line-addressed`);
  }
  if (!Array.isArray(entry.effects.calls) || !Array.isArray(entry.effects.writes) || !Number.isInteger(entry.effects.returns)) {
    errors.push(`${label}: direct syntactic-effect evidence is malformed`);
  }
}
for (const forbidden of ['constructor', 'f']) {
  if (scriptingNames.includes(forbidden)) errors.push(`Dynamic or decorator-infrastructure name was misclassified as a static scripting global: ${forbidden}`);
}
for (const required of [
  'Docs', 'List', 'Doc', 'ScriptField', 'ComputedField', 'selectedDocs', 'undo', 'redo',
  'setBackgroundColor', 'followLink', 'replayWorkspace', 'imageRemoveBackground',
  'dashCallChat', 'GoogleAuthenticationManager',
]) {
  if (!scriptingNames.includes(required)) errors.push(`Reviewed scripting global disappeared: ${required}`);
}
if (scriptingReference.dynamicRegistrations.length !== 2 || scriptingReference.dynamicRegistrations.some((site) =>
  site.expression !== 'f' || site.owner !== 'addScriptToGlobals' || site.source.file !== 'src/client/util/ScriptManager.ts'
)) {
  errors.push('Saved-script runtime registration no longer matches the two reviewed ScriptManager call sites');
}

if (httpReference.repository.baseline !== sourceReference.repository.baselineTip) {
  errors.push('HTTP route reference and generated source reference use different baseline revisions');
}
if (httpReference.routes.length < 100) {
  errors.push(`HTTP route inventory fell below its reviewed coverage floor (found ${httpReference.routes.length}, expected at least 100)`);
}
if (new Set(httpReference.routes.map((route) => route.group)).size < 15) {
  errors.push('HTTP route inventory no longer covers the 15 reviewed service ownership groups');
}
if (httpReference.methodology.supervisedCandidateFiles < 1 || httpReference.methodology.directCandidateFiles < 1) {
  errors.push('HTTP route inventory did not record both supervised and direct-registration candidate files');
}
if (JSON.stringify(httpReference.methodology.directOwnerNames) !== JSON.stringify(['app', 'server'])) {
  errors.push('HTTP route inventory direct Express owner-name grammar changed without review');
}

for (const route of httpReference.routes) {
  const label = `${route.method} ${route.path}`;
  if (!allowedMethods.has(route.method)) errors.push(`${label}: unsupported HTTP method in generated inventory`);
  if (!allowedLayers.has(route.layer)) errors.push(`${label}: unknown registration layer ${route.layer}`);
  if (!allowedAccess.has(route.access)) errors.push(`${label}: unknown access classification ${route.access}`);
  if (!route.path || !route.group) errors.push(`${label}: route path and service group are required`);
  if (!sourceModules.has(route.source.file)) errors.push(`${label}: source module is absent from the generated source API (${route.source.file})`);
  if (!route.source.url.includes(httpReference.repository.baseline) || !route.source.url.endsWith(`#L${route.source.line}`)) {
    errors.push(`${label}: source URL is not pinned to its recorded baseline and line`);
  }
  const completeKey = `${label}|${route.source.file}|${route.source.line}`;
  if (completeRegistrations.has(completeKey)) errors.push(`${label}: identical registration was emitted more than once`);
  completeRegistrations.add(completeKey);
  routeKeys.set(label, (routeKeys.get(label) ?? 0) + 1);
  for (const [channel, fields] of Object.entries(route.inputs)) {
    if (!channel || !Array.isArray(fields) || fields.some((field) => typeof field !== 'string')) {
      errors.push(`${label}: malformed observed-input entry`);
    }
    if (new Set(fields).size !== fields.length) errors.push(`${label}: duplicate observed ${channel} input`);
  }
  if (new Set(route.responses).size !== route.responses.length) errors.push(`${label}: duplicate response operation`);
}

const calculatedDuplicates = [...routeKeys]
  .filter(([, count]) => count > 1)
  .map(([key]) => key)
  .sort();
const recordedDuplicates = [...httpReference.duplicateMethodPaths].sort();
if (JSON.stringify(calculatedDuplicates) !== JSON.stringify(recordedDuplicates)) {
  errors.push('HTTP duplicate method/path summary disagrees with generated route registrations');
}

const calculatedSummary = {
  routes: httpReference.routes.length,
  supervised: httpReference.routes.filter((route) => route.layer === 'supervised').length,
  direct: httpReference.routes.filter((route) => route.layer === 'direct-express').length,
  public: httpReference.routes.filter((route) => route.access.includes('public')).length,
  admin: httpReference.routes.filter((route) => route.access === 'admin-in-release').length,
  duplicateMethodPaths: calculatedDuplicates.length,
};
for (const [key, value] of Object.entries(calculatedSummary)) {
  if (httpReference.summary[key] !== value) errors.push(`HTTP route summary ${key} is stale (${httpReference.summary[key]} versus ${value})`);
}

const expectedCriticalRoutes = [
  ['POST', '/saveDynamicTool', 'direct-no-route-manager'],
  ['GET', '/getDynamicTools', 'direct-no-route-manager'],
  ['GET', '/getDynamicTool/:toolName', 'direct-no-route-manager'],
  ['GET', '/delete', 'admin-in-release'],
  ['GET', '/delete/:target', 'admin-in-release'],
];
for (const [method, routePath, access] of expectedCriticalRoutes) {
  if (!httpReference.routes.some((route) => route.method === method && route.path === routePath && route.access === access)) {
    errors.push(`Critical HTTP boundary is missing or reclassified without review: ${method} ${routePath}`);
  }
}

if (errors.length) {
  console.error(`Documentation quality check failed with ${errors.length} issue${errors.length === 1 ? '' : 's'}:`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    `Documentation quality complete: ${files.length} pages have required metadata and unique titles; ` +
      `${images} inline images have reproducible sources and intentional alt text; ` +
      `${overlayIds.length} runtime contract overlays resolve to source symbols; ` +
      `${exportedSymbols.length.toLocaleString()} exported declarations have collision-safe module targets; ` +
      `${httpReference.routes.length} HTTP route registrations, ${documentReference.types.length} document type lifecycles, ` +
      `${fieldReference.registrations.length} serialized field types, ${scriptingReference.globals.length} scripting globals, ` +
      `${interfaceControlReference.controls.length} interface controls, and ` +
      `${contextMenuReference.items.length} context-menu entries pass inventory invariants.`
  );
}
