import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'public/assets/images/visuals');

const sources = {
  'agent-oversight': 'assets/gifs/environment/undo-redo.gif',
  'policy-checker': 'assets/gifs/gettingstarted/dash-show-links.gif',
  'graph-view': 'assets/images/dash2.jpg',
  'ai-html': 'assets/gifs/ai/ai-edit-1.gif',
  'life-coach': 'assets/images/current/dash-trip-planner-workspace.webp',
  'sketch-3d': 'assets/gifs/features/inkdraw.gif',
  'data-viz-generation': 'assets/gifs/dataViz/aiVisualize.gif',
  'video-generator': 'assets/images/gen_ai.png',
  'image-reference-generation': 'assets/gifs/ai/ai-firefly-template-image-2.gif',
  'trip-planner': 'assets/images/current/dash-trip-planner-workspace.webp',
  'probability-module': 'assets/images/environment/text_doc.png',
  'desktop-local': 'assets/images/current/dash-home-workspaces.webp',
  'research-agent': 'assets/gifs/ai/ai-websearch-1.gif',
  'selection-formatting': 'assets/gifs/ai/ai-text.gif',
  'agent-tools': 'assets/images/dash1.png',
  'canvas-aware-agent': 'assets/images/environment/dash-labeled-interface.png',
  'tutorial-agent': 'assets/images/environment/dash-labeled-interface.png',
  scrapbook: 'assets/images/dash1.png',
  'symbolic-math': 'assets/images/environment/text_doc.png',
  'model-documents': 'assets/images/dash1.png',
  'diagram-documents': 'assets/gifs/features/inkdraw.gif',
  'agent-calendar': 'assets/images/current/dash-trip-planner-detail.webp',
  'task-documents': 'assets/images/dash1.png',
  'mesh-tooling': 'assets/images/dash1.png',
  'smart-draw': 'assets/gifs/ai/ai-image.gif',
  'chart-filtering': 'assets/gifs/dataViz/filteringC.gif',
  'animation-remodel': 'assets/gifs/animation/basicanimation.gif',
  'presentation-dictation': 'assets/gifs/audio/dictation.gif',
  'branching-trails': 'assets/images/trails/prestree.png',
  'agent-created-docs': 'assets/gifs/ai/ai-text.gif',
  'content-search': 'assets/gifs/features/andy_search.gif',
  'maps-calendar': 'assets/gifs/environment/create_map.gif',
  'physics-simulation': 'assets/images/environment/simulation_doc.png',
  'document-recommendations': 'assets/gifs/features/andy_search.gif',
  'sentiment-deployment': 'assets/images/environment/dataViz_doc.png',
  'component-library': 'assets/images/environment/dash-labeled-interface.png',
  'documentation-site': 'assets/images/dash-doc-representation.png',
  'data-viz-documents': 'assets/images/environment/dataViz_doc.png',
  'novice-home': 'assets/images/current/dash-home-workspaces.webp',
  'document-model': 'assets/images/dash-doc-representation.png',
  'collection-views': 'assets/images/dash2.jpg',
  'linking-annotation': 'assets/gifs/gettingstarted/dash-creating-link.gif',
  'rich-text': 'assets/images/environment/text_doc.png',
  'media-documents': 'assets/images/dash1.png',
  'import-export': 'assets/gifs/gettingstarted/dash-import.gif',
  'collaboration-sharing': 'assets/gifs/gettingstarted/sharing.gif',
  'workspace-interface': 'assets/images/current/dash-trip-planner-workspace.webp',
};

await mkdir(output, { recursive: true });

for (const [name, relative] of Object.entries(sources)) {
  const input = path.join(root, 'public', relative);
  await sharp(input, { pages: 1 })
    .resize({
      width: 960,
      height: 540,
      fit: 'contain',
      background: { r: 14, g: 20, b: 31, alpha: 1 },
      withoutEnlargement: true,
    })
    .webp({ quality: 86, effort: 5 })
    .toFile(path.join(output, `${name}.webp`));
}

console.log(`Built ${Object.keys(sources).length} visual posters.`);
