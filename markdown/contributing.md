---
layout: default
title: Contributing to this site
permalink: /contributing/
nav_order: 10
---

# Contributing to this site
{: .no_toc }

How to run this site locally and how to add your cohort's work to it. Written so
that adding next year's cohort takes an afternoon rather than a redesign.

<details open markdown="block">
  <summary>Table of contents</summary>
  {: .text-delta }
1. TOC
{:toc}
</details>

## Running it locally

You need Ruby and Bundler.

```bash
git clone https://github.com/brown-dash/Dash-Documentation.git
cd Dash-Documentation
bundle install
bundle exec jekyll serve --config _config.yml,_config_local.yml
```

Then open <http://localhost:4000/>.

The two config files matter. `_config.yml` is what GitHub Pages uses: it sets
`baseurl` to `/Dash-Documentation` and pulls the theme with `remote_theme`.
`_config_local.yml` overrides both, so links resolve at the root of localhost
and the theme comes from the gem instead of the network. Serving without it
will appear to work and then 404 on every internal link.

To check what the deployed site will look like, build with the production config
alone:

```bash
bundle exec jekyll build
```

{: .note }
> On Windows, `bundle install` needs a C toolchain to build a few native gems.
> If it fails on `http_parser.rb` or `eventmachine`, you are missing `make` and
> a compiler. `scoop install ruby gcc msys2` followed by
> `pacman -S make` inside the msys2 shell is one way through it.

## Adding a cohort

Two steps.

**1. Add the cohort to `_data/cohorts.yml`**, at the top, newest first:

```yaml
- id: 2027
  title: Spring 2027 to Fall 2027
  short: Spring/Fall 2027
  current: true
  start: 2027-01
  end: 2027-12
  commits: 0
  summary: >-
    Two or three sentences on what the year was actually about. Not a list of
    features; the projects below cover those.
  themes:
    - A theme
    - Another theme
```

Remove `current: true` from the previous cohort. Exactly one cohort should have
it, since the homepage and the People page both use it to find the current one.

For `commits`, run this against a Dash-Web checkout:

```bash
git log --all --since=2027-01-01 --until=2027-12-31 --oneline | wc -l
```

**2. Add the roster to `_data/people.yml`** under `rosters:`, keyed by the same
id. To find who was active:

```bash
git log --all --since=2027-01-01 --until=2027-12-31 --pretty=format:"%an" |
  sort | uniq -c | sort -rn
```

Use real names. If a GitHub account has no name attached and you cannot work out
whose it is, put the handle in and note it, the way `Skitty1238` is handled in
the 2025 roster. Do not guess.

**3. Create `markdown/cohorts/2027.md`.** Copy an existing one; the whole file
is front matter plus a few includes:

```markdown
---
layout: default
title: Spring 2027 to Fall 2027
parent: Cohorts
permalink: /cohorts/2027/
nav_order: 1
cohort_id: 2027
---

{% raw %}{% assign cohort = site.data.cohorts | where: "id", page.cohort_id | first %}{% endraw %}

# {% raw %}{{ cohort.title }}{% endraw %}
{: .no_toc }

<p class="lede">{% raw %}{{ cohort.summary }}{% endraw %}</p>

## Who was here

{% raw %}{% include cohort-roster.html cohort_id=page.cohort_id %}{% endraw %}

## Projects

{% raw %}{% include cohort-projects.html cohort_id=page.cohort_id %}{% endraw %}
```

Bump `nav_order` on the older cohort pages so the newest stays first.

Nothing else needs touching. The cohort index, the projects index and its
filters, and the People page all read from the data files.

## Adding a project

Add an entry under your cohort's id in `_data/projects.yml`. Only `title`,
`status`, and `problem` are required; every other block is skipped when absent,
so a short entry renders as a short entry rather than a page of empty headings.

```yaml
  - title: A short, specific name
    people: [Your Name]
    status: integrated
    problem: >-
      What was actually wrong or missing before. Not "there was no X" but why
      the absence of X mattered.
    approach: >-
      The shape of the solution, and the choice you made that another person
      might not have made.
    contribution: >-
      What you built. Specifics are better than categories. If half the work
      was making something not break, say that.
    relation: >-
      How it connects to the rest of Dash.
    outcome: >-
      Where it ended up, including what does not work.
    tech: [TypeScript, React]
    code: "`DocumentType.YOURS`; branch `your-branch`"
    evidence: >-
      What you checked to justify the status above.
```

## Choosing a status honestly

This is the part that matters most, because it is the part that makes the rest
of the site worth trusting.

The vocabulary is in `_data/statuses.yml`. The rule for `integrated` is that
someone else must be able to find your work in the current `master` branch of
Dash-Web without taking your word for it. That means one of:

- a document type declared in `DocumentTypes.ts` and constructed in `Documents.ts`
- an entry in `CollectionViewType` that `CollectionView.tsx` switches on
- a tool constructed in the agent registry in `agentsystem/Agent.ts`
- source on `master` that one of the above calls

A merged branch is not sufficient on its own; branches get merged and then
superseded. A demo recording, a screenshot, and a completed final report are all
not sufficient either.

If your branch is not merged, the status is `implemented`, and that is a normal
outcome, not a failure. If you built something to answer a question rather than
to ship, it is `prototype`. Write the `evidence` field as though the person
reading it will go and check, because eventually somebody will.

## Editing feature documentation

Feature pages live under `markdown/features/`, `markdown/documents/`,
`markdown/views/`, and `markdown/properties/`.

Two conventions worth keeping:

**Reference assets through `relative_url`,** not relative paths:

```markdown
![Alt text describing the interaction]({% raw %}{{ '/assets/gifs/thing.gif' | relative_url }}{% endraw %}){:.img}
```

The old pages used `../../assets/...`, with the number of `../` guessed from the
page's nesting. Several were wrong. `relative_url` cannot be, and it picks up
the production base URL for free.

**Always write alt text.** These pages are mostly screen recordings of
interactions, and an empty `alt` makes them invisible to anyone who cannot see
them. Describe what happens, not that it is a GIF.

**End permalinks with a slash.** Mixing `/foo/` and `/foo` puts pages at
different directory depths and breaks relative paths written for the other form.

## If a feature is removed

Do not delete its documentation page. Add the `removed` callout at the top,
explaining when it went and why, and set the project's status to `archived`:

```markdown
{: .removed }
> Physics simulation documents were removed from Dash. This page is kept as a
> record of what the feature did.
```

The physics simulation page is the worked example. A group that deletes the
record of work that did not survive ends up unable to explain its own history.

## Checking your work

There is no CI on this repository. Before you commit, build the site and click
through what you changed. Internal links, anchors, and image paths are the three
things that break most often and the three things nobody notices until a visitor
does.
