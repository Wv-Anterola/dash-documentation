import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [projectsSource, capabilitiesSource, visualsSource] = await Promise.all([
  readFile(path.join(root, 'src/data/projects.ts'), 'utf8'),
  readFile(path.join(root, 'src/data/capabilities.ts'), 'utf8'),
  readFile(path.join(root, 'src/data/visuals.ts'), 'utf8'),
]);

const projectPattern =
  /^\s{4}title:\s*'(?<title>[^']+)',[\s\S]*?^\s{4}status:\s*'(?<status>[^']+)',/gm;
const projects = [...projectsSource.matchAll(projectPattern)].map((match) => ({
  title: match.groups.title,
  status: match.groups.status,
}));

const capabilityProjectTitles = new Set();
for (const match of capabilitiesSource.matchAll(/projects:\s*\[(?<titles>[\s\S]*?)\],/g)) {
  for (const title of match.groups.titles.matchAll(/'([^']+)'/g)) {
    capabilityProjectTitles.add(title[1]);
  }
}

const knownTitles = new Set(projects.map((project) => project.title));
const unknown = [...capabilityProjectTitles].filter((title) => !knownTitles.has(title));
const unmappedIntegrated = projects
  .filter((project) => project.status === 'integrated')
  .filter((project) => !capabilityProjectTitles.has(project.title));

const docsTargets = [...capabilitiesSource.matchAll(/(?:docs|technical):\s*'([^']+)'/g)]
  .map((match) => match[1].split('#')[0])
  .filter((target) => target.startsWith('/'));

const missingTargets = [];
for (const target of new Set(docsTargets)) {
  const slug = target.replace(/^\/|\/$/g, '');
  const candidates = slug
    ? [
        path.join(root, 'src/content/docs', `${slug}.mdx`),
        path.join(root, 'src/content/docs', slug, 'index.mdx'),
        path.join(root, 'src/content/docs', `${slug}.md`),
      ]
    : [path.join(root, 'src/content/docs/index.mdx')];
  let found = false;
  for (const candidate of candidates) {
    try {
      await readFile(candidate);
      found = true;
      break;
    } catch {
      // Try the next supported content path.
    }
  }
  if (!found) missingTargets.push(target);
}

const projectVisualBody =
  visualsSource.match(
    /export const projectVisuals:[\s\S]*?= \{(?<body>[\s\S]*?)\n\};\n\nexport const capabilityVisuals/
  )?.groups?.body ?? '';
const projectVisualTitles = new Set(
  [...projectVisualBody.matchAll(/^\s{2}'([^']+)':/gm)].map((match) => match[1])
);
const missingProjectVisuals = projects.filter(
  (project) => !projectVisualTitles.has(project.title)
);
const unknownProjectVisuals = [...projectVisualTitles].filter(
  (title) => !knownTitles.has(title)
);

const capabilityIds = new Set(
  [...capabilitiesSource.matchAll(/^\s{4}id:\s*'([^']+)',/gm)].map((match) => match[1])
);
const capabilityVisualBody =
  visualsSource.match(
    /export const capabilityVisuals:[\s\S]*?= \{(?<body>[\s\S]*?)\n\};\n\nexport function visualForProject/
  )?.groups?.body ?? '';
const capabilityVisualIds = new Set(
  [...capabilityVisualBody.matchAll(/^\s{2}(?:'([^']+)'|([a-z][A-Za-z0-9]*)):/gm)]
    .map((match) => match[1] ?? match[2])
);
const missingCapabilityVisuals = [...capabilityIds].filter(
  (id) => !capabilityVisualIds.has(id)
);
const unknownCapabilityVisuals = [...capabilityVisualIds].filter(
  (id) => !capabilityIds.has(id)
);

const visualPosters = new Set(
  [...visualsSource.matchAll(/poster\('([^']+)'\)/g)].map((match) => match[1])
);
const missingVisualPosters = [];
for (const poster of visualPosters) {
  try {
    await readFile(path.join(root, 'public/assets/images/visuals', `${poster}.webp`));
  } catch {
    missingVisualPosters.push(poster);
  }
}

if (
  unknown.length ||
  unmappedIntegrated.length ||
  missingTargets.length ||
  missingProjectVisuals.length ||
  unknownProjectVisuals.length ||
  missingCapabilityVisuals.length ||
  unknownCapabilityVisuals.length ||
  missingVisualPosters.length
) {
  if (unknown.length) {
    console.error('Capability registry references unknown projects:');
    for (const title of unknown) console.error(`  - ${title}`);
  }
  if (unmappedIntegrated.length) {
    console.error('Integrated projects without a capability mapping:');
    for (const project of unmappedIntegrated) console.error(`  - ${project.title}`);
  }
  if (missingTargets.length) {
    console.error('Capability registry references missing documentation pages:');
    for (const target of missingTargets) console.error(`  - ${target}`);
  }
  if (missingProjectVisuals.length) {
    console.error('Projects without visual evidence:');
    for (const project of missingProjectVisuals) console.error(`  - ${project.title}`);
  }
  if (unknownProjectVisuals.length) {
    console.error('Visual registry references unknown projects:');
    for (const title of unknownProjectVisuals) console.error(`  - ${title}`);
  }
  if (missingCapabilityVisuals.length) {
    console.error('Capabilities without visual evidence:');
    for (const id of missingCapabilityVisuals) console.error(`  - ${id}`);
  }
  if (unknownCapabilityVisuals.length) {
    console.error('Visual registry references unknown capabilities:');
    for (const id of unknownCapabilityVisuals) console.error(`  - ${id}`);
  }
  if (missingVisualPosters.length) {
    console.error('Visual posters have not been built:');
    for (const poster of missingVisualPosters) console.error(`  - ${poster}.webp`);
    console.error('Run `npm run visuals` to rebuild the poster set.');
  }
  process.exitCode = 1;
} else {
  console.log(
    `Capability coverage complete: ${projects.length} projects, ` +
      `${projects.filter((project) => project.status === 'integrated').length} integrated projects mapped, ` +
      `${new Set(docsTargets).size} canonical documentation targets verified, ` +
      `${projectVisualTitles.size} project visuals and ${capabilityVisualIds.size} capability visuals verified.`
  );
}
