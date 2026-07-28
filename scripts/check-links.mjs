/**
 * Validate the built site: internal links, heading anchors, images, alt text,
 * and heading order.
 *
 * Run after `npm run build`. There is no CI on this repository, so this is the
 * check that keeps a routing mistake from reaching the deployed site.
 *
 *   node scripts/check-links.mjs [dist-dir]
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const DIST = resolve(process.argv[2] ?? 'dist');
const BASE = '/Dash-Documentation';

/** Every file in the build, as site-root paths. */
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push('/' + relative(DIST, full).split(sep).join('/'));
  }
  return out;
}

const files = new Set(walk(DIST));
const pages = [...files].filter((f) => f.endsWith('.html'));

const idsOf = new Map();
const problems = { links: [], anchors: [], images: [], alt: [], headings: [] };

const html = new Map();
for (const p of pages) {
  html.set(p, readFileSync(join(DIST, p.slice(1)), 'utf8'));
}

// Collect element ids per page so cross-page anchors can be checked.
for (const [p, src] of html) {
  const ids = new Set();
  for (const m of src.matchAll(/\sid="([^"]+)"/g)) ids.add(m[1]);
  idsOf.set(p, ids);
}

/** Resolve a site URL to the built file that serves it. */
function targetFile(pathname) {
  let p = pathname;
  if (BASE && p.startsWith(BASE)) p = p.slice(BASE.length) || '/';
  if (p.endsWith('/')) p += 'index.html';
  else if (!p.includes('.')) p += '/index.html';
  return p;
}

for (const [page, src] of html) {
  // Ignore Starlight's own chrome; we are checking authored content and the
  // navigation generated from it, both of which live in <body>.
  for (const m of src.matchAll(/<a\b[^>]*\shref="([^"]+)"/g)) {
    const href = m[1];
    if (/^(https?:|mailto:|tel:|#|javascript:|data:)/.test(href)) {
      if (href.startsWith('#')) {
        const frag = decodeURIComponent(href.slice(1));
        if (frag && !idsOf.get(page)?.has(frag)) problems.anchors.push([page, href]);
      }
      continue;
    }
    if (!href.startsWith('/')) continue;

    const [pathname, frag] = href.split('#');
    const file = targetFile(decodeURIComponent(pathname));
    if (!files.has(file)) {
      problems.links.push([page, href]);
      continue;
    }
    if (frag) {
      const ids = idsOf.get(file);
      if (ids && !ids.has(decodeURIComponent(frag))) problems.anchors.push([page, href]);
    }
  }

  for (const m of src.matchAll(/<img\b([^>]*)>/g)) {
    const tag = m[1];
    const src2 = /\ssrc="([^"]+)"/.exec(tag)?.[1];
    // `alt="..."`, `alt=""`, and bare `alt` are all fine; the last two mark a
    // decorative image, which is how Starlight renders the site logo. Only a
    // completely absent alt attribute is a problem.
    const hasAlt = /\salt(=|\s|$)/.test(tag);
    if (!hasAlt) problems.alt.push([page, src2 ?? '(no src)']);
    if (!src2 || /^(https?:|data:)/.test(src2)) continue;
    if (!src2.startsWith('/')) continue;
    let f = src2;
    if (BASE && f.startsWith(BASE)) f = f.slice(BASE.length);
    if (!files.has(f)) problems.images.push([page, src2]);
  }

  // Heading order within the article body.
  const body = /<main\b[\s\S]*?<\/main>/.exec(src)?.[0] ?? src;
  let prev = 0;
  for (const m of body.matchAll(/<h([1-6])\b/g)) {
    const lvl = Number(m[1]);
    if (prev && lvl > prev + 1) problems.headings.push([page, `h${prev} -> h${lvl}`]);
    prev = lvl;
  }
}

const report = (name, rows, limit = 25) => {
  console.log(`\n### ${name}: ${rows.length}`);
  for (const r of rows.slice(0, limit)) console.log('   ', r[0], '->', r[1]);
  if (rows.length > limit) console.log(`    ... and ${rows.length - limit} more`);
};

console.log(`Checked ${pages.length} pages in ${DIST}`);
report('Broken internal links', problems.links);
report('Broken anchors', problems.anchors);
report('Broken images', problems.images);
report('Images missing alt', problems.alt);
report('Heading order problems', problems.headings);

const fatal = problems.links.length + problems.anchors.length + problems.images.length;
process.exit(fatal ? 1 : 0);
