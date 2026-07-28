// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { rehypeBaseUrls } from './src/plugins/rehype-base-urls.mjs';

// Where the site is served from. Vercel serves it at a domain root, so `base`
// is empty by default. The original GitHub Pages deployment lives under a
// project path, which is what DOCS_BASE is for:
//
//   DOCS_BASE=/Dash-Documentation DOCS_SITE=https://brown-dash.github.io npm run build
//
// Pages always link with site-root paths like `/concepts/documents/`. Starlight
// rewrites the links it generates, and src/plugins/rehype-base-urls.mjs handles
// the ones authors write by hand, so neither needs the prefix spelled out.
const site = process.env.DOCS_SITE ?? 'https://dash-documentation.vercel.app';
const base = process.env.DOCS_BASE ?? '/';

export default defineConfig({
  site,
  base,
  trailingSlash: 'always',
  markdown: {
    // Authors write site-root paths; this adds the base so they resolve in
    // production as well as in dev. See src/plugins/rehype-base-urls.mjs.
    rehypePlugins: [[rehypeBaseUrls, { base }]],
  },
  // The Jekyll site used flat permalinks. These keep old links and bookmarks
  // working; Astro emits a meta-refresh page for each in a static build.
  redirects: {
    '/about/': '/overview/what-dash-is/',
    '/system/': '/architecture/',
    '/projects/': '/research/projects/',
    '/cohorts/': '/research/cohorts/',
    '/cohorts/2026/': '/research/cohorts/2026/',
    '/cohorts/2025/': '/research/cohorts/2025/',
    '/cohorts/2024/': '/research/cohorts/2024/',
    '/cohorts/2023/': '/research/cohorts/2023/',
    '/cohorts/2021-2022/': '/research/cohorts/2021-2022/',
    '/cohorts/2019-2020/': '/research/cohorts/2019-2020/',
    '/research-team/': '/research/people/',
    '/release-notes/': '/research/release-history/',
    '/joining-dash/': '/contributing/joining/',
    '/contributing/': '/contributing/documentation/',
    '/getting-started/': '/getting-started/using-dash/',
    '/environment/': '/getting-started/environment/',
    '/videos/': '/guides/videos/',
    '/documents/': '/guides/documents/documents/',
    '/documents/text/': '/guides/documents/text/',
    '/documents/pdf/': '/guides/documents/pdf/',
    '/documents/images/': '/guides/documents/images/',
    '/documents/webpage/': '/guides/documents/webpage/',
    '/documents/map/': '/guides/documents/map/',
    '/documents/dataViz/': '/guides/documents/dataviz/',
    '/documents/simulations/': '/guides/documents/simulations/',
    '/documents/tempMedia/': '/guides/documents/temporal-media/',
    '/documents/tempMedia/audio/': '/guides/documents/audio/',
    '/documents/tempMedia/video/': '/guides/documents/video/',
    '/views/': '/guides/views/views/',
    '/views/freeform/': '/guides/views/freeform/',
    '/views/schema/': '/guides/views/schema/',
    '/views/stacking/': '/guides/views/stacking/',
    '/views/notetaking/': '/guides/views/notetaking/',
    '/features/': '/guides/features/features/',
    '/features/linking/': '/guides/features/linking/',
    '/features/markup/': '/guides/features/markup/',
    '/features/ink/': '/guides/features/ink/',
    '/features/trails/': '/guides/features/trails/',
    '/features/trails/tips/': '/guides/features/trails-tips/',
    '/features/search/': '/guides/features/search/',
    '/features/animation/': '/guides/features/animation/',
    '/features/scripting/': '/guides/features/scripting/',
    '/features/collaboration/': '/guides/features/collaboration/',
    '/features/generativeai/': '/guides/features/generative-ai/',
    '/properties/': '/guides/properties/properties/',
    '/properties/fields-and-tags/': '/guides/properties/fieldsandtags/',
    '/properties/filters/': '/guides/properties/filters/',
    '/properties/layout/': '/guides/properties/layout/',
    '/properties/linked-to/': '/guides/properties/linkedto/',
    '/properties/options/': '/guides/properties/options/',
    '/properties/other-contexts/': '/guides/properties/othercontexts/',
    '/properties/sharing-and-permissions/': '/guides/properties/sharingpermissions/',
  },
  integrations: [
    starlight({
      title: 'Dash',
      description:
        'Documentation and project history for Dash, a component-based hypermedia system built by Andries van Dam\'s research group at Brown University.',
      logo: {
        src: './public/assets/images/medium-blue-light-blue.png',
        alt: '',
        replacesTitle: false,
      },
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/brown-dash' },
      ],
      editLink: {
        baseUrl: 'https://github.com/Wv-Anterola/dash-documentation/edit/main/',
      },
      lastUpdated: true,
      customCss: ['./src/styles/dash.css'],
      // Starlight ships Pagefind search, breadcrumbs via the sidebar, an
      // on-page table of contents, previous/next links, and mobile navigation.
      // None of that is rebuilt here.
      tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 },
      pagination: true,
      sidebar: [
        {
          label: 'Overview',
          items: [
            { slug: 'index' },
            { slug: 'overview/what-dash-is' },
            { slug: 'overview/current-state' },
          ],
        },
        {
          label: 'Getting started',
          items: [
            { slug: 'getting-started/environment' },
            { slug: 'getting-started/using-dash' },
            { slug: 'getting-started/running-dash' },
          ],
        },
        {
          label: 'Concepts',
          items: [
            { slug: 'concepts' },
            { slug: 'concepts/documents' },
            { slug: 'concepts/collections' },
            { slug: 'concepts/links' },
            { slug: 'concepts/trails' },
            { slug: 'concepts/agents' },
            { slug: 'concepts/generative' },
          ],
        },
        {
          label: 'Using Dash',
          collapsed: true,
          // Each subsection is autogenerated, so a new guide page appears
          // without a config edit. The groups are listed individually only to
          // give them labels: autogenerating `guides` wholesale names each
          // group after its directory, which put "documents" and "tempMedia"
          // in the sidebar.
          items: [
            {
              label: 'Features',
              collapsed: true,
              items: [{ autogenerate: { directory: 'guides/features' } }],
            },
            {
              label: 'Document types',
              collapsed: true,
              items: [{ autogenerate: { directory: 'guides/documents' } }],
            },
            {
              label: 'Collection views',
              collapsed: true,
              items: [{ autogenerate: { directory: 'guides/views' } }],
            },
            {
              label: 'Properties panel',
              collapsed: true,
              items: [{ autogenerate: { directory: 'guides/properties' } }],
            },
            { slug: 'guides/videos' },
          ],
        },
        {
          label: 'Architecture',
          items: [
            { slug: 'architecture' },
            { slug: 'architecture/extension-points' },
          ],
        },
        {
          label: 'Research and history',
          items: [
            { slug: 'research/projects' },
            { slug: 'research/cohorts' },
            { slug: 'research/cohorts/2026' },
            { slug: 'research/cohorts/2025' },
            { slug: 'research/cohorts/2024' },
            { slug: 'research/cohorts/2023' },
            { slug: 'research/cohorts/2021-2022' },
            { slug: 'research/cohorts/2019-2020' },
            { slug: 'research/people' },
            { slug: 'research/release-history' },
          ],
        },
        {
          label: 'Development',
          items: [{ slug: 'development' }],
        },
        {
          label: 'Contributing',
          items: [
            { slug: 'contributing/joining' },
            { slug: 'contributing/documentation' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { slug: 'reference/status-taxonomy' },
            { slug: 'reference/glossary' },
          ],
        },
      ],
    }),
  ],
});
