/**
 * Crawling is welcome; scraping the reference pages is not the good path.
 *
 * The generated references build their record lists in the browser, so a
 * crawler that reads the HTML gets a loading message rather than the records.
 * Pointing at llms.txt and the dataset manifest here is the cheapest way to
 * put a machine on the route that actually has the data.
 */
export const prerender = true;

export function GET(context: { site?: URL }) {
  const base = (context.site ?? new URL('https://brown-dash-documentation.vercel.app')).href.replace(/\/$/, '');
  const body = [
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${base}/sitemap-index.xml`,
    '',
    '# Machine-readable entry points, which carry more than the rendered HTML:',
    `#   ${base}/llms.txt            what this site covers, one link per page`,
    `#   ${base}/llms-full.txt       the full prose corpus`,
    `#   ${base}/assets/data/index.json  manifest of every generated dataset`,
    '',
  ].join('\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
