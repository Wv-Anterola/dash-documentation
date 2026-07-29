/**
 * Visual evidence is kept separate from narrative project records so one
 * recovered demo can support both the historical project and the product
 * capability it became. Every project and capability must have an entry here;
 * `npm run coverage` checks that neither registry can silently lose visuals.
 *
 * A representative image is intentionally not presented as an exact project
 * screenshot. `scope` is rendered beside every image and `brief` records the
 * preferred replacement when the original interface has not been recovered.
 */

export type VisualScope =
  | 'Current product capture'
  | 'Exact archived demo'
  | 'Archived feature recording'
  | 'Representative Dash interface';

export interface VisualEvidence {
  src: string;
  alt: string;
  caption: string;
  scope: VisualScope;
  source?: string;
  recorded?: string;
  brief?: string;
}

const visual = (
  src: string,
  alt: string,
  caption: string,
  scope: VisualScope,
  options: Pick<VisualEvidence, 'source' | 'recorded' | 'brief'> = {}
): VisualEvidence => ({ src, alt, caption, scope, ...options });

const poster = (name: string) => `/assets/images/visuals/${name}.webp`;

export const projectVisuals: Record<string, VisualEvidence> = {
  'Post-hoc oversight of prompt-injected agents': visual(
    poster('agent-oversight'),
    'Dash undo and redo controls stepping through reversible workspace actions',
    'The current study extends Dash’s reversible action model with source-aware review. This recording shows the underlying undo workflow, not the unmerged provenance interface.',
    'Representative Dash interface',
    {
      source: '/assets/gifs/environment/undo-redo.gif',
      brief: 'Replace with a study-build capture showing the provenance review panel, source attribution, and keep-or-undo decision.',
    }
  ),
  'Policy testimony and policy checker documents': visual(
    poster('policy-checker'),
    'Creating a link from a Dash annotation document back to source material',
    'Policy testimony and checker documents depend on source-level citation links. This recording shows an annotation document being connected to evidence.',
    'Archived feature recording',
    {
      source: '/assets/gifs/gettingstarted/dash-link-annotation-document.gif',
      brief: 'Capture a policy checker beside linked testimony with one citation selected and the source filter visible.',
    }
  ),
  'Graph view for collections': visual(
    poster('graph-view'),
    'Changing the view used to arrange one Dash collection',
    'The graph view joined Dash’s existing family of collection perspectives. This recovered overview shows the view system; a graph-specific recording should replace it when available.',
    'Representative Dash interface',
    {
      source: '/assets/gifs/views/dash-change-view.gif',
      brief: 'Capture a graph collection with at least eight nodes, visible link edges, a hovered neighbourhood, and the physics settings panel.',
    }
  ),
  'AI-authored interactive HTML documents': visual(
    poster('ai-html'),
    'An AI-assisted editing action applied to a document inside Dash',
    'The branch prototype edits embedded HTML through structured AI patches. This archived AI-editing sequence represents the interaction family, not the unmerged HTML patch interface.',
    'Archived feature recording',
    {
      source: '/assets/gifs/ai/ai-edit-1.gif',
      brief: 'Capture the HTML document, prompt surface, selector-targeted patch preview, and the updated interactive result in one frame.',
    }
  ),
  'Life coach workspace': visual(
    poster('life-coach'),
    'The Life Coach document creator in the current Dash Tools panel',
    'This current creator is direct interface evidence that the life-coach document family remains reachable from Dash.',
    'Current product capture',
    { source: '/assets/images/creators/trip-doc.webp', recorded: '2026-07-29' }
  ),
  'Sketch-to-CAD drawing in 3D': visual(
    poster('sketch-3d'),
    'A selected ink drawing being reshaped with Dash editing controls',
    'The branch combines editable stroke input with a 3D scene and CAD generation. This recording shows the drawing-side interaction shared with that prototype.',
    'Representative Dash interface',
    {
      source: '/assets/gifs/features/inkedit3.gif',
      brief: 'Capture the branch with the 2D sketch, generated 3D geometry, camera controls, and regeneration action visible.',
    }
  ),
  'Data-visualisation generation pipeline': visual(
    poster('data-viz-generation'),
    'Dash generating a proposed visualization from selected data',
    'The integrated generation pipeline proposes visualizations from data already present in the workspace.',
    'Exact archived demo',
    { source: '/assets/gifs/dataViz/aiVisualize.gif' }
  ),
  'Video generator': visual(
    poster('video-generator'),
    'A temporal-media document being edited in Dash timeline view',
    'The video generator produces media as Dash documents. This recording shows the temporal-media timeline that receives and edits video output.',
    'Representative Dash interface',
    {
      source: '/assets/gifs/video/timelineview.gif',
      brief: 'Capture the prompt, model and duration controls, generation state, and completed video document together.',
    }
  ),
  'Image generation with style and structure references': visual(
    poster('image-reference-generation'),
    'A generated image displayed beside the drawing used as its structural reference',
    'The branch prototype uses an existing image or drawing as a style or structure reference during generation.',
    'Exact archived demo',
    { source: '/assets/gifs/ai/ai-firefly-template-image-2.gif' }
  ),
  'Multi-objective trip planner': visual(
    poster('trip-planner'),
    'A current Dash trip-planning canvas with linked overview, route map, stops, and planning tool',
    'The current Trip Planner preset turns a project-shaped workflow into a reusable Dash dashboard built from documents, maps, links, and tools.',
    'Current product capture',
    { source: '/assets/images/current/dash-trip-planner-workspace.webp', recorded: '2026-07-29' }
  ),
  'Probability teaching module': visual(
    poster('probability-module'),
    'A formatted text document open in Dash with editable inline content',
    'The teaching prototype combines formatted content and symbolic expressions. This is the shared document surface, not a recovered probability lesson.',
    'Representative Dash interface',
    {
      source: '/assets/images/environment/text_doc2.gif',
      brief: 'Capture one complete probability exercise with editable parameters, equation output, and explanatory text.',
    }
  ),
  'Desktop build with local model execution': visual(
    poster('desktop-local'),
    'Managing dashboards and workspace tabs in the Dash application shell',
    'The Electron build packages the same dashboard experience and can route agent work to a separately installed local model.',
    'Representative Dash interface',
    {
      source: '/assets/gifs/environment/dash-managing.gif',
      brief: 'Capture the Electron window chrome and a successful local-model response with the configured provider visible.',
    }
  ),
  'Research agent': visual(
    poster('research-agent'),
    'An assistant web-search workflow returning linked results inside Dash',
    'The research-agent prototype builds on Dash’s retrieval and document-creation workflow.',
    'Archived feature recording',
    {
      source: '/assets/gifs/ai/ai-websearch-1.gif',
      brief: 'Capture a research run with the question, plan or progress, cited source collection, and generated synthesis visible.',
    }
  ),
  'Selection-aware text formatting actions': visual(
    poster('selection-formatting'),
    'An AI-assisted edit being applied to selected Dash document content',
    'Selection-aware actions operate on the user’s active text context and return editable document content.',
    'Exact archived demo',
    { source: '/assets/gifs/ai/ai-edit-2.gif' }
  ),
  'Agent tool registry and dynamic tool creation': visual(
    poster('agent-tools'),
    'The current Dash Tools panel open beside a workspace',
    'The agent tool registry exposes operations over the same document types people can create from this panel. A tool-registry inspector capture is still needed.',
    'Representative Dash interface',
    {
      source: '/assets/images/current/dash-tools-panel.webp',
      brief: 'Capture the agent tool list, one dynamically created tool definition, its approval or execution state, and the resulting canvas change.',
    }
  ),
  'Canvas awareness and UI control for the agent': visual(
    poster('canvas-aware-agent'),
    'The current Dash Properties panel open beside a selected workspace item',
    'Canvas awareness lets the agent reason about and control visible interface state such as the selected document and its properties.',
    'Representative Dash interface',
    { source: '/assets/images/current/dash-properties-panel.webp', recorded: '2026-07-29' }
  ),
  'Tutorial agent': visual(
    poster('tutorial-agent'),
    'A Dash document context toolbar with its actions labeled',
    'The tutorial agent guides a new user through concrete controls such as those on this context toolbar.',
    'Representative Dash interface',
    {
      source: '/assets/images/getting-started/context-toolbar.png',
      brief: 'Capture the tutorial prompt, highlighted target control, progress state, and the resulting workspace action.',
    }
  ),
  'Scrapbook documents': visual(
    poster('scrapbook'),
    'The Scrapbook document creator in the current Dash Tools panel',
    'The current creator shows where a scrapbook begins before it collects heterogeneous documents into a recurring workspace.',
    'Representative Dash interface',
    {
      source: '/assets/images/creators/scrapbook.webp',
      brief: 'Capture a scrapbook with one date heading and a mix of text, image, web, and linked items.',
    }
  ),
  'Symbolic mathematics in documents': visual(
    poster('symbolic-math'),
    'The Math document creator in the current Dash Tools panel',
    'The creator exposes the symbolic-mathematics document family; a capture of an evaluated expression is still needed.',
    'Representative Dash interface',
    {
      source: '/assets/images/creators/math.webp',
      brief: 'Capture an editable expression, its evaluated result, and surrounding explanatory text in the same document.',
    }
  ),
  '3D model documents': visual(
    poster('model-documents'),
    'The 3D Model document creator in the current Dash Tools panel',
    'The creator is current evidence that 3D models remain a first-class document family. A clean viewer interaction is still needed.',
    'Representative Dash interface',
    {
      source: '/assets/images/creators/3d-model.webp',
      brief: 'Capture a loaded 3D model with orbit controls, model document chrome, and a neighbouring linked Dash document.',
    }
  ),
  'Diagram documents from source code': visual(
    poster('diagram-documents'),
    'The Diagram document creator in the current Dash Tools panel',
    'The creator exposes the structured diagram document family. A source-editor and rendered-result capture remains the preferred evidence.',
    'Representative Dash interface',
    {
      source: '/assets/images/creators/diagram.webp',
      brief: 'Capture the diagram source editor and rendered diagram side by side, with the document type visible.',
    }
  ),
  'Calendar and scheduling for the agent': visual(
    poster('agent-calendar'),
    'A map-based story moving through places and linked Dash documents',
    'Agent scheduling operates over temporal and spatial Dash documents. This archived map story demonstrates the spatial half of that combined context.',
    'Representative Dash interface',
    {
      source: '/assets/gifs/environment/map_story.gif',
      brief: 'Capture the agent calendar tool, a proposed event, conflict handling, and the resulting calendar entry.',
    }
  ),
  'Task documents': visual(
    poster('task-documents'),
    'The Task document creator in the current Dash Tools panel',
    'The current creator shows where a task starts before it is arranged, linked, and collected with other content.',
    'Representative Dash interface',
    {
      source: '/assets/images/creators/task.webp',
      brief: 'Capture a task document with completion, due-date, assignee, and recurrence controls visible.',
    }
  ),
  'Mesh tooling': visual(
    poster('mesh-tooling'),
    'The REPL Viewer document creator in the current Dash Tools panel',
    'The mesh branch extends specialized computational and 3D document families. This is a distinct nearby creator, not a branch-specific mesh capture.',
    'Representative Dash interface',
    {
      source: '/assets/images/creators/replviewer.webp',
      brief: 'Capture an imported mesh with selection, material or transform controls, and an edited result.',
    }
  ),
  'Smart Draw and generative drawing': visual(
    poster('smart-draw'),
    'Dash generating an image from a drawing and text prompt',
    'Smart Draw turns a canvas gesture or prompt into editable generated media.',
    'Exact archived demo',
    { source: '/assets/gifs/ai/ai-image.gif' }
  ),
  'Interactive chart filtering': visual(
    poster('chart-filtering'),
    'Selecting marks directly in a Dash chart to filter linked records',
    'Chart selections filter the shared records that back other linked views.',
    'Exact archived demo',
    { source: '/assets/gifs/dataViz/filteringC.gif' }
  ),
  'Animation remodel for presentation trails': visual(
    poster('animation-remodel'),
    'Documents interpolating between animation keyframes in Dash',
    'The animation remodel made canvas state and document motion editable as a presentation timeline.',
    'Exact archived demo',
    { source: '/assets/gifs/animation/basicanimation.gif' }
  ),
  'Presentation transitions and dictation': visual(
    poster('presentation-dictation'),
    'Speech dictation creating editable text inside Dash',
    'Dictation feeds editable Dash text that can become presentation content; the transition editor is documented separately.',
    'Archived feature recording',
    {
      source: '/assets/gifs/audio/dictation.gif',
      brief: 'Capture a presentation slide with a transition selected and live dictation producing speaker or slide text.',
    }
  ),
  'Branching presentation trails': visual(
    poster('branching-trails'),
    'A Dash presentation trail displayed as a branching tree of slides',
    'Trails preserve alternative paths instead of forcing a presentation into one linear deck.',
    'Exact archived demo',
    { source: '/assets/images/trails/prestree.png' }
  ),
  'Agent-created documents': visual(
    poster('agent-created-docs'),
    'AI-generated content appearing as an editable Dash document',
    'The branch lets agent output persist as ordinary editable, linkable Dash documents.',
    'Archived feature recording',
    { source: '/assets/gifs/ai/ai-text.gif' }
  ),
  'Search over document content': visual(
    poster('content-search'),
    'Searching for a Dash document from the sidebar search interface',
    'The search branch expanded discovery beyond titles toward document content.',
    'Archived feature recording',
    { source: '/assets/gifs/features/andy_search.gif' }
  ),
  'Calendar collection view and Mapbox documents': visual(
    poster('maps-calendar'),
    'Creating a Mapbox-backed map document inside Dash',
    'Map documents and calendar views place shared Dash records in spatial and temporal perspectives.',
    'Exact archived demo',
    { source: '/assets/gifs/environment/create_map.gif' }
  ),
  'Physics simulation documents': visual(
    poster('physics-simulation'),
    'A Dash physics simulation showing a ramp, block, and editable initial values',
    'The archived simulation document embedded an interactive physics model in the Dash document system.',
    'Exact archived demo',
    { source: '/assets/images/environment/simulation_doc.png' }
  ),
  'User-controlled document recommendations': visual(
    poster('document-recommendations'),
    'Opening a selected Dash document in the focused lightbox view',
    'Recommendations were explored as a user-directed discovery workflow. This lightbox recording shows how an accepted item is inspected, not the branch-specific recommendation controls.',
    'Representative Dash interface',
    {
      source: '/assets/gifs/gettingstarted/dash-lightbox.gif',
      brief: 'Capture recommendation controls, the reason for one recommendation, and the accept or dismiss interaction.',
    }
  ),
  'Sentiment analysis and containerised deployment': visual(
    poster('sentiment-deployment'),
    'AI-generated explanatory text appearing beside a Dash data visualization',
    'The separate deployment analyzed document data and returned structured results. This archived AI-and-data interaction represents the receiving surface, not the container service.',
    'Representative Dash interface',
    {
      source: '/assets/gifs/dataViz/aiText.gif',
      brief: 'Capture sentiment results beside their source documents and include a small architecture inset for the container boundary.',
    }
  ),
  'Component library extraction': visual(
    poster('component-library'),
    'A close view labeling the reusable chrome around one Dash document',
    'The component-library project extracted reusable interface primitives such as this document frame, title bar, and action chrome.',
    'Representative Dash interface',
    {
      source: '/assets/images/getting-started/document-chrome.png',
      brief: 'Capture the component Storybook with navigation, buttons, inputs, menus, and document chrome visible in one grid.',
    }
  ),
  'This documentation site': visual(
    '/assets/images/current/dash-documentation-site.webp',
    'The current Dash documentation homepage with its navigation and product overview',
    'The documentation connects product explanations, technical implementation, and research provenance in one searchable reference.',
    'Current product capture',
    {
      recorded: '2026-07-29',
    }
  ),
  'Data visualisation documents': visual(
    poster('data-viz-documents'),
    'A CSV-backed Dash data visualization document with table and chart controls',
    'Data visualization documents make structured records explorable as tables and charts without leaving the canvas.',
    'Exact archived demo',
    { source: '/assets/gifs/dataViz/simple_dataViz.gif' }
  ),
  'Novice mode and homepage': visual(
    poster('novice-home'),
    'The current Dash home screen with saved dashboards, shared workspaces, and the new-dashboard action',
    'The homepage gives new and returning users a direct route into their dashboards and presets.',
    'Current product capture',
    { source: '/assets/images/current/dash-home-workspaces.webp', recorded: '2026-07-29' }
  ),
  'Document and field model': visual(
    poster('document-model'),
    'Diagram of a Dash document split into data, layout, prototype, and field relationships',
    'The document and field model is the substrate shared by every content type, collection, link, and workspace.',
    'Exact archived demo',
    { source: '/assets/images/dash-doc-representation.png' }
  ),
  'Collections and view types': visual(
    poster('collection-views'),
    'Opening and navigating a collection nested inside another Dash collection',
    'Nested collections demonstrate that a collection is itself a document; its view can still change without duplicating its children.',
    'Exact archived demo',
    { source: '/assets/gifs/gettingstarted/dash-nested-collection.gif' }
  ),
  'Linking and annotation': visual(
    poster('linking-annotation'),
    'Creating a first-class link between two Dash documents',
    'Dash links connect whole documents or precise regions while remaining editable documents themselves.',
    'Exact archived demo',
    { source: '/assets/gifs/gettingstarted/dash-creating-link.gif' }
  ),
};

export const capabilityVisuals: Record<string, VisualEvidence> = {
  'document-model': projectVisuals['Document and field model'],
  'rich-text': visual(
    poster('rich-text'),
    'A formatted text document open on a Dash canvas',
    'Rich text remains embedded in the shared document and selection model.',
    'Exact archived demo',
    { source: '/assets/images/environment/dash-text-toolbar.png' }
  ),
  'media-documents': visual(
    poster('media-documents'),
    'A Dash workspace overview containing several different document families',
    'Dash treats heterogeneous media and specialized content as first-class documents on one canvas.',
    'Exact archived demo',
    { source: '/assets/images/environment/overview.png' }
  ),
  'drawing-diagrams': projectVisuals['Smart Draw and generative drawing'],
  'structured-personal-documents': visual(
    poster('structured-personal-documents'),
    'The Journal document creator in the current Dash Tools panel',
    'Journal is one of the structured personal document families available from the current creator palette.',
    'Current product capture',
    { source: '/assets/images/creators/journal.webp', recorded: '2026-07-29' }
  ),
  'policy-analysis': projectVisuals['Policy testimony and policy checker documents'],
  'three-dimensional-content': projectVisuals['3D model documents'],
  'life-coach': projectVisuals['Life coach workspace'],
  collections: projectVisuals['Collections and view types'],
  'graph-view': projectVisuals['Graph view for collections'],
  'data-visualization': projectVisuals['Data visualisation documents'],
  'maps-calendar': projectVisuals['Calendar collection view and Mapbox documents'],
  'links-annotations': projectVisuals['Linking and annotation'],
  'trails-presentations': visual(
    '/assets/images/current/dash-trails-panel.webp',
    'The current Dash Trails panel open beside an active workspace',
    'The current sidebar provides trail creation and access without leaving the document canvas.',
    'Current product capture',
    { recorded: '2026-07-29' }
  ),
  'search-discovery': visual(
    '/assets/images/current/dash-search-panel.webp',
    'The current Dash Search panel with scope and query controls beside the workspace',
    'Search stays beside the active canvas so documents can be found, opened, and compared in context.',
    'Current product capture',
    { recorded: '2026-07-29' }
  ),
  'import-export': visual(
    '/assets/images/current/dash-imports-panel.webp',
    'The current Dash Imports panel open beside an active workspace',
    'The current import surface is the entry point for external material that becomes Dash documents.',
    'Current product capture',
    { recorded: '2026-07-29' }
  ),
  'collaboration-sharing': visual(
    poster('collaboration-sharing'),
    'Sharing a Dash document and adjusting its access',
    'Sharing and permissions apply to documents and nested collaborative workspaces.',
    'Exact archived demo',
    { source: '/assets/gifs/gettingstarted/sharing.gif' }
  ),
  agents: projectVisuals['Research agent'],
  'generative-media': projectVisuals['Smart Draw and generative drawing'],
  'scripting-automation': projectVisuals['Agent tool registry and dynamic tool creation'],
  'desktop-local-models': projectVisuals['Desktop build with local model execution'],
  'workspace-interface': visual(
    poster('workspace-interface'),
    'The Dash interface labeled with its top bar, document canvas, panels, and tool regions',
    'The shell coordinates dashboards, tabs, tiles, panels, and interaction modes around one document canvas.',
    'Exact archived demo',
    { source: '/assets/images/environment/dash-labeled-interface.png' }
  ),
  'undo-history': projectVisuals['Post-hoc oversight of prompt-injected agents'],
  'developer-platform': projectVisuals['Component library extraction'],
  'documentation-platform': projectVisuals['This documentation site'],
};

export function visualForProject(title: string): VisualEvidence {
  const evidence = projectVisuals[title];
  if (!evidence) throw new Error(`Missing project visual: ${title}`);
  return evidence;
}

export function visualForCapability(id: string): VisualEvidence {
  const evidence = capabilityVisuals[id];
  if (!evidence) throw new Error(`Missing capability visual: ${id}`);
  return evidence;
}
