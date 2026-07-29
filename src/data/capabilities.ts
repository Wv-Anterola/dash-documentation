/**
 * Canonical product capability registry.
 *
 * Projects explain who explored or shipped an idea. Capabilities explain what
 * Dash can do now. Keeping those records separate lets a single capability
 * accumulate work from several cohorts without turning its user guide into a
 * chronology, while `projects` preserves the provenance.
 *
 * `verifiedAgainst` is deliberately explicit. "Current master" is not a
 * reproducible source reference.
 */
export const verifiedAgainst = {
  repository: 'brown-dash/Dash-Web',
  ref: 'origin/master',
  commit: 'e7473b5d1076d5b77f6e580c4367afd8c4958033',
  date: '2026-07-22',
} as const;

export type CapabilityCategory =
  | 'Foundation'
  | 'Content'
  | 'Organization'
  | 'Connections'
  | 'Presentation'
  | 'Intelligence'
  | 'Platform';

export type CapabilityAvailability =
  | 'Core'
  | 'Advanced'
  | 'Optional service'
  | 'Experimental'
  | 'Legacy';

export interface Capability {
  id: string;
  title: string;
  category: CapabilityCategory;
  availability: CapabilityAvailability;
  summary: string;
  entryPoints: string[];
  docs: string;
  technical: string;
  source: string[];
  projects: string[];
  aliases?: string[];
}

export const capabilities = [
  {
    id: 'document-model',
    title: 'Documents, fields, prototypes, and layouts',
    category: 'Foundation',
    availability: 'Core',
    summary:
      'The shared object model behind text, media, collections, links, trails, agents, and interface state.',
    entryPoints: ['Create menu', 'Colon menu', 'Import panel', 'Canvas drag and drop'],
    docs: '/capabilities/documents/#the-document-foundation',
    technical: '/architecture/document-model/',
    source: [
      'src/fields/Doc.ts',
      'src/client/documents/Documents.ts',
      'src/client/documents/DocumentTypes.ts',
    ],
    projects: ['Document and field model'],
  },
  {
    id: 'rich-text',
    title: 'Rich text, equations, and selection-aware editing',
    category: 'Content',
    availability: 'Core',
    summary:
      'Create formatted notes, embed other documents, annotate selections, and evaluate symbolic mathematical expressions.',
    entryPoints: ['Double-click a canvas', 'Colon menu → text', 'Text selection toolbar'],
    docs: '/capabilities/documents/#text-equations-and-editing',
    technical: '/architecture/rendering-lifecycle/#formatted-content',
    source: [
      'src/client/views/nodes/formattedText/FormattedTextBox.tsx',
      'src/client/views/nodes/EquationBox.tsx',
    ],
    projects: [
      'Selection-aware text formatting actions',
      'Symbolic mathematics in documents',
      'Probability teaching module',
    ],
  },
  {
    id: 'media-documents',
    title: 'Images, PDFs, web pages, audio, and video',
    category: 'Content',
    availability: 'Core',
    summary:
      'Place heterogeneous media on one canvas while preserving native navigation, playback, annotation, and linking.',
    entryPoints: ['Import panel', 'Drag files or URLs to a collection', 'Colon menu'],
    docs: '/capabilities/documents/#media-documents',
    technical: '/architecture/rendering-lifecycle/#type-specific-views',
    source: [
      'src/client/views/nodes/ImageBox.tsx',
      'src/client/views/nodes/PDFBox.tsx',
      'src/client/views/nodes/WebBox.tsx',
      'src/client/views/nodes/AudioBox.tsx',
      'src/client/views/nodes/VideoBox.tsx',
    ],
    projects: [],
  },
  {
    id: 'drawing-diagrams',
    title: 'Ink, smart drawing, masks, and diagrams',
    category: 'Content',
    availability: 'Advanced',
    summary:
      'Draw directly in the workspace, edit vector points, use masks, and create diagram documents from source.',
    entryPoints: ['Ink tool', 'Document create menu', 'Image editor'],
    docs: '/capabilities/documents/#drawing-and-diagrams',
    technical: '/architecture/rendering-lifecycle/#type-specific-views',
    source: [
      'src/client/views/InkingStroke.tsx',
      'src/client/views/nodes/DiagramBox.tsx',
    ],
    projects: ['Smart Draw and generative drawing', 'Diagram documents from source code'],
  },
  {
    id: 'structured-personal-documents',
    title: 'Tasks, journals, and scrapbooks',
    category: 'Content',
    availability: 'Core',
    summary:
      'Purpose-built document types for recurring work that still participate in Dash collections, links, and layouts.',
    entryPoints: ['Document create menu', 'Templates', 'Home workspace'],
    docs: '/capabilities/documents/#tasks-journals-and-scrapbooks',
    technical: '/architecture/document-model/#specialized-document-types',
    source: [
      'src/client/views/nodes/TaskBox.tsx',
      'src/client/views/nodes/formattedText/DailyJournal.tsx',
      'src/client/views/nodes/scrapbook/ScrapbookBox.tsx',
    ],
    projects: ['Task documents', 'Scrapbook documents'],
  },
  {
    id: 'policy-analysis',
    title: 'Policy testimony and policy checking',
    category: 'Intelligence',
    availability: 'Optional service',
    summary:
      'Analyze a policy against linked testimony, retain source citations, filter evidence, and rerun an analysis.',
    entryPoints: ['Policy document create actions', 'Linked testimony panel'],
    docs: '/capabilities/documents/#policy-analysis',
    technical: '/architecture/agents-ai/#policy-analysis-documents',
    source: [
      'src/client/views/nodes/formattedText/PolicyTestimony.tsx',
      'src/client/views/nodes/PolicyCheckerBox.tsx',
    ],
    projects: ['Policy testimony and policy checker documents'],
  },
  {
    id: 'three-dimensional-content',
    title: '3D viewing, sketching, and mesh workflows',
    category: 'Content',
    availability: 'Advanced',
    summary:
      'View models, sketch in a 3D scene, and explore branch-based CAD and mesh tooling without leaving the canvas.',
    entryPoints: ['Import a supported model', '3D document create action'],
    docs: '/capabilities/documents/#3d-content',
    technical: '/architecture/rendering-lifecycle/#3d-rendering',
    source: [
      'src/client/views/nodes/Viewer3DBox.tsx',
      'src/client/views/nodes/sketch3d/sketch3DBox.tsx',
    ],
    projects: ['3D model documents', 'Sketch-to-CAD drawing in 3D', 'Mesh tooling'],
  },
  {
    id: 'life-coach',
    title: 'Life-coach workspaces and events',
    category: 'Organization',
    availability: 'Optional service',
    summary:
      'Coordinate events, categories, locations, maps, recurring reminders, and generated workspace imagery.',
    entryPoints: ['Life-coach workspace document', 'Event spreadsheet', 'Map'],
    docs: '/capabilities/organization/#life-coach-workspaces',
    technical: '/architecture/document-model/#specialized-document-types',
    source: ['src/client/views/nodes/lifeCoach/'],
    projects: ['Life coach workspace', 'Multi-objective trip planner'],
  },
  {
    id: 'collections',
    title: 'Collections and perspectives',
    category: 'Organization',
    availability: 'Core',
    summary:
      'Keep one set of documents and change how it is displayed without converting or duplicating its data.',
    entryPoints: ['Create collection', 'Group selection', 'Appearance → Add a Perspective'],
    docs: '/capabilities/organization/#collections-and-perspectives',
    technical: '/architecture/collections-views/',
    source: [
      'src/client/views/collections/CollectionView.tsx',
      'src/client/documents/DocumentTypes.ts',
    ],
    projects: ['Collections and view types'],
  },
  {
    id: 'graph-view',
    title: 'Graph view for linked collections',
    category: 'Organization',
    availability: 'Advanced',
    summary:
      'Display collection documents as nodes and Dash links as edges, with force layout, previews, and in-place link creation.',
    entryPoints: ['Collection appearance menu → Graph'],
    docs: '/capabilities/organization/#graph-view',
    technical: '/architecture/collections-views/#graph-view',
    source: [
      'src/client/views/collections/collectionGraph/',
      'src/client/views/collections/collectionFreeForm/collectionFreeFormLayoutEngines/GraphLayoutEngine.tsx',
    ],
    projects: ['Graph view for collections'],
  },
  {
    id: 'data-visualization',
    title: 'Tables, charts, filtering, and semantic maps',
    category: 'Organization',
    availability: 'Core',
    summary:
      'Turn CSV-backed records into interactive charts, filter linked views, generate chart proposals, and project mixed documents into an exploratory semantic map.',
    entryPoints: [
      'Import CSV',
      'Data visualization document',
      'Marquee menu → Visualize Unstructured Data',
      'AI visualization action',
    ],
    docs: '/capabilities/organization/#data-visualization',
    technical: '/architecture/collections-views/#data-visualization',
    source: ['src/client/views/nodes/DataVizBox/'],
    projects: [
      'Data visualisation documents',
      'Interactive chart filtering',
      'Data-visualisation generation pipeline',
    ],
  },
  {
    id: 'maps-calendar',
    title: 'Maps, routes, pushpins, and calendars',
    category: 'Organization',
    availability: 'Optional service',
    summary:
      'Organize spatial and temporal documents with Mapbox-backed maps, pushpins, routes, and calendar views.',
    entryPoints: ['Map document', 'Collection appearance menu → Calendar'],
    docs: '/capabilities/organization/#maps-and-calendars',
    technical: '/architecture/collections-views/#maps-and-calendars',
    source: [
      'src/client/views/nodes/MapBox/MapBox.tsx',
      'src/client/views/nodes/calendarBox/',
    ],
    projects: ['Calendar collection view and Mapbox documents'],
  },
  {
    id: 'links-annotations',
    title: 'Links, backlinks, anchors, and annotations',
    category: 'Connections',
    availability: 'Core',
    summary:
      'Connect whole documents or precise regions and retain the link as a first-class, describable Dash document.',
    entryPoints: ['Link handle', 'Linkboard', 'Selection toolbar', 'Properties → Linked to'],
    docs: '/capabilities/connections-and-trails/#links-and-annotations',
    technical: '/architecture/links-trails/#links-and-anchors',
    source: [
      'src/client/views/nodes/LinkBox.tsx',
      'src/client/util/LinkManager.ts',
      'src/client/views/PropertiesDocBacklinksSelector.tsx',
    ],
    projects: ['Linking and annotation'],
  },
  {
    id: 'trails-presentations',
    title: 'Trails, slides, transitions, and presentation',
    category: 'Presentation',
    availability: 'Core',
    summary:
      'Prepare a path through documents while preserving the ability to branch, leave the path, and return to the presentation.',
    entryPoints: ['Trails panel', 'Pin document', 'Presentation controls'],
    docs: '/capabilities/connections-and-trails/#trails-and-presentations',
    technical: '/architecture/links-trails/#trails-and-presentation-state',
    source: [
      'src/client/views/nodes/trails/PresBox.tsx',
      'src/client/views/nodes/trails/PresSlideBox.tsx',
    ],
    projects: [
      'Animation remodel for presentation trails',
      'Presentation transitions and dictation',
      'Branching presentation trails',
    ],
  },
  {
    id: 'search-discovery',
    title: 'Search, filtering, and content discovery',
    category: 'Organization',
    availability: 'Core',
    summary:
      'Search titles, fields, document content, annotations, and links, then narrow collections without changing their source data.',
    entryPoints: ['Sidebar search', 'Search document', 'Collection filters', 'Link search'],
    docs: '/capabilities/search-import/#search-and-filtering',
    technical: '/architecture/import-export/#search-indexes',
    source: [
      'src/client/util/SearchUtil.ts',
      'src/client/views/search/SearchBox.tsx',
    ],
    projects: [
      'Search over document content',
      'User-controlled document recommendations',
    ],
  },
  {
    id: 'import-export',
    title: 'Import, embedding, and export',
    category: 'Platform',
    availability: 'Core',
    summary:
      'Bring in files, URLs, and structured data; embed Dash documents in one another; and export supported views and media.',
    entryPoints: ['Import panel', 'Canvas drop', 'Document context menu → Export'],
    docs: '/capabilities/search-import/#import-and-embedding',
    technical: '/architecture/import-export/',
    source: ['src/client/util/Import & Export/'],
    projects: [],
  },
  {
    id: 'collaboration-sharing',
    title: 'Sharing, permissions, and collaborative workspaces',
    category: 'Platform',
    availability: 'Core',
    summary:
      'Share documents and collections with users or groups while retaining nested layouts and document-level access controls.',
    entryPoints: ['Properties → Sharing', 'Share action', 'Group manager'],
    docs: '/capabilities/platform/#collaboration-sharing-and-permissions',
    technical: '/architecture/server-storage-security/#identity-sharing-and-acls',
    source: [
      'src/client/util/SharingManager.tsx',
      'src/client/util/GroupManager.tsx',
      'src/fields/Doc.ts',
    ],
    projects: [],
  },
  {
    id: 'agents',
    title: 'Retrieval assistant and workspace agent',
    category: 'Intelligence',
    availability: 'Optional service',
    summary:
      'Ask questions grounded in Dash documents or let a tool-using agent inspect, organize, link, create, and control workspace content.',
    entryPoints: ['Chat document', 'Agent document', 'Documentation assistant'],
    docs: '/capabilities/ai-automation/#assistant-and-agent',
    technical: '/architecture/agents-ai/',
    source: [
      'src/client/views/nodes/chatbot/',
      'src/client/views/nodes/agent/',
    ],
    projects: [
      'Agent tool registry and dynamic tool creation',
      'Canvas awareness and UI control for the agent',
      'Tutorial agent',
      'Calendar and scheduling for the agent',
      'Agent-created documents',
      'Research agent',
    ],
  },
  {
    id: 'generative-media',
    title: 'Generative text, images, diagrams, and video',
    category: 'Intelligence',
    availability: 'Optional service',
    summary:
      'Generate or revise content using canvas context while keeping results as editable, linkable Dash documents.',
    entryPoints: ['AI editor', 'Image generation', 'Video generator', 'Data visualization AI'],
    docs: '/capabilities/ai-automation/#generative-media',
    technical: '/architecture/agents-ai/#generation-services',
    source: [
      'src/client/views/nodes/VideoGenerator/',
      'src/client/views/nodes/ImageBox.tsx',
      'src/client/views/nodes/DataVizBox/',
    ],
    projects: [
      'Video generator',
      'Smart Draw and generative drawing',
      'Image generation with style and structure references',
      'Selection-aware text formatting actions',
      'AI-authored interactive HTML documents',
    ],
  },
  {
    id: 'scripting-automation',
    title: 'Scripting, custom layouts, and dynamic tools',
    category: 'Intelligence',
    availability: 'Advanced',
    summary:
      'Attach scripts to document events, compute fields, build custom layouts, and extend the agent with dynamically compiled tools.',
    entryPoints: ['Script document', 'Properties → OnClick', 'Agent create-new-tool action'],
    docs: '/capabilities/ai-automation/#scripting-and-automation',
    technical: '/development/extension-points/',
    source: [
      'src/client/util/Scripting.ts',
      'src/client/views/nodes/ScriptingBox.tsx',
      'src/client/views/nodes/chatbot/tools/CreateNewTool.ts',
    ],
    projects: ['Agent tool registry and dynamic tool creation'],
  },
  {
    id: 'desktop-local-models',
    title: 'Desktop packaging and local model execution',
    category: 'Platform',
    availability: 'Experimental',
    summary:
      'Run Dash as a desktop application and connect agent features to a separately installed local Ollama model.',
    entryPoints: ['Electron build', 'Agent service configuration'],
    docs: '/capabilities/platform/#desktop-and-local-models',
    technical: '/architecture/desktop-local-models/',
    source: ['electron-main.mjs', 'src/server/DashSession/'],
    projects: ['Desktop build with local model execution'],
  },
  {
    id: 'workspace-interface',
    title: 'Dashboards, tabs, tiles, panes, and interaction modes',
    category: 'Platform',
    availability: 'Core',
    summary:
      'Arrange multiple active contexts, switch between novice and advanced controls, and move documents across tabs and tiles.',
    entryPoints: ['Home menu', 'Top bar', 'Sidebar', 'Tab and tile controls'],
    docs: '/capabilities/platform/#workspace-interface',
    technical: '/architecture/system-map/#client-shell',
    source: [
      'src/client/views/MainView.tsx',
      'src/client/views/collections/TabDocView.tsx',
    ],
    projects: ['Novice mode and homepage'],
  },
  {
    id: 'undo-history',
    title: 'Undo, redo, and action provenance',
    category: 'Foundation',
    availability: 'Core',
    summary:
      'Group persistent edits into named reversible batches; experimental provenance can additionally record what source caused an agent action.',
    entryPoints: ['Top bar undo/redo', 'Keyboard shortcuts', 'Agent review prototype'],
    docs: '/capabilities/platform/#undo-redo-and-provenance',
    technical: '/architecture/undo-provenance/',
    source: ['src/client/util/UndoManager.ts'],
    projects: ['Post-hoc oversight of prompt-injected agents'],
  },
  {
    id: 'developer-platform',
    title: 'Shared component library and extension platform',
    category: 'Platform',
    availability: 'Advanced',
    summary:
      'A reusable UI library and four established extension slots for document types, collection views, agent tools, and undo-aware actions.',
    entryPoints: ['Dash-Web monorepo', 'packages/components Storybook'],
    docs: '/capabilities/platform/#developer-platform',
    technical: '/development/extension-points/',
    source: ['packages/components/', 'src/client/documents/DocumentTypes.ts'],
    projects: [
      'Component library extraction',
      'Sentiment analysis and containerised deployment',
    ],
  },
  {
    id: 'documentation-platform',
    title: 'Documentation, history, and capability governance',
    category: 'Platform',
    availability: 'Core',
    summary:
      'A versioned Starlight documentation system connecting product capabilities to implementation evidence and research provenance.',
    entryPoints: ['Documentation site'],
    docs: '/contributing/documentation/',
    technical: '/contributing/documentation/#capability-coverage',
    source: ['Dash-Documentation/'],
    projects: ['This documentation site'],
  },
] as const satisfies readonly Capability[];

export type CapabilityId = (typeof capabilities)[number]['id'];

export const capabilityCategories: CapabilityCategory[] = [
  'Foundation',
  'Content',
  'Organization',
  'Connections',
  'Presentation',
  'Intelligence',
  'Platform',
];

export function capabilityById(id: string): Capability {
  const capability = capabilities.find((candidate) => candidate.id === id);
  if (!capability) throw new Error(`Unknown capability id: ${id}`);
  return capability;
}

export function capabilitiesForProject(title: string): readonly Capability[] {
  return capabilities.filter((capability) =>
    (capability.projects as readonly string[]).includes(title)
  );
}
