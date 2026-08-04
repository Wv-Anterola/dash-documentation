/**
 * Validate the built site: internal links, heading anchors, images, alt text,
 * and heading order.
 *
 * Run after `npm run build`. This is the check that keeps a routing mistake
 * from reaching the deployed site; CI runs it on every push and pull request
 * (.github/workflows/verify.yml).
 *
 *   node scripts/check-links.mjs [dist-dir]
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const DIST = resolve(process.argv[2] ?? 'dist');
// Empty when the site is served from a domain root, as it is on Vercel. Set
// DOCS_BASE to match astro.config.mjs when building for a subpath such as
// GitHub Pages. The trailing slash is stripped so the comparisons below line up.
const BASE = (process.env.DOCS_BASE ?? '').replace(/\/$/, '');

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

// The site's own origin, so a hand-written absolute link back to it can be
// told apart from a genuine outbound one. An absolute self-link works in
// production and breaks in dev and on the GitHub Pages layout, which is the
// worst way for a link to be wrong.
const SITE_ORIGIN = (process.env.DOCS_SITE ?? 'https://brown-dash-documentation.vercel.app').replace(/\/$/, '');

const idsOf = new Map();
const externalHosts = new Map();
const problems = { links: [], anchors: [], duplicateIds: [], images: [], alt: [], headings: [], insecure: [], selfAbsolute: [] };

const html = new Map();
for (const p of pages) {
  html.set(p, readFileSync(join(DIST, p.slice(1)), 'utf8'));
}

// Collect element ids per page so cross-page anchors can be checked.
for (const [p, src] of html) {
  const ids = new Set();
  for (const m of src.matchAll(/\sid="([^"]+)"/g)) {
    if (ids.has(m[1])) problems.duplicateIds.push([p, m[1]]);
    ids.add(m[1]);
  }
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
        continue;
      }
      if (/^https?:/.test(href)) {
        // A local development URL is an instruction, not a link that has to be
        // reachable or secure.
        const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)/.test(href);
        if (href.startsWith('http://') && !isLocal) problems.insecure.push([page, href]);
        if (href.startsWith(`${SITE_ORIGIN}/`)) problems.selfAbsolute.push([page, href]);
        if (!isLocal) {
          try {
            const host = new URL(href).host;
            externalHosts.set(host, (externalHosts.get(host) ?? 0) + 1);
          } catch {
            problems.links.push([page, href]);
          }
        }
      }
      continue;
    }
    if (!href.startsWith('/')) continue;

    // A query string is a filter for the page's own script, not part of the
    // route, so it has to come off before the file is resolved.
    const [beforeFragment, frag] = href.split('#');
    const pathname = beforeFragment.split('?')[0];
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
report('Duplicate element IDs', problems.duplicateIds);
report('Broken images', problems.images);
report('Images missing alt', problems.alt);
report('Heading order problems', problems.headings);
report('Insecure http links', problems.insecure);
report('Absolute links back to this site', problems.selfAbsolute);

const hosts = [...externalHosts.entries()].sort((a, b) => b[1] - a[1]);
console.log(`
### Outbound links: ${hosts.reduce((total, [, count]) => total + count, 0)} to ${hosts.length} hosts`);
for (const [host, count] of hosts.slice(0, 12)) console.log('   ', String(count).padStart(5), host);

const fatal = Object.values(problems).reduce((total, rows) => total + rows.length, 0);
process.exit(fatal ? 1 : 0);
