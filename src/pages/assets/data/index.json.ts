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
import contextMenus from '../../../data/generated/context-menus.json';
import documentTypes from '../../../data/generated/document-types.json';
import fieldTypes from '../../../data/generated/field-types.json';
import httpRoutes from '../../../data/generated/http-routes.json';
import interfaceControls from '../../../data/generated/interface-controls.json';
import keyboardShortcuts from '../../../data/generated/keyboard-shortcuts.json';
import projectControls from '../../../data/generated/project-controls.json';
import scriptingGlobals from '../../../data/generated/scripting-globals.json';
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
  baseline: string;
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
