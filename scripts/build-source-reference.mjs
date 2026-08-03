/**
 * Build the semantic, immutable source ledger used by the technical reference.
 *
 * Unlike the branch-tip audit, this walks every object reachable from every
 * local/origin ref. Each blob is classified, source blobs are parsed once by
 * SHA, and origin/master is projected into modules, symbols, registries, and
 * branch-level semantic deltas.
 */
import { createHash } from 'node:crypto';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import {
  PARSED_TS_EXTENSIONS,
  SOURCE_EXTENSIONS,
  classifyPath,
  extensionOf,
  parseJsonConfiguration,
  parseTypeScriptBlob,
  sourceUrl,
} from './lib/source-analysis.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const docsRoot = resolve(here, '..');
const dashRoot = resolve(process.env.DASH_REPO ?? resolve(docsRoot, '..', 'Dash-Web'));
const outputRoot = resolve(docsRoot, 'src', 'data', 'generated');
const referencePath = resolve(outputRoot, 'source-reference.json');
const moduleReferencePath = resolve(outputRoot, 'source-modules.json');
const branchReferencePath = resolve(outputRoot, 'semantic-branches.json');
const inventoryPath = resolve(outputRoot, 'source-inventory.json');
const historyPath = resolve(outputRoot, 'historical-symbols.json');
const historyArchivePath = resolve(docsRoot, 'public', 'assets', 'data', 'historical-symbols.json.gz');
const pythonParser = resolve(here, 'lib', 'parse-python-ast.py');
const typescriptBatchParser = resolve(here, 'lib', 'parse-typescript-git-batch.mjs');
const baseline = process.env.DASH_BASELINE ?? 'origin/master';

const run = (args, options = {}) =>
  execFileSync('git', ['-c', `safe.directory=${dashRoot.replaceAll('\\', '/')}`, ...args], {
    cwd: dashRoot,
    encoding: options.encoding ?? 'utf8',
    maxBuffer: 1024 * 1024 * 1024,
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

const parseRefs = () => {
  const raw = run([
    'for-each-ref',
    '--format=%(refname)%09%(refname:short)%09%(objectname)%09%(authordate:iso-strict)%09%(authorname)%09%(subject)',
    'refs/heads',
    'refs/remotes/origin',
  ]);
  return raw.split(/\r?\n/).filter(Boolean).map((line) => {
    const fields = line.split('\t');
    const fullName = fields[0];
    const name = fields[1];
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
  }).filter(Boolean).sort(
    (a, b) => a.shortName.localeCompare(b.shortName) || a.scope.localeCompare(b.scope)
  );
};

const listTree = (ref) => {
  const raw = run(['ls-tree', '-r', '-z', ref], { encoding: 'buffer' });
  return raw.toString('utf8').split('\0').filter(Boolean).map((row) => {
    const match = row.match(/^(\d+)\s+(\w+)\s+([0-9a-f]+)\t([\s\S]+)$/);
    if (!match) throw new Error(`Cannot parse ls-tree row: ${row}`);
    return { mode: match[1], type: match[2], sha: match[3], path: match[4] };
  });
};

const batchCheck = (shas) => {
  const facts = new Map();
  const chunkSize = 20_000;
  for (let index = 0; index < shas.length; index += chunkSize) {
    const chunk = shas.slice(index, index + chunkSize);
    const child = spawnSync(
      'git',
      ['-c', `safe.directory=${dashRoot.replaceAll('\\', '/')}`, 'cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)'],
      {
        cwd: dashRoot,
        input: `${chunk.join('\n')}\n`,
        encoding: 'utf8',
        maxBuffer: 256 * 1024 * 1024,
        windowsHide: true,
      }
    );
    if (child.status !== 0) throw new Error(child.stderr || 'git cat-file --batch-check failed');
    for (const line of child.stdout.split(/\r?\n/).filter(Boolean)) {
      const [sha, type, size] = line.split(' ');
      facts.set(sha, { type, size: Number(size) });
    }
  }
  return facts;
};

const readBlobs = (shas) => {
  const blobs = new Map();
  const chunkSize = 1200;
  for (let index = 0; index < shas.length; index += chunkSize) {
    const chunk = shas.slice(index, index + chunkSize);
    const child = spawnSync(
      'git',
      ['-c', `safe.directory=${dashRoot.replaceAll('\\', '/')}`, 'cat-file', '--batch'],
      {
        cwd: dashRoot,
        input: `${chunk.join('\n')}\n`,
        encoding: null,
        maxBuffer: 1024 * 1024 * 1024,
        windowsHide: true,
      }
    );
    if (child.status !== 0) throw new Error(child.stderr?.toString('utf8') || 'git cat-file failed');
    let offset = 0;
    while (offset < child.stdout.length) {
      const headerEnd = child.stdout.indexOf(10, offset);
      if (headerEnd < 0) break;
      const header = child.stdout.subarray(offset, headerEnd).toString('utf8');
      offset = headerEnd + 1;
      const match = header.match(/^([0-9a-f]+)\s+blob\s+(\d+)$/);
      if (!match) throw new Error(`Unexpected cat-file header: ${header}`);
      const size = Number(match[2]);
      blobs.set(match[1], child.stdout.subarray(offset, offset + size));
      offset += size + 1;
    }
  }
  return blobs;
};

const reachableObjects = (refs) => {
  const raw = run(['rev-list', '--objects', ...refs.map((ref) => ref.fullName)]);
  const paths = new Map();
  const shas = [];
  for (const line of raw.split(/\r?\n/).filter(Boolean)) {
    const space = line.indexOf(' ');
    const sha = space < 0 ? line : line.slice(0, space);
    const path = space < 0 ? '' : line.slice(space + 1);
    shas.push(sha);
    if (path && !paths.has(sha)) paths.set(sha, path);
  }
  return { shas: [...new Set(shas)], paths };
};

const parsePython = (records) => {
  if (records.length === 0) return [];
  const input = records.map((record) => JSON.stringify(record)).join('\n') + '\n';
  const child = spawnSync('python', [pythonParser], {
    input,
    cwd: docsRoot,
    encoding: 'utf8',
    maxBuffer: 512 * 1024 * 1024,
    windowsHide: true,
  });
  if (child.status !== 0) {
    return records.map((record) => ({
      sha: record.sha,
      path: record.path,
      symbols: [],
      calls: [],
      errors: [{ message: `Python AST process failed: ${child.stderr || child.status}` }],
    }));
  }
  return child.stdout.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
};

const parseTypeScriptBatch = (rows, mode = 'full') => {
  if (rows.length === 0) return [];
  return new Promise((resolveBatch) => {
    const child = spawn(process.execPath, [typescriptBatchParser, dashRoot], {
      cwd: docsRoot,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', (error) => {
      resolveBatch(rows.map((row) => ({
        sha: row.sha,
        path: row.path,
        symbols: [],
        errors: [{ message: `TypeScript batch parser failed: ${error.message}` }],
      })));
    });
    child.on('close', (status) => {
      if (status !== 0) {
        resolveBatch(rows.map((row) => ({
          sha: row.sha,
          path: row.path,
          symbols: [],
          errors: [{ message: `TypeScript batch parser failed: ${stderr || status}` }],
        })));
        return;
      }
      resolveBatch(stdout.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line)));
    });
    child.stdin.end(
      rows.map((row) => JSON.stringify({ sha: row.sha, path: row.path, mode })).join('\n') + '\n'
    );
  });
};

const prepareBatch = async (rows, mode) => {
  const pythonRows = rows.filter((row) => extensionOf(row.path) === '.py');
  const typeScriptRows = rows.filter((row) => extensionOf(row.path) !== '.py');
  const blobs = readBlobs(pythonRows.map((row) => row.sha));
  const pythonRecords = pythonRows.map((row) => ({
    sha: row.sha,
    path: row.path,
    text: blobs.get(row.sha).toString('utf8').toWellFormed(),
  }));
  const [typeScriptAnalyses, pythonAnalyses] = await Promise.all([
    parseTypeScriptBatch(typeScriptRows, mode),
    Promise.resolve(parsePython(pythonRecords)),
  ]);
  return { rows, analyses: [...typeScriptAnalyses, ...pythonAnalyses] };
};

const processParallelBatches = async (
  rows,
  batchSize,
  mode,
  consume,
  selectRows = (batch) => batch
) => {
  for (let index = 0; index < rows.length; index += batchSize * 2) {
    const batches = [
      rows.slice(index, index + batchSize),
      rows.slice(index + batchSize, index + batchSize * 2),
    ].filter((batch) => batch.length > 0);
    const results = await Promise.all(batches.map(async (batch) => {
      const prepared = await prepareBatch(selectRows(batch), mode);
      return { rows: batch, analyses: prepared.analyses };
    }));
    for (const result of results) consume(result);
    global.gc?.();
  }
};

const parseDiff = (base, ref) => {
  if (!base) return [];
  const fields = run(['diff', '--name-status', '-z', '--find-renames', `${base}..${ref}`])
    .split('\0').filter(Boolean);
  const rows = [];
  for (let index = 0; index < fields.length;) {
    const status = fields[index++];
    if (status.startsWith('R') || status.startsWith('C')) {
      rows.push({ status, oldPath: fields[index++], path: fields[index++] });
    } else {
      rows.push({ status, path: fields[index++] });
    }
  }
  return rows;
};

const sourceTree = (tree) =>
  tree.filter((entry) =>
    ['source', 'test', 'build-config'].includes(classifyPath(entry.path)) &&
    SOURCE_EXTENSIONS.has(extensionOf(entry.path))
  );

const symbolKey = (path, symbol) => `${path}::${symbol.qualifiedName}`;

const semanticDelta = (baseTree, tipTree, parsedBySha) => {
  const baseByPath = new Map(sourceTree(baseTree).map((entry) => [entry.path, entry.sha]));
  const tipByPath = new Map(sourceTree(tipTree).map((entry) => [entry.path, entry.sha]));
  const paths = [...new Set([...baseByPath.keys(), ...tipByPath.keys()])].sort();
  const added = [];
  const changed = [];
  const removed = [];
  const unreachable = [];
  for (const path of paths) {
    const baseAnalysis = parsedBySha.get(baseByPath.get(path));
    const tipAnalysis = parsedBySha.get(tipByPath.get(path));
    const before = new Map((baseAnalysis?.symbols ?? []).map((symbol) => [symbol.qualifiedName, symbol]));
    const after = new Map((tipAnalysis?.symbols ?? []).map((symbol) => [symbol.qualifiedName, symbol]));
    for (const [name, symbol] of after) {
      const previous = before.get(name);
      const row = { path, name, kind: symbol.kind };
      if (!previous) added.push(row);
      else if (previous.signature !== symbol.signature || previous.documentation !== symbol.documentation) {
        changed.push(row);
      }
    }
    for (const [name, symbol] of before) {
      if (!after.has(name)) removed.push({ path, name, kind: symbol.kind });
    }
    if (baseByPath.has(path) && !tipByPath.has(path)) unreachable.push(path);
  }
  return { added, changed, removed, unreachable };
};

const unique = (values) => [...new Set(values)].sort((a, b) => a.localeCompare(b));

const deriveRegistries = (modules) => {
  const allSymbols = modules.flatMap((module) => module.symbols.map((symbol) => ({ ...symbol, path: module.path, sourceUrl: symbol.sourceUrl })));
  const moduleText = new Map(modules.map((module) => [module.path, module.sourceText]));
  const enumMembers = (enumName) => {
    for (const module of modules) {
      const match = Object.entries(module.enums).find(([name]) => name === enumName || name.endsWith(`.${enumName}`));
      if (match) {
        return match[1].map((member) => ({
          ...member,
          path: module.path,
          sourceUrl: sourceUrl(module.remote, module.commit, module.path, member.line),
        }));
      }
    }
    return [];
  };

  const routes = [];
  const environmentVariables = [];
  const keybindings = [];
  const renderers = [];
  const scriptingGlobals = [];
  for (const module of modules) {
    const text = moduleText.get(module.path);
    for (const match of text.matchAll(/\.\s*(get|post|put|patch|delete|use)\s*\(\s*(['"`])([^'"`\r\n]+)\2/g)) {
      const line = text.slice(0, match.index).split(/\r?\n/).length;
      routes.push({ method: match[1].toUpperCase(), route: match[3], path: module.path, sourceUrl: sourceUrl(module.remote, module.commit, module.path, line) });
    }
    for (const match of text.matchAll(/(?:process\.env\.|process\.env\[['"])([A-Z][A-Z0-9_]+)/g)) {
      const line = text.slice(0, match.index).split(/\r?\n/).length;
      environmentVariables.push({ name: match[1], path: module.path, sourceUrl: sourceUrl(module.remote, module.commit, module.path, line) });
    }
    for (const match of text.matchAll(/(?:event|e)\.key\s*={2,3}\s*['"]([^'"]+)['"]/g)) {
      const line = text.slice(0, match.index).split(/\r?\n/).length;
      keybindings.push({ key: match[1], path: module.path, sourceUrl: sourceUrl(module.remote, module.commit, module.path, line) });
    }
    for (const match of text.matchAll(/(?:DocumentType\.([A-Za-z0-9_]+)[\s\S]{0,220}?\bview\s*:\s*([A-Za-z_$][\w$]*))/g)) {
      const line = text.slice(0, match.index).split(/\r?\n/).length;
      renderers.push({ documentType: match[1], renderer: match[2], path: module.path, sourceUrl: sourceUrl(module.remote, module.commit, module.path, line) });
    }
    for (const match of text.matchAll(
      /ScriptingGlobals\s*\.\s*add\s*\(\s*(?:(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|(['"`])([^'"`\r\n]+)\2|([A-Za-z_$][\w$]*))/g
    )) {
      const name = match[1] || match[3] || match[4];
      const line = text.slice(0, match.index).split(/\r?\n/).length;
      scriptingGlobals.push({ name, path: module.path, sourceUrl: sourceUrl(module.remote, module.commit, module.path, line) });
    }
  }

  const agentTools = allSymbols
    .filter((symbol) => /\/(?:tools?|agent)\//i.test(symbol.path) && symbol.exported && ['class', 'function', 'variable'].includes(symbol.kind))
    .map(({ name, kind, path, sourceUrl: link }) => ({ name, kind, path, sourceUrl: link }));
  const components = allSymbols
    .filter((symbol) => symbol.path.startsWith('packages/components/') && symbol.exported)
    .map(({ name, kind, signature, path, sourceUrl: link }) => ({ name, kind, signature, path, sourceUrl: link }));
  const workers = unique(modules.filter((module) => /(^|\/)workers?\//i.test(module.path) || /\.worker\./i.test(module.path)).map((module) => module.path));
  const electronBoundaries = unique(modules.filter((module) => /electron/i.test(module.path) || module.imports.some((specifier) => specifier === 'electron')).map((module) => module.path));

  const dedupe = (rows, key) => [...new Map(rows.map((row) => [key(row), row])).values()]
    .sort((a, b) => key(a).localeCompare(key(b)));
  return {
    documentTypes: enumMembers('DocumentType'),
    collectionViews: enumMembers('CollectionViewType'),
    renderers: dedupe(renderers, (row) => `${row.documentType}:${row.renderer}:${row.path}`),
    agentTools: dedupe(agentTools, (row) => `${row.name}:${row.path}`),
    scriptingGlobals: dedupe(scriptingGlobals, (row) => `${row.name}:${row.path}`),
    routes: dedupe(routes, (row) => `${row.method}:${row.route}:${row.path}`),
    environmentVariables: dedupe(environmentVariables, (row) => `${row.name}:${row.path}`),
    keybindings: dedupe(keybindings, (row) => `${row.key}:${row.path}`),
    components: dedupe(components, (row) => `${row.name}:${row.path}`),
    workers,
    electronBoundaries,
  };
};

const main = async () => {
  const startedAt = Date.now();
  const baselineTip = tryRun(['rev-parse', baseline]);
  if (!baselineTip) throw new Error(`Cannot resolve ${baseline} in ${dashRoot}`);
  const remote = tryRun(['remote', 'get-url', 'origin']);
  const refs = parseRefs();
  const baselineTree = listTree(baseline);
  const reachable = reachableObjects(refs);
  const objectFacts = batchCheck(reachable.shas);
  const reachableBlobRows = reachable.shas
    .filter((sha) => objectFacts.get(sha)?.type === 'blob')
    .map((sha) => {
      const path = reachable.paths.get(sha) ?? '';
      const classification = path ? classifyPath(path) : 'artifact';
      const extension = extensionOf(path);
      const parser = PARSED_TS_EXTENSIONS.has(extension)
        ? 'typescript'
        : extension === '.py'
          ? 'python-ast'
          : SOURCE_EXTENSIONS.has(extension)
            ? 'unsupported'
            : 'not-applicable';
      return { sha, path, size: objectFacts.get(sha).size, classification, parser };
    });

  const sourceBlobRows = reachableBlobRows.filter((row) =>
    ['source', 'test', 'build-config'].includes(row.classification) &&
    (PARSED_TS_EXTENSIONS.has(extensionOf(row.path)) || extensionOf(row.path) === '.py')
  );

  // Build the ref/merge-base tree plan before parsing. Branch deltas need only
  // blobs present in one of these trees; all other historical blobs can be
  // streamed later and discarded immediately after their compact facts land
  // in the history index.
  const treeCache = new Map([[baselineTip, baselineTree]]);
  const branchPlans = [];
  for (const ref of refs) {
    const counts = tryRun(['rev-list', '--left-right', '--count', `${baseline}...${ref.fullName}`])
      .split(/\s+/).map(Number);
    const behindBaseline = counts[0] || 0;
    const aheadOfBaseline = counts[1] || 0;
    const mergeBase = aheadOfBaseline === 0
      ? ref.tip
      : behindBaseline === 0
        ? baselineTip
        : tryRun(['merge-base', baseline, ref.fullName]);
    if (!treeCache.has(ref.tip)) treeCache.set(ref.tip, listTree(ref.fullName));
    if (mergeBase && !treeCache.has(mergeBase)) treeCache.set(mergeBase, listTree(mergeBase));
    branchPlans.push({ ref, behindBaseline, aheadOfBaseline, mergeBase });
  }
  const neededParsedShas = new Set(
    [...treeCache.values()].flatMap((tree) =>
      sourceTree(tree)
        .filter((entry) => PARSED_TS_EXTENSIONS.has(extensionOf(entry.path)) || extensionOf(entry.path) === '.py')
        .map((entry) => entry.sha)
    )
  );
  const canonicalParsedShas = new Set(
    sourceTree(baselineTree)
      .filter((entry) => PARSED_TS_EXTENSIONS.has(extensionOf(entry.path)) || extensionOf(entry.path) === '.py')
      .map((entry) => entry.sha)
  );
  const retainAnalysis = (analysis) => canonicalParsedShas.has(analysis.sha)
    ? analysis
    : {
        sha: analysis.sha,
        path: analysis.path,
        symbols: analysis.symbols,
        errors: analysis.errors,
      };

  const parsedBySha = new Map();
  const neededRows = sourceBlobRows.filter((row) =>
    neededParsedShas.has(row.sha) && !canonicalParsedShas.has(row.sha)
  );
  await processParallelBatches(neededRows, 300, 'delta', ({ analyses }) => {
    for (const analysis of analyses) {
      parsedBySha.set(analysis.sha, retainAnalysis(analysis));
    }
  });

  const baselineBlobShas = unique(baselineTree.map((entry) => entry.sha));
  const baselineBlobs = readBlobs(baselineBlobShas);

  const canonicalModules = sourceTree(baselineTree).filter((entry) => {
    const extension = extensionOf(entry.path);
    return PARSED_TS_EXTENSIONS.has(extension) || extension === '.py';
  }).map((entry) => {
    let analysis = parsedBySha.get(entry.sha);
    const text = baselineBlobs.get(entry.sha).toString('utf8').toWellFormed();
    if (!analysis) {
      if (extensionOf(entry.path) === '.py') analysis = parsePython([{ sha: entry.sha, path: entry.path, text }])[0];
      else analysis = parseTypeScriptBlob({ sha: entry.sha, path: entry.path, text });
      parsedBySha.set(entry.sha, analysis);
    }
    const symbols = analysis.symbols.map((symbol) => ({
      ...symbol,
      id: `${entry.path}#${symbol.qualifiedName}`,
      sourceUrl: sourceUrl(remote, baselineTip, entry.path, symbol.lineStart, symbol.lineEnd),
    }));
    return {
      path: entry.path,
      sha: entry.sha,
      language: extensionOf(entry.path) === '.py' ? 'Python' : 'TypeScript/JavaScript',
      imports: analysis.imports ?? [],
      enums: analysis.enums ?? {},
      symbols,
      calls: analysis.calls,
      parserErrors: analysis.errors,
      parserDiagnostics: analysis.diagnostics ?? [],
      commit: baselineTip,
      remote,
      sourceText: text,
    };
  }).sort((a, b) => a.path.localeCompare(b.path));

  const canonicalByPath = new Map(canonicalModules.map((module) => [module.path, module]));
  const baselineFiles = baselineTree.map((entry) => {
    const classification = classifyPath(entry.path);
    const extension = extensionOf(entry.path);
    let parser = 'not-applicable';
    let parserState = 'not-applicable';
    if (
      ['source', 'test'].includes(classification) ||
      (classification === 'build-config' && (PARSED_TS_EXTENSIONS.has(extension) || extension === '.py'))
    ) {
      parser = PARSED_TS_EXTENSIONS.has(extension) ? 'typescript' : extension === '.py' ? 'python-ast' : 'unsupported';
      parserState = parser === 'unsupported' ? 'unsupported' : canonicalByPath.get(entry.path)?.parserErrors.length ? 'failed' : 'parsed';
    } else if (classification === 'build-config' && extension === '.json') {
      parser = 'json';
      parserState = parseJsonConfiguration(
        entry.path,
        baselineBlobs.get(entry.sha).toString('utf8')
      ).ok ? 'parsed' : 'failed';
    }
    return {
      path: entry.path,
      sha: entry.sha,
      bytes: objectFacts.get(entry.sha)?.size ?? baselineBlobs.get(entry.sha)?.length ?? 0,
      classification,
      parser,
      parserState,
      sourceUrl: `${remote.replace(/^git@github\.com:/, 'https://github.com/').replace(/\.git$/, '')}/blob/${baselineTip}/${entry.path.split('/').map(encodeURIComponent).join('/')}`,
    };
  });

  const branchRows = [];
  for (const { ref, behindBaseline, aheadOfBaseline, mergeBase } of branchPlans) {
    const delta = semanticDelta(treeCache.get(mergeBase) ?? [], treeCache.get(ref.tip), parsedBySha);
    const pathDelta = parseDiff(mergeBase, ref.fullName);
    branchRows.push({
      ...ref,
      mergeBase,
      behindBaseline,
      aheadOfBaseline,
      containedInBaseline: aheadOfBaseline === 0,
      fileDelta: {
        added: pathDelta.filter((entry) => entry.status.startsWith('A')).length,
        changed: pathDelta.filter((entry) => entry.status.startsWith('M')).length,
        removed: pathDelta.filter((entry) => entry.status.startsWith('D')).length,
        renamed: pathDelta.filter((entry) => entry.status.startsWith('R')).length,
      },
      semanticDelta: delta,
    });
  }

  const currentSymbolKeys = new Set(canonicalModules.flatMap((module) =>
    module.symbols.map((symbol) => symbolKey(module.path, symbol))
  ));
  const historyIndex = new Map();
  const historicalParserFailures = [];
  const historicalParserDiagnostics = [];
  await processParallelBatches(sourceBlobRows, 400, 'history', ({ rows, analyses }) => {
    const missing = rows.filter((row) => !parsedBySha.has(row.sha));
    const missingShas = new Set(missing.map((row) => row.sha));
    const ephemeral = new Map(
      analyses.filter((analysis) => missingShas.has(analysis.sha)).map((analysis) => [analysis.sha, analysis])
    );

    for (const row of rows) {
      const analysis = parsedBySha.get(row.sha) ?? ephemeral.get(row.sha);
      for (const error of analysis?.errors ?? []) {
        historicalParserFailures.push({ path: row.path, sha: row.sha, parser: row.parser, ...error });
      }
      for (const diagnostic of analysis?.diagnostics ?? []) {
        historicalParserDiagnostics.push({ path: row.path, sha: row.sha, parser: row.parser, ...diagnostic });
      }
      for (const symbol of analysis?.symbols ?? []) {
        const key = symbolKey(row.path, symbol);
        if (!historyIndex.has(key)) {
          historyIndex.set(key, {
            key,
            path: row.path,
            name: symbol.name,
            qualifiedName: symbol.qualifiedName,
            kind: symbol.kind,
            state: currentSymbolKeys.has(key) ? 'current' : 'removed',
            blobShas: [],
            versions: 0,
          });
        }
        const record = historyIndex.get(key);
        record.versions += 1;
        if (record.blobShas.length < 8) record.blobShas.push(row.sha);
      }
    }
  }, (batch) => batch.filter((row) => !parsedBySha.has(row.sha)));
  const historicalSymbols = [...historyIndex.values()].map((record) => ({
    ...record,
    blobShas: unique(record.blobShas),
  })).sort((a, b) => a.path.localeCompare(b.path) || a.qualifiedName.localeCompare(b.qualifiedName));

  const modulesForOutput = canonicalModules.map(({ sourceText, remote: _remote, commit: _commit, ...module }) => module);
  const registries = deriveRegistries(canonicalModules);
  const symbolsByName = new Map();
  for (const module of modulesForOutput) {
    for (const symbol of module.symbols) {
      const rows = symbolsByName.get(symbol.name) ?? [];
      rows.push(symbol.id);
      symbolsByName.set(symbol.name, rows);
    }
  }
  const callGraph = modulesForOutput.flatMap((module) =>
    module.calls.map((call) => {
      const from = module.symbols.find((symbol) => symbol.qualifiedName === call.from)?.id ??
        `${module.path}#${call.from}`;
      const targetName = call.to.split('.').at(-1);
      const candidates = symbolsByName.get(targetName) ?? [];
      return {
        from,
        to: call.to,
        targetIds: candidates.length <= 12 ? candidates : [],
        ambiguousTargetCount: candidates.length > 1 ? candidates.length : 0,
        path: module.path,
        line: call.line,
      };
    })
  );
  const importGraph = modulesForOutput.flatMap((module) =>
    module.imports.map((specifier) => ({ from: module.path, specifier }))
  );
  const parserFailures = [
    ...canonicalModules.flatMap((module) =>
      module.parserErrors.map((error) => ({ path: module.path, sha: module.sha, parser: module.language, ...error }))
    ),
    ...baselineFiles.filter((file) => file.parserState === 'failed').map((file) => ({
      path: file.path,
      sha: file.sha,
      parser: file.parser,
      message: 'Native parser rejected this file.',
    })),
  ];
  const parserDiagnostics = canonicalModules.flatMap((module) =>
    module.parserDiagnostics.map((diagnostic) => ({
      path: module.path,
      sha: module.sha,
      parser: module.language,
      ...diagnostic,
    }))
  );
  const symbolCount = modulesForOutput.reduce((sum, module) => sum + module.symbols.length, 0);
  const exportedSymbolCount = modulesForOutput.reduce(
    (sum, module) => sum + module.symbols.filter((symbol) => symbol.exported).length,
    0
  );
  const documentedExportCount = modulesForOutput.reduce(
    (sum, module) => sum + module.symbols.filter((symbol) => symbol.exported && symbol.documentation).length,
    0
  );
  const classificationCounts = Object.fromEntries(
    [...new Set(baselineFiles.map((file) => file.classification))].sort().map((classification) => [
      classification,
      baselineFiles.filter((file) => file.classification === classification).length,
    ])
  );
  const reachableClassificationCounts = Object.fromEntries(
    [...new Set(reachableBlobRows.map((row) => row.classification))].sort().map((classification) => [
      classification,
      reachableBlobRows.filter((row) => row.classification === classification).length,
    ])
  );
  const digest = createHash('sha256')
    .update(baselineTip)
    .update('\n')
    .update(baselineFiles.map((file) => `${file.sha}\t${file.path}\t${file.classification}`).join('\n'))
    .update('\n')
    .update(modulesForOutput.flatMap((module) => module.symbols.map((symbol) => `${symbol.id}\t${symbol.signature}`)).join('\n'))
    .digest('hex');
  const generatedAt = run(['show', '-s', '--format=%cI', baselineTip]).trim();

  const shared = {
    schemaVersion: 1,
    generatedAt,
    repository: { pathHint: 'Dash-Web', remote, baseline, baselineTip },
  };
  const inventory = {
    ...shared,
    methodology: {
      refs: refs.length,
      reachableCommits: Number(run(['rev-list', '--count', ...refs.map((ref) => ref.fullName)]).trim()),
      reachableObjects: reachable.shas.length,
      reachableBlobs: reachableBlobRows.length,
      classifiedReachableBlobs: reachableBlobRows.length,
      canonicalTrackedFiles: baselineFiles.length,
      classificationCounts,
      reachableClassificationCounts,
      parsedReachableSourceBlobs: sourceBlobRows.length,
      unsupportedReachableSourceBlobs: reachableBlobRows.filter((row) => row.parser === 'unsupported').length,
      digest,
    },
    files: baselineFiles,
    blobs: reachableBlobRows,
  };
  const reference = {
    ...shared,
    methodology: {
      moduleCount: modulesForOutput.length,
      symbolCount,
      exportedSymbolCount,
      documentedExportCount,
      exportedDocumentationCoverage: exportedSymbolCount ? documentedExportCount / exportedSymbolCount : 1,
      parserFailures: parserFailures.length,
      parserDiagnostics: parserDiagnostics.length,
      branchCount: branchRows.length,
      digest,
    },
    parserFailures,
    parserDiagnostics,
    registries,
    graph: {
      calls: callGraph,
      imports: importGraph,
    },
    modules: modulesForOutput,
    branches: branchRows,
  };
  const historyArchive = {
    ...shared,
    methodology: {
      symbols: historicalSymbols.length,
      current: historicalSymbols.filter((symbol) => symbol.state === 'current').length,
      removed: historicalSymbols.filter((symbol) => symbol.state === 'removed').length,
      sourceBlobs: sourceBlobRows.length,
      parserFailures: historicalParserFailures.length,
      parserDiagnostics: historicalParserDiagnostics.length,
      digest,
    },
    parserFailures: historicalParserFailures,
    parserDiagnostics: historicalParserDiagnostics,
    symbols: historicalSymbols,
  };
  const historyArchiveBytes = gzipSync(Buffer.from(JSON.stringify(historyArchive)), { level: 9 });
  const history = {
    ...shared,
    methodology: historyArchive.methodology,
    parserFailures: historicalParserFailures,
    parserDiagnostics: historicalParserDiagnostics,
    archive: {
      path: '/assets/data/historical-symbols.json.gz',
      format: 'gzip-compressed JSON',
      bytes: historyArchiveBytes.length,
      sha256: createHash('sha256').update(historyArchiveBytes).digest('hex'),
    },
  };
  const moduleReference = {
    ...shared,
    methodology: {
      ...reference.methodology,
      canonicalTrackedFiles: inventory.methodology.canonicalTrackedFiles,
      reachableCommits: inventory.methodology.reachableCommits,
      reachableBlobs: inventory.methodology.reachableBlobs,
      historicalRemovedSymbols: history.methodology.removed,
    },
    parserFailures,
    parserDiagnostics,
    registries,
    modules: modulesForOutput,
  };
  const branchReference = {
    ...shared,
    methodology: {
      branchCount: branchRows.length,
      symbolCount,
      reachableCommits: inventory.methodology.reachableCommits,
      reachableBlobs: inventory.methodology.reachableBlobs,
      digest,
    },
    branches: branchRows,
  };

    mkdirSync(outputRoot, { recursive: true });
    mkdirSync(dirname(historyArchivePath), { recursive: true });
  writeFileSync(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`);
  writeFileSync(referencePath, `${JSON.stringify(reference, null, 2)}\n`);
  writeFileSync(moduleReferencePath, `${JSON.stringify(moduleReference, null, 2)}\n`);
    writeFileSync(branchReferencePath, `${JSON.stringify(branchReference, null, 2)}\n`);
    writeFileSync(historyPath, `${JSON.stringify(history, null, 2)}\n`);
    writeFileSync(historyArchivePath, historyArchiveBytes);
  process.stdout.write([
    `Wrote ${inventoryPath}`,
    `Wrote ${referencePath}`,
    `Wrote ${moduleReferencePath}`,
    `Wrote ${branchReferencePath}`,
    `Wrote ${historyPath}`,
    `Reachable commits / blobs: ${inventory.methodology.reachableCommits.toLocaleString()} / ${inventory.methodology.reachableBlobs.toLocaleString()}`,
    `Canonical files / symbols / exports: ${baselineFiles.length.toLocaleString()} / ${symbolCount.toLocaleString()} / ${exportedSymbolCount.toLocaleString()}`,
    `Historical symbols: ${historicalSymbols.length.toLocaleString()} (${history.methodology.removed.toLocaleString()} removed)`,
    `Parser failures: ${parserFailures.length} canonical / ${historicalParserFailures.length} historical`,
    `Elapsed: ${((Date.now() - startedAt) / 1000).toFixed(1)}s`,
  ].join('\n') + '\n');
};

main();
