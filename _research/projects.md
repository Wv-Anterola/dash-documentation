---
layout: default
title: Projects
permalink: /projects/
nav_order: 1
---

# Projects
{: .no_toc }

Every project we could tie to evidence, across all cohorts, with its
implementation status. Follow a project title to the full write-up on its
cohort page.

<details open markdown="block">
  <summary>Table of contents</summary>
  {: .text-delta }
1. TOC
{:toc}
</details>

## Status vocabulary

{% include status-key.html %}

## All projects

<div class="filter-bar">
  <div>
    <label for="filter-cohort">Cohort</label>
    <select id="filter-cohort">
      <option value="">All cohorts</option>
      {%- for c in site.data.cohorts %}
      <option value="{{ c.id }}">{{ c.title }}</option>
      {%- endfor %}
    </select>
  </div>
  <div>
    <label for="filter-status">Status</label>
    <select id="filter-status">
      <option value="">All statuses</option>
      {%- for st in site.data.statuses %}
      <option value="{{ st.key }}">{{ st.label }}</option>
      {%- endfor %}
    </select>
  </div>
</div>

<p class="filter-status" id="filter-count" role="status"></p>

<ul class="project-grid" id="project-grid">
  {%- for c in site.data.cohorts -%}
    {%- for p in site.data.projects[c.id] %}
  {%- assign anchor = p.title | slugify -%}
  {%- capture href %}/cohorts/{{ c.id }}/#{{ anchor }}{% endcapture -%}
  <li class="project-card" data-cohort="{{ c.id }}" data-status="{{ p.status }}">
    {%- comment -%}
      Card titles are divs rather than headings on purpose. The theme's
      heading-anchor pass rewrites every h1-h6 in page content, which on a
      forty-card grid produced forty anchor links all pointing at the enclosing
      section. The list gives the structure; each card has exactly one link.
    {%- endcomment -%}
    <div class="project-card__title"><a href="{{ href | relative_url }}">{{ p.title }}</a></div>
    <p>{{ p.problem | strip_html | truncate: 180 }}</p>
    <div class="project-card__meta">
      {% include status-badge.html key=p.status %}
      <span>{{ c.short }}</span>
      {%- if p.people %}<span>{{ p.people | join: ", " }}</span>{%- endif %}
    </div>
  </li>
    {%- endfor -%}
  {%- endfor %}
</ul>

<script>
    // Progressive enhancement: without JavaScript every project is listed, which
    // is the useful default. The filters only ever hide cards that are already
    // in the page, so nothing depends on this running.
    (function () {
        const grid = document.getElementById('project-grid');
        const cohortSelect = document.getElementById('filter-cohort');
        const statusSelect = document.getElementById('filter-status');
        const count = document.getElementById('filter-count');
        if (!grid || !cohortSelect || !statusSelect || !count) return;

        const cards = Array.from(grid.querySelectorAll('.project-card'));

        function apply() {
            const cohort = cohortSelect.value;
            const status = statusSelect.value;
            let shown = 0;
            cards.forEach(card => {
                const ok =
                    (!cohort || card.dataset.cohort === cohort) &&
                    (!status || card.dataset.status === status);
                card.classList.toggle('is-hidden', !ok);
                if (ok) shown++;
            });
            count.textContent =
                shown === cards.length
                    ? `Showing all ${cards.length} projects.`
                    : `Showing ${shown} of ${cards.length} projects.`;
        }

        cohortSelect.addEventListener('change', apply);
        statusSelect.addEventListener('change', apply);
        apply();
    })();
</script>

## How to read the statuses

The distinction that matters most is between *integrated* and everything else.
A project is integrated only if we could point at it in the current `master`
branch: a document type registered in `Documents.ts`, an entry in
`CollectionViewType`, a tool constructed in the agent's registry, or code one of
those calls. Each project's write-up records exactly what we checked, under
"Evidence for the status above".

A merged branch on its own does not qualify, and neither does a demo recording
or a screenshot. Several projects here have both and are still not in the
application.
