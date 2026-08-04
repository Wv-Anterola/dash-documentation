import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import sourceReference from '../src/data/generated/source-reference.json' with { type: 'json' };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.resolve(process.env.DASH_SOURCE_ROOT ?? path.join(root, '..', 'Dash-Web'));
const baseline = sourceReference.repository.baselineTip;
const remote = sourceReference.repository.remote
  .replace(/^git@github\.com:/, 'https://github.com/')
  .replace(/\.git$/, '');

function git(...args) {
  return execFileSync('git', ['-c', `safe.directory=${sourceRoot.replaceAll('\\', '/')}`, '-C', sourceRoot, ...args], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  });
}

function sourceAt(file) {
  return git('show', `${baseline}:${file}`);
}

function sourceUrl(file, line) {
  return `${remote}/blob/${baseline}/${file}#L${line}`;
}

function lineOf(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function compact(node, sourceFile, limit = 220) {
  if (!node) return undefined;
  const value = node.getText(sourceFile).replace(/\s+/g, ' ').trim();
  return value.length > limit ? `${value.slice(0, limit - 1)}…` : value;
}

function stringLiteral(node) {
  return node && ts.isStringLiteralLike(node) ? node.text : undefined;
}

function decorators(node) {
  if (typeof ts.canHaveDecorators === 'function' && ts.canHaveDecorators(node)) return ts.getDecorators(node) ?? [];
  return node.decorators ?? [];
}

function hasDecorator(node, name) {
  return decorators(node).some((decorator) => {
    const expression = decorator.expression;
    return expression.getText() === name || (ts.isCallExpression(expression) && expression.expression.getText() === name);
  });
}

function ownerName(node, sourceFile) {
  for (let cursor = node.parent; cursor; cursor = cursor.parent) {
    if (ts.isFunctionDeclaration(cursor) && cursor.name) return cursor.name.text;
    if (ts.isMethodDeclaration(cursor) && cursor.name) return cursor.name.getText(sourceFile);
    if (ts.isClassDeclaration(cursor) && cursor.name) return cursor.name.text;
  }
  return 'module initialization';
}

function declarationName(node) {
  if ((ts.isClassDeclaration(node) || ts.isFunctionDeclaration(node)) && node.name) return node.name.text;
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) return node.name.text;
  return undefined;
}

function functionLike(node) {
  return Boolean(node) && (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node) || ts.isMethodDeclaration(node));
}

function signatureFor(name, node, sourceFile) {
  if (!node) return name;
  if (functionLike(node)) {
    const parameters = node.parameters.map((parameter) => compact(parameter, sourceFile, 120)).join(', ');
    const result = node.type ? `: ${compact(node.type, sourceFile, 100)}` : '';
    const asyncPrefix = node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword) ? 'async ' : '';
    return `${asyncPrefix}${name}(${parameters})${result}`;
  }
  if (ts.isClassDeclaration(node)) {
    if (['AudioField', 'ImageField', 'VideoField', 'PdfField', 'WebField', 'CsvField', 'YoutubeField', 'Viewer3DField'].includes(name)) {
      return `new ${name}(urlVal: string | URL)`;
    }
    if (name === 'PrefetchProxy') return 'new PrefetchProxy(value?: Doc | string)';
    const constructor = node.members.find((member) => ts.isConstructorDeclaration(member));
    const parameters = constructor?.parameters.map((parameter) => compact(parameter, sourceFile, 120)).join(', ') ?? '';
    return `new ${name}(${parameters})`;
  }
  return compact(node, sourceFile) ?? name;
}

function humanize(name) {
  return name
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
    .trim()
    .toLowerCase();
}

const purposeOverrides = {
  d: 'Constructs a DateField from the same arguments accepted by JavaScript Date.',
  Docs: 'Exposes the document construction namespace to scripts.',
  List: 'Constructs an observable Dash List rather than a plain JavaScript array.',
  docList: 'Converts a field result into the document-list form used by Dash helpers.',
  idToDoc: 'Returns the currently cached document for a persistent ID, when available.',
  selectedDocs: 'Returns the current selection with optional collection exclusion and prior-value fallback.',
  DocFocusOrOpen: 'Focuses an existing document view or opens the document when no mounted view can receive focus.',
  dashCallChat: 'Starts the legacy GPT completion helper and writes its pending and final value through the supplied setter.',
  makeScript: 'Compiles a statement body and returns a persistent ScriptField when compilation succeeds.',
  setInPlace: 'Writes a field according to Dash data-versus-layout ownership instead of blindly replacing the delegate field.',
  copyField: 'Copies an ObjectField through its Copy contract and passes primitive or reference values through.',
};

function purposeFor(record) {
  if (purposeOverrides[record.name]) return purposeOverrides[record.name];
  if (record.description) return record.description.replace(/^[a-z]/, (letter) => letter.toUpperCase()).replace(/\.?$/, '.');
  const words = humanize(record.name);
  if (record.kind === 'class') return `Constructs a ${record.name} runtime value for use by a script.`;
  if (record.kind === 'namespace-or-object') return `Exposes the ${record.name} namespace or application object to scripts.`;
  if (/^(is|has|can)[A-Z_]/.test(record.name)) return `Reports whether ${words.replace(/^(is|has|can)\s+/, '')}.`;
  if (/^get[A-Z_]/.test(record.name)) return `Returns ${words.replace(/^get\s+/, '')}.`;
  if (/^set[A-Z_]/.test(record.name)) return `Sets ${words.replace(/^set\s+/, '')}.`;
  if (/^toggle[A-Z_]/.test(record.name)) return `Toggles ${words.replace(/^toggle\s+/, '')}.`;
  if (/^create[A-Z_]/.test(record.name)) return `Creates ${words.replace(/^create\s+/, '')}.`;
  if (/^remove[A-Z_]/.test(record.name)) return `Removes ${words.replace(/^remove\s+/, '')}.`;
  if (/^add[A-Z_]/.test(record.name)) return `Adds ${words.replace(/^add\s+/, '')}.`;
  if (/^reset[A-Z_]/.test(record.name)) return `Resets ${words.replace(/^reset\s+/, '')}.`;
  if (/^open[A-Z_]/.test(record.name)) return `Opens ${words.replace(/^open\s+/, '')}.`;
  if (/^(next|prev|goto|navigate|follow)[A-Z_]/.test(record.name)) return `Navigates using ${words}.`;
  if (record.mode === 'query') return `Returns or evaluates ${words}.`;
  return `Runs the ${words} application operation.`;
}

function purposeSourceFor(record) {
  if (purposeOverrides[record.name]) return 'documentation-override';
  if (record.description) return 'source-description';
  return 'identifier-inference';
}

function categoryFor(record) {
  const probe = `${record.path} ${record.name}`.toLowerCase();
  if (record.path.startsWith('src/fields/ScriptField') || /chat/.test(probe) || record.name === 'makeScript') return 'scripting-and-automation';
  if (record.path.startsWith('src/fields/')) return 'values-and-documents';
  if (/selectionmanager/.test(probe) || /\bundo\b|\bredo\b|selected|deselect/.test(probe)) return 'selection-and-history';
  if (/recordingbox|workspace recording|workspace replay/.test(probe)) return 'recording-and-replay';
  if (/gestureoverlay|(^|[^a-z])ink([^a-z]|$)|eraser|\bpen\b/.test(probe)) return 'ink-and-gesture';
  if (/webbox|image|video|equation|dataviz/.test(probe)) return 'media-and-specialized-content';
  if (/collection|schema|groupby|showfreeform|setview|switchview|keyframe|pivot/.test(probe)) return 'collections-and-layout';
  if (/dashboard|mainview|documentview|lightbox|template|link|presbox|navigate|focus|folder/.test(probe)) return 'workspace-and-navigation';
  if (/currentuserutils/.test(probe) || /novice|explore|comic|sharing/.test(probe)) return 'user-state-and-modes';
  if (/google|dropconverter|importdocument/.test(probe)) return 'imports-and-services';
  if (/globalscripts/.test(probe)) return 'appearance-and-tools';
  return 'application-services';
}

function modeFor(name, kind) {
  if (kind === 'class') return 'constructor';
  if (kind === 'namespace-or-object') return 'object';
  if (['copyField', 'd', 'docCastAsync', 'docList', 'generateLinkTitle', 'idToDoc', 'links', 'MySharedDocs', 'NotRadiusEraser', 'schemaHeaderField', 'SelectedDocType'].includes(name)) return name === 'd' || name === 'schemaHeaderField' ? 'constructor' : 'query';
  if (/^(get|is|has|can|active|current|selected|same|compare|format|min$|max$|urlhash|tojavascript)/.test(name.toLowerCase())) return 'query';
  return 'action';
}

function analyzeEffects(node, sourceFile) {
  if (!node || !functionLike(node) || !node.body) return { calls: [], writes: [], returns: 0 };
  const calls = [];
  const writes = [];
  let returns = 0;
  const visit = (child) => {
    if (ts.isCallExpression(child)) calls.push(compact(child.expression, sourceFile, 100));
    if (ts.isBinaryExpression(child) && [
      ts.SyntaxKind.EqualsToken,
      ts.SyntaxKind.PlusEqualsToken,
      ts.SyntaxKind.MinusEqualsToken,
      ts.SyntaxKind.AsteriskEqualsToken,
      ts.SyntaxKind.SlashEqualsToken,
    ].includes(child.operatorToken.kind)) writes.push(compact(child.left, sourceFile, 120));
    if (ts.isReturnStatement(child)) returns++;
    ts.forEachChild(child, visit);
  };
  visit(node.body);
  return {
    calls: [...new Set(calls.filter(Boolean))].slice(0, 8),
    writes: [...new Set(writes.filter(Boolean))].slice(0, 8),
    returns,
  };
}

const grepOutput = git('grep', '-l', '-E', 'ScriptingGlobals\\.add|@scriptingGlobal', baseline, '--', 'src');
const candidateFiles = [...new Set(grepOutput.split(/\r?\n/).filter(Boolean).map((line) => line.replace(`${baseline}:`, '')))].sort();
const parsedFiles = new Map();
for (const file of candidateFiles) {
  const source = sourceAt(file);
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const declarations = new Map();
  const visitDeclarations = (node) => {
    const name = declarationName(node);
    if (name && !declarations.has(name)) declarations.set(name, node);
    ts.forEachChild(node, visitDeclarations);
  };
  visitDeclarations(sourceFile);
  parsedFiles.set(file, { source, sourceFile, declarations });
}

const sourceSymbols = new Map();
for (const module of sourceReference.modules) {
  for (const symbol of module.symbols) {
    if (!sourceSymbols.has(symbol.name)) sourceSymbols.set(symbol.name, { ...symbol, path: module.path });
  }
}

const staticEntries = [];
const dynamicEntries = [];
for (const [file, parsed] of parsedFiles) {
  const { sourceFile, declarations } = parsed;
  const visit = (node) => {
    if (ts.isClassDeclaration(node) && node.name && hasDecorator(node, 'scriptingGlobal')) {
      const name = node.name.text;
      const line = lineOf(sourceFile, node);
      staticEntries.push({
        name,
        path: file,
        line,
        registration: 'decorator',
        kind: 'class',
        signature: signatureFor(name, node, sourceFile),
        description: '',
        parameterMetadata: '',
        owner: name,
        effects: { calls: [], writes: [], returns: 0 },
        source: { file, line, url: sourceUrl(file, line) },
      });
    }
    if (ts.isCallExpression(node) && node.expression.getText(sourceFile) === 'ScriptingGlobals.add') {
      const first = node.arguments[0];
      const second = node.arguments[1];
      const third = node.arguments[2];
      const owner = ownerName(node, sourceFile);
      if (file.endsWith('/ScriptingGlobals.ts') && owner === 'scriptingGlobal') {
        ts.forEachChild(node, visit);
        return;
      }

      let name;
      let declaration;
      let kind = 'function';
      let registration = 'call';
      if (first && (ts.isFunctionExpression(first) || ts.isArrowFunction(first))) {
        name = first.name?.text;
        declaration = first;
      } else if (first && ts.isStringLiteralLike(first)) {
        name = first.text;
        declaration = second && ts.isIdentifier(second) ? declarations.get(second.text) : second;
        kind = functionLike(declaration) ? 'function' : declaration && ts.isClassDeclaration(declaration) ? 'class' : 'namespace-or-object';
        registration = 'named-call';
      } else if (first && ts.isIdentifier(first)) {
        name = first.text;
        declaration = declarations.get(name);
        const sourceSymbol = sourceSymbols.get(name);
        kind = declaration && functionLike(declaration) ? 'function' : declaration && ts.isClassDeclaration(declaration) ? 'class' : sourceSymbol?.kind === 'class' ? 'class' : 'namespace-or-object';
      }

      if (!name || ['f', 'constructor'].includes(name)) {
        const line = lineOf(sourceFile, node);
        dynamicEntries.push({
          expression: compact(first, sourceFile) ?? 'unknown',
          valueExpression: compact(second, sourceFile),
          owner,
          source: { file, line, url: sourceUrl(file, line) },
          reason: name === 'f' ? 'Saved script name, description, and parameter string are read from a document at runtime.' : 'Registration name is computed at runtime.',
        });
      } else {
        const line = lineOf(sourceFile, node);
        const sourceSymbol = sourceSymbols.get(name);
        const signature = kind === 'namespace-or-object'
          ? name
          : declaration
            ? signatureFor(name, declaration, sourceFile)
            : sourceSymbol?.signature?.replace(/\s+/g, ' ').slice(0, 260) || `${name}`;
        staticEntries.push({
          name,
          path: file,
          line,
          registration,
          kind,
          signature,
          description: stringLiteral(second) ?? sourceSymbol?.documentation ?? '',
          parameterMetadata: stringLiteral(third) ?? '',
          owner,
          effects: analyzeEffects(declaration, sourceFile),
          source: { file, line, url: sourceUrl(file, line) },
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
}

const duplicateNames = [...new Set(staticEntries.map((entry) => entry.name))]
  .map((name) => ({ name, entries: staticEntries.filter((entry) => entry.name === name) }))
  .filter((item) => item.entries.length > 1);
if (duplicateNames.length) {
  throw new Error(`Static scripting globals would collide at module initialization: ${duplicateNames.map((item) => item.name).join(', ')}`);
}

const globals = staticEntries
  .map((entry) => {
    const mode = modeFor(entry.name, entry.kind);
    const enriched = { ...entry, mode };
    return {
      ...enriched,
      category: categoryFor(enriched),
      purpose: purposeFor(enriched),
      purposeSource: purposeSourceFor(enriched),
    };
  })
  .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

const runtimeFiles = ['src/client/util/Scripting.ts', 'src/client/util/ScriptingGlobals.ts', 'src/client/util/ScriptManager.ts', 'src/fields/ScriptField.ts'];
const runtimeSources = {};
for (const file of runtimeFiles) {
  const source = sourceAt(file);
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const wanted = new Set(['CompileScript', 'Run', 'add', 'removeGlobal', 'setScriptingGlobals', 'resetScriptingGlobals', 'initialize', 'deserializeScript', 'value', 'MakeFunction', 'MakeScript']);
  const visit = (node) => {
    if ((ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) && node.name) {
      const name = node.name.getText(sourceFile);
      if (wanted.has(name)) {
        const owner = ownerName(node, sourceFile);
        const key = runtimeSources[name] ? `${owner}.${name}` : name;
        const line = lineOf(sourceFile, node);
        runtimeSources[key] = { file, line, url: sourceUrl(file, line) };
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
}

const categories = [...new Set(globals.map((entry) => entry.category))].sort();
const modes = ['action', 'query', 'constructor', 'object'];
const exactNames = new Set();
for (const entry of globals) {
  if (exactNames.has(entry.name)) throw new Error(`Duplicate static scripting global: ${entry.name}`);
  exactNames.add(entry.name);
}
const caseFoldedNames = new Map();
for (const entry of globals) {
  const key = entry.name.toLocaleLowerCase('en-US');
  caseFoldedNames.set(key, [...(caseFoldedNames.get(key) ?? []), entry.name]);
}
const caseInsensitiveNameCollisions = [...caseFoldedNames.values()]
  .filter((names) => names.length > 1)
  .map((names) => [...names].sort())
  .sort((a, b) => a[0].localeCompare(b[0]));
const categoryCounts = Object.fromEntries(
  categories.map((category) => [category, globals.filter((entry) => entry.category === category).length]),
);
const output = {
  schemaVersion: 1,
  generatedAt: sourceReference.generatedAt,
  repository: { remote, baseline },
  methodology: {
    registryParser: 'TypeScript compiler AST over every ScriptingGlobals.add call and @scriptingGlobal class decorator in the integrated source',
    sourceSemantics: 'Signatures, explicit descriptions, parameter metadata, direct calls, and assignment targets are extracted from the registered declaration when statically resolvable',
    dynamicBoundary: 'Runtime names from saved script documents are recorded as dynamic registration sites, not invented as static globals',
    candidateFiles: candidateFiles.length,
  },
  summary: {
    staticGlobals: globals.length,
    decoratedClasses: globals.filter((entry) => entry.registration === 'decorator').length,
    functions: globals.filter((entry) => entry.kind === 'function').length,
    constructors: globals.filter((entry) => entry.kind === 'class').length,
    objects: globals.filter((entry) => entry.kind === 'namespace-or-object').length,
    explicitDescriptions: globals.filter((entry) => entry.description).length,
    categories: categories.length,
    dynamicRegistrationSites: dynamicEntries.length,
  },
  categories,
  categoryCounts,
  caseInsensitiveNameCollisions,
  modes,
  runtimeSources,
  dynamicRegistrations: dynamicEntries,
  globals,
};

const outputPath = path.join(root, 'src', 'data', 'generated', 'scripting-globals.json');
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

console.log(
  `Wrote ${outputPath}\n` +
  `${globals.length} static globals across ${categories.length} categories; ` +
  `${output.summary.decoratedClasses} decorator registrations; ${dynamicEntries.length} dynamic saved-script sites.`,
);
