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
    'Linked Dash documents with visible relationship lines and navigation',
    'Policy testimony and checker documents are first-class linked documents. The archived recording demonstrates that shared relationship model; a checker-specific capture is still preferred.',
    'Archived feature recording',
    {
      source: '/assets/gifs/gettingstarted/dash-show-links.gif',
      brief: 'Capture a policy checker beside linked testimony with one citation selected and the source filter visible.',
    }
  ),
  'Graph view for collections': visual(
    poster('graph-view'),
    'Dash documents displayed in several collection perspectives',
    'The graph view joined Dash’s existing family of collection perspectives. This recovered overview shows the view system; a graph-specific recording should replace it when available.',
    'Representative Dash interface',
    {
      source: '/assets/images/dash2.jpg',
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
    'A current Dash planning workspace with overview cards, mapped stops, route, resources, and planner',
    'A current planning workspace built from the life-coach document family, events, locations, maps, and generated workspace structure.',
    'Current product capture',
    { source: '/assets/images/current/dash-trip-planner-workspace.webp', recorded: '2026-07-29' }
  ),
  'Sketch-to-CAD drawing in 3D': visual(
    poster('sketch-3d'),
    'Ink strokes being created and edited on a Dash canvas',
    'The branch combines stroke input with a 3D scene and CAD generation. The recovered ink interaction shows only the drawing input shared with that prototype.',
    'Representative Dash interface',
    {
      source: '/assets/gifs/features/inkdraw.gif',
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
    'A Dash canvas containing several AI-generated media documents',
    'The video generator produces media as Dash documents. This recovered generative-media overview is representative; the generator panel itself still needs a clean capture.',
    'Representative Dash interface',
    {
      source: '/assets/images/gen_ai.png',
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
      source: '/assets/images/environment/text_doc.png',
      brief: 'Capture one complete probability exercise with editable parameters, equation output, and explanatory text.',
    }
  ),
  'Desktop build with local model execution': visual(
    poster('desktop-local'),
    'The current Dash home screen showing saved and shared dashboards',
    'The Electron build packages the same dashboard experience and can route agent work to a separately installed local model.',
    'Representative Dash interface',
    {
      source: '/assets/images/current/dash-home-workspaces.webp',
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
    'AI-generated text being inserted into a selected Dash text document',
    'Selection-aware actions operate on the user’s active text context and return editable document content.',
    'Exact archived demo',
    { source: '/assets/gifs/ai/ai-text.gif' }
  ),
  'Agent tool registry and dynamic tool creation': visual(
    poster('agent-tools'),
    'A freeform Dash workspace containing several documents and active interface tools',
    'The agent tool registry exposes workspace operations over the same document canvas. A tool-registry inspector capture is still needed.',
    'Representative Dash interface',
    {
      source: '/assets/images/dash1.png',
      brief: 'Capture the agent tool list, one dynamically created tool definition, its approval or execution state, and the resulting canvas change.',
    }
  ),
  'Canvas awareness and UI control for the agent': visual(
    poster('canvas-aware-agent'),
    'A labeled Dash interface showing the canvas, bars, panels, and interaction regions',
    'Canvas awareness lets the agent reason about and control the same interface regions a person uses.',
    'Representative Dash interface',
    { source: '/assets/images/environment/dash-labeled-interface.png' }
  ),
  'Tutorial agent': visual(
    poster('tutorial-agent'),
    'A labeled Dash interface showing the major controls a tutorial can explain',
    'The tutorial agent guides a new user through the real Dash interface and its core controls.',
    'Representative Dash interface',
    {
      source: '/assets/images/environment/dash-labeled-interface.png',
      brief: 'Capture the tutorial prompt, highlighted target control, progress state, and the resulting workspace action.',
    }
  ),
  'Scrapbook documents': visual(
    poster('scrapbook'),
    'Mixed media documents arranged together on a freeform Dash canvas',
    'Scrapbooks collect heterogeneous Dash documents into a recurring, date-oriented workspace.',
    'Representative Dash interface',
    {
      source: '/assets/images/dash1.png',
      brief: 'Capture a scrapbook with one date heading and a mix of text, image, web, and linked items.',
    }
  ),
  'Symbolic mathematics in documents': visual(
    poster('symbolic-math'),
    'A rich text document open in Dash with formatted inline content',
    'Symbolic mathematics is evaluated inside the rich-text editing surface. The recovered text capture does not yet show an evaluated expression.',
    'Representative Dash interface',
    {
      source: '/assets/images/environment/text_doc.png',
      brief: 'Capture an editable expression, its evaluated result, and surrounding explanatory text in the same document.',
    }
  ),
  '3D model documents': visual(
    poster('model-documents'),
    'A Dash canvas containing documents in a spatial freeform arrangement',
    '3D models are embedded as first-class documents on the same canvas. No clean viewer-specific archive image was recovered.',
    'Representative Dash interface',
    {
      source: '/assets/images/dash1.png',
      brief: 'Capture a loaded 3D model with orbit controls, model document chrome, and a neighbouring linked Dash document.',
    }
  ),
  'Diagram documents from source code': visual(
    poster('diagram-documents'),
    'A hand-drawn diagram being created inside Dash',
    'Diagram documents render structured source, while this recovered recording shows the adjacent ink-based diagram workflow. The source-rendered view remains unverified.',
    'Representative Dash interface',
    {
      source: '/assets/gifs/features/inkdraw.gif',
      brief: 'Capture the diagram source editor and rendered diagram side by side, with the document type visible.',
    }
  ),
  'Calendar and scheduling for the agent': visual(
    poster('agent-calendar'),
    'A current planning workspace with stops, dates, and mapped route information',
    'Agent scheduling operates over temporal and spatial Dash documents. This current planning workspace demonstrates that combined context.',
    'Representative Dash interface',
    {
      source: '/assets/images/current/dash-trip-planner-detail.webp',
      brief: 'Capture the agent calendar tool, a proposed event, conflict handling, and the resulting calendar entry.',
    }
  ),
  'Task documents': visual(
    poster('task-documents'),
    'Several editable documents arranged on a Dash canvas',
    'Tasks use the common document model and can be arranged, linked, and collected with other content.',
    'Representative Dash interface',
    {
      source: '/assets/images/dash1.png',
      brief: 'Capture a task document with completion, due-date, assignee, and recurrence controls visible.',
    }
  ),
  'Mesh tooling': visual(
    poster('mesh-tooling'),
    'A freeform Dash canvas capable of hosting specialized visual documents',
    'The mesh branch extends the 3D document family. No branch-specific mesh screenshot was recovered from the documentation archive.',
    'Representative Dash interface',
    {
      source: '/assets/images/dash1.png',
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
    'The Dash search and discovery interface returning document results',
    'Recommendations were explored as a user-directed discovery workflow. The recovered search recording shows the surrounding interface, not the branch-specific controls.',
    'Representative Dash interface',
    {
      source: '/assets/gifs/features/andy_search.gif',
      brief: 'Capture recommendation controls, the reason for one recommendation, and the accept or dismiss interaction.',
    }
  ),
  'Sentiment analysis and containerised deployment': visual(
    poster('sentiment-deployment'),
    'A Dash data visualization document combining records and a rendered chart',
    'The separate deployment analyzed document data and returned structured results. This is the receiving Dash data surface, not the container service.',
    'Representative Dash interface',
    {
      source: '/assets/images/environment/dataViz_doc.png',
      brief: 'Capture sentiment results beside their source documents and include a small architecture inset for the container boundary.',
    }
  ),
  'Component library extraction': visual(
    poster('component-library'),
    'The Dash interface with its reusable navigation, toolbar, panel, and document components labeled',
    'The component-library project extracted reusable interface primitives from the production Dash shell.',
    'Representative Dash interface',
    {
      source: '/assets/images/environment/dash-labeled-interface.png',
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
    { source: '/assets/images/environment/dataViz_doc.png' }
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
    'The same Dash documents shown through multiple collection view types',
    'One collection can change perspective without duplicating or converting its documents.',
    'Exact archived demo',
    { source: '/assets/images/dash2.jpg' }
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
    { source: '/assets/images/environment/text_doc.png' }
  ),
  'media-documents': visual(
    '/assets/images/current/dash-tools-panel.webp',
    'The current Dash Tools panel showing creators for image, HTML, web, audio, recording, map, 3D, and other document types',
    'The current document palette exposes heterogeneous media and specialized content as first-class Dash documents.',
    'Current product capture',
    { recorded: '2026-07-29' }
  ),
  'drawing-diagrams': projectVisuals['Smart Draw and generative drawing'],
  'structured-personal-documents': visual(
    '/assets/images/current/dash-tools-panel.webp',
    'The current Dash Tools panel showing task, scrapbook, and journal document creators',
    'Tasks, scrapbooks, and journals are directly creatable from the current document palette.',
    'Current product capture',
    { recorded: '2026-07-29' }
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
    'The current Dash workspace with top bar, sidebar, tab strip, freeform canvas, map, and planner',
    'The current shell coordinates dashboards, tabs, tiles, panels, and interaction modes around one document canvas.',
    'Current product capture',
    { source: '/assets/images/current/dash-trip-planner-workspace.webp', recorded: '2026-07-29' }
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
