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

function compact(node, sourceFile, limit = 180) {
  if (!node) return undefined;
  const value = node.getText(sourceFile).replace(/\s+/g, ' ').trim();
  return value.length > limit ? `${value.slice(0, limit - 1)}…` : value;
}

function decorators(node) {
  if (typeof ts.canHaveDecorators === 'function' && ts.canHaveDecorators(node)) return ts.getDecorators(node) ?? [];
  return node.decorators ?? [];
}

function decoratorCall(node, name) {
  for (const decorator of decorators(node)) {
    const expression = decorator.expression;
    if (ts.isCallExpression(expression) && expression.expression.getText() === name) return expression;
    if (expression.getText() === name) return expression;
  }
  return undefined;
}

function hasDecorator(node, name) {
  return decorators(node).some((decorator) => {
    const expression = decorator.expression;
    return expression.getText() === name || (ts.isCallExpression(expression) && expression.expression.getText() === name);
  });
}

function memberName(member, sourceFile) {
  if (!member.name) return undefined;
  if (ts.isComputedPropertyName(member.name)) return member.name.expression.getText(sourceFile);
  return member.name.getText(sourceFile).replace(/^['"]|['"]$/g, '');
}

const taxonomy = {
  Doc: {
    label: 'Document identity', category: 'identity', purpose: 'Stores one persistent Dash document: a stable ID plus its typed field map.',
    hydration: 'The constructor receives the stored id; nested fields are repaired and ACL caches are refreshed after hydration.',
    copy: 'Document identity is referenced through ProxyField rather than recursively copied as a nested object.',
  },
  cursor: {
    label: 'Collaborator cursor', category: 'interaction', purpose: 'Stores a collaborator identifier, timestamp, and canvas position as one presence value.',
    hydration: 'The nested serializr schema reconstructs metadata and position; later position changes must call FieldChanged.',
    copy: 'Copy constructs another CursorField around the same data object rather than deep-cloning the nested records.',
  },
  date: {
    label: 'Date and time', category: 'scalar', purpose: 'Preserves JavaScript Date semantics instead of flattening time to an untyped string.',
    hydration: 'serializr date conversion reconstructs a Date instance.',
    copy: 'Copy wraps the same Date object; callers needing value isolation must clone the Date explicitly.',
  },
  html: {
    label: 'HTML source', category: 'content', purpose: 'Stores authored or imported HTML as a semantically distinct field.',
    hydration: 'The html member is restored as a primitive string.',
    copy: 'Copy constructs a new wrapper around the same immutable string.',
  },
  icon: {
    label: 'Icon token', category: 'content', purpose: 'Stores an icon identifier without treating it as ordinary display text.',
    hydration: 'The icon member is restored as a primitive string.',
    copy: 'Copy constructs a new wrapper; script and JavaScript conversion intentionally return invalid.',
  },
  ink: {
    label: 'Ink geometry', category: 'interaction', purpose: 'Stores sampled stroke points and derived Bezier geometry for drawing, erasing, and hit testing.',
    hydration: 'A nested point schema restores x, y, pressure, and optional timestamp data.',
    copy: 'Copy follows the implementation’s InkData construction path; inner mutation must notify FieldChanged.',
  },
  list: {
    label: 'Observable list', category: 'collection', purpose: 'Stores an ordered, observable sequence with incremental add/remove change intent.',
    hydration: 'Nested values pass through autoObject; document members are represented internally as ProxyField references.',
    copy: 'Copy recursively invokes Copy for ObjectField members and retains referenced document identity.',
  },
  proxy: {
    label: 'Lazy document reference', category: 'reference', purpose: 'Stores only a target document ID and resolves the shared client identity on demand.',
    hydration: 'The repair hook reconnects a cached target when available; the first cold read starts one shared request.',
    copy: 'Copy preserves the resolved target or its fieldId, not a copy of the target document.',
  },
  prefetch_proxy: {
    label: 'Prefetched reference', category: 'reference', purpose: 'Uses ProxyField storage while beginning target hydration immediately after deserialization.',
    hydration: 'Its repair hook reads value, which triggers the normal cached-or-requested ProxyField resolution path.',
    copy: 'Inherited ProxyField copy currently produces a ProxyField rather than preserving the PrefetchProxy subclass.',
  },
  RichTextField: {
    label: 'Formatted text', category: 'content', purpose: 'Keeps ProseMirror-compatible structured content and its plain-text projection together.',
    hydration: 'Both serialized strings are restored; editor code depends on them describing the same content.',
    copy: 'Copy constructs a new wrapper around the two immutable string projections.',
  },
  script: {
    label: 'Executable script', category: 'executable', purpose: 'Persists Dash script source, options, captured values, and optional setter behavior.',
    hydration: 'The asynchronous repair path recompiles source and resolves encoded document captures.',
    copy: 'Copy retains compiled script objects, setter script, and raw source according to the class implementation.',
  },
  computed: {
    label: 'Reactive computation', category: 'executable', purpose: 'Extends ScriptField with MobX-tracked evaluation and an optional persisted cache result.',
    hydration: 'Uses the ScriptField repair path; evaluation supplies this, _last_, _setCacheResult_, and _readOnly_.',
    copy: 'Copy returns a new ComputedField and does not recursively copy referenced documents.',
  },
  schemaheader: {
    label: 'Schema column header', category: 'interaction', purpose: 'Stores a schema column’s label, color, value kind, width, sorting, and collapsed state.',
    hydration: 'Primitive members restore directly; all supported mutators call FieldChanged.',
    copy: 'Copy transfers every serialized configuration member into a new wrapper.',
  },
  audio: {
    label: 'Audio URL', category: 'media', purpose: 'Retains the semantic identity of an audio resource while sharing URL storage behavior.',
    hydration: 'Relative paths resolve against the current origin; external and data URLs remain absolute.', copy: 'Inherited URLField copy preserves the concrete AudioField constructor.',
  },
  image: {
    label: 'Image URL', category: 'media', purpose: 'Retains the semantic identity of an image resource while sharing URL storage behavior.',
    hydration: 'Relative paths resolve against the current origin; external and data URLs remain absolute.', copy: 'Inherited URLField copy preserves the concrete ImageField constructor.',
  },
  video: {
    label: 'Video URL', category: 'media', purpose: 'Retains the semantic identity of a video resource while sharing URL storage behavior.',
    hydration: 'Relative paths resolve against the current origin; external and data URLs remain absolute.', copy: 'Inherited URLField copy preserves the concrete VideoField constructor.',
  },
  pdf: {
    label: 'PDF URL', category: 'media', purpose: 'Retains the semantic identity of a PDF resource while sharing URL storage behavior.',
    hydration: 'Relative paths resolve against the current origin; external and data URLs remain absolute.', copy: 'Inherited URLField copy preserves the concrete PdfField constructor.',
  },
  web: {
    label: 'Web URL', category: 'media', purpose: 'Retains the semantic identity of a web resource while sharing URL storage behavior.',
    hydration: 'Relative paths resolve against the current origin; external and data URLs remain absolute.', copy: 'Inherited URLField copy preserves the concrete WebField constructor.',
  },
  csv: {
    label: 'CSV URL', category: 'media', purpose: 'Retains the semantic identity of a tabular resource while sharing URL storage behavior.',
    hydration: 'Relative paths resolve against the current origin; external and data URLs remain absolute.', copy: 'Inherited URLField copy preserves the concrete CsvField constructor.',
  },
  youtube: {
    label: 'YouTube URL', category: 'media', purpose: 'Retains the semantic identity of a YouTube resource while sharing URL storage behavior.',
    hydration: 'Relative paths resolve against the current origin; external and data URLs remain absolute.', copy: 'Inherited URLField copy preserves the concrete YoutubeField constructor.',
  },
  viewer3d: {
    label: '3D model URL', category: 'media', purpose: 'Retains the semantic identity of a 3D model resource while sharing URL storage behavior.',
    hydration: 'Relative paths resolve against the current origin; external and data URLs remain absolute.', copy: 'Inherited URLField copy preserves the concrete Viewer3DField constructor.',
  },
};

const fieldFiles = git('ls-tree', '-r', '--name-only', baseline, '--', 'src/fields')
  .split(/\r?\n/)
  .filter((file) => /\.(ts|tsx)$/.test(file));

const classes = new Map();
for (const file of fieldFiles) {
  const source = sourceAt(file);
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const visit = (node) => {
    if (ts.isClassDeclaration(node) && node.name) {
      const name = node.name.text;
      const extendsClause = node.heritageClauses?.find((clause) => clause.token === ts.SyntaxKind.ExtendsKeyword);
      const base = extendsClause?.types[0]?.expression.getText(sourceFile);
      const serializedMembers = node.members
        .filter((member) => decoratorCall(member, 'serializable'))
        .map((member) => {
          const serializable = decoratorCall(member, 'serializable');
          const line = lineOf(sourceFile, member);
          return {
            owner: name,
            name: memberName(member, sourceFile),
            type: member.type?.getText(sourceFile) ?? 'inferred',
            schema: compact(serializable?.arguments?.[0], sourceFile) ?? 'default',
            source: { file, line, url: sourceUrl(file, line) },
          };
        });
      const methods = node.members
        .filter((member) => ts.isMethodDeclaration(member) || ts.isGetAccessorDeclaration(member) || ts.isSetAccessorDeclaration(member))
        .map((member) => ({
          name: memberName(member, sourceFile),
          kind: ts.isGetAccessorDeclaration(member) ? 'getter' : ts.isSetAccessorDeclaration(member) ? 'setter' : 'method',
          callsFieldChanged: member.getText(sourceFile).includes('[FieldChanged]'),
          line: lineOf(sourceFile, member),
        }));
      const registration = decoratorCall(node, 'Deserializable');
      classes.set(name, {
        name,
        file,
        line: lineOf(sourceFile, node),
        source: { file, line: lineOf(sourceFile, node), url: sourceUrl(file, lineOf(sourceFile, node)) },
        base,
        serializedMembers,
        methods,
        scriptingGlobal: hasDecorator(node, 'scriptingGlobal'),
        registration: registration && ts.isCallExpression(registration)
          ? {
              tag: registration.arguments[0] && ts.isStringLiteralLike(registration.arguments[0]) ? registration.arguments[0].text : compact(registration.arguments[0], sourceFile),
              repairHook: compact(registration.arguments[1], sourceFile),
              constructorArgs: compact(registration.arguments[2], sourceFile),
              line: lineOf(sourceFile, registration),
            }
          : undefined,
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
}

function inheritance(name) {
  const chain = [];
  const seen = new Set();
  let cursor = classes.get(name);
  while (cursor && !seen.has(cursor.name)) {
    seen.add(cursor.name);
    chain.push(cursor);
    cursor = cursor.base ? classes.get(cursor.base) : undefined;
  }
  return chain;
}

function callerEvidence(record) {
  const id = `${record.file}#${record.name}`;
  const calls = sourceReference.graph.calls.filter((call) =>
    call.targetIds.some((targetId) => targetId === id || targetId.startsWith(`${id}.`)),
  );
  return {
    count: calls.length,
    examples: calls.slice(0, 3).map((call) => ({
      owner: call.from,
      source: { file: call.path, line: call.line, url: sourceUrl(call.path, call.line) },
    })),
  };
}

const conversionSymbols = new Set(['Copy', 'ToValue', 'ToJavascriptString', 'ToScriptString', 'ToString', 'ToPlainText']);
const registrations = [...classes.values()]
  .filter((record) => record.registration)
  .map((record) => {
    const tag = record.registration.tag;
    const editorial = taxonomy[tag];
    if (!editorial) throw new Error(`Serialized field tag ${tag} has no reviewed taxonomy entry`);
    const chain = inheritance(record.name);
    const effectiveMembers = [];
    const memberNames = new Set();
    for (const owner of [...chain].reverse()) {
      for (const member of owner.serializedMembers) {
        if (member.name && memberNames.has(member.name)) {
          const at = effectiveMembers.findIndex((item) => item.name === member.name);
          effectiveMembers.splice(at, 1);
        }
        if (member.name) memberNames.add(member.name);
        effectiveMembers.push(member);
      }
    }
    const effectiveMethods = new Map();
    for (const owner of [...chain].reverse()) {
      for (const method of owner.methods) effectiveMethods.set(method.name, { ...method, owner: owner.name });
    }
    return {
      tag,
      className: record.name,
      label: editorial.label,
      category: editorial.category,
      purpose: editorial.purpose,
      hydration: editorial.hydration,
      copy: editorial.copy,
      base: record.base,
      baseChain: chain.slice(1).map((item) => item.name),
      source: record.source,
      registration: {
        source: { file: record.file, line: record.registration.line, url: sourceUrl(record.file, record.registration.line) },
        repairHook: record.registration.repairHook,
        constructorArgs: record.registration.constructorArgs,
      },
      storedMembers: effectiveMembers,
      ownStoredMembers: record.serializedMembers.map((member) => member.name),
      conversions: [...effectiveMethods.values()].filter((method) => conversionSymbols.has(method.name)),
      mutationMethods: [...effectiveMethods.values()].filter((method) => method.callsFieldChanged),
      scriptingGlobal: chain.some((item) => item.scriptingGlobal),
      callers: callerEvidence(record),
    };
  })
  .sort((a, b) => a.category.localeCompare(b.category) || a.tag.localeCompare(b.tag));

const registeredTags = new Set(registrations.map((entry) => entry.tag));
const missingTaxonomy = Object.keys(taxonomy).filter((tag) => !registeredTags.has(tag));
if (missingTaxonomy.length) throw new Error(`Reviewed field tags are no longer registered: ${missingTaxonomy.join(', ')}`);
if (registeredTags.size !== registrations.length) throw new Error('Duplicate serialized field tags reached the generated reference');

const serializationPath = 'src/client/util/SerializationHelper.ts';
const serializationSource = sourceAt(serializationPath);
const serializationFile = ts.createSourceFile(serializationPath, serializationSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const runtimeSources = {};
const visitSerialization = (node) => {
  if ((ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) && node.name) {
    const name = node.name.getText(serializationFile);
    if (['Serialize', 'Deserialize', 'Deserializable', 'autoObject', 'afterDocDeserialize'].includes(name)) {
      const line = lineOf(serializationFile, node);
      runtimeSources[name] = { file: serializationPath, line, url: sourceUrl(serializationPath, line) };
    }
  }
  ts.forEachChild(node, visitSerialization);
};
visitSerialization(serializationFile);

const categories = [...new Set(registrations.map((entry) => entry.category))].sort();
const output = {
  schemaVersion: 1,
  generatedAt: sourceReference.generatedAt,
  repository: { remote, baseline },
  methodology: {
    registryParser: 'TypeScript compiler AST over every @Deserializable registration under src/fields',
    inheritanceParser: 'Resolved current class ancestry for inherited serializable members and field conversion methods',
    callerEvidence: 'Resolved static call edges from the source-generated API graph; dynamic calls may not appear',
    fieldFiles: fieldFiles.length,
  },
  summary: {
    primitiveTypes: 3,
    registeredTags: registrations.length,
    categories: categories.length,
    objectFieldTags: registrations.filter((entry) => entry.className !== 'Doc').length,
    referenceTags: registrations.filter((entry) => entry.category === 'identity' || entry.category === 'reference').length,
    repairHooks: registrations.filter((entry) => entry.registration.repairHook).length,
    scriptingGlobals: registrations.filter((entry) => entry.scriptingGlobal).length,
  },
  primitives: [
    { type: 'string', storedAs: 'JSON string', behavior: 'Passes through serialization unchanged; Cast accepts it only when typeof is string.' },
    { type: 'number', storedAs: 'JSON number', behavior: 'Passes through serialization unchanged; Cast accepts it only when typeof is number.' },
    { type: 'boolean', storedAs: 'JSON boolean', behavior: 'Passes through serialization unchanged; Cast accepts it only when typeof is boolean.' },
  ],
  runtimeSources,
  categories,
  registrations,
};

const outputPath = path.join(root, 'src', 'data', 'generated', 'field-types.json');
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

console.log(
  `Wrote ${outputPath}\n` +
  `${registrations.length} serialized tags across ${categories.length} categories; ` +
  `${output.summary.repairHooks} repair hooks; ${output.summary.scriptingGlobals} scripting-visible types.`,
);
