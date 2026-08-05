/**
 * A manifest of the generated datasets this site publishes.
 *
 * Every reference page here is rendered from a machine-readable inventory. That
 * inventory is worth publishing on its own: it lets a reader verify a claim
 * without scraping HTML, and lets a tool build something else on top of it.
 *
 * Each entry carries the dataset's own schema version, the Dash-Web revision it
 * was generated from, and its record count, so a consumer can tell a
 * regeneration from a schema change.
 */
import accessibility from '../../../data/generated/accessibility.json';
import contextMenus from '../../../data/generated/context-menus.json';
import coverageReport from '../../../data/generated/coverage-report.json';
import documentTypes from '../../../data/generated/document-types.json';
import fieldTypes from '../../../data/generated/field-types.json';
import httpRoutes from '../../../data/generated/http-routes.json';
import interfaceControls from '../../../data/generated/interface-controls.json';
import keyboardShortcuts from '../../../data/generated/keyboard-shortcuts.json';
import inappDocLinks from '../../../data/generated/inapp-doc-links.json';
import openDestinations from '../../../data/generated/open-destinations.json';
import projectControls from '../../../data/generated/project-controls.json';
import scriptingGlobals from '../../../data/generated/scripting-globals.json';
import scriptingUsage from '../../../data/generated/scripting-usage.json';
import taskRoutes from '../../../data/generated/task-routes.json';
import exportedSymbols from '../../../data/generated/exported-symbols.json';

export const prerender = true;

interface DatasetEntry {
  id: string;
  title: string;
  description: string;
  path: string;
  page: string;
  schemaVersion: number;
  records: number;
  recordKey: string;
  /**
   * The Dash-Web commit the records describe. Null for the one dataset that
   * measures this site rather than Dash: the accessibility report is derived
   * from this repository's own stylesheet, and pinning it to a Dash revision
   * would be a false provenance claim.
   */
  baseline: string | null;
  generator: string;
}

const datasets: DatasetEntry[] = [
  {
    id: 'interface-controls',
    title: 'Interface control and node atlas',
    description: 'Every persistent control across the top bar, sidebar, context toolbar, document decorations, properties panel, tab and tile chrome, footer, and creator palette.',
    path: '/assets/data/interface-controls.json',
    page: '/reference/interface-controls/',
    schemaVersion: interfaceControls.schemaVersion,
    records: interfaceControls.controls.length,
    recordKey: 'controls',
    baseline: interfaceControls.repository.baseline,
    generator: 'npm run audit:controls',
  },
  {
    id: 'context-menus',
    title: 'Right-click menu atlas',
    description: 'Every entry a component can contribute to the context-menu singleton, with its guards, nesting, and handler.',
    path: '/assets/data/context-menus.json',
    page: '/reference/context-menus/',
    schemaVersion: contextMenus.schemaVersion,
    records: contextMenus.items.length,
    recordKey: 'items',
    baseline: contextMenus.repository.baseline,
    generator: 'npm run audit:menus',
  },
  {
    id: 'keyboard-shortcuts',
    title: 'Keyboard shortcuts',
    description: 'Every keystroke Dash routes itself, with both platform chords and whether the browser default survives.',
    path: '/assets/data/keyboard-shortcuts.json',
    page: '/reference/keyboard-shortcuts/',
    schemaVersion: keyboardShortcuts.schemaVersion,
    records: keyboardShortcuts.shortcuts.length,
    recordKey: 'shortcuts',
    baseline: keyboardShortcuts.repository.baseline,
    generator: 'npm run audit:keys',
  },
  {
    id: 'task-routes',
    title: 'Cross-route task index',
    description: 'Everyday tasks mapped to every control, menu entry, and shortcut that reaches them.',
    path: '/assets/data/task-routes.json',
    page: '/reference/task-routes/',
    schemaVersion: taskRoutes.schemaVersion,
    records: taskRoutes.tasks.length,
    recordKey: 'tasks',
    baseline: taskRoutes.repository.baseline,
    generator: 'npm run audit:tasks',
  },
  {
    id: 'open-destinations',
    title: 'Open destination map',
    description: 'Every OpenWhere destination, the routers that claim it, the rules that override it, and the split algebra it feeds.',
    path: '/assets/data/open-destinations.json',
    page: '/reference/open-destinations/',
    schemaVersion: openDestinations.schemaVersion,
    records: openDestinations.destinations.length,
    recordKey: 'destinations',
    baseline: openDestinations.repository.baseline,
    generator: 'npm run audit:destinations',
  },
  {
    id: 'coverage-report',
    title: 'Documentation coverage report',
    description: 'For every generated surface, how many records carry a source line, how many carry a human explanation, and which are still missing one.',
    path: '/assets/data/coverage-report.json',
    page: '/reference/documentation-coverage/',
    schemaVersion: coverageReport.schemaVersion,
    records: coverageReport.surfaces.length,
    recordKey: 'surfaces',
    baseline: coverageReport.repository.baseline,
    generator: 'npm run audit:coverage-report',
  },
  {
    id: 'accessibility',
    title: 'Accessibility measurements for this site',
    description: 'Every reviewed colour pair with its computed contrast in both themes and the threshold it has to meet, plus the areas this site does not test at all.',
    path: '/assets/data/accessibility.json',
    page: '/reference/accessibility/',
    schemaVersion: accessibility.schemaVersion,
    records: accessibility.measurements.length,
    recordKey: 'measurements',
    baseline: null,
    generator: 'npm run audit:accessibility',
  },
  {
    id: 'scripting-usage',
    title: 'Which controls call which scripting global',
    description: 'For each scripting global that an interface control calls, the controls that call it and the reviewed explanation each of them carries. Most globals have no description of their own; this is where an answer exists anyway.',
    path: '/assets/data/scripting-usage.json',
    page: '/guides/features/scripting/',
    schemaVersion: scriptingUsage.schemaVersion,
    records: scriptingUsage.usage.length,
    recordKey: 'usage',
    baseline: scriptingUsage.repository.baseline,
    generator: 'npm run audit:scripting-usage',
  },
  {
    id: 'inapp-doc-links',
    title: 'Links from Dash into this site',
    description: 'Every documentation URL shipped inside the Dash client, resolved against this site’s page list and redirect table, with fragment checks.',
    path: '/assets/data/inapp-doc-links.json',
    page: '/contributing/inapp-links/',
    schemaVersion: inappDocLinks.schemaVersion,
    records: inappDocLinks.links.length,
    recordKey: 'links',
    baseline: inappDocLinks.repository.baseline,
    generator: 'npm run audit:inapp',
  },
  {
    id: 'project-controls',
    title: 'Project-specific controls',
    description: 'Controls added by workspace presets. Pinned to each project feature branch, not to master.',
    path: '/assets/data/project-controls.json',
    page: '/guides/features/trip-planner/',
    schemaVersion: projectControls.schemaVersion,
    records: projectControls.controls.length,
    recordKey: 'controls',
    baseline: projectControls.repository.masterTip,
    generator: 'npm run audit:projects',
  },
  {
    id: 'document-types',
    title: 'Document types and creators',
    description: 'Every serialized document type, its prototype registration, factory functions, renderer, and palette creator.',
    path: '/assets/data/document-types.json',
    page: '/reference/document-types/',
    schemaVersion: documentTypes.schemaVersion,
    records: documentTypes.types.length,
    recordKey: 'types',
    baseline: documentTypes.repository.baseline,
    generator: 'npm run audit:documents',
  },
  {
    id: 'field-types',
    title: 'Serialized field types',
    description: 'Every field tag with its storage form, hydration path, and conversion behavior.',
    path: '/assets/data/field-types.json',
    page: '/reference/runtime-contracts/',
    schemaVersion: fieldTypes.schemaVersion,
    records: fieldTypes.registrations.length,
    recordKey: 'registrations',
    baseline: fieldTypes.repository.baseline,
    generator: 'npm run audit:fields',
  },
  {
    id: 'http-routes',
    title: 'HTTP service interface',
    description: 'Every registered route with its method, path, registration layer, and access-path classification.',
    path: '/assets/data/http-routes.json',
    page: '/reference/http-service-interface/',
    schemaVersion: httpRoutes.schemaVersion,
    records: httpRoutes.routes.length,
    recordKey: 'routes',
    baseline: httpRoutes.repository.baseline,
    generator: 'npm run audit:http',
  },
  {
    id: 'scripting-globals',
    title: 'Scripting globals',
    description: 'Every function exposed to Dash scripts, with its signature, direct calls, and observed field writes.',
    path: '/assets/data/scripting-globals.json',
    page: '/guides/features/scripting/',
    schemaVersion: scriptingGlobals.schemaVersion,
    records: scriptingGlobals.globals.length,
    recordKey: 'globals',
    baseline: scriptingGlobals.repository.baseline,
    generator: 'npm run audit:scripting',
  },
  {
    id: 'exported-symbols',
    title: 'Exported symbol index',
    description: 'Every exported declaration in the Dash-Web tree, with kind, signature, module, and line range.',
    path: '/assets/data/exported-symbols.json',
    page: '/technical/exported-symbols/',
    schemaVersion: exportedSymbols.schemaVersion,
    records: exportedSymbols.rows.length,
    recordKey: 'rows',
    // This dataset records both the ref it was asked for and the commit it
    // resolved to; the manifest always publishes the resolved commit.
    baseline: exportedSymbols.repository.baselineTip,
    generator: 'npm run audit:symbols',
  },
];

export function GET() {
  const body = {
    schemaVersion: 1,
    description:
      'Generated reference datasets published by the Dash documentation site. Each dataset is derived from a pinned Dash-Web revision and carries its own schema version.',
    stability:
      'Record fields are added, not renamed or removed, without incrementing that dataset schemaVersion. Baselines change whenever the pinned Dash-Web revision moves, so pin a baseline if you need reproducible results.',
    generatedAt: interfaceControls.generatedAt,
    datasets,
  };
  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
