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
const sourceReference = JSON.parse(referenceSource);
const httpReference = JSON.parse(httpReferenceSource);
const documentReference = JSON.parse(documentReferenceSource);
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
      `${httpReference.routes.length} HTTP route registrations and ${documentReference.types.length} document type lifecycles pass inventory invariants.`
  );
}
