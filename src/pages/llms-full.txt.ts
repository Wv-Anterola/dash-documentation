/**
 * The whole prose corpus in one plain-text fetch.
 *
 * Deliberately the *prose*, not the rendered page. The generated reference
 * tables are thousands of records that live in JSON and are filtered in the
 * browser; inlining them here would bury the writing under data that is already
 * published in a better form. Each page that renders a generated component
 * therefore keeps its explanation and gains a pointer to the dataset behind it,
 * which is the honest thing to hand a reader that cannot run JavaScript.
 */
import { getCollection } from 'astro:content';

export const prerender = true;

/** Component name in an MDX page, mapped to the dataset it renders. */
const componentDatasets: Record<string, string> = {
  InterfaceControlReference: 'interface-controls',
  ContextMenuReference: 'context-menus',
  KeyboardShortcutReference: 'keyboard-shortcuts',
  TaskRouteReference: 'task-routes',
  OpenDestinationReference: 'open-destinations',
  ProjectControlReference: 'project-controls',
  DocumentTypeReference: 'document-types',
  FieldTypeReference: 'field-types',
  HttpRouteReference: 'http-routes',
  ScriptingGlobalReference: 'scripting-globals',
  ExportedSymbolReference: 'exported-symbols',
  CreatorAtlas: 'document-types',
  DocumentPaletteReference: 'document-types',
  CollectionViewReference: 'document-types',
};

/**
 * Reduce an MDX body to readable text: drop the import block and the frontmatter
 * fence, and replace each component invocation with a line naming the dataset it
 * stands for so nothing silently disappears.
 */
function toPlainText(body: string, base: string): string {
  const withoutImports = body.replace(/^import\s.+?;\s*$/gm, '');
  const withComponents = withoutImports.replace(/<([A-Z][A-Za-z0-9]*)\s*\/>/g, (match, name: string) => {
    const dataset = componentDatasets[name];
    return dataset
      ? `[Generated reference rendered here. The records are published as JSON at ${base}/assets/data/${dataset}.json]`
      : `[Generated section rendered here: ${name}]`;
  });
  return withComponents
    .replace(/<\/?[A-Za-z][^>]*>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function GET(context: { site?: URL }) {
  const base = (context.site ?? new URL('https://brown-dash-documentation.vercel.app')).href.replace(/\/$/, '');
  const docs = (await getCollection('docs')).sort((a, b) => a.id.localeCompare(b.id));

  const header = [
    '# Dash documentation, full text',
    '',
    'Every page on this site, in reading order by path. Generated reference tables are not',
    'inlined: they are large, they change with the pinned source revision, and they are already',
    `published as JSON. The manifest is at ${base}/assets/data/index.json, and each page below`,
    'names the dataset that belongs to it where one is rendered.',
    '',
    `Pages: ${docs.length}`,
    '',
    '---',
    '',
  ].join('\n');

  const body = docs
    .map((entry) => {
      const url = entry.id === 'index' || !entry.id ? `${base}/` : `${base}/${entry.id}/`;
      const lines = [`# ${entry.data.title}`, '', `Source: ${url}`];
      if (entry.data.description) lines.push('', entry.data.description);
      lines.push('', toPlainText(entry.body ?? '', base));
      return lines.join('\n');
    })
    .join('\n\n---\n\n');

  return new Response(`${header}${body}\n`, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
