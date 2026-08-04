/**
 * Page weight budget, measured on what a browser actually fetches first.
 *
 * The naive version of this check sums every byte a page references and fails
 * on the total. That would be the wrong measurement here: this site documents
 * an interactive application with screen recordings, some of which are tens of
 * megabytes, and a reader who never scrolls to one should never pay for it.
 * What matters is the **eager** weight: the document, the stylesheets and
 * scripts it loads, and the images it does *not* defer. That is what stands
 * between a reader and a readable page.
 *
 * The deferred weight is measured too, and reported rather than enforced, so a
 * page that quietly grows a second forty-megabyte recording is still visible
 * even though it does not fail the build.
 *
 * Run after `npm run build`.
 *
 *   node scripts/check-performance-budget.mjs [dist-dir]
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const DIST = resolve(process.argv[2] ?? 'dist');
const BASE = (process.env.DOCS_BASE ?? '').replace(/\/$/, '');

/**
 * Budgets in bytes.
 *
 * `eager` is the enforced one. It is a target rather than a ratchet fitted to
 * whatever the site happens to weigh today: demanding enough that a page cannot
 * quietly acquire an undeferred recording, loose enough that ordinary writing
 * never trips it. When this was introduced the worst page loaded 64 MB before a
 * reader could scroll; the worst now loads 1.5 MB, and the headroom above that
 * is deliberate.
 *
 * `deferredWarn` is reported, never enforced. Some of these recordings are the
 * only record of a feature that no longer runs, and shrinking them is a media
 * decision, not something a build should force at three in the morning.
 */
const budgets = {
  eager: 1_750_000,
  deferredWarn: 20_000_000,
  documentWarn: 900_000,
};

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push('/' + relative(DIST, full).split(sep).join('/'));
  }
  return out;
}

const files = new Set(walk(DIST));
const sizeCache = new Map();
function sizeOf(sitePath) {
  let path = sitePath;
  if (BASE && path.startsWith(BASE)) path = path.slice(BASE.length);
  if (!files.has(path)) return 0;
  if (!sizeCache.has(path)) sizeCache.set(path, statSync(join(DIST, path.slice(1))).size);
  return sizeCache.get(path);
}

const pages = [...files].filter((file) => file.endsWith('/index.html') || file === '/index.html');
const rows = [];

for (const page of pages) {
  const html = readFileSync(join(DIST, page.slice(1)), 'utf8');
  // Redirect stubs are a meta refresh and nothing else.
  if (!/sl-markdown-content|<article/.test(html)) continue;

  const document = Buffer.byteLength(html);
  let eager = document;
  let deferred = 0;
  const heaviest = [];

  for (const match of html.matchAll(/<link\b[^>]*\srel="stylesheet"[^>]*>/g)) {
    const href = /\shref="([^"]+)"/.exec(match[0])?.[1];
    if (href?.startsWith('/')) eager += sizeOf(href);
  }
  for (const match of html.matchAll(/<script\b([^>]*)\ssrc="([^"]+)"[^>]*>/g)) {
    const [, attrs, src] = match;
    if (!src.startsWith('/')) continue;
    const size = sizeOf(src);
    // A module script is deferred by definition; a classic one blocks.
    if (/\sdefer\b|\basync\b|type="module"/.test(attrs)) deferred += size;
    else eager += size;
  }
  for (const match of html.matchAll(/<img\b([^>]*)>/g)) {
    const attrs = match[1];
    const src = /\ssrc="([^"]+)"/.exec(attrs)?.[1];
    if (!src?.startsWith('/')) continue;
    const size = sizeOf(src);
    if (/\sloading="lazy"/.test(attrs)) {
      deferred += size;
      heaviest.push([size, src]);
    } else {
      eager += size;
      heaviest.push([size, src]);
    }
  }

  heaviest.sort((a, b) => b[0] - a[0]);
  rows.push({ page, document, eager, deferred, heaviest: heaviest.slice(0, 2) });
}

const kb = (bytes) => `${(bytes / 1024).toFixed(0)} kB`;
const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

const overBudget = rows.filter((row) => row.eager > budgets.eager).sort((a, b) => b.eager - a.eager);
const heavyDocuments = rows.filter((row) => row.document > budgets.documentWarn).sort((a, b) => b.document - a.document);
const heavyDeferred = rows.filter((row) => row.deferred > budgets.deferredWarn).sort((a, b) => b.deferred - a.deferred);

console.log(`Measured ${rows.length} content pages in ${DIST}`);

if (heavyDeferred.length) {
  console.log(`\n### Heavy deferred media (reported, not enforced): ${heavyDeferred.length}`);
  for (const row of heavyDeferred.slice(0, 8)) {
    console.log(`    ${row.page} defers ${mb(row.deferred)}, largest: ${row.heaviest[0]?.[1]} at ${mb(row.heaviest[0]?.[0] ?? 0)}`);
  }
}

if (heavyDocuments.length) {
  console.log(`\n### Large documents (reported, not enforced): ${heavyDocuments.length}`);
  for (const row of heavyDocuments.slice(0, 8)) console.log(`    ${row.page} is ${kb(row.document)} of HTML`);
}

if (overBudget.length) {
  console.log(`\n### Over the eager budget of ${kb(budgets.eager)}: ${overBudget.length}`);
  for (const row of overBudget.slice(0, 20)) {
    console.log(`    ${row.page} loads ${kb(row.eager)} before the reader can scroll; largest: ${row.heaviest[0]?.[1]} at ${kb(row.heaviest[0]?.[0] ?? 0)}`);
  }
  console.log('\n    Defer the image with loading="lazy", or shrink it. The page visual above the article is the only image meant to load eagerly.');
  process.exit(1);
}

const worst = rows.slice().sort((a, b) => b.eager - a.eager)[0];
const totalDeferred = rows.reduce((sum, row) => sum + row.deferred, 0);
console.log(
  `Every page loads under the ${kb(budgets.eager)} eager budget ` +
    `(heaviest: ${worst.page} at ${kb(worst.eager)}). ` +
    `${mb(totalDeferred)} of media across the site is deferred until a reader scrolls to it.`
);
