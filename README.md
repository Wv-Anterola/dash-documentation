# Dash documentation

Documentation and project history for [Dash](https://github.com/brown-dash/Dash-Web),
a component-based hypermedia system built by Andries van Dam's research group at
Brown University and in continuous development since December 2018.

The site covers what Dash is, its complete user-facing capability surface,
end-to-end workflows, how the current system is put together, and what each
student cohort contributed. Every recovered project has an evidence-backed
implementation status and every integrated project maps back into the
capability it expanded.

Most of the reference is generated rather than written by hand. Parsers read a
pinned Dash-Web revision and emit inventories of every interface control,
right-click menu entry, keyboard shortcut, document type, serialized field,
HTTP route, scripting global, and exported symbol, each row line-addressed to
an immutable commit. Those inventories are published as JSON at
`/assets/data/`, and generation fails when the code a row describes moves, so
drift is a build error rather than a silent inaccuracy.

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
npm run audit:all # regenerate every source-derived inventory (needs a Dash-Web checkout)
npm run coverage  # verify integrated projects map to canonical capability docs
npm run encoding  # reject mojibake and replacement characters
npm run examples  # resolve every field in a documented query against the real dataset
npm run links     # internal link, anchor, image, and heading checks over dist/
npm run test:e2e  # generated reference, archive, and mobile-navigation checks
```

Run `npm run verify` before committing: it is the whole gate, in the order CI
runs it. For the edit loop use `npm run preflight`, the fast half (unit tests,
encoding, coverage, quality), which needs no build, finishes in under a minute,
and catches the failure that actually happens: a generated file that was not
regenerated after an edit. `npm test` on its own does not catch that. Run
`npm run hooks:install` once to have `preflight` run on every push.

Every check names the command that fixes it when it fails. Read the `fix:` line
before investigating anything. [How this site is
built](https://brown-dash-documentation.vercel.app/contributing/pipeline/) maps
every generator, dataset, and check, and is itself generated from the repository.

Node 22 or newer. Dependency updates arrive monthly as grouped pull requests,
each gated by the same checks, so an upgrade that breaks something fails on its
own branch.

The same steps run in CI on every push and pull request
(`.github/workflows/verify.yml`). CI does not run `audit:all`, because those
generators read a sibling Dash-Web checkout it does not have; their output is
committed and the other checks prove it is internally consistent and
source-addressed.

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
  pages/assets/data/  published JSON endpoints, one per generated dataset
scripts/
  build-source-reference.mjs
                      classifies every reachable blob and parses source by SHA
  build-interface-control-reference.mjs
                      every persistent control, including the tab and tile chrome
  build-context-menu-reference.mjs
                      every right-click entry, its guards, nesting, and effects
  build-keyboard-shortcut-reference.mjs
                      the modifier router, both platform chords, and event control
  build-project-control-reference.mjs
                      controls a workspace preset adds, pinned to its own branch
  build-task-route-reference.mjs
                      everyday tasks resolved to every control, menu, and shortcut
  build-typedoc-reference.mjs
                      generates TypeDoc JSON from an immutable Git archive
  check-capability-coverage.mjs
                      rejects incomplete inventories, parser failures, and dead evidence
  check-documentation-quality.mjs
                      page metadata, media, prose, and every generated inventory invariant
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

Work that lives on an unmerged feature branch is documented as such: those rows
are pinned to the branch tip, carry a `mergedIntoMaster` flag, and the pages
using them say plainly that the feature is not on the mainline.
