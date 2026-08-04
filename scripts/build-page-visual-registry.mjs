/**
 * Assign one distinct, relevant Dash image to every documentation page.
 *
 * The previous implementation had seventeen category images for more than one
 * hundred pages. It made different tabs look identical. This generator:
 *
 * - inventories real archived/current media already in the repository;
 * - removes exact duplicate files by SHA-256;
 * - excludes media already used as project/capability posters;
 * - scores remaining media against each page path;
 * - assigns every page a different source image.
 */
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docsRoot = path.join(root, 'src', 'content', 'docs');
const publicRoot = path.join(root, 'public');
const output = path.join(root, 'src', 'data', 'generated', 'page-visuals.json');

const allowed = /\.(gif|png|jpe?g|webp)$/i;
const candidateRoots = [
  'assets/gifs',
  'assets/images/current',
  'assets/images/environment',
  'assets/images/getting-started',
  'assets/images/trails',
];

const manual = {
  '/': '/assets/images/current/dash-trip-planner-detail.webp',
  '/architecture': '/assets/images/dash1.png',
  '/architecture/agents-ai': '/assets/gifs/ai/ai-websearch-2.gif',
  '/architecture/collections-views': '/assets/images/environment/views/freeform_view.gif',
  '/architecture/desktop-local-models': '/assets/images/environment/homemenu.png',
  '/architecture/document-model': '/assets/gifs/gettingstarted/dash-create-text.gif',
  '/architecture/extension-points': '/assets/gifs/environment/colon-menu.gif',
  '/architecture/import-export': '/assets/gifs/gettingstarted/dash-drag-drop.gif',
  '/architecture/links-trails': '/assets/gifs/gettingstarted/dash-trail-transition.gif',
  '/architecture/rendering-lifecycle': '/assets/gifs/environment/dash-flyout.gif',
  '/architecture/server-storage-security': '/assets/gifs/gettingstarted/dash-pin-doc.gif',
  '/architecture/system-map': '/assets/gifs/environment/menu-panel.gif',
  '/architecture/undo-provenance': '/assets/gifs/gettingstarted/recently-closed.gif',
  '/capabilities': '/assets/images/gen_ai.png',
  '/capabilities/ai-automation': '/assets/gifs/ai/ai-firefly-template-image-1.gif',
  '/capabilities/connections-and-trails': '/assets/gifs/trails/arrows-present-together.gif',
  '/capabilities/documents': '/assets/images/environment/image_doc3.png',
  '/capabilities/organization': '/assets/gifs/views/schema_columns.gif',
  '/capabilities/platform': '/assets/gifs/environment/dash-create-delete-tab.gif',
  '/capabilities/search-import': '/assets/gifs/gettingstarted/dash-link-search.gif',
  '/concepts': '/assets/gifs/gettingstarted/dash-show-links.gif',
  '/concepts/agents': '/assets/gifs/dataViz/aiChat.gif',
  '/concepts/collections': '/assets/gifs/gettingstarted/dash-create-collection-marquee.gif',
  '/concepts/documents': '/assets/gifs/gettingstarted/dash-image-text-embed.gif',
  '/concepts/generative': '/assets/gifs/ai/ai-firefly-image-1.gif',
  '/concepts/links': '/assets/gifs/links/linkboard.gif',
  '/concepts/trails': '/assets/gifs/trails/miniplayer.gif',
  '/contributing/documentation': '/assets/gifs/gettingstarted/dash-editing-link.gif',
  '/contributing/joining': '/assets/gifs/environment/dash-drag-tab-create-tile.gif',
  '/development': '/assets/gifs/environment/rename-dashboard.gif',
  '/development/add-agent-tool': '/assets/gifs/ai/ai-pdf.gif',
  '/development/add-collection-view': '/assets/gifs/dataViz/fromSchema_dataViz.gif',
  '/development/add-document-type': '/assets/gifs/gettingstarted/createnode.gif',
  '/development/extension-points': '/assets/gifs/trails/pinmenuview.gif',
  '/development/testing-release': '/assets/gifs/environment/dash-report.gif',
  '/overview/what-dash-is': '/assets/images/dash2.jpg',
  '/overview/current-state': '/assets/images/current/dash-files-panel.webp',
  '/getting-started/environment': '/assets/images/environment/dash-topbar.png',
  '/getting-started/picture-tour': '/assets/images/environment/dash-freeform-toolbar.png',
  '/getting-started/using-dash': '/assets/gifs/gettingstarted/createnode.gif',
  '/getting-started/modes': '/assets/gifs/gettingstarted/dash-shift-click.gif',
  '/getting-started/running-dash': '/assets/gifs/environment/new-dashboard.gif',
  '/guides/documents/temporal-media': '/assets/gifs/audio/audiotrimming.gif',
  '/guides/features/collaboration': '/assets/gifs/gettingstarted/dash-create-link-board.gif',
  '/guides/features/scripting': '/assets/gifs/ai/ai-edit-3.gif',
  '/guides/properties/fieldsandtags': '/assets/gifs/dataViz/titleCol.gif',
  '/guides/properties/filters': '/assets/gifs/environment/map_filter.gif',
  '/guides/properties/layout': '/assets/gifs/trails/pinlayoutcontent.gif',
  '/guides/properties/linkedto': '/assets/gifs/gettingstarted/dash-toggle-show-link.gif',
  '/guides/properties/options': '/assets/gifs/gettingstarted/dash-colon-menu.gif',
  '/guides/properties/othercontexts': '/assets/gifs/gettingstarted/dash-pres-layout-content-grouping.gif',
  '/guides/properties/sharingpermissions': '/assets/gifs/gettingstarted/dash-drag-drop-link.gif',
  '/guides/videos': '/assets/gifs/gettingstarted/dash-pres-miniplayer.gif',
  '/guides/views/notetaking': '/assets/gifs/gettingstarted/textannos.gif',
  '/guides/views/stacking': '/assets/gifs/environment/colon-stack.gif',
  '/reference/interface-controls': '/assets/gifs/gettingstarted/dash-context-menu.gif',
  '/reference/context-menus': '/assets/images/diagrams/dash-context-menu-composition.svg',
  '/reference/branch-audit': '/assets/gifs/environment/dash-report.gif',
  '/reference/agent-tools': '/assets/gifs/ai/ai-template-csv-1.gif',
  '/reference/collection-views': '/assets/images/environment/views/schema_view.png',
  '/reference/configuration': '/assets/gifs/gettingstarted/dash-properties-pane.gif',
  '/reference/document-types': '/assets/images/diagrams/dash-document-construction-lifecycle.svg',
  '/reference/glossary': '/assets/gifs/gettingstarted/dash-edit-link.gif',
  '/reference/implementation-snapshot': '/assets/images/diagrams/source-evidence-flow.svg',
  '/reference/keyboard-shortcuts': '/assets/gifs/gettingstarted/dash-highlight-select.gif',
  '/reference/status-taxonomy': '/assets/gifs/gettingstarted/dash-annotation-icon.gif',
  '/research/cohorts': '/assets/gifs/environment/dash-drag-tab-back.gif',
  '/research/cohorts/2019-2020': '/assets/gifs/gettingstarted/textannos.gif',
  '/research/cohorts/2021-2022': '/assets/gifs/gettingstarted/dash-pin-with-view.gif',
  '/research/cohorts/2023': '/assets/gifs/environment/map_placepin.gif',
  '/research/cohorts/2024': '/assets/gifs/ai/ai-template-csv-2.gif',
  '/research/cohorts/2025': '/assets/gifs/ai/ai-pdf.gif',
  '/research/cohorts/2026': '/assets/images/current/dash-trip-planner-preset.webp',
  '/research/lineage': '/assets/gifs/gettingstarted/dash-following-link.gif',
  '/research/projects': '/assets/gifs/gettingstarted/dash-marquee.gif',
  '/research/people': '/assets/gifs/gettingstarted/groupselection.gif',
  '/research/publications': '/assets/gifs/gettingstarted/dash-pdf-select-annotate.gif',
  '/research/release-history': '/assets/gifs/gettingstarted/dash-reorganize-slides.gif',
  '/workflows/research-synthesis': '/assets/gifs/gettingstarted/dash-pdf-anno-marquee.gif',
  '/workflows/data-to-story': '/assets/gifs/dataViz/filteringB.gif',
  '/workflows/agent-assisted': '/assets/gifs/ai/ai-edit-3.gif',
  '/workflows/team-workspace': '/assets/gifs/gettingstarted/dash-drag-drop-link.gif',
  '/workflows': '/assets/gifs/gettingstarted/dash-present-trail.gif',
};

const manualAlt = {
  '/reference/context-menus':
    'How Dash assembles a right-click menu: the hit path up the React tree, each component contributing entries, guards removing them, and shared group names merging the result.',
  '/reference/document-types':
    'Document construction lifecycle from serialized type through prototypes, data and view delegates, and layout-driven rendering.',
  '/reference/implementation-snapshot':
    'Evidence flow from observed Dash behavior and source code through research records to published documentation.',
};

const synonymGroups = [
  ['agent', 'agents', 'ai', 'gpt', 'assistant', 'websearch', 'firefly'],
  ['link', 'links', 'linked', 'linking'],
  ['trail', 'trails', 'presentation', 'present', 'pin', 'slide', 'animation', 'miniplayer'],
  ['document', 'documents', 'node', 'nodes', 'doc'],
  ['collection', 'collections', 'view', 'views', 'schema', 'group', 'stacking'],
  ['map', 'maps', 'location', 'trip', 'route'],
  ['data', 'dataviz', 'chart', 'csv', 'filter', 'visualization'],
  ['image', 'images', 'ink', 'draw', 'markup', 'marquee', 'annotation', 'highlight'],
  ['audio', 'recording', 'dictation'],
  ['video', 'timeline', 'temporal'],
  ['text', 'rich', 'format', 'fields', 'tags'],
  ['search', 'find', 'discovery'],
  ['import', 'export', 'drag', 'drop', 'upload'],
  ['properties', 'configuration', 'settings', 'options', 'menu', 'colon'],
  ['sharing', 'collaboration', 'shared', 'permissions'],
  ['undo', 'history', 'recent', 'provenance'],
  ['home', 'dashboard', 'workspace', 'environment', 'interface'],
  ['pdf', 'paper', 'publication', 'research'],
  ['webpage', 'website', 'html'],
  ['simulation', 'physics'],
  ['developer', 'development', 'extension', 'scripting', 'component'],
];

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

const routeForFile = (filename) => {
  const relative = path.relative(docsRoot, filename).replaceAll('\\', '/');
  const withoutExtension = relative.replace(/\.(md|mdx)$/i, '');
  if (withoutExtension === 'index') return '/';
  return `/${withoutExtension.replace(/\/index$/i, '')}`.toLowerCase();
};

const words = (value) =>
  new Set(
    value
      .toLowerCase()
      .replace(/\.[a-z0-9]+$/i, '')
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 1)
  );

const overlap = (a, b) => [...a].filter((word) => b.has(word)).length;

const relevance = (route, source) => {
  const routeWords = words(route);
  const sourceWords = words(source);
  let score = overlap(routeWords, sourceWords) * 30;
  for (const group of synonymGroups) {
    if (
      group.some((word) => routeWords.has(word)) &&
      group.some((word) => sourceWords.has(word))
    ) {
      score += 100;
    }
  }
  // Prefer recordings over static reference crops when relevance is equal.
  if (source.endsWith('.gif')) score += 4;
  return score;
};

const humanize = (source) =>
  path.basename(source, path.extname(source))
    .replace(/^dash[-_]/i, '')
    .replaceAll(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const posterScript = await readFile(path.join(root, 'scripts', 'build-visual-posters.mjs'), 'utf8');
const posterSources = new Set(
  [...posterScript.matchAll(/:\s*'((?:assets\/)[^']+\.(?:gif|png|jpe?g|webp))'/gi)]
    .map((match) => `/${match[1]}`)
);

const pageFiles = (await walk(docsRoot)).filter((file) => /\.(md|mdx)$/i.test(file));
const inlineVisualPattern =
  /!\[[^\]]*\]\(|<img\b|<VisualEvidence\b|<WorkflowGallery\b|<CohortProjects\b|<ProjectIndex\b|<CapabilityCatalog\b|<BranchAudit\b/i;
const routes = [];
for (const pageFile of pageFiles) {
  const pageSource = await readFile(pageFile, 'utf8');
  if (!inlineVisualPattern.test(pageSource)) routes.push(routeForFile(pageFile));
}
routes.sort();

const rawCandidates = [];
for (const relativeRoot of candidateRoots) {
  const files = await walk(path.join(publicRoot, relativeRoot));
  rawCandidates.push(
    ...files
      .filter((file) => allowed.test(file))
      .map((file) => `/${path.relative(publicRoot, file).replaceAll('\\', '/')}`)
  );
}
rawCandidates.push(
  '/assets/images/dash1.png',
  '/assets/images/dash2.jpg',
  '/assets/images/dash-doc-representation.png',
  '/assets/images/gen_ai.png'
);

const candidates = [];
const seenHashes = new Set();
for (const source of rawCandidates.sort()) {
  if (posterSources.has(source)) continue;
  const bytes = await readFile(path.join(publicRoot, source.slice(1)));
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (seenHashes.has(digest)) continue;
  seenHashes.add(digest);
  candidates.push(source);
}

const used = new Set();
const assignments = {};

for (const route of routes) {
  const source = manual[route];
  if (!source) continue;
  if (used.has(source)) throw new Error(`Manual page visual is repeated: ${source}`);
  used.add(source);
  assignments[route] = {
    src: source,
    alt: manualAlt[route] ?? `Dash demonstration of ${humanize(source)}.`,
  };
}

const unassigned = routes
  .filter((route) => !assignments[route])
  .sort((a, b) => {
    const bestA = Math.max(...candidates.filter((source) => !used.has(source)).map((source) => relevance(a, source)));
    const bestB = Math.max(...candidates.filter((source) => !used.has(source)).map((source) => relevance(b, source)));
    return bestB - bestA || a.localeCompare(b);
  });

for (const route of unassigned) {
  const source = candidates
    .filter((candidate) => !used.has(candidate))
    .sort((a, b) => relevance(route, b) - relevance(route, a) || a.localeCompare(b))[0];
  if (!source) throw new Error(`Not enough unique visual sources for ${route}`);
  used.add(source);
  assignments[route] = {
    src: source,
    alt: `Dash demonstration of ${humanize(source)}.`,
  };
}

const ordered = Object.fromEntries(
  Object.entries(assignments).sort(([a], [b]) => a.localeCompare(b))
);
await writeFile(output, `${JSON.stringify(ordered, null, 2)}\n`);
console.log(
  `Assigned ${routes.length} pages without inline media ${used.size} distinct source images ` +
  `from ${candidates.length} unique candidates; pages with their own visuals keep those instead.`
);
