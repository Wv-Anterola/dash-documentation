import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(root, 'src', 'data', 'generated', 'source-modules.json');
const overlayPath = path.join(root, 'src', 'data', 'symbolOverlays.ts');
const outputPath = path.join(root, 'src', 'data', 'generated', 'exported-symbols.json');

const sourceReference = JSON.parse(await readFile(sourcePath, 'utf8'));
const overlayTypeScript = await readFile(overlayPath, 'utf8');
const overlayJavaScript = ts.transpileModule(overlayTypeScript, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: overlayPath,
}).outputText;
const overlayModule = { exports: {} };
new Function('module', 'exports', overlayJavaScript)(overlayModule, overlayModule.exports);
const { symbolOverlays } = overlayModule.exports;

const slug = (value) => value
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

const normalizeDisplayText = (value) => value
  .replaceAll('\u00e2\u20ac\u2018', '\u2011')
  .replaceAll('\u00e2\u20ac\u2122', '\u2019')
  .replaceAll('\u00e2\u20ac\u0153', '\u201c')
  .replaceAll('\u00e2\u20ac\u009d', '\u201d')
  .replaceAll('\u00e2\u20ac\u201c', '\u2013')
  .replaceAll('\u00e2\u20ac\u201d', '\u2014')
  .replaceAll('\u00e2\u20ac\u02dc', '\u2018')
  .replaceAll('\u00e2\u20ac\u00a6', '\u2026');

const subsystemDefinitions = [
  { value: 'client', label: 'Client UI and runtime', prefix: 'src/client/' },
  { value: 'fields', label: 'Field system', prefix: 'src/fields/' },
  { value: 'server', label: 'Server and services', prefix: 'src/server/' },
  { value: 'components', label: 'Shared component package', prefix: 'packages/components/' },
  { value: 'source', label: 'Source utilities', prefix: 'src/' },
];

const subsystemFor = (modulePath) =>
  subsystemDefinitions.find((definition) => modulePath.startsWith(definition.prefix)) ?? {
    value: 'tooling',
    label: 'Tooling and repository utilities',
  };

const rows = [];
for (const module of sourceReference.modules) {
  const anchorCounts = new Map();
  const anchors = new Map();
  for (const symbol of module.symbols) {
    const base = slug(symbol.qualifiedName);
    const occurrence = (anchorCounts.get(base) ?? 0) + 1;
    anchorCounts.set(base, occurrence);
    anchors.set(symbol, occurrence === 1 ? base : `${base}-${occurrence}`);
  }

  const callsBySource = new Map();
  const referencesByTarget = new Map();
  for (const call of module.calls) {
    const calls = callsBySource.get(call.from) ?? new Set();
    calls.add(call.to);
    callsBySource.set(call.from, calls);

    const references = referencesByTarget.get(call.to) ?? new Set();
    references.add(call.from);
    referencesByTarget.set(call.to, references);
  }

  for (const symbol of module.symbols.filter((candidate) => candidate.exported)) {
    const overlay = symbolOverlays[symbol.id];
    const evidence = overlay ? 'reviewed' : symbol.documentation ? 'source' : 'declaration';
    const subsystem = subsystemFor(module.path);
    const calls = [...new Set([
      ...(callsBySource.get(symbol.name) ?? []),
      ...(callsBySource.get(symbol.qualifiedName) ?? []),
    ])].sort();
    const callers = [...new Set([
      ...(referencesByTarget.get(symbol.name) ?? []),
      ...(referencesByTarget.get(symbol.qualifiedName) ?? []),
    ])].sort();
    const anchor = anchors.get(symbol);
    if (!anchor) throw new Error(`Missing generated anchor for ${symbol.id}`);

    rows.push({
      id: `${slug(module.path)}--${anchor}`,
      name: symbol.name,
      qualifiedName: symbol.qualifiedName,
      kind: symbol.kind,
      visibility: symbol.visibility,
      signature: symbol.signature,
      module: module.path,
      subsystem: subsystem.value,
      subsystemLabel: subsystem.label,
      evidence,
      description: normalizeDisplayText(overlay?.summary || symbol.documentation || ''),
      lineStart: symbol.lineStart,
      lineEnd: symbol.lineEnd,
      calls,
      callers,
      contractPath: `/technical/api/modules/${slug(module.path)}/#${anchor}`,
      sourceUrl: symbol.sourceUrl,
    });
  }
}

rows.sort((left, right) =>
  left.qualifiedName.localeCompare(right.qualifiedName) ||
  left.module.localeCompare(right.module) ||
  left.lineStart - right.lineStart
);

const output = {
  schemaVersion: 1,
  generatedAt: sourceReference.generatedAt,
  repository: sourceReference.repository,
  methodology: {
    source: 'Semantic exported declarations, signatures, source ranges, and module-local calls from source-modules.json',
    contracts: 'Reviewed summaries from symbolOverlays.ts take precedence over source descriptions',
    navigation: 'Collision-safe module routes and declaration anchors use the same slug algorithm as the generated Astro pages',
  },
  summary: {
    exports: rows.length,
    modules: new Set(rows.map((row) => row.module)).size,
    reviewed: rows.filter((row) => row.evidence === 'reviewed').length,
    sourceDescribed: rows.filter((row) => row.evidence === 'source').length,
    declarationOnly: rows.filter((row) => row.evidence === 'declaration').length,
    kinds: new Set(rows.map((row) => row.kind)).size,
  },
  kinds: [...new Set(rows.map((row) => row.kind))].sort(),
  subsystems: [
    ...subsystemDefinitions.map(({ value, label }) => ({ value, label })),
    { value: 'tooling', label: 'Tooling and repository utilities' },
  ],
  rows,
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(
  `Wrote ${outputPath}\n` +
  `${output.summary.exports.toLocaleString()} exports across ${output.summary.modules.toLocaleString()} modules; ` +
  `${output.summary.reviewed} reviewed, ${output.summary.sourceDescribed} source-described, ` +
  `${output.summary.declarationOnly.toLocaleString()} declaration-only.`,
);
