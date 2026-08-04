// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { unified } from '@astrojs/markdown-remark';
import { rehypeBaseUrls } from './src/plugins/rehype-base-urls.mjs';
import { rehypeContentA11y } from './src/plugins/rehype-content-a11y.mjs';

// Where the site is served from. Vercel serves it at a domain root, so `base`
// is empty by default. The original GitHub Pages deployment lives under a
// project path, which is what DOCS_BASE is for:
//
//   DOCS_BASE=/Dash-Documentation DOCS_SITE=https://brown-dash.github.io npm run build
//
// Pages always link with site-root paths like `/concepts/documents/`. Starlight
// rewrites the links it generates, and src/plugins/rehype-base-urls.mjs handles
// the ones authors write by hand, so neither needs the prefix spelled out.
const site = process.env.DOCS_SITE ?? 'https://brown-dash-documentation.vercel.app';
const base = process.env.DOCS_BASE ?? '/';

export default defineConfig({
  site,
  base,
  trailingSlash: 'always',
  markdown: {
    // Authors write site-root paths; this adds the base so they resolve in
    // production as well as in dev. See src/plugins/rehype-base-urls.mjs.
    // rehype-content-a11y adds the table header scopes and task-list labels
    // that markdown has no syntax for.
    processor: unified({
      rehypePlugins: [[rehypeBaseUrls, { base }], rehypeContentA11y],
    }),
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
      components: {
        PageTitle: './src/components/PageTitle.astro',
      },
      // Starlight ships Pagefind search, breadcrumbs via the sidebar, an
      // on-page table of contents, previous/next links, and mobile navigation.
      // None of that is rebuilt here.
      tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 },
      pagination: true,
      sidebar: [
        {
          label: 'Start',
          items: [
            { slug: 'overview/what-dash-is', label: '1. What Dash is' },
            { slug: 'getting-started/picture-tour', label: '2. Picture tour' },
            { slug: 'getting-started/environment', label: '3. Know the screen' },
            { slug: 'getting-started/basic-interactions', label: '4. Move, order, and resize things' },
            { slug: 'getting-started/using-dash', label: '5. Make your first board' },
            { slug: 'reference/interface-controls', label: 'Every button and node' },
            { slug: 'reference/context-menus', label: 'Every right-click menu' },
            { slug: 'reference/task-routes', label: 'Every way to do a thing' },
            { slug: 'reference/open-destinations', label: 'Where a document opens' },
            { slug: 'overview/current-state', label: 'What works right now' },
          ],
        },
        {
          label: 'Guides',
          items: [
            { slug: 'capabilities', label: 'Everything Dash can do' },
            {
              label: 'Do a real task',
              collapsed: true,
              items: [
                { slug: 'workflows/research-synthesis' },
                { slug: 'workflows/data-to-story' },
                { slug: 'workflows/agent-assisted' },
                { slug: 'workflows/team-workspace' },
              ],
            },
            {
              label: 'Work with documents',
              collapsed: true,
              items: [
                { slug: 'guides/documents/text' },
                { slug: 'guides/documents/pdf' },
                { slug: 'guides/documents/images' },
                { slug: 'guides/documents/webpage' },
                { slug: 'guides/documents/map' },
                { slug: 'guides/documents/dataviz' },
                { slug: 'guides/documents/audio' },
                { slug: 'guides/documents/video' },
                { slug: 'guides/documents/simulations' },
              ],
            },
            {
              label: 'Arrange collections',
              collapsed: true,
              items: [
                { slug: 'guides/views/freeform' },
                { slug: 'guides/views/schema' },
                { slug: 'guides/views/stacking' },
                { slug: 'guides/views/notetaking' },
              ],
            },
            {
              label: 'Use features',
              collapsed: true,
              items: [
                { slug: 'guides/features/linking' },
                { slug: 'guides/features/markup' },
                { slug: 'guides/features/ink' },
                { slug: 'guides/features/trails' },
                { slug: 'guides/features/search' },
                { slug: 'guides/features/animation' },
                { slug: 'guides/features/collaboration' },
                { slug: 'guides/features/generative-ai' },
                { slug: 'guides/features/scripting' },
                { slug: 'guides/features/trip-planner' },
              ],
            },
            {
              label: 'Change properties',
              collapsed: true,
              items: [
                { slug: 'guides/properties/properties', label: 'Properties overview' },
                { slug: 'guides/properties/fieldsandtags' },
                { slug: 'guides/properties/filters' },
                { slug: 'guides/properties/layout' },
                { slug: 'guides/properties/linkedto' },
                { slug: 'guides/properties/options' },
                { slug: 'guides/properties/othercontexts' },
                { slug: 'guides/properties/sharingpermissions' },
              ],
            },
            { slug: 'guides/videos', label: 'Watch demonstrations' },
          ],
        },
        {
          label: 'Technical',
          collapsed: true,
          items: [
            {
              label: 'Core ideas',
              collapsed: true,
              items: [
                { slug: 'concepts/documents' },
                { slug: 'concepts/collections' },
                { slug: 'concepts/links' },
                { slug: 'concepts/trails' },
                { slug: 'concepts/agents' },
                { slug: 'concepts/generative' },
              ],
            },
            {
              label: 'How it is built',
              collapsed: true,
              items: [
                { slug: 'architecture/engineering-model', label: 'How Dash actually works' },
                { slug: 'architecture/decisions-tradeoffs', label: 'Decisions and tradeoffs' },
                { slug: 'architecture/system-map' },
                { slug: 'architecture/document-model' },
                { slug: 'architecture/field-runtime' },
                { slug: 'architecture/rendering-lifecycle' },
                { slug: 'architecture/collections-views' },
                { slug: 'architecture/links-trails' },
                { slug: 'architecture/agents-ai' },
                { slug: 'architecture/server-storage-security' },
                { slug: 'architecture/import-export' },
                { slug: 'architecture/desktop-local-models' },
                { slug: 'architecture/undo-provenance' },
                { slug: 'technical/api', label: 'Generated API and registries' },
                { slug: 'technical/exported-symbols', label: 'Search exported symbols' },
              ],
            },
            {
              label: 'Build and extend',
              collapsed: true,
              items: [
                { slug: 'getting-started/running-dash', label: 'Run it locally' },
                { slug: 'development/extension-points', label: 'Choose where to extend it' },
                { slug: 'development/add-document-type' },
                { slug: 'development/add-collection-view' },
                { slug: 'development/add-agent-tool' },
                { slug: 'development/testing-release' },
                { slug: 'development/troubleshooting' },
                { slug: 'contributing/joining' },
                { slug: 'contributing/documentation' },
                { slug: 'contributing/inapp-links', label: 'Links from Dash into this site' },
              ],
            },
          ],
        },
        {
          label: 'Research',
          collapsed: true,
          items: [
            { slug: 'research/projects', label: 'All projects' },
            { slug: 'research/lineage', label: 'How projects became features' },
            { slug: 'research/publications' },
            { slug: 'research/reproducibility' },
            { slug: 'reference/branch-audit', label: 'Implementation archive' },
            {
              label: 'Cohorts by year',
              collapsed: true,
              items: [
                { slug: 'research/cohorts/2026' },
                { slug: 'research/cohorts/2025' },
                { slug: 'research/cohorts/2024' },
                { slug: 'research/cohorts/2023' },
                { slug: 'research/cohorts/2021-2022' },
                { slug: 'research/cohorts/2019-2020' },
              ],
            },
            { slug: 'research/people' },
            { slug: 'research/release-history' },
          ],
        },
        {
          label: 'Reference',
          collapsed: true,
          items: [
            { slug: 'reference/keyboard-shortcuts' },
            { slug: 'reference/context-menus', label: 'Right-click menu atlas' },
            { slug: 'reference/task-routes', label: 'Cross-route task index' },
            { slug: 'reference/open-destinations', label: 'Open destination map' },
            { slug: 'reference/generated-data', label: 'Generated data endpoints' },
            { slug: 'reference/document-types', label: 'Document types and schemas' },
            { slug: 'reference/collection-views' },
            { slug: 'reference/agent-tools' },
            { slug: 'reference/configuration' },
            { slug: 'reference/runtime-contracts' },
            { slug: 'reference/http-service-interface' },
            { slug: 'reference/synchronization-protocol' },
            { slug: 'reference/implementation-snapshot', label: 'Source coverage' },
            { slug: 'reference/status-taxonomy' },
            { slug: 'reference/glossary' },
          ],
        },
      ],
    }),
  ],
});
