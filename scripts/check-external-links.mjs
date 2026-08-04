/**
 * Reachability check for every outbound link, run on a schedule rather than on
 * a push.
 *
 * Link rot is real and worth measuring, but it is somebody else's server. A
 * check that fails the build because a university page was briefly down, or
 * because a host dislikes a CI runner's address, teaches everyone to ignore a
 * red build. So this runs weekly, prints a report, and exits 0 unless the
 * failure is one this repository can actually fix.
 *
 * The one exception is a link to the site's own production origin: if that is
 * unreachable, the deployment is broken, and that is worth failing on.
 *
 *   node scripts/check-external-links.mjs [dist-dir]
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const DIST = resolve(process.argv[2] ?? 'dist');
const OWN_ORIGIN = (process.env.DOCS_SITE ?? 'https://brown-dash-documentation.vercel.app').replace(/\/$/, '');
// Deliberately gentle. These are other people's servers, and a burst is the
// fastest way to be told 429 by a host that would otherwise have answered.
const CONCURRENCY = 4;
const TIMEOUT_MS = 15_000;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push('/' + relative(DIST, full).split(sep).join('/'));
  }
  return out;
}

/**
 * Distinct outbound URLs, with one page that cites each.
 *
 * Deduplicated hard: the source permalinks alone run to tens of thousands of
 * links across a handful of repositories, and checking each would be a denial
 * of service aimed at the people who host this project's own code. One request
 * per distinct URL, and blob permalinks are sampled rather than exhausted,
 * because they are all the same immutable commit on the same host.
 */
function collect() {
  const urls = new Map();
  const sampled = new Set();
  for (const file of walk(DIST).filter((entry) => entry.endsWith('.html'))) {
    const html = readFileSync(join(DIST, file.slice(1)), 'utf8');
    for (const match of html.matchAll(/<a\b[^>]*\shref="(https?:\/\/[^"]+)"/g)) {
      const href = match[1].replace(/#.*$/, '');
      if (/^https?:\/\/(localhost|127\.0\.0\.1)/.test(href)) continue;
      // Source permalinks and per-page edit links are thousands of URLs on one
      // host, differing only in a path. One probe per repository and ref tells
      // you whether the host and the ref are alive, which is all these links
      // can collectively fail at, and it keeps the check from reading as an
      // attack on the people who host this project's own code.
      const family = /^(https:\/\/github\.com\/[^/]+\/[^/]+\/(?:blob|edit|tree|raw)\/[^/]+)\//.exec(href);
      if (family) {
        if (sampled.has(family[1])) continue;
        sampled.add(family[1]);
      }
      if (!urls.has(href)) urls.set(href, file);
    }
  }
  return [...urls.entries()].map(([url, page]) => ({ url, page }));
}

async function probe(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    // HEAD first: cheaper, and most hosts answer it. Some answer 403 or 405 to
    // a HEAD they would serve as a GET, so a non-2xx HEAD is retried.
    let response = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: controller.signal });
    if (!response.ok) {
      response = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal });
    }
    return { status: response.status, ok: response.ok };
  } catch (error) {
    return { status: 0, ok: false, error: error.name === 'AbortError' ? 'timed out' : error.message };
  } finally {
    clearTimeout(timer);
  }
}

const targets = collect();
console.log(`Checking ${targets.length} distinct outbound links from ${DIST}`);

const results = [];
let cursor = 0;
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (cursor < targets.length) {
      const target = targets[cursor++];
      results.push({ ...target, ...(await probe(target.url)) });
    }
  })
);

const unreachable = results.filter((result) => !result.ok);
// GitHub answers 404, not 403, for a repository the caller cannot see, so a
// private repository is indistinguishable from a deleted one over HTTP. Dash's
// own source repository is private, and reporting its permalinks as rot every
// week would train everyone to skim past this report. They are separated and
// labelled instead, which is also what the site says under "who can open a
// source link".
const restricted = unreachable.filter((result) => result.status === 404 && /^https:\/\/github\.com\/brown-dash\/Dash-Web\b/.test(result.url));
const failures = unreachable.filter((result) => !restricted.includes(result)).sort((a, b) => a.url.localeCompare(b.url));
const ownFailures = failures.filter((result) => result.url.startsWith(`${OWN_ORIGIN}/`) || result.url === OWN_ORIGIN);

if (restricted.length) {
  console.log(`\n### Not publicly visible: ${restricted.length}`);
  console.log('    Expected. These point into a repository that is private, which GitHub reports as 404 to an anonymous caller.');
  for (const result of restricted.sort((a, b) => a.url.localeCompare(b.url))) console.log(`    404  ${result.url}`);
}

if (failures.length) {
  console.log(`\n### Unreachable: ${failures.length} of ${results.length - restricted.length}`);
  for (const result of failures) {
    console.log(`    ${result.status || result.error}  ${result.url}`);
    console.log(`        cited by ${result.page}`);
  }
} else {
  console.log(`\nEvery one of the ${results.length - restricted.length} publicly reachable links answered.`);
}

if (ownFailures.length) {
  console.log(`\nFailing because ${ownFailures.length} of these are this site's own pages, which is a deployment problem rather than link rot.`);
  process.exit(1);
}

console.log(
  '\nReport only: a third-party link that stops answering is recorded here, not turned into a red build. ' +
    'Fix the ones this repository owns; for the rest, decide whether to update or drop the citation.'
);
