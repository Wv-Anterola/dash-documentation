import type { Project } from './dash';

export interface WorkflowStep {
  eyebrow: string;
  title: string;
  explanation: string;
  technical: string;
}

type WorkflowCore = [action: string, surface: string, engine: string, result: string];

/**
 * One explicit interaction path per recovered project.
 *
 * These are intentionally concrete and plain. The project record supplies the
 * scholarly "why" and source evidence; this map supplies the missing
 * button-to-result story a first-time reader needs.
 */
const cores: Record<string, WorkflowCore> = {
  'Post-hoc oversight of prompt-injected agents': [
    'Run an agent task, then open the review surface and inspect each proposed edit.',
    'The workspace shows the changed document, the action that changed it, and—when enabled—the source that prompted that action.',
    'Agent.processAction validates a tool call, the provenance wrapper records its source, and the undo manager keeps the action separately reversible.',
    'Keep legitimate edits and undo the injected one without discarding the whole agent run.',
  ],
  'Policy testimony and policy checker documents': [
    'Create a policy testimony or policy checker document and give it policy text to examine.',
    'A dedicated node keeps the source material and the policy-focused output together on the canvas.',
    'Registered document types route through their node views and call the project’s policy analysis logic.',
    'The workspace gains a reusable policy artifact that can be linked, arranged, and revisited like any other Dash document.',
  ],
  'Graph view for collections': [
    'Open a collection’s appearance controls and choose the graph layout.',
    'The same child documents become nodes; their relationships become edges.',
    'CollectionView selects the graph renderer and GraphLayoutEngine calculates positions without converting the underlying documents.',
    'Switch back to another view at any time; the content and links stay the same.',
  ],
  'AI-authored interactive HTML documents': [
    'Ask the AI surface to make an interactive explanation, widget, or small webpage.',
    'Dash places the generated HTML in a document that can be viewed beside the source material.',
    'The branch sends the prompt through its GPT path, stores returned markup, and renders it through HTMLBox.',
    'The result behaves like a canvas document rather than a detached chat answer.',
  ],
  'Life coach workspace': [
    'Create the life-coach workspace and add goals, events, or reflections.',
    'Specialized life-coach nodes organize the plan while still living on a normal Dash canvas.',
    'LIFECOACH and LCEVENT document registrations route fields into the life-coach views.',
    'The plan remains spatial, linkable, and editable alongside ordinary notes and media.',
  ],
  'Sketch-to-CAD drawing in 3D': [
    'Draw or describe an object, then ask the 3D tool to turn the idea into geometry.',
    'The sketch and generated model appear as inspectable objects in the workspace.',
    'Branch-specific CAD and 3D code translates the input into mesh or scene data and hands it to the 3D viewer.',
    'Rotate and inspect the model, then keep iterating from the original sketch.',
  ],
  'Data-visualisation generation pipeline': [
    'Provide data, choose what you want to understand, and request a chart.',
    'A DataViz node shows the generated view and exposes selection or filtering controls.',
    'The generation pipeline interprets the request, prepares a chart specification, and DataVizBox renders the result.',
    'Use the chart as part of a larger dashboard, with selected data feeding the next step.',
  ],
  'Video generator': [
    'Describe a clip and start generation from a video-generator document.',
    'The node shows the request, generation state, and finished media in one place.',
    'The VIDGEN document view calls the generation service, tracks the job, then stores the returned media reference.',
    'Play, arrange, and link the generated video like other temporal media.',
  ],
  'Image generation with style and structure references': [
    'Add a prompt plus optional style and structure images, then request a new image.',
    'The generating node keeps the references visible so the request is understandable later.',
    'Branch code packages prompt and reference inputs for the image model and writes the response back into a Dash image document.',
    'The new image arrives with its visual inputs still present for comparison and another iteration.',
  ],
  'Multi-objective trip planner': [
    'Choose Trip Planner in New Dashboard, enter constraints, then ask the planner for options.',
    'A prepared dashboard opens with places, resources, a map, and an analysis area.',
    'TripPlannerAnalysis combines the preset’s documents and objectives; normal Dash fields, links, Mapbox, and AI tools carry the work.',
    'Compare trade-offs, move candidates, and keep the chosen itinerary as a normal editable workspace.',
  ],
  'Probability teaching module': [
    'Open the teaching activity, change a probability input, and run the example.',
    'The lesson places explanation, controls, and visible outcomes next to one another.',
    'The branch calculates the experiment state and updates its interactive teaching view.',
    'Learners can see how changing one value changes the outcome instead of memorizing a formula.',
  ],
  'Desktop build with local model execution': [
    'Launch the desktop build, choose a local model, and send an agent request.',
    'Dash looks like the web workspace, but model status and execution remain on the computer.',
    'Electron hosts the application and ollamaService sends compatible requests to the local Ollama endpoint.',
    'The agent can work without sending the prompt to a hosted model when the local path is configured.',
  ],
  'Research agent': [
    'Give the research agent a question and source material, then start the research run.',
    'The branch surfaces intermediate searches, notes, or draft outputs rather than only a final chat bubble.',
    'Agent orchestration invokes research-specific tools, collects results, and writes structured artifacts back into Dash.',
    'A reviewable research workspace remains after the run, with sources and synthesis kept together.',
  ],
  'Selection-aware text formatting actions': [
    'Select words inside a text document and press a formatting command.',
    'Only the highlighted range changes, so the effect is immediately visible where the cursor already is.',
    'The formatted-text view converts the selection into an editor operation and records the document update.',
    'Bold, style, or other formatting applies to the intended text without replacing the whole document.',
  ],
  'Agent tool registry and dynamic tool creation': [
    'Ask the agent to do something; if needed, ask it to create a reusable tool.',
    'The chat shows the request while the workspace shows the document changes produced by approved tools.',
    'Agent validates the call against static and dynamic registries, parses parameters, executes the tool, and returns its result.',
    'The same agent can use a known capability again without hard-coding every workflow into the chat interface.',
  ],
  'Canvas awareness and UI control for the agent': [
    'Ask the agent about visible documents or tell it to operate a canvas control.',
    'The agent reads workspace context and the affected item or interface state changes in place.',
    'CanvasDocsTool exposes document context and UIControlTool translates allowed requests into interface operations.',
    'The response is grounded in the workspace the person can see, not only the conversation transcript.',
  ],
  'Tutorial agent': [
    'Open tutorial mode and ask what to do next.',
    'The assistant gives one constrained lesson step that points back to the Dash interface.',
    'Tutorial sessions expose TutorialTool instead of the full write-tool registry.',
    'A beginner receives guidance without giving the tutorial assistant broad editing power.',
  ],
  'Scrapbook documents': [
    'Create a scrapbook and drop related text, images, or clippings into it.',
    'A scrapbook node presents the gathered pieces as one visual artifact.',
    'The SCRAPBOOK document type routes its fields and children into the scrapbook renderer.',
    'Mixed material stays together while remaining part of the larger linked workspace.',
  ],
  'Symbolic mathematics in documents': [
    'Enter a symbolic expression and request a calculation or simplification.',
    'The math document keeps the input and result close enough to compare.',
    'A web worker runs SymPy-compatible computation away from the main interface thread and returns the symbolic result.',
    'The computed expression becomes material that can be annotated and connected to an explanation.',
  ],
  '3D model documents': [
    'Create or import a 3D document, then drag or rotate the model.',
    'The 3D node provides a viewport inside the Dash canvas.',
    'VIEWER3D and SKETCH3D document registrations route scene data into the sketch3d rendering path.',
    'A 3D object can sit beside notes, images, and references instead of requiring a separate application.',
  ],
  'Diagram documents from source code': [
    'Paste or generate diagram source and ask Dash to render it.',
    'The diagram node shows the visual result while preserving the source that created it.',
    'The branch parses the diagram language, renders it, and stores both representation and source in the document.',
    'Edit the source to update the diagram, then connect the result to the rest of the workspace.',
  ],
  'Calendar and scheduling for the agent': [
    'Tell the agent what should happen and when.',
    'The request appears in chat and the scheduled item appears in calendar-aware workspace data.',
    'CalendarTool validates date and event parameters before creating or updating the corresponding document fields.',
    'The schedule becomes an editable Dash object rather than a promise left in chat.',
  ],
  'Task documents': [
    'Create a task, give it a name, and change its completion state when work is done.',
    'A task node presents the actionable fields without hiding that it is still a Dash document.',
    'DocumentType.TASK selects the task view while normal fields and persistence store its state.',
    'Tasks can live inside collections, connect to source material, and participate in larger boards.',
  ],
  'Mesh tooling': [
    'Load a model or start from geometry, choose a mesh operation, and apply it.',
    'The branch displays the object and the effect of the operation in a 3D-oriented node.',
    'Mesh utilities transform geometry data and pass the result back to the rendering document.',
    'The modified mesh can be inspected and used in the project’s next 3D step.',
  ],
  'Smart Draw and generative drawing': [
    'Draw a rough mark or select an image-editing action, then request assistance.',
    'The drawing surface keeps the original gesture visible while showing the interpreted or generated result.',
    'Smart Draw and image-editor paths turn strokes, selections, and prompts into updates on the visual document.',
    'The person can continue drawing from the generated material instead of accepting a one-shot output.',
  ],
  'Interactive chart filtering': [
    'Select a chart item or change a filter.',
    'DataVizBox immediately emphasizes the matching subset and de-emphasizes or removes the rest.',
    'Selection state is translated into chart filters and propagated through the visualization document.',
    'A viewer can ask a question by touching the chart and see the answer without rebuilding it.',
  ],
  'Animation remodel for presentation trails': [
    'Arrange presentation items, open the animation controls, and set how one state leads to the next.',
    'The timeline makes the order and duration of transitions visible.',
    'Animation timeline data and presentation customization code calculate interpolated document states.',
    'Playing the trail moves through authored transitions while preserving the underlying documents.',
  ],
  'Presentation transitions and dictation': [
    'Build a trail, record or attach narration, then play the presentation.',
    'Trail and audio nodes coordinate the visible step with the spoken track.',
    'Presentation state advances through trail documents while temporal-media code controls recorded audio.',
    'The audience receives a paced story, and the author can still revise each source document.',
  ],
  'Branching presentation trails': [
    'Create a trail, add choices at a step, then select a branch while presenting.',
    'The trail view shows that one presentation point can lead to more than one next point.',
    'BranchingTrailManager stores branch options and resolves the selected route through the trail graph.',
    'A presentation can respond to an audience or teaching choice without duplicating the whole deck.',
  ],
  'Agent-created documents': [
    'Ask the agent to create a particular kind of document with given content.',
    'The new item appears directly on the canvas, where the person can inspect it.',
    'The branch’s agent action resolves a document type, constructs fields, and adds the document through normal workspace mutation paths.',
    'The result is a real editable Dash document, not merely formatted text inside chat.',
  ],
  'Search over document content': [
    'Type a word or question into search and choose a result.',
    'The result list identifies matching documents and takes the person back to the relevant workspace item.',
    'Branch search code indexes or scans document fields, ranks matches, and resolves them to Dash documents.',
    'Scattered material becomes findable without remembering which board contains it.',
  ],
  'Calendar collection view and Mapbox documents': [
    'Put dated or located documents in a collection, then choose Calendar or open a Map document.',
    'The same underlying items appear by date or geographic position.',
    'CollectionViewType.Calendar selects the calendar renderer; DocumentType.MAP routes location fields into MapboxMapBox.',
    'Switch between spatial and temporal readings without copying the records.',
  ],
  'Physics simulation documents': [
    'Open a simulation, adjust a parameter, and run or reset it.',
    'The node shows motion or state changing beside the values that control it.',
    'The archived branch advances its simulation model and renders each state into its custom document view.',
    'A learner can experiment repeatedly and connect observations to notes in Dash.',
  ],
  'User-controlled document recommendations': [
    'Open recommendations, inspect why an item is suggested, and choose whether to bring it into view.',
    'The lightbox recommendation list keeps suggestions separate until the person accepts one.',
    'The branch scores candidate documents from workspace context and renders them through RecommendationList.',
    'Discovery remains user-controlled: a suggestion does not silently rearrange the board.',
  ],
  'Sentiment analysis and containerised deployment': [
    'Send text to the analysis workflow and request its sentiment.',
    'Dash shows the material and the returned label or score in the project surface.',
    'The branch calls a separately deployed analysis service packaged through its container experiments.',
    'The result demonstrates how an external model service can feed a Dash document workflow.',
  ],
  'Component library extraction': [
    'A developer imports a shared Dash component instead of copying its implementation.',
    'The consuming interface uses the same visual and interaction primitive as another Dash surface.',
    'The packages/components work separates reusable UI contracts, builds them, and exposes them to Dash-Web.',
    'Common parts can be repaired or restyled once while research features keep composing them.',
  ],
  'This documentation site': [
    'Choose a task, feature, concept, project, or technical reference from the navigation.',
    'The page pairs plain instructions with current or clearly labelled representative visuals.',
    'Astro and Starlight build typed project registries, Markdown/MDX content, and generated evidence checks into a static site.',
    'A reader can move from “what is this button?” to the exact source and branch behind it.',
  ],
  'Data visualisation documents': [
    'Create a DataViz document, provide data, and select a visual representation.',
    'The visualization appears as a node that can live inside any Dash collection.',
    'DocumentType.DATAVIZ routes data and configuration fields into DataVizBox.',
    'Charts become linkable workspace objects rather than exported pictures.',
  ],
  'Novice mode and homepage': [
    'Turn on novice mode or begin from the homepage’s guided entry points.',
    'The interface reduces or explains controls so the first action is easier to identify.',
    'CurrentUserUtils, SettingsManager, and Doc.noviceMode propagate the preference into relevant views.',
    'A new user sees a smaller learning surface without creating a separate simplified data model.',
  ],
  'Document and field model': [
    'Create any item and change one of its properties.',
    'The item appears as a document; its title, content, position, and behavior are exposed through fields.',
    'Documents.ts defines types and field descriptors while the document manager and stores synchronize updates.',
    'Every higher-level feature receives the same editable, persistent building block.',
  ],
  'Collections and view types': [
    'Put documents in a collection and choose a different view from the appearance controls.',
    'The children rearrange as freeform, schema, stacking, calendar, graph, or another registered perspective.',
    'CollectionViewType selects a renderer over the same collection membership and child documents.',
    'Change how information is seen without converting or duplicating the information.',
  ],
  'Linking and annotation': [
    'Select a document or a precise region, start a link, and choose the destination.',
    'Dash draws or exposes the connection and can return to the anchored context later.',
    'LINK documents store endpoints and anchor metadata; linking views resolve and render those endpoints.',
    'Evidence, commentary, and navigation remain explicit objects in the shared workspace.',
  ],
};

export function workflowForProject(project: Project): WorkflowStep[] {
  const core = cores[project.title];
  if (!core) {
    throw new Error(`Missing workflow for project: ${project.title}`);
  }
  const [action, surface, engine, result] = core;
  return [
    {
      eyebrow: '1 · You start',
      title: 'Do the first action',
      explanation: action,
      technical: `Entry point: ${project.area}.`,
    },
    {
      eyebrow: '2 · You see',
      title: 'Watch Dash respond',
      explanation: surface,
      technical: `Surface status: ${project.status}.`,
    },
    {
      eyebrow: '3 · Dash does',
      title: 'Follow the implementation',
      explanation: engine,
      technical: project.code ?? 'See the project evidence and architecture pages for the exact source path.',
    },
    {
      eyebrow: '4 · You get',
      title: 'Use the result',
      explanation: result,
      technical: project.evidence ?? 'The project record explains how this result was verified.',
    },
  ];
}
