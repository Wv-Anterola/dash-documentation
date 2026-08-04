/**
 * Validate the plain-text and JSON entry points a machine reads.
 *
 * These files are the only part of the site with no visible surface, so nothing
 * about them is self-correcting: an llms.txt that lost half the site, or that
 * links to pages which no longer build, would look exactly like a healthy one.
 * This check makes those failures loud.
 *
 * Run after `npm run build`.
 *
 *   node scripts/check-machine-endpoints.mjs [dist-dir]
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const DIST = resolve(process.argv[2] ?? 'dist');
const BASE = (process.env.DOCS_BASE ?? '').replace(/\/$/, '');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push('/' + relative(DIST, full).split(sep).join('/'));
  }
  return out;
}

const files = new Set(walk(DIST));
const problems = [];
const complain = (message) => problems.push(message);

const read = (path) => {
  if (!files.has(path)) {
    complain(`${path} was not built`);
    return '';
  }
  return readFileSync(join(DIST, path.slice(1)), 'utf8');
};

const llms = read('/llms.txt');
const llmsFull = read('/llms-full.txt');
const robots = read('/robots.txt');
const manifestText = read('/assets/data/index.json');

/* ------------------------------------------------------------------ *
 * llms.txt must follow the format and cover the whole site
 * ------------------------------------------------------------------ */

if (llms && !llms.startsWith('# ')) complain('llms.txt must open with a single H1 naming the project');
if (llms && !/\n> /.test(llms)) complain('llms.txt must carry a blockquote summary');
if (llms && !/\n## /.test(llms)) complain('llms.txt must group its links under H2 sections');

const pages = [...files].filter((file) => file.endsWith('/index.html'));
/** Site path a built page is served at, minus any deployment base. */
const pagePath = (file) => file.replace(/index\.html$/, '');
const routes = new Set(pages.map(pagePath));

const linked = new Set();
for (const match of llms.matchAll(/\]\((https?:\/\/[^)]+)\)/g)) {
  const url = new URL(match[1]);
  let pathname = url.pathname;
  if (BASE && pathname.startsWith(BASE)) pathname = pathname.slice(BASE.length) || '/';
  linked.add(pathname);
  if (!routes.has(pathname)) complain(`llms.txt links to ${pathname}, which is not a built page`);
}

// Redirect stubs are pages too, but they are not content; only content pages
// carry a Starlight article, so compare against the pages that have one.
const contentRoutes = pages.filter((file) => {
  const html = readFileSync(join(DIST, file.slice(1)), 'utf8');
  return html.includes('<article') || html.includes('sl-markdown-content');
});
const missing = contentRoutes.map(pagePath).filter((route) => !linked.has(route));
// Generated per-symbol, per-person, and per-project pages are enumerated in the
// datasets rather than in llms.txt, which is an index and not a sitemap.
const generatedPrefixes = ['/technical/api/modules/', '/research/implementation/', '/research/people/', '/research/projects/', '/research/publications/', '/research/cohorts/'];
const missingContent = missing.filter((route) => !generatedPrefixes.some((prefix) => route.startsWith(prefix)));
for (const route of missingContent) complain(`llms.txt omits the content page ${route}`);

/* ------------------------------------------------------------------ *
 * llms-full.txt must carry the prose, not the record tables
 * ------------------------------------------------------------------ */

if (llmsFull) {
  // llms.txt is already checked page by page above, so this only needs a floor
  // low enough never to be noise and high enough to catch a collapsed corpus.
  const entries = [...llmsFull.matchAll(/^Source: (https?:\/\/\S+)$/gm)].length;
  if (entries !== linked.size) complain(`llms-full.txt carries ${entries} pages but llms.txt indexes ${linked.size}`);
  if (llmsFull.length < 200_000) complain(`llms-full.txt is only ${llmsFull.length} bytes, which suggests page bodies were dropped`);
  if (/<[A-Z][A-Za-z0-9]*\s*\/>/.test(llmsFull)) complain('llms-full.txt still contains raw MDX component tags');
  if (/^import\s/m.test(llmsFull)) complain('llms-full.txt still contains MDX import statements');
  for (const match of llmsFull.matchAll(/published as JSON at ([^\s\]]+)/g)) {
    const url = new URL(match[1]);
    let pathname = url.pathname;
    if (BASE && pathname.startsWith(BASE)) pathname = pathname.slice(BASE.length);
    if (!files.has(pathname)) complain(`llms-full.txt points at ${pathname}, which is not published`);
  }
}

/* ------------------------------------------------------------------ *
 * robots.txt must name the sitemap and the text entry points
 * ------------------------------------------------------------------ */

if (robots) {
  if (!/^Sitemap: https?:\/\/\S+/m.test(robots)) complain('robots.txt does not name a sitemap');
  for (const path of ['/llms.txt', '/llms-full.txt', '/assets/data/index.json']) {
    if (!robots.includes(path)) complain(`robots.txt does not point at ${path}`);
  }
  const sitemap = /^Sitemap: (\S+)/m.exec(robots)?.[1];
  if (sitemap) {
    let pathname = new URL(sitemap).pathname;
    if (BASE && pathname.startsWith(BASE)) pathname = pathname.slice(BASE.length);
    if (!files.has(pathname)) complain(`robots.txt names ${pathname}, which was not built`);
  }
}

/* ------------------------------------------------------------------ *
 * The dataset manifest must match what is actually served
 * ------------------------------------------------------------------ */

if (manifestText) {
  let manifest;
  try {
    manifest = JSON.parse(manifestText);
  } catch (error) {
    complain(`the dataset manifest is not valid JSON: ${error.message}`);
  }
  if (manifest) {
    for (const dataset of manifest.datasets ?? []) {
      if (!files.has(dataset.path)) complain(`the manifest advertises ${dataset.id} at ${dataset.path}, which was not built`);
      if (!routes.has(dataset.page)) complain(`the manifest points ${dataset.id} at ${dataset.page}, which is not a built page`);
      if (!/^[0-9a-f]{40}$/.test(String(dataset.baseline))) complain(`${dataset.id} is not pinned to an immutable commit`);
      if (!Number.isInteger(dataset.records) || dataset.records < 1) complain(`${dataset.id} advertises ${dataset.records} records`);
    }
    const served = [...files].filter((file) => file.startsWith('/assets/data/') && file.endsWith('.json') && file !== '/assets/data/index.json');
    for (const file of served) {
      if (!(manifest.datasets ?? []).some((dataset) => dataset.path === file)) complain(`${file} is served but missing from the manifest`);
    }
  }
}

console.log(`Checked the machine-readable entry points in ${DIST}`);
if (problems.length) {
  console.log(`\n### Problems: ${problems.length}`);
  for (const problem of problems) console.log('   ', problem);
  process.exit(1);
}
console.log(
  `llms.txt indexes ${linked.size} pages, llms-full.txt carries the prose corpus, ` +
    'robots.txt names the sitemap and both text entry points, and every advertised dataset is served.'
);
