# Dash documentation

Documentation and project history for [Dash](https://github.com/brown-dash/Dash-Web),
a component-based hypermedia system built by Andries van Dam's research group at
Brown University and in continuous development since December 2018.

The site covers what Dash is, its complete user-facing capability surface,
end-to-end workflows, how the current system is put together, and what each
student cohort contributed. Every recovered project has an evidence-backed
implementation status and every integrated project maps back into the
capability it expanded.

## Relationship to the upstream project

Dash itself lives at [brown-dash/Dash-Web](https://github.com/brown-dash/Dash-Web),
and the research group's own documentation site is
[brown-dash/Dash-Documentation](https://github.com/brown-dash/Dash-Documentation),
published at <https://brown-dash.github.io/Dash-Documentation/>.

**This repository is a personal rework of that documentation, not an official
publication of the research group.** Where the two disagree, the group's copy is
the authority. Nothing here changes the upstream repositories.

## Running it

```bash
npm install
npm run dev
```

The site is [Astro](https://astro.build) with
[Starlight](https://starlight.astro.build). Content is MDX in this repository;
there is no hosted editor and no account required.

```bash
npm run build     # production build into dist/
npm run preview   # serve the built output
npm run check     # Astro and TypeScript diagnostics
npm test          # semantic parser and immutable-link unit tests
npm run audit:all # branch tips, reachable history, semantic API, and TypeDoc JSON
npm run coverage  # verify integrated projects map to canonical capability docs
npm run encoding  # reject mojibake and replacement characters
npm run links     # internal link, anchor, image, and heading checks over dist/
npm run test:e2e  # generated reference, archive, and mobile-navigation checks
```

Run `npm run verify` before committing.

## Where things live

```text
src/
  content/docs/       every page, as MDX
  components/         Dash-specific components only
  data/
    dash.ts           cohorts, concepts, statuses, people, helpers
    projects.ts       the project records
    capabilities.ts   product capabilities and project-to-feature mappings
    researchArchive.ts
                      structured projects, people, publications, and evidence
    generated/        full inventory, semantic API, history, TypeDoc, branches
  styles/dash.css     palette and component styling
scripts/
  build-source-reference.mjs
                      classifies every reachable blob and parses source by SHA
  build-typedoc-reference.mjs
                      generates TypeDoc JSON from an immutable Git archive
  check-capability-coverage.mjs
                      rejects incomplete inventories, parser failures, and dead evidence
astro.config.mjs      sidebar, redirects, and site configuration
public/assets/        images and screen recordings
```

Sidebar, search, table of contents, previous/next links, mobile navigation, and
dark mode all come from Starlight and are not reimplemented.

The documentation includes its own maintenance guide, covering how to add a
page, add a cohort or project, connect a project to a concept, and choose an
implementation status honestly. It is the `Contributing` section of the built
site, at `src/content/docs/contributing/documentation.mdx`.

## Where the site is served from

By default the build targets a domain root, which is what Vercel serves.

To build for a subpath, such as the GitHub Pages deployment, set both variables:

```bash
DOCS_BASE=/Dash-Documentation DOCS_SITE=https://brown-dash.github.io npm run build
DOCS_BASE=/Dash-Documentation npm run links
```

On Git Bash for Windows, prefix those commands with `MSYS_NO_PATHCONV=1` or the
shell rewrites `/Dash-Documentation` into a Windows path.

## A note on accuracy

Implementation statuses are checked against the current Dash-Web application,
runtime evidence, and surviving research artifacts. Each project states what
was verified and which questions remain open. Cohort rosters are provisional
until the research group confirms membership and project roles from its records.

Some entries are deliberately marked as unclear or documentation-only. That is
the honest state of the evidence, not an omission.
