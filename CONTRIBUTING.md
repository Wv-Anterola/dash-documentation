# Contributing

Thank you for looking. The most valuable contribution to this site is not a new
page: it is telling us that a record here is wrong.

## Three commands

```bash
npm install
npm run dev         # local site at localhost:4321
npm run preflight   # run this before you push
```

`preflight` is the fast half of the full gate: unit tests, encoding, coverage,
and quality. It needs no build, takes under a minute, and catches the failure
that actually happens here, which is a generated file that was not regenerated
after an edit. `npm test` on its own does not catch that.

`npm run verify` is the whole gate, in the order CI runs it. Run it before a
pull request. `npm run hooks:install` wires `preflight` to a pre-push hook if
you would rather not remember.

## When a check fails, read the `fix:` line

Most failures here are a stale generated file rather than a mistake in what you
wrote, and every check names the command that resolves it:

```text
Pages without inline media also lack a unique page visual:
  - /contributing/pipeline
    fix: run `npm run visuals` and commit the result, because the registry
    assigns a visual to every page it finds, and it has not been re-run since
    these pages were added.
```

Three commands resolve nearly everything:

| Command | Use it when |
| :--- | :--- |
| `npm run visuals` | A page was added, moved, or grew its own image. |
| `npm run audit:all` | The pinned Dash-Web revision moved. Needs a sibling Dash-Web checkout. |
| `npm run preflight` | Before pushing. |

## How the site is built

Reference content is not typed into pages. A generator reads a pinned Dash-Web
revision and writes a dataset; the dataset is committed, because CI has no
Dash-Web checkout; a component renders it; a test asserts it; a check proves it
still agrees with the pages.

[How this site is built](https://brown-dash-documentation.vercel.app/contributing/pipeline/)
maps every generator, dataset, and check, and is itself generated from this
repository, so it cannot go stale. Read it before adding a generator.

## Reporting a wrong record

Automation catches structural drift: when a control is renamed or deleted, the
generator that describes it fails and the build stops. What automation cannot
catch is a plain-language explanation that is simply wrong. Those are the
reports worth making, and the issue templates ask for the two things needed to
act on one: which record, and what the source actually does.

## House rules

- Commit messages are short lowercase phrases.
- No em dashes or en dashes in prose. Use a colon, semicolon, comma, or
  parentheses.
- A claim needs evidence. If a statement cannot be pinned to a source line, a
  published dataset, or an observation someone can repeat, say plainly that it
  is unverified rather than asserting it.
- Do not raise a coverage number by writing something you do not know. The
  [coverage report](https://brown-dash-documentation.vercel.app/reference/documentation-coverage/)
  counts explained separately from traced precisely so that gaps stay visible
  instead of being averaged away.

Longer guidance, including page structure, media rules, and the weight budget,
is at [contributing to the
documentation](https://brown-dash-documentation.vercel.app/contributing/documentation/).
