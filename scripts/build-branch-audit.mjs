/**
 * Build a reproducible, branch-aware evidence index for the Dash codebase.
 *
 * This deliberately does not check branches out. The Dash-Web working tree may
 * contain a researcher's local work, so the audit reads branch-tip trees and
 * blobs directly from Git's object database.
 *
 * "Read every branch" has a precise meaning here:
 *   1. enumerate every local and origin branch tip;
 *   2. enumerate every code blob under src/ at every tip;
 *   3. de-duplicate inherited blobs by Git SHA;
 *   4. read every unique blob once through `git cat-file --batch`;
 *   5. attribute each branch's delta from its merge-base with origin/master.
 *
 * Run:
 *   npm run audit:branches
 *   DASH_REPO=C:\path\to\Dash-Web npm run audit:branches
 */
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const docsRoot = resolve(here, '..');
const dashRoot = resolve(process.env.DASH_REPO ?? resolve(docsRoot, '..', 'Dash-Web'));
const outputPath = resolve(docsRoot, 'src', 'data', 'generated', 'branch-audit.json');
const baseline = process.env.DASH_BASELINE ?? 'origin/master';

const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.css', '.scss', '.sass', '.less',
  '.html', '.htm', '.vue', '.svelte',
  '.json', '.graphql', '.gql',
]);

const LANGUAGE_BY_EXTENSION = {
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript JSX',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript JSX',
  '.mjs': 'JavaScript modules',
  '.cjs': 'CommonJS',
  '.css': 'CSS',
  '.scss': 'SCSS',
  '.sass': 'Sass',
  '.less': 'Less',
  '.html': 'HTML',
  '.htm': 'HTML',
  '.vue': 'Vue',
  '.svelte': 'Svelte',
  '.json': 'JSON',
  '.graphql': 'GraphQL',
  '.gql': 'GraphQL',
};

const AREA_RULES = [
  ['Document model', /(^|\/)(Document|Fields|FieldSymbols|ClientUtils|Serialization|DocServer|DocumentManager)(\/|\.|$)|documenttype|docmodel/i],
  ['Collection views', /CollectionView|collection.*view|Freeform|SchemaView|Stacking|TreeView|Timeline|Masonry|Kanban|CalendarView/i],
  ['Links, annotations, and trails', /Link|Annotation|Anchor|Trail|Presentation|Marquee|Ink/i],
  ['Agent and AI', /Agent|OpenAI|GPT|LLM|Prompt|ToolRegistry|tutorial.*agent|provenance/i],
  ['Media and generative tools', /Image|Video|Audio|Webcam|DataViz|Chart|Map|Simulation|Equation|CAD|Mesh|Diagram/i],
  ['Search, import, and export', /Search|Import|Export|Upload|Download|PDF|Webpage|HTML/i],
  ['Server, storage, and accounts', /(^|\/)(server|Server|stores|auth|routes|api)(\/|$)|Mongo|Socket|Database|User|Sharing|Permission/i],
  ['Desktop and build', /electron|webpack|package\.json|Docker|Ollama|desktop|build/i],
  ['Workspace interface', /(^|\/)(views|components)(\/|$)|Menu|Toolbar|Sidebar|Dashboard|Homepage|Novice/i],
  ['Tests and evaluation', /(^|\/)(__tests__|tests?|e2e|evaluation|evals?)(\/|$)|\.(test|spec)\./i],
];

const FEATURE_SIGNALS = [
  ['OpenAI', /\bOpenAI\b|api\.openai\.com|gpt-[a-z0-9.-]+/i],
  ['local models / Ollama', /\bOllama\b|localhost:11434|local model/i],
  ['MongoDB', /\bMongo(Store|Client|DB)?\b|mongodb/i],
  ['WebSockets', /\b(SocketIO|socket\.io|WebSocket)\b/i],
  ['Mapbox', /\bmapbox\b/i],
  ['Three.js / 3D', /\bthree\b|THREE\.|react-three/i],
  ['D3 / charts', /\bd3\b|vega|chart\.js|recharts|plotly/i],
  ['media generation', /generate(Image|Video|Audio)|text.to.(image|video)|image generation/i],
  ['agent tools', /ToolRegistry|processAction|AgentTool|createNewTool|tool[_ -]?call/i],
  ['undo / provenance', /UndoManager|undoBatch|provenance|ActionProvenance/i],
  ['collaboration', /Collaboration|presence|multiplayer|sharing|permissions/i],
  ['import / export', /\b(import|export|download|upload)\b/i],
  ['trails / presentations', /BranchingTrail|PresentationView|TrailManager|Slideshow/i],
  ['search', /SearchUtil|searchDocs|full.?text|Pagefind/i],
  ['tests', /\b(describe|test|it)\s*\(|Playwright|Jest|Mocha/i],
];

const extensionOf = (path) => {
  const match = path.toLowerCase().match(/(\.[a-z0-9]+)$/);
  return match?.[1] ?? '';
};

const run = (args, options = {}) =>
  execFileSync('git', ['-c', `safe.directory=${dashRoot.replaceAll('\\', '/')}`, ...args], {
    cwd: dashRoot,
    encoding: options.encoding ?? 'utf8',
    maxBuffer: 512 * 1024 * 1024,
    windowsHide: true,
    ...options,
  });

const tryRun = (args) => {
  try {
    return run(args).trim();
  } catch {
    return '';
  }
};

const parseBranchRefs = () => {
  const raw = run([
    'for-each-ref',
    '--format=%(refname)%09%(refname:short)%09%(objectname)%09%(authordate:iso-strict)%09%(authorname)%09%(subject)',
    'refs/heads',
    'refs/remotes/origin',
  ]);
  const rows = raw.split(/\r?\n/).filter(Boolean).map((line) => {
    const fields = line.split('\t');
    const fullName = fields[0].trim();
    const name = fields[1].trim();
    if (!name || name === 'origin/HEAD') return null;
    const scope = fullName.startsWith('refs/heads/') ? 'local' : 'origin';
    const shortName = scope === 'origin' ? name.replace(/^origin\//, '') : name;
    return {
      fullName,
      name,
      shortName,
      displayName: scope === 'local' ? `local/${shortName}` : shortName,
      scope,
      tip: fields[2],
      authoredAt: fields[3],
      author: fields[4],
      subject: fields.slice(5).join(' ').replace(/\s+/g, ' ').trim(),
    };
  }).filter(Boolean);
  return rows.sort(
    (a, b) => a.shortName.localeCompare(b.shortName) || a.scope.localeCompare(b.scope)
  );
};

const listTree = (ref, pathspec = 'src') => {
  const raw = run(['ls-tree', '-r', '-z', ref, '--', pathspec], { encoding: 'buffer' });
  return raw
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .map((row) => {
      const match = row.match(/^(\d+)\s+(\w+)\s+([0-9a-f]+)\t(.+)$/);
      if (!match) return null;
      return { mode: match[1], type: match[2], sha: match[3], path: match[4] };
    })
    .filter(Boolean);
};

const readBlobs = (shas) => {
  if (shas.length === 0) return new Map();
  const child = spawnSync(
    'git',
    ['-c', `safe.directory=${dashRoot.replaceAll('\\', '/')}`, 'cat-file', '--batch'],
    {
    cwd: dashRoot,
    input: `${shas.join('\n')}\n`,
    encoding: null,
    maxBuffer: 1024 * 1024 * 1024,
    windowsHide: true,
    }
  );
  if (child.status !== 0) {
    throw new Error(`git cat-file failed: ${child.stderr?.toString('utf8')}`);
  }

  const output = child.stdout;
  const blobs = new Map();
  let offset = 0;
  while (offset < output.length) {
    const headerEnd = output.indexOf(10, offset);
    if (headerEnd < 0) break;
    const header = output.subarray(offset, headerEnd).toString('utf8');
    offset = headerEnd + 1;
    const match = header.match(/^([0-9a-f]+)\s+blob\s+(\d+)$/);
    if (!match) throw new Error(`Unexpected cat-file header: ${header}`);
    const size = Number(match[2]);
    const content = output.subarray(offset, offset + size);
    blobs.set(match[1], content);
    offset += size + 1;
  }
  return blobs;
};

const parseDiff = (base, ref) => {
  if (!base) return [];
  const raw = run(['diff', '--name-status', '-z', '--find-renames', `${base}..${ref}`, '--', 'src']);
  const fields = raw.split('\0').filter(Boolean);
  const entries = [];
  for (let i = 0; i < fields.length;) {
    const status = fields[i++];
    if (status.startsWith('R') || status.startsWith('C')) {
      entries.push({ status, oldPath: fields[i++], path: fields[i++] });
    } else {
      entries.push({ status, path: fields[i++] });
    }
  }
  return entries;
};

const areasForPaths = (paths) =>
  AREA_RULES.filter(([, pattern]) => paths.some((path) => pattern.test(path))).map(([name]) => name);

const extractSymbols = (text) => {
  const names = new Set();
  const patterns = [
    /\b(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/g,
    /\b(?:export\s+)?interface\s+([A-Za-z_$][\w$]*)/g,
    /\b(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g,
    /\b(?:export\s+)?enum\s+([A-Za-z_$][\w$]*)/g,
    /\bexport\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) names.add(match[1]);
  }
  return [...names];
};

const main = () => {
  const baselineTip = tryRun(['rev-parse', baseline]);
  if (!baselineTip) throw new Error(`Cannot resolve ${baseline} in ${dashRoot}`);

  const branches = parseBranchRefs();
  const branchTrees = new Map();
  const branchAssets = new Map();
  const blobPaths = new Map();

  for (const branch of branches) {
    const fullTree = listTree(branch.name);
    const tree = fullTree.filter((entry) => CODE_EXTENSIONS.has(extensionOf(entry.path)));
    branchTrees.set(branch.name, tree);
    branchAssets.set(
      branch.name,
      fullTree
        .map((entry) => entry.path)
        .filter((path) => /\.(png|jpe?g|gif|webp|svg|mp4|webm)$/i.test(path))
        .slice(0, 80)
    );
    for (const entry of tree) {
      if (!blobPaths.has(entry.sha)) blobPaths.set(entry.sha, new Set());
      blobPaths.get(entry.sha).add(entry.path);
    }
  }

  const blobShas = [...blobPaths.keys()].sort();
  const blobs = readBlobs(blobShas);
  if (blobs.size !== blobShas.length) {
    throw new Error(`Expected ${blobShas.length} blobs, read ${blobs.size}`);
  }

  const blobFacts = new Map();
  const languageTotals = {};
  let totalBytes = 0;
  let totalLines = 0;

  for (const sha of blobShas) {
    const content = blobs.get(sha);
    const text = content.toString('utf8');
    const representativePath = [...blobPaths.get(sha)].sort()[0];
    const extension = extensionOf(representativePath);
    const language = LANGUAGE_BY_EXTENSION[extension] ?? extension;
    const lines = text.length === 0 ? 0 : text.split(/\r?\n/).length;
    const signals = FEATURE_SIGNALS.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
    const symbols = extractSymbols(text);
    blobFacts.set(sha, { bytes: content.length, lines, language, signals, symbols });
    totalBytes += content.length;
    totalLines += lines;
    languageTotals[language] ??= { blobs: 0, bytes: 0, lines: 0 };
    languageTotals[language].blobs += 1;
    languageTotals[language].bytes += content.length;
    languageTotals[language].lines += lines;
  }

  const branchRows = [];
  for (const branch of branches) {
    const counts = tryRun(['rev-list', '--left-right', '--count', `${baseline}...${branch.name}`])
      .split(/\s+/)
      .map(Number);
    const behindBaseline = counts[0] || 0;
    const aheadOfBaseline = counts[1] || 0;
    const containedInBaseline = aheadOfBaseline === 0;
    const mergeBase =
      containedInBaseline
        ? branch.tip
        : behindBaseline === 0
          ? baselineTip
          : tryRun(['merge-base', baseline, branch.name]);

    const diff = parseDiff(mergeBase, branch.name);
    const changedPaths = diff.map((entry) => entry.path);
    const sourceTree = branchTrees.get(branch.name);
    const shaByPath = new Map(sourceTree.map((entry) => [entry.path, entry.sha]));
    const changedFacts = changedPaths
      .map((path) => blobFacts.get(shaByPath.get(path)))
      .filter(Boolean);
    const signalCounts = {};
    const symbolNames = new Set();
    for (const facts of changedFacts) {
      for (const signal of facts.signals) signalCounts[signal] = (signalCounts[signal] ?? 0) + 1;
      for (const symbol of facts.symbols) symbolNames.add(symbol);
    }

    const assets = branchAssets.get(branch.name);

    branchRows.push({
      ...branch,
      mergeBase,
      behindBaseline,
      aheadOfBaseline,
      containedInBaseline,
      sourceFileCount: sourceTree.length,
      changedSourceFileCount: changedPaths.length,
      changeSummary: {
        added: diff.filter((entry) => entry.status.startsWith('A')).length,
        modified: diff.filter((entry) => entry.status.startsWith('M')).length,
        deleted: diff.filter((entry) => entry.status.startsWith('D')).length,
        renamed: diff.filter((entry) => entry.status.startsWith('R')).length,
      },
      architectureAreas: areasForPaths(changedPaths),
      featureSignals: Object.entries(signalCounts)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([name, files]) => ({ name, files })),
      significantSymbols: [...symbolNames].sort().slice(0, 80),
      changedPaths,
      visualAssetCount: assets.length,
      visualAssets: assets,
    });
  }

  const auditDigest = createHash('sha256')
    .update(branchRows.map((branch) => `${branch.name}:${branch.tip}`).join('\n'))
    .update('\n')
    .update(blobShas.join('\n'))
    .digest('hex');

  const result = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    repository: {
      pathHint: 'Dash-Web',
      remote: tryRun(['remote', 'get-url', 'origin']),
      baseline,
      baselineTip,
    },
    methodology: {
      scope: 'Every code blob under src/ reachable from every local and origin branch tip.',
      deduplication: 'Identical inherited code is read once by Git blob SHA; branch deltas remain attributed to each branch.',
      branchCount: branchRows.length,
      localBranchCount: branchRows.filter((branch) => branch.scope === 'local').length,
      originBranchCount: branchRows.filter((branch) => branch.scope === 'origin').length,
      branchTipSourceFileReferences: [...branchTrees.values()].reduce((sum, tree) => sum + tree.length, 0),
      uniqueCodeBlobsExpected: blobShas.length,
      uniqueCodeBlobsRead: blobs.size,
      totalUniqueBytesRead: totalBytes,
      totalUniqueLinesRead: totalLines,
      languageTotals,
      auditDigest,
    },
    branches: branchRows,
  };

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(
    [
      `Wrote ${outputPath}`,
      `Branches: ${result.methodology.branchCount}`,
      `Branch-tip source references: ${result.methodology.branchTipSourceFileReferences}`,
      `Unique code blobs read: ${result.methodology.uniqueCodeBlobsRead}`,
      `Unique lines read: ${result.methodology.totalUniqueLinesRead.toLocaleString()}`,
      `Digest: ${auditDigest}`,
    ].join('\n') + '\n'
  );
};

main();
