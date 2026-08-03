import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docsRoot = path.join(root, 'src', 'content', 'docs');

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(target));
    else if (/\.mdx?$/i.test(entry.name)) files.push(target);
  }
  return files;
}

function frontmatter(source, filename) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { error: `${filename}: missing frontmatter` };
  const value = (key) => {
    const field = match[1].match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1]?.trim();
    return field?.replace(/^(['"])(.*)\1$/, '$2');
  };
  return { title: value('title'), description: value('description') };
}

function markdownImages(source) {
  return [...source.matchAll(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g)].map(
    ([, alt, src]) => ({ alt: alt.trim(), src })
  );
}

function duplicateSectionHeadings(source) {
  const headings = [...source.matchAll(/^(#{2,4})\s+(.+)$/gm)].map((match) =>
    match[2]
      .replace(/[`*_]/g, '')
      .replace(/\[[^\]]+\]\([^)]+\)/g, '')
      .trim()
      .toLowerCase()
  );
  return headings.filter((heading, index) => headings.indexOf(heading) !== index);
}

const files = await walk(docsRoot);
const errors = [];
const titles = new Map();
let images = 0;

for (const filename of files) {
  const relative = path.relative(root, filename).replaceAll('\\', '/');
  const source = await readFile(filename, 'utf8');
  const proseSource = source
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`\r\n]+`/g, '');
  const data = frontmatter(source, relative);
  if (data.error) {
    errors.push(data.error);
    continue;
  }
  if (!data.title) errors.push(`${relative}: frontmatter title is required`);
  if (!data.description || data.description.length < 40) {
    errors.push(`${relative}: description must state the page's purpose in at least 40 characters`);
  }
  if (data.title) {
    const owners = titles.get(data.title.toLowerCase()) ?? [];
    owners.push(relative);
    titles.set(data.title.toLowerCase(), owners);
  }

  for (const image of markdownImages(proseSource)) {
    images++;
    const decorativeIcon = !image.alt && image.src.includes('/assets/icons/');
    if (!image.alt && !decorativeIcon) errors.push(`${relative}: ${image.src} has empty alt text`);
    if (/^https?:\/\//i.test(image.src)) {
      errors.push(`${relative}: hot-linked media is not reproducible (${image.src})`);
    }
    if (/\b(?:doc\d+|inkedit\d+)\b|\b(?:open trails pane|creating link|generate animations)\b/i.test(image.alt)) {
      errors.push(`${relative}: image alt text describes a filename instead of the interaction (${image.alt})`);
    }
  }

  const repeatedHeadings = [...new Set(duplicateSectionHeadings(source))];
  for (const heading of repeatedHeadings) {
    errors.push(`${relative}: duplicate section heading creates an ambiguous anchor (${heading})`);
  }

  if (!relative.includes('/contributing/') && !relative.includes('/research/release-history')) {
    const metaPatterns = [
      /when checked on \d{1,2}\s+[A-Z][a-z]+\s+20\d{2}/i,
      /original version of this page/i,
      /this page used to/i,
      /legacy tips page/i,
    ];
    for (const pattern of metaPatterns) {
      if (pattern.test(source)) errors.push(`${relative}: reader-facing content contains documentation-process commentary (${pattern})`);
    }
  }
}

for (const [title, owners] of titles) {
  if (owners.length > 1) errors.push(`Duplicate page title "${title}": ${owners.join(', ')}`);
}

const overlaySource = await readFile(path.join(root, 'src', 'data', 'symbolOverlays.ts'), 'utf8');
const referenceSource = await readFile(path.join(root, 'src', 'data', 'generated', 'source-reference.json'), 'utf8');
const overlayIds = [...overlaySource.matchAll(/^\s{2}'([^']+)':\s*\{/gm)].map((match) => match[1]);
for (const id of overlayIds) {
  if (!referenceSource.includes(`"id": "${id}"`)) {
    errors.push(`Runtime contract overlay has no matching source symbol: ${id}`);
  }
}

if (errors.length) {
  console.error(`Documentation quality check failed with ${errors.length} issue${errors.length === 1 ? '' : 's'}:`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    `Documentation quality complete: ${files.length} pages have required metadata and unique titles; ` +
      `${images} inline images have reproducible sources and intentional alt text; ` +
      `${overlayIds.length} runtime contract overlays resolve to source symbols.`
  );
}
