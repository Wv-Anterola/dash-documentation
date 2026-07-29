import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'public/assets/images/visuals');

const sources = {
  'agent-oversight': 'assets/gifs/environment/undo-redo.gif',
  'policy-checker': 'assets/gifs/gettingstarted/dash-link-annotation-document.gif',
  'graph-view': 'assets/gifs/views/dash-change-view.gif',
  'ai-html': 'assets/gifs/ai/ai-edit-1.gif',
  'life-coach': 'assets/images/creators/trip-doc.webp',
  'sketch-3d': 'assets/gifs/features/inkedit3.gif',
  'data-viz-generation': 'assets/gifs/dataViz/aiVisualize.gif',
  'video-generator': 'assets/gifs/video/timelineview.gif',
  'image-reference-generation': 'assets/gifs/ai/ai-firefly-template-image-2.gif',
  'trip-planner': 'assets/images/current/dash-trip-planner-workspace.webp',
  'probability-module': 'assets/images/environment/text_doc2.gif',
  'desktop-local': 'assets/gifs/environment/dash-managing.gif',
  'research-agent': 'assets/gifs/ai/ai-websearch-1.gif',
  'selection-formatting': 'assets/gifs/ai/ai-edit-2.gif',
  'agent-tools': 'assets/images/current/dash-tools-panel.webp',
  'canvas-aware-agent': 'assets/images/current/dash-properties-panel.webp',
  'tutorial-agent': 'assets/images/getting-started/context-toolbar.png',
  scrapbook: 'assets/images/creators/scrapbook.webp',
  'symbolic-math': 'assets/images/creators/math.webp',
  'model-documents': 'assets/images/creators/3d-model.webp',
  'diagram-documents': 'assets/images/creators/diagram.webp',
  'agent-calendar': 'assets/gifs/environment/map_story.gif',
  'task-documents': 'assets/images/creators/task.webp',
  'mesh-tooling': 'assets/images/creators/replviewer.webp',
  'smart-draw': 'assets/gifs/ai/ai-image.gif',
  'chart-filtering': 'assets/gifs/dataViz/filteringC.gif',
  'animation-remodel': 'assets/gifs/animation/basicanimation.gif',
  'presentation-dictation': 'assets/gifs/audio/dictation.gif',
  'branching-trails': 'assets/images/trails/prestree.png',
  'agent-created-docs': 'assets/gifs/ai/ai-text.gif',
  'content-search': 'assets/gifs/features/andy_search.gif',
  'maps-calendar': 'assets/gifs/environment/create_map.gif',
  'physics-simulation': 'assets/images/environment/simulation_doc.png',
  'document-recommendations': 'assets/gifs/gettingstarted/dash-lightbox.gif',
  'sentiment-deployment': 'assets/gifs/dataViz/aiText.gif',
  'component-library': 'assets/images/getting-started/document-chrome.png',
  'documentation-site': 'assets/images/current/dash-documentation-site.webp',
  'data-viz-documents': 'assets/gifs/dataViz/simple_dataViz.gif',
  'novice-home': 'assets/images/current/dash-home-workspaces.webp',
  'document-model': 'assets/images/dash-doc-representation.png',
  'collection-views': 'assets/gifs/gettingstarted/dash-nested-collection.gif',
  'linking-annotation': 'assets/gifs/gettingstarted/dash-creating-link.gif',
  'rich-text': 'assets/images/environment/dash-text-toolbar.png',
  'media-documents': 'assets/images/environment/overview.png',
  'structured-personal-documents': 'assets/images/creators/journal.webp',
  'import-export': 'assets/gifs/gettingstarted/dash-import.gif',
  'collaboration-sharing': 'assets/gifs/gettingstarted/sharing.gif',
  'workspace-interface': 'assets/images/environment/dash-labeled-interface.png',
};

const creatorCards = {
  'life-coach': {
    title: 'Life Coach',
    subtitle: 'Tools → planning document',
    kind: 'Current creator capture',
    accent: '#56b4ff',
  },
  scrapbook: {
    title: 'Scrapbook',
    subtitle: 'Tools → mixed-media document',
    kind: 'Current creator capture',
    accent: '#ffbd59',
  },
  'symbolic-math': {
    title: 'Math',
    subtitle: 'Tools → symbolic document',
    kind: 'Current creator capture',
    accent: '#8be28b',
  },
  'model-documents': {
    title: '3D Model',
    subtitle: 'Tools → spatial document',
    kind: 'Current creator capture',
    accent: '#bf9cff',
  },
  'diagram-documents': {
    title: 'Diagram',
    subtitle: 'Tools → source-rendered document',
    kind: 'Current creator capture',
    accent: '#ff7898',
  },
  'task-documents': {
    title: 'Task',
    subtitle: 'Tools → structured work item',
    kind: 'Current creator capture',
    accent: '#64dfcf',
  },
  'mesh-tooling': {
    title: 'Mesh tooling',
    subtitle: 'Related computational creator',
    kind: 'Representative creator capture',
    accent: '#ff9668',
  },
  'structured-personal-documents': {
    title: 'Journal',
    subtitle: 'Tools → personal document',
    kind: 'Current creator capture',
    accent: '#82aaff',
  },
};

await mkdir(output, { recursive: true });

for (const [name, relative] of Object.entries(sources)) {
  const input = path.join(root, 'public', relative);
  const creatorCard = creatorCards[name];
  if (creatorCard) {
    const icon = await sharp(input)
      .resize({ width: 280, height: 260, fit: 'contain', kernel: 'lanczos3' })
      .sharpen()
      .png()
      .toBuffer();
    const background = Buffer.from(`
      <svg width="960" height="540" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#0e141f"/>
            <stop offset="1" stop-color="#17243a"/>
          </linearGradient>
          <radialGradient id="glow">
            <stop offset="0" stop-color="${creatorCard.accent}" stop-opacity=".28"/>
            <stop offset="1" stop-color="${creatorCard.accent}" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <rect width="960" height="540" fill="url(#bg)"/>
        <circle cx="810" cy="60" r="320" fill="url(#glow)"/>
        <rect x="54" y="105" width="332" height="330" rx="28" fill="#0a1019" stroke="${creatorCard.accent}" stroke-opacity=".55" stroke-width="2"/>
        <rect x="430" y="123" width="8" height="250" rx="4" fill="${creatorCard.accent}"/>
        <text x="480" y="170" fill="${creatorCard.accent}" font-family="Arial, sans-serif" font-size="20" font-weight="700" letter-spacing="2">${creatorCard.kind.toUpperCase()}</text>
        <text x="480" y="255" fill="#ffffff" font-family="Arial, sans-serif" font-size="54" font-weight="750">${creatorCard.title}</text>
        <text x="480" y="310" fill="#b8c7dd" font-family="Arial, sans-serif" font-size="25">${creatorCard.subtitle}</text>
        <text x="480" y="380" fill="#8191a8" font-family="Arial, sans-serif" font-size="18">Distinct source evidence from Dash’s interface</text>
      </svg>
    `);
    await sharp(background)
      .composite([{ input: icon, left: 80, top: 140 }])
      .webp({ quality: 90, effort: 5 })
      .toFile(path.join(output, `${name}.webp`));
    continue;
  }
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
