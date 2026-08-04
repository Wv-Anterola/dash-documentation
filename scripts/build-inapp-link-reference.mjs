/**
 * Builds the inventory of links from Dash back into this documentation.
 *
 * Dash ships help links: a question mark in the sharing dialog, an info button
 * in the image editor, a "Help..." entry in every document's right-click menu.
 * Each one opens a URL that was written when this site was a Jekyll build with
 * flat permalinks. The site has since been restructured, and nothing in either
 * repository checks that those URLs still land anywhere.
 *
 * That is a failure mode documentation sets have and rarely measure: the links
 * *into* the docs rot silently, because they live in the other codebase and the
 * person editing a page never sees them. This generator finds every such URL in
 * Dash-Web, resolves it against this site's own page list and redirect table,
 * and records where a user actually ends up, including whether the fragment
 * they were sent to still exists on the target page.
 *
 * Generation fails when a link cannot be classified at all. It does *not* fail
 * on a broken link: a broken link is a finding to publish, not a reason to stop
 * publishing. The count is asserted in the tests instead, so a regression is
 * visible without hiding the current state.
 */
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import sourceReference from '../src/data/generated/source-reference.json' with { type: 'json' };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.resolve(process.env.DASH_SOURCE_ROOT ?? path.join(root, '..', 'Dash-Web'));
const baseline = sourceReference.repository.baselineTip;
const remote = sourceReference.repository.remote.replace(/^git@github\.com:/, 'https://github.com/').replace(/\.git$/, '');

function git(...args) {
  return execFileSync('git', ['-c', `safe.directory=${sourceRoot.replaceAll('\\', '/')}`, '-C', sourceRoot, ...args], {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    windowsHide: true,
  });
}

const sourceUrl = (file, line) => `${remote}/blob/${baseline}/${file}#L${line}`;

/* ------------------------------------------------------------------ *
 * This site's own route table
 * ------------------------------------------------------------------ */

const configText = await readFile(path.join(root, 'astro.config.mjs'), 'utf8');
const redirectBlock = /redirects:\s*{([\s\S]*?)\n {2}},/.exec(configText)?.[1];
if (!redirectBlock) throw new Error('astro.config.mjs no longer exposes a parseable redirects table');
const redirects = new Map(
  [...redirectBlock.matchAll(/'([^']+)':\s*'([^']+)'/g)].map((match) => [match[1], match[2]])
);

/** Every page slug in the content collection, as a site path. */
async function collectPages(dir, prefix = '') {
  const pages = new Map();
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      for (const [key, value] of await collectPages(path.join(dir, entry.name), `${prefix}${entry.name}/`)) pages.set(key, value);
      continue;
    }
    if (!/\.mdx?$/.test(entry.name)) continue;
    const slug = entry.name.replace(/\.mdx?$/, '').toLowerCase();
    const route = slug === 'index' ? `/${prefix}` : `/${prefix}${slug}/`;
    const text = await readFile(path.join(dir, entry.name), 'utf8');
    pages.set(route, {
      route,
      file: path.posix.join('src/content/docs', `${prefix}${entry.name}`),
      title: /^title:\s*(.+)$/m.exec(text)?.[1]?.replace(/^["']|["']$/g, '') ?? slug,
      anchors: headingAnchors(text),
    });
  }
  return pages;
}

/**
 * The fragment identifiers a page publishes. Starlight slugs headings the
 * GitHub way, and the generated components add their own ids, so both are
 * collected: markdown headings from the body, explicit ids from any `id="…"`.
 */
function headingAnchors(text) {
  const anchors = new Set();
  for (const match of text.matchAll(/^#{2,6}\s+(.+?)\s*$/gm)) {
    anchors.add(
      match[1]
        .replace(/`([^`]*)`/g, '$1')
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/<[^>]*>/g, '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s-]/gu, '')
        .trim()
        .replace(/\s+/g, '-')
    );
  }
  for (const match of text.matchAll(/\bid="([^"]+)"/g)) anchors.add(match[1]);
  return [...anchors].filter(Boolean);
}

const pages = await collectPages(path.join(root, 'src', 'content', 'docs'));

/**
 * Resolve one old-style path the way a visitor would experience it.
 *
 * Astro is configured with `trailingSlash: 'always'`, so a path without a
 * trailing slash reaches its page only because the host adds one. That is worth
 * distinguishing from a path that resolves on its own.
 */
function resolveRoute(rawPath) {
  const slashed = rawPath.endsWith('/') ? rawPath : `${rawPath}/`;
  const needsSlash = !rawPath.endsWith('/');
  if (pages.has(slashed)) return { status: needsSlash ? 'needs-trailing-slash' : 'direct', target: slashed, hops: [] };
  if (redirects.has(slashed)) {
    const target = redirects.get(slashed);
    if (pages.has(target)) return { status: needsSlash ? 'needs-trailing-slash' : 'redirect', target, hops: [slashed] };
    return { status: 'redirect-to-nowhere', target, hops: [slashed] };
  }
  return { status: 'unresolved', target: '', hops: [] };
}

/* ------------------------------------------------------------------ *
 * Reviewed surfaces: what the user pressed to open the link
 * ------------------------------------------------------------------ */

const surfaceContracts = [
  {
    file: 'src/client/views/nodes/DocumentView.tsx',
    surface: 'Document right-click menu, Help entry',
    plain: 'Every document’s right-click menu ends with Help, and for eight document types that submenu offers a link to this site for that type.',
  },
  {
    file: 'src/client/views/topbar/TopBar.tsx',
    surface: 'Top bar, Help menu',
    plain: 'The Documentation entry in the top bar Help menu, which opens the site root.',
  },
  {
    file: 'src/client/util/SharingManager.tsx',
    surface: 'Sharing dialog, question icon',
    plain: 'The question mark beside the sharing information in the share dialog.',
  },
  {
    file: 'src/client/views/PropertiesView.tsx',
    surface: 'Properties panel, section info icons',
    plain: 'Small info icons beside properties panel sections, which open the matching guide.',
  },
  {
    file: 'src/client/views/nodes/trails/PresBox.tsx',
    surface: 'Trail properties, info icon',
    plain: 'The info icon in the trail slide properties, which points at the slide customization section.',
  },
  {
    file: 'src/client/views/nodes/imageEditor/GenerativeFillButtons.tsx',
    surface: 'Image editor, generative fill toolbar',
    plain: 'The Open Documentation button beside the generative fill controls.',
  },
  {
    file: 'src/client/views/nodes/imageEditor/ImageEditorButtons.tsx',
    surface: 'Image editor, main toolbar',
    plain: 'The Open Documentation button on the image editor toolbar.',
  },
];

/* ------------------------------------------------------------------ *
 * Find every documentation URL in the client
 * ------------------------------------------------------------------ */

const needle = 'Dash-Documentation';
const listing = git('grep', '-l', '-e', needle, baseline, '--', 'src');
const files = listing
  .split(/\r?\n/)
  .filter(Boolean)
  .map((entry) => entry.slice(entry.indexOf(':') + 1))
  .filter((file) => /\.tsx?$/.test(file));

const failures = [];
const links = [];

function enclosingName(node, sourceFile) {
  const parts = [];
  for (let cursor = node.parent; cursor; cursor = cursor.parent) {
    if (ts.isClassDeclaration(cursor) && cursor.name) parts.unshift(cursor.name.text);
    else if ((ts.isMethodDeclaration(cursor) || ts.isPropertyDeclaration(cursor)) && cursor.name && parts.length < 2) parts.unshift(cursor.name.getText(sourceFile));
    else if (ts.isVariableDeclaration(cursor) && ts.isIdentifier(cursor.name) && parts.length < 2) parts.unshift(cursor.name.text);
  }
  return [...new Set(parts)].slice(-2).join('.');
}

/** Every line in a file that mentions the documentation, 1-indexed. */
function mentionLines(text) {
  return text
    .split(/\r?\n/)
    .map((line, index) => (line.includes(needle) ? index + 1 : 0))
    .filter(Boolean);
}

for (const file of files) {
  const text = git('show', `${baseline}:${file}`);
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const contract = surfaceContracts.find((entry) => entry.file === file);
  if (!contract) failures.push(`${file} links to the documentation but has no reviewed surface description`);

  const visit = (node) => {
    if (ts.isStringLiteralLike(node) && node.text.includes(needle)) {
      const position = node.getStart(sourceFile);
      const line = sourceFile.getLineAndCharacterOfPosition(position).line + 1;
      let url;
      try {
        url = new URL(node.text);
      } catch {
        failures.push(`${file}:${line} holds an unparseable documentation URL: ${node.text}`);
        ts.forEachChild(node, visit);
        return;
      }
      const sitePath = url.pathname.replace(/^\/Dash-Documentation/, '') || '/';
      const fragment = url.hash.replace(/^#/, '');
      const resolution = resolveRoute(sitePath);
      const page = resolution.target ? pages.get(resolution.target) : undefined;
      const fragmentStatus = !fragment ? 'none' : page?.anchors.includes(fragment) ? 'present' : 'missing';
      links.push({
        id: `link-${links.length + 1}`,
        url: node.text,
        host: url.host,
        requested: sitePath,
        fragment,
        fragmentStatus,
        status: resolution.status,
        target: resolution.target,
        targetTitle: page?.title ?? '',
        via: resolution.hops,
        reachable: true,
        surface: contract?.surface ?? '',
        surfacePlain: contract?.plain ?? '',
        owner: enclosingName(node, sourceFile),
        source: { file, line, url: sourceUrl(file, line) },
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  // A URL inside a comment never reaches the AST, so the parse alone would
  // quietly under-count the file. Anything the raw text mentions on a line the
  // parse did not produce a link for is recorded as present but unreachable,
  // which is the difference between "Dash has no such link" and "Dash has one
  // and it is switched off".
  const parsedLines = new Set(links.filter((link) => link.source.file === file).map((link) => link.source.line));
  for (const line of mentionLines(text)) {
    if (parsedLines.has(line)) continue;
    const raw = /(https?:\/\/[^'"`\s)]+)/.exec(text.split(/\r?\n/)[line - 1])?.[1] ?? '';
    const sitePath = raw ? new URL(raw).pathname.replace(/^\/Dash-Documentation/, '') || '/' : '';
    const resolution = sitePath ? resolveRoute(sitePath) : { status: 'unresolved', target: '', hops: [] };
    links.push({
      id: `link-${links.length + 1}`,
      url: raw,
      host: raw ? new URL(raw).host : '',
      requested: sitePath,
      fragment: '',
      fragmentStatus: 'none',
      status: resolution.status,
      target: resolution.target,
      targetTitle: resolution.target ? (pages.get(resolution.target)?.title ?? '') : '',
      via: resolution.hops,
      reachable: false,
      surface: contract?.surface ?? '',
      surfacePlain: contract?.plain ?? '',
      owner: 'commented out',
      source: { file, line, url: sourceUrl(file, line) },
    });
  }
}

for (const contract of surfaceContracts) {
  if (!links.some((link) => link.source.file === contract.file)) {
    failures.push(`${contract.file} no longer links to the documentation; drop its reviewed surface`);
  }
}
if (!links.length) failures.push('No documentation links were found in Dash-Web');
if (failures.length) throw new Error(`The in-app link inventory drifted:\n  ${[...new Set(failures)].join('\n  ')}`);

links.sort((a, b) => a.source.file.localeCompare(b.source.file) || a.source.line - b.source.line);

const live = links.filter((link) => link.reachable);
const distinct = new Set(live.map((link) => `${link.requested}${link.fragment ? `#${link.fragment}` : ''}`));

const output = {
  schemaVersion: 1,
  generatedAt: sourceReference.generatedAt,
  repository: { remote: sourceReference.repository.remote, baseline: sourceReference.repository.baselineTip },
  methodology: {
    discovery: 'Every string literal in the Dash-Web client containing "Dash-Documentation", found with the TypeScript compiler',
    resolution: 'Each path is resolved against this site’s own page list and the redirect table in astro.config.mjs',
    fragments: 'Fragments are checked against the heading slugs and explicit element ids of the resolved page',
    trailingSlash: 'The site is built with trailingSlash: always, so a link without one is recorded separately: it reaches the page only because the host adds the slash',
    commented:
      'A URL inside a comment never reaches the parse tree, so the raw text is compared against the parsed lines and any difference is recorded as present but unreachable',
    driftRule: 'Generation fails when a file links to the documentation without a reviewed surface, when a reviewed surface stops linking, or when a URL cannot be parsed. A broken link is published, not suppressed.',
  },
  summary: {
    links: links.length,
    reachable: live.length,
    distinctTargets: distinct.size,
    files: new Set(links.map((link) => link.source.file)).size,
    surfaces: surfaceContracts.length,
    direct: live.filter((link) => link.status === 'direct').length,
    viaRedirect: live.filter((link) => link.status === 'redirect').length,
    needsTrailingSlash: live.filter((link) => link.status === 'needs-trailing-slash').length,
    unresolved: live.filter((link) => link.status === 'unresolved' || link.status === 'redirect-to-nowhere').length,
    missingFragments: live.filter((link) => link.fragmentStatus === 'missing').length,
  },
  redirectTableSize: redirects.size,
  links,
};

const outputPath = path.join(root, 'src', 'data', 'generated', 'inapp-doc-links.json');
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

console.log(
  `Wrote ${outputPath}\n` +
    `${output.summary.links} documentation links in ${output.summary.files} client files ` +
    `(${output.summary.reachable} reachable, ${output.summary.distinctTargets} distinct targets); ` +
    `${output.summary.direct} land directly, ${output.summary.viaRedirect} via a redirect, ` +
    `${output.summary.needsTrailingSlash} depend on the host adding a trailing slash, ` +
    `${output.summary.unresolved} do not resolve, ${output.summary.missingFragments} land on a missing fragment.`
);
