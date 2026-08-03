import assignments from './generated/page-visuals.json';

export interface PageVisual {
  src: string;
  alt: string;
  label: string;
  plain: string;
  position?: string;
}

const current = (name: string) => `/assets/images/current/${name}.webp`;
const poster = (name: string) => `/assets/images/visuals/${name}.webp`;

const visuals = {
  workspace: {
    src: current('dash-trip-planner-workspace'),
    alt: 'The current Dash workspace with documents arranged on a large canvas',
    label: 'The big picture',
    plain: 'Dash is a big board. The things sitting on the board are documents.',
  },
  home: {
    src: current('dash-home-workspaces'),
    alt: 'The current Dash home screen showing saved workspaces',
    label: 'Where you begin',
    plain: 'Choose a workspace here. A workspace is one saved board.',
  },
  tools: {
    src: current('dash-tools-panel'),
    alt: 'The current Dash workspace with the Tools panel and document creators open',
    label: 'Make something',
    plain: 'These buttons put a new kind of document onto the board.',
    position: 'left top',
  },
  files: {
    src: current('dash-files-panel'),
    alt: 'The current Dash workspace with the Files panel open',
    label: 'Find saved things',
    plain: 'The Files panel lists documents that already belong to your workspace.',
    position: 'left top',
  },
  search: {
    src: current('dash-search-panel'),
    alt: 'The current Dash workspace with the Search panel open',
    label: 'Find anything',
    plain: 'Type a word here and Dash looks through the things you saved.',
    position: 'left top',
  },
  imports: {
    src: current('dash-imports-panel'),
    alt: 'The current Dash workspace with the Imports panel open',
    label: 'Bring things in',
    plain: 'Imports turn files from outside Dash into documents on your board.',
    position: 'left top',
  },
  trails: {
    src: current('dash-trails-panel'),
    alt: 'The current Dash workspace with the Trails panel open',
    label: 'Remember a path',
    plain: 'A trail is a saved order for visiting documents, like stops on a walk.',
    position: 'left top',
  },
  properties: {
    src: current('dash-properties-panel'),
    alt: 'The current Dash workspace with the Properties panel open',
    label: 'Change the selected thing',
    plain: 'Properties are the settings for the document you clicked.',
    position: 'right top',
  },
  trip: {
    src: current('dash-trip-planner-detail'),
    alt: 'The current Dash Trip Planner showing a route, stops, and planning controls',
    label: 'A complete Dash project',
    plain: 'This project combines documents, a map, links, generated information, and a guided workflow.',
  },
  documents: {
    src: poster('document-model'),
    alt: 'A visual example of a Dash document and its surrounding workspace',
    label: 'The basic building block',
    plain: 'A document is one thing Dash can save, show, move, link, or edit.',
  },
  collections: {
    src: poster('collection-views'),
    alt: 'Dash documents shown together in different collection views',
    label: 'A group of things',
    plain: 'A collection holds other documents and decides how that group is arranged.',
  },
  links: {
    src: poster('linking-annotation'),
    alt: 'Dash documents connected with visible links and annotations',
    label: 'Connect two things',
    plain: 'A link says that one document or exact piece of a document is related to another.',
  },
  agents: {
    src: poster('agent-tools'),
    alt: 'A Dash agent interface working with documents and tools',
    label: 'Ask Dash to help',
    plain: 'An agent can read context and use allowed tools. You still review what it does.',
  },
  architecture: {
    src: poster('workspace-interface'),
    alt: 'The Dash interface showing the workspace around its document system',
    label: 'What is under the screen',
    plain: 'The technical pages explain how the visible board becomes data, views, services, and stored state.',
  },
  development: {
    src: poster('component-library'),
    alt: 'A set of reusable Dash interface components',
    label: 'Where builders add things',
    plain: 'Developers extend Dash at a few repeatable seams instead of rebuilding the whole application.',
  },
  research: {
    src: poster('research-agent'),
    alt: 'A research workflow inside Dash',
    label: 'Why this exists',
    plain: 'Dash is also a research record. Each project tests an idea that may become part of the product.',
  },
  reference: {
    src: current('dash-documentation-site'),
    alt: 'The current searchable Dash documentation site',
    label: 'Look up one exact answer',
    plain: 'Reference pages are dictionaries and inventories. You do not need to memorize them.',
  },
} satisfies Record<string, PageVisual>;

const pageCopy = {
  '/reference/implementation-snapshot': {
    label: 'Evidence flow',
    plain: 'Behavior, source code, and research artifacts support different kinds of documentation claims.',
  },
} satisfies Partial<Record<keyof typeof assignments, Partial<PageVisual>>>;

function baseVisualForPath(pathname: string): PageVisual {
  const path = pathname.toLowerCase();

  if (path === '/' || path.endsWith('/index/')) return visuals.workspace;
  if (path.includes('/interface-controls')) return visuals.tools;
  if (path.includes('/trip-planner') || path.includes('/data-to-story')) return visuals.trip;
  if (path.includes('/search')) return visuals.search;
  if (path.includes('/import') || path.includes('/export')) return visuals.imports;
  if (path.includes('/trail')) return visuals.trails;
  if (path.includes('/propert') || path.includes('/fieldsandtags') || path.includes('/linkedto')) return visuals.properties;
  if (path.includes('/environment') || path.includes('/running-dash') || path.includes('/configuration')) return visuals.files;
  if (path.includes('/using-dash') || path.includes('/modes') || path.includes('/picture-tour')) return visuals.workspace;
  if (path.includes('/document') || path.includes('/text') || path.includes('/pdf') || path.includes('/image') || path.includes('/audio') || path.includes('/video') || path.includes('/webpage') || path.includes('/map') || path.includes('/dataviz') || path.includes('/simulation')) return visuals.documents;
  if (path.includes('/collection') || path.includes('/view') || path.includes('/organization') || path.includes('/freeform') || path.includes('/schema') || path.includes('/stacking') || path.includes('/notetaking')) return visuals.collections;
  if (path.includes('/link') || path.includes('/markup') || path.includes('/ink') || path.includes('/animation')) return visuals.links;
  if (path.includes('/agent') || path.includes('/generative') || path.includes('/ai-') || path.includes('/scripting')) return visuals.agents;
  if (path.includes('/workflow')) return visuals.trip;
  if (path.includes('/architecture') || path.includes('/system-map') || path.includes('/implementation-snapshot')) return visuals.architecture;
  if (path.includes('/development') || path.includes('/contributing')) return visuals.development;
  if (path.includes('/research') || path.includes('/cohort') || path.includes('/project') || path.includes('/publication') || path.includes('/release-history')) return visuals.research;
  if (path.includes('/reference')) return visuals.reference;
  if (path.includes('/current-state')) return visuals.home;
  return visuals.workspace;
}

export function pageVisualForPath(pathname: string): PageVisual | undefined {
  const route = pathname.toLowerCase().replace(/\/+$/, '') || '/';
  const assigned = assignments[route as keyof typeof assignments];
  if (!assigned) return undefined;
  return {
    ...baseVisualForPath(pathname),
    ...assigned,
    ...pageCopy[route as keyof typeof pageCopy],
  };
}
