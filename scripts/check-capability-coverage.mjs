import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [
  projectsSource,
  capabilitiesSource,
  visualsSource,
  creatorsSource,
  pageVisualsSource,
  workflowsSource,
  branchAuditSource,
  sourceInventorySource,
  sourceReferenceSource,
  historicalSymbolsSource,
  typedocSource,
  posterBuilderSource,
  pageRegistrySource,
] = await Promise.all([
  readFile(path.join(root, 'src/data/projects.ts'), 'utf8'),
  readFile(path.join(root, 'src/data/capabilities.ts'), 'utf8'),
  readFile(path.join(root, 'src/data/visuals.ts'), 'utf8'),
  readFile(path.join(root, 'src/data/creators.ts'), 'utf8'),
  readFile(path.join(root, 'src/data/pageVisuals.ts'), 'utf8'),
  readFile(path.join(root, 'src/data/projectWorkflows.ts'), 'utf8'),
  readFile(path.join(root, 'src/data/generated/branch-audit.json'), 'utf8'),
  readFile(path.join(root, 'src/data/generated/source-inventory.json'), 'utf8'),
  readFile(path.join(root, 'src/data/generated/source-reference.json'), 'utf8'),
  readFile(path.join(root, 'src/data/generated/historical-symbols.json'), 'utf8'),
  readFile(path.join(root, 'src/data/generated/typedoc-api.json'), 'utf8'),
  readFile(path.join(root, 'scripts/build-visual-posters.mjs'), 'utf8'),
  readFile(path.join(root, 'src/data/generated/page-visuals.json'), 'utf8'),
]);

const projectPattern =
  /^\s{4}title:\s*'(?<title>[^']+)',[\s\S]*?^\s{4}status:\s*'(?<status>[^']+)',/gm;
const projects = [...projectsSource.matchAll(projectPattern)].map((match) => ({
  title: match.groups.title,
  status: match.groups.status,
}));

const capabilityProjectTitles = new Set();
for (const match of capabilitiesSource.matchAll(/projects:\s*\[(?<titles>[\s\S]*?)\],/g)) {
  for (const title of match.groups.titles.matchAll(/'([^']+)'/g)) {
    capabilityProjectTitles.add(title[1]);
  }
}

const knownTitles = new Set(projects.map((project) => project.title));
const unknown = [...capabilityProjectTitles].filter((title) => !knownTitles.has(title));
const unmappedIntegrated = projects
  .filter((project) => project.status === 'integrated')
  .filter((project) => !capabilityProjectTitles.has(project.title));

const docsTargets = [...capabilitiesSource.matchAll(/(?:docs|technical):\s*'([^']+)'/g)]
  .map((match) => match[1].split('#')[0])
  .filter((target) => target.startsWith('/'));

const missingTargets = [];
for (const target of new Set(docsTargets)) {
  const slug = target.replace(/^\/|\/$/g, '');
  const candidates = slug
    ? [
        path.join(root, 'src/content/docs', `${slug}.mdx`),
        path.join(root, 'src/content/docs', slug, 'index.mdx'),
        path.join(root, 'src/content/docs', `${slug}.md`),
      ]
    : [path.join(root, 'src/content/docs/index.mdx')];
  let found = false;
  for (const candidate of candidates) {
    try {
      await readFile(candidate);
      found = true;
      break;
    } catch {
      // Try the next supported content path.
    }
  }
  if (!found) missingTargets.push(target);
}

const projectVisualBody =
  visualsSource.match(
    /export const projectVisuals:[\s\S]*?= \{(?<body>[\s\S]*?)\n\};\n\nexport const capabilityVisuals/
  )?.groups?.body ?? '';
const projectVisualTitles = new Set(
  [...projectVisualBody.matchAll(/^\s{2}'([^']+)':/gm)].map((match) => match[1])
);
const missingProjectVisuals = projects.filter(
  (project) => !projectVisualTitles.has(project.title)
);
const unknownProjectVisuals = [...projectVisualTitles].filter(
  (title) => !knownTitles.has(title)
);

const workflowTitles = new Set(
  [...workflowsSource.matchAll(/^\s{2}'([^']+)':\s*\[/gm)].map((match) => match[1])
);
const missingProjectWorkflows = projects.filter(
  (project) => !workflowTitles.has(project.title)
);
const unknownProjectWorkflows = [...workflowTitles].filter(
  (title) => !knownTitles.has(title)
);

const branchAudit = JSON.parse(branchAuditSource);
const auditBranchNames = new Set(
  branchAudit.branches.map((branch) => branch.shortName)
);
const duplicateAuditBranches = branchAudit.branches
  .map((branch) => branch.fullName)
  .filter((name, index, rows) => rows.indexOf(name) !== index);
const unreadAuditBlobs =
  branchAudit.methodology.uniqueCodeBlobsExpected -
  branchAudit.methodology.uniqueCodeBlobsRead;
const sourceInventory = JSON.parse(sourceInventorySource);
const sourceReference = JSON.parse(sourceReferenceSource);
const historicalSymbols = JSON.parse(historicalSymbolsSource);
const typedoc = JSON.parse(typedocSource);
const unclassifiedReachableBlobs =
  sourceInventory.methodology.reachableBlobs -
  sourceInventory.methodology.classifiedReachableBlobs;
const inventoryPathCount = new Set(sourceInventory.files.map((file) => file.path)).size;
const duplicateInventoryPaths =
  sourceInventory.files.length - inventoryPathCount;
const sourceParserFailures = sourceReference.parserFailures;
const historicalParserFailures = historicalSymbols.parserFailures;
const sourceBranchRefs = new Set(sourceReference.branches.map((branch) => branch.fullName));
const missingSemanticBranches = branchAudit.branches
  .filter((branch) => !sourceBranchRefs.has(branch.fullName))
  .map((branch) => branch.fullName);
const baselineMismatch =
  sourceInventory.repository.baselineTip !== sourceReference.repository.baselineTip ||
  sourceReference.repository.baselineTip !== branchAudit.repository.baselineTip;
const sourceLinksWithoutCommit = sourceReference.modules.flatMap((module) =>
  module.symbols
    .filter((symbol) => !symbol.sourceUrl.includes(sourceReference.repository.baselineTip))
    .map((symbol) => `${module.path}#${symbol.qualifiedName}`)
);
const typedocName = typedoc.name ?? '';
const typedocBaselineMissing =
  !typedocName.includes(sourceReference.repository.baselineTip.slice(0, 12));

const missingNamedBranches = [];
for (const match of projectsSource.matchAll(/^\s{4}code:\s*'(?<code>[^']+)',/gm)) {
  const branchSegment = match.groups.code.match(/\bbranches?\s+([^;]+)/i)?.[1];
  if (!branchSegment) continue;
  for (const quoted of branchSegment.matchAll(/`([^`]+)`/g)) {
    if (!auditBranchNames.has(quoted[1])) missingNamedBranches.push(quoted[1]);
  }
}

const capabilityIds = new Set(
  [...capabilitiesSource.matchAll(/^\s{4}id:\s*'([^']+)',/gm)].map((match) => match[1])
);
const capabilityVisualBody =
  visualsSource.match(
    /export const capabilityVisuals:[\s\S]*?= \{(?<body>[\s\S]*?)\n\};\n\nexport function visualForProject/
  )?.groups?.body ?? '';
const capabilityVisualIds = new Set(
  [...capabilityVisualBody.matchAll(/^\s{2}(?:'([^']+)'|([a-z][A-Za-z0-9]*)):/gm)]
    .map((match) => match[1] ?? match[2])
);
const missingCapabilityVisuals = [...capabilityIds].filter(
  (id) => !capabilityVisualIds.has(id)
);
const unknownCapabilityVisuals = [...capabilityVisualIds].filter(
  (id) => !capabilityIds.has(id)
);

const visualPosters = new Set(
  [...visualsSource.matchAll(/poster\('([^']+)'\)/g)].map((match) => match[1])
);
const missingVisualPosters = [];
for (const poster of visualPosters) {
  try {
    await readFile(path.join(root, 'public/assets/images/visuals', `${poster}.webp`));
  } catch {
    missingVisualPosters.push(poster);
  }
}

const creatorLabels = [
  ...creatorsSource.matchAll(/\{\s*label:\s*'([^']+)'/g),
].map((match) => match[1]);
const duplicateCreatorLabels = creatorLabels.filter(
  (label, index) => creatorLabels.indexOf(label) !== index
);
const missingCreatorImages = [];
for (const match of creatorsSource.matchAll(/image:\s*(captured|poster)\('([^']+)'\)/g)) {
  const directory = match[1] === 'captured' ? 'creators' : 'visuals';
  const candidate = path.join(root, 'public/assets/images', directory, `${match[2]}.webp`);
  try {
    await readFile(candidate);
  } catch {
    missingCreatorImages.push(`/${directory}/${match[2]}.webp`);
  }
}

const missingPageVisuals = [];
for (const match of pageVisualsSource.matchAll(/src:\s*(current|poster)\('([^']+)'\)/g)) {
  const directory = match[1] === 'current' ? 'current' : 'visuals';
  const candidate = path.join(root, 'public/assets/images', directory, `${match[2]}.webp`);
  try {
    await readFile(candidate);
  } catch {
    missingPageVisuals.push(`/${directory}/${match[2]}.webp`);
  }
}

const posterNames = [
  ...posterBuilderSource.matchAll(
    /^\s{2}(?:'([^']+)'|([a-z][a-z0-9-]*)):\s*'assets\/[^']+',?$/gmi
  ),
].map((match) => match[1] ?? match[2]);
const posterHashGroups = new Map();
for (const name of posterNames) {
  const bytes = await readFile(
    path.join(root, 'public/assets/images/visuals', `${name}.webp`)
  );
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (!posterHashGroups.has(digest)) posterHashGroups.set(digest, []);
  posterHashGroups.get(digest).push(name);
}
const duplicatePosterContent = [...posterHashGroups.values()].filter(
  (names) => names.length > 1
);
const posterSourcePaths = [
  ...posterBuilderSource.matchAll(
    /:\s*'((?:assets\/)[^']+\.(?:gif|png|jpe?g|webp))'/gi
  ),
].map((match) => `/${match[1]}`);
const posterSourceHashGroups = new Map();
for (const source of posterSourcePaths) {
  const bytes = await readFile(path.join(root, 'public', source.replace(/^\//, '')));
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (!posterSourceHashGroups.has(digest)) posterSourceHashGroups.set(digest, []);
  posterSourceHashGroups.get(digest).push(source);
}
const duplicatePosterSourceContent = [...posterSourceHashGroups.values()].filter(
  (sources) => sources.length > 1
);

const walk = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else files.push(full);
  }
  return files;
};

const docsRoot = path.join(root, 'src/content/docs');
const routeForFile = (filename) => {
  const relative = path.relative(docsRoot, filename).replaceAll('\\', '/');
  const withoutExtension = relative.replace(/\.(md|mdx)$/i, '');
  if (withoutExtension === 'index') return '/';
  return `/${withoutExtension.replace(/\/index$/i, '')}`.toLowerCase();
};
const inlineVisualPattern =
  /!\[[^\]]*\]\(|<img\b|<VisualEvidence\b|<WorkflowGallery\b|<CohortProjects\b|<ProjectIndex\b|<CapabilityCatalog\b|<BranchAudit\b/i;
const pageFiles = (await walk(docsRoot)).filter((file) => /\.(md|mdx)$/i.test(file));
const pagesNeedingHero = [];
for (const pageFile of pageFiles) {
  const source = await readFile(pageFile, 'utf8');
  if (!inlineVisualPattern.test(source)) pagesNeedingHero.push(routeForFile(pageFile));
}

const pageRegistry = JSON.parse(pageRegistrySource);
const assignedRoutes = new Set(Object.keys(pageRegistry));
const missingPageAssignments = pagesNeedingHero.filter(
  (route) => !assignedRoutes.has(route)
);
const unexpectedPageAssignments = [...assignedRoutes].filter(
  (route) => !pagesNeedingHero.includes(route)
);
const assignedSources = Object.values(pageRegistry).map((entry) => entry.src);
const duplicateAssignedSources = assignedSources.filter(
  (source, index) => assignedSources.indexOf(source) !== index
);
const pageVisualHashGroups = new Map();
const missingAssignedPageMedia = [];
for (const source of assignedSources) {
  try {
    const bytes = await readFile(path.join(root, 'public', source.replace(/^\//, '')));
    const digest = createHash('sha256').update(bytes).digest('hex');
    if (!pageVisualHashGroups.has(digest)) pageVisualHashGroups.set(digest, []);
    pageVisualHashGroups.get(digest).push(source);
  } catch {
    missingAssignedPageMedia.push(source);
  }
}
const duplicatePageVisualContent = [...pageVisualHashGroups.values()].filter(
  (sources) => sources.length > 1
);
const repeatedAcrossPageAndPoster = [];
for (const [digest, sources] of pageVisualHashGroups) {
  const posterSources = posterSourceHashGroups.get(digest);
  if (posterSources) {
    repeatedAcrossPageAndPoster.push([...posterSources, ...sources]);
  }
}

if (
  unknown.length ||
  unmappedIntegrated.length ||
  missingTargets.length ||
  missingProjectVisuals.length ||
  unknownProjectVisuals.length ||
  missingProjectWorkflows.length ||
  unknownProjectWorkflows.length ||
  duplicateAuditBranches.length ||
  unreadAuditBlobs !== 0 ||
  unclassifiedReachableBlobs !== 0 ||
  duplicateInventoryPaths !== 0 ||
  sourceParserFailures.length ||
  missingSemanticBranches.length ||
  baselineMismatch ||
  sourceLinksWithoutCommit.length ||
  typedocBaselineMissing ||
  !branchAudit.branches.some((branch) => branch.name === 'origin/master') ||
  missingNamedBranches.length ||
  missingCapabilityVisuals.length ||
  unknownCapabilityVisuals.length ||
  missingVisualPosters.length ||
  creatorLabels.length !== 38 ||
  duplicateCreatorLabels.length ||
  missingCreatorImages.length ||
  missingPageVisuals.length ||
  duplicatePosterContent.length ||
  duplicatePosterSourceContent.length ||
  missingPageAssignments.length ||
  unexpectedPageAssignments.length ||
  duplicateAssignedSources.length ||
  duplicatePageVisualContent.length ||
  repeatedAcrossPageAndPoster.length ||
  missingAssignedPageMedia.length
) {
  if (unknown.length) {
    console.error('Capability registry references unknown projects:');
    for (const title of unknown) console.error(`  - ${title}`);
  }
  if (unmappedIntegrated.length) {
    console.error('Integrated projects without a capability mapping:');
    for (const project of unmappedIntegrated) console.error(`  - ${project.title}`);
  }
  if (missingTargets.length) {
    console.error('Capability registry references missing documentation pages:');
    for (const target of missingTargets) console.error(`  - ${target}`);
  }
  if (missingProjectVisuals.length) {
    console.error('Projects without visual evidence:');
    for (const project of missingProjectVisuals) console.error(`  - ${project.title}`);
  }
  if (unknownProjectVisuals.length) {
    console.error('Visual registry references unknown projects:');
    for (const title of unknownProjectVisuals) console.error(`  - ${title}`);
  }
  if (missingProjectWorkflows.length) {
    console.error('Projects without a complete interaction workflow:');
    for (const project of missingProjectWorkflows) console.error(`  - ${project.title}`);
  }
  if (unknownProjectWorkflows.length) {
    console.error('Workflow registry references unknown projects:');
    for (const title of unknownProjectWorkflows) console.error(`  - ${title}`);
  }
  if (duplicateAuditBranches.length) {
    console.error('Branch audit contains duplicate branch names:');
    for (const name of new Set(duplicateAuditBranches)) console.error(`  - ${name}`);
  }
  if (unreadAuditBlobs !== 0) {
    console.error(
      `Branch audit did not read every expected blob: ${unreadAuditBlobs} remain.`
    );
  }
  if (unclassifiedReachableBlobs !== 0) {
    console.error(`Source inventory left ${unclassifiedReachableBlobs} reachable blobs unclassified.`);
  }
  if (duplicateInventoryPaths !== 0) {
    console.error(`Source inventory contains ${duplicateInventoryPaths} duplicate canonical paths.`);
  }
  if (sourceParserFailures.length) {
    console.error('Semantic source parsers reported failures:');
    for (const failure of sourceParserFailures.slice(0, 100)) {
      console.error(`  - ${failure.path}:${failure.line ?? '?'} ${failure.message}`);
    }
  }
  if (missingSemanticBranches.length) {
    console.error('Branch-tip audit refs missing from semantic branch deltas:');
    for (const ref of missingSemanticBranches) console.error(`  - ${ref}`);
  }
  if (baselineMismatch) {
    console.error('Generated branch, inventory, and semantic references do not share one baseline commit.');
  }
  if (sourceLinksWithoutCommit.length) {
    console.error('Generated symbols without immutable commit links:');
    for (const symbol of sourceLinksWithoutCommit.slice(0, 100)) console.error(`  - ${symbol}`);
  }
  if (typedocBaselineMissing) {
    console.error('TypeDoc reflection JSON is absent or was not generated for the semantic baseline.');
  }
  if (!branchAudit.branches.some((branch) => branch.name === 'origin/master')) {
    console.error('Branch audit does not contain the origin/master baseline.');
  }
  if (missingNamedBranches.length) {
    console.error('Project records name branches absent from the branch audit:');
    for (const name of new Set(missingNamedBranches)) console.error(`  - ${name}`);
  }
  if (missingCapabilityVisuals.length) {
    console.error('Capabilities without visual evidence:');
    for (const id of missingCapabilityVisuals) console.error(`  - ${id}`);
  }
  if (unknownCapabilityVisuals.length) {
    console.error('Visual registry references unknown capabilities:');
    for (const id of unknownCapabilityVisuals) console.error(`  - ${id}`);
  }
  if (missingVisualPosters.length) {
    console.error('Visual posters have not been built:');
    for (const poster of missingVisualPosters) console.error(`  - ${poster}.webp`);
    console.error('Run `npm run visuals` to rebuild the poster set.');
  }
  if (creatorLabels.length !== 38) {
    console.error(`Expected 38 documented creator entries, found ${creatorLabels.length}.`);
  }
  if (duplicateCreatorLabels.length) {
    console.error('Creator atlas contains duplicate labels:');
    for (const label of new Set(duplicateCreatorLabels)) console.error(`  - ${label}`);
  }
  if (missingCreatorImages.length) {
    console.error('Creator cards reference missing images:');
    for (const image of missingCreatorImages) console.error(`  - ${image}`);
  }
  if (missingPageVisuals.length) {
    console.error('Automatic page visuals reference missing images:');
    for (const image of missingPageVisuals) console.error(`  - ${image}`);
  }
  if (duplicatePosterContent.length) {
    console.error('Project/capability posters repeat identical image content:');
    for (const names of duplicatePosterContent) console.error(`  - ${names.join(', ')}`);
  }
  if (duplicatePosterSourceContent.length) {
    console.error('Project/capability posters reuse the same underlying image:');
    for (const sources of duplicatePosterSourceContent) {
      console.error(`  - ${sources.join(', ')}`);
    }
  }
  if (missingPageAssignments.length) {
    console.error('Pages without inline media also lack a unique page visual:');
    for (const route of missingPageAssignments) console.error(`  - ${route}`);
  }
  if (unexpectedPageAssignments.length) {
    console.error('Page visual registry contains pages that already own inline visuals:');
    for (const route of unexpectedPageAssignments) console.error(`  - ${route}`);
  }
  if (duplicateAssignedSources.length) {
    console.error('Page visual registry repeats source paths:');
    for (const source of new Set(duplicateAssignedSources)) console.error(`  - ${source}`);
  }
  if (duplicatePageVisualContent.length) {
    console.error('Page visual registry repeats identical image content:');
    for (const sources of duplicatePageVisualContent) console.error(`  - ${sources.join(', ')}`);
  }
  if (repeatedAcrossPageAndPoster.length) {
    console.error('Page visuals reuse image content already assigned to a poster:');
    for (const sources of repeatedAcrossPageAndPoster) {
      console.error(`  - ${sources.join(', ')}`);
    }
  }
  if (missingAssignedPageMedia.length) {
    console.error('Page visual registry references missing media:');
    for (const source of missingAssignedPageMedia) console.error(`  - ${source}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    `Capability coverage complete: ${projects.length} projects, ` +
      `${projects.filter((project) => project.status === 'integrated').length} integrated projects mapped, ` +
      `${new Set(docsTargets).size} canonical documentation targets verified, ` +
      `${projectVisualTitles.size} project visuals, ${workflowTitles.size} complete project workflows, ` +
      `${capabilityVisualIds.size} capability visuals, ${creatorLabels.length} creator cards, ` +
      `${posterNames.length} content-unique posters, ${assignedRoutes.size} non-repeating page visuals, ` +
      `and ${branchAudit.methodology.branchCount} branch tips / ` +
      `${branchAudit.methodology.uniqueCodeBlobsRead} unique code versions verified; ` +
      `${sourceInventory.methodology.reachableBlobs} reachable blobs classified, ` +
      `${sourceReference.methodology.symbolCount} current symbols and ` +
      `${historicalSymbols.methodology.removed} removed symbols indexed.`
  );
}

if (historicalParserFailures.length) {
  console.warn(
    `Historical source archive recorded ${historicalParserFailures.length} parser failures from malformed or incomplete revisions; these remain disclosed in the generated archive.`
  );
}
