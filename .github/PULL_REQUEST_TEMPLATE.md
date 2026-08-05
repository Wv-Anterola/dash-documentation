<!--
Short is fine. The checks below run on this branch automatically; this list is
here so a failure is expected rather than surprising.
-->

## What changed

<!-- One or two sentences. -->

## Evidence

<!--
For a factual change: the source line, the dataset field, or the steps to
reproduce what you observed. If a claim cannot be pinned to any of those, say so
here rather than in the page.
-->

## Before merging

- [ ] `npm run verify` passes locally, or the CI run on this branch is green.
- [ ] If a page was added, moved, or renamed: `npm run visuals` was re-run and
      the result committed.
- [ ] If the pinned Dash-Web revision moved: `npm run audit:all` was re-run and
      every regenerated dataset committed in this change, alongside the prose it
      supports.
- [ ] No em dashes or en dashes in prose.
