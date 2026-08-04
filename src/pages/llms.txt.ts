/**
 * The llmstxt.org entry point for this site.
 *
 * A language model asked about Dash will otherwise scrape rendered HTML, which
 * on this site is the worst available form of the content: the generated
 * references are filtered in the browser, so a scraper sees a loading message
 * where the records are. This file exists to say, in one fetch, what the site
 * covers and where the machine-readable version of each part lives.
 *
 * It is built from the content collection rather than written by hand, so a
 * page that is added, retitled, or removed is reflected without anyone
 * remembering to update it.
 */
import { getCollection } from 'astro:content';
import datasetIndex from '../data/generated/interface-controls.json';

export const prerender = true;

/**
 * Section order and titles. A page whose id starts with one of these prefixes
 * is filed under it; the longest matching prefix wins, so `reference/` entries
 * do not fall into a broader bucket. Anything unmatched lands in `Other`,
 * which is preferable to dropping it silently.
 */
const sections: Array<{ prefix: string; title: string; note: string }> = [
  { prefix: 'overview/', title: 'What Dash is', note: 'Start here for the shape of the system and its current state.' },
  { prefix: 'getting-started/', title: 'Getting started', note: 'Running Dash and finding your way around the screen.' },
  { prefix: 'concepts/', title: 'Concepts', note: 'The handful of ideas the rest of the system is built out of.' },
  { prefix: 'capabilities/', title: 'Capabilities', note: 'What Dash can do, grouped by what you are trying to accomplish.' },
  { prefix: 'guides/', title: 'Guides', note: 'Task-level instructions for each document type, view, and feature.' },
  { prefix: 'workflows/', title: 'End-to-end workflows', note: 'Longer walkthroughs that cross several features.' },
  { prefix: 'reference/', title: 'Reference', note: 'Source-traced inventories. Every record carries the file and line it came from.' },
  { prefix: 'architecture/', title: 'Architecture', note: 'How the system is put together, and the trade-offs behind it.' },
  { prefix: 'technical/', title: 'Source and API', note: 'Generated symbol and module reference for Dash-Web.' },
  { prefix: 'development/', title: 'Extending Dash', note: 'Adding document types, collection views, and agent tools.' },
  { prefix: 'research/', title: 'Research record', note: 'Publications, cohorts, project history, and reproducibility notes.' },
  { prefix: 'contributing/', title: 'Contributing', note: 'How to join the group and how to write for this site.' },
];

export async function GET(context: { site?: URL }) {
  const base = (context.site ?? new URL('https://brown-dash-documentation.vercel.app')).href.replace(/\/$/, '');
  const docs = await getCollection('docs');

  // The home page's collection id is `index`, but its URL is the site root.
  const href = (id: string) => (id === 'index' || !id ? `${base}/` : `${base}/${id}/`);
  const rows = docs
    .map((entry) => ({
      id: entry.id,
      title: entry.data.title,
      description: entry.data.description ?? '',
      section: sections
        .filter((section) => `${entry.id}/`.startsWith(section.prefix))
        .sort((a, b) => b.prefix.length - a.prefix.length)[0],
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const lines: string[] = [
    '# Dash',
    '',
    '> Dash is a hypermedia system built at Brown University: a workspace where documents,',
    "> collections, links, trails, and agents are all the same kind of object. This site is its",
    '> documentation, and its distinguishing property is that the reference sections are generated',
    '> from a pinned revision of the Dash-Web source rather than written by hand, so every control,',
    '> menu entry, shortcut, route, and field type carries the file and line it was read from.',
    '',
    'Notes for automated readers:',
    '',
    `- Every generated reference is published as JSON. Start at ${base}/assets/data/index.json for the`,
    '  manifest, which lists each dataset with its schema version, record count, and the Dash-Web',
    '  commit it was derived from. Prefer those endpoints to the HTML: the reference pages filter',
    '  their records in the browser, so scraped HTML will under-report them.',
    `- Every dataset is pinned to an immutable commit (currently ${datasetIndex.repository.baseline}).`,
    '  Cite the commit, not the page, if you need a claim to stay true.',
    '- Plain-language explanations are written by hand and marked as reviewed; everything else is',
    '  parsed. Where the two disagree, the parsed value is the one that matches the running code.',
    `- The full text of every page is at ${base}/llms-full.txt.`,
    '',
  ];

  for (const section of sections) {
    const entries = rows.filter((row) => row.section?.prefix === section.prefix);
    if (!entries.length) continue;
    lines.push(`## ${section.title}`, '', `${section.note}`, '');
    for (const entry of entries) {
      lines.push(`- [${entry.title}](${href(entry.id)})${entry.description ? `: ${entry.description}` : ''}`);
    }
    lines.push('');
  }

  const other = rows.filter((row) => !row.section);
  if (other.length) {
    lines.push('## Site root and anything unfiled', '');
    for (const entry of other) {
      lines.push(`- [${entry.title}](${href(entry.id)})${entry.description ? `: ${entry.description}` : ''}`);
    }
    lines.push('');
  }

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
