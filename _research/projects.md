---
layout: default
title: Project index
permalink: /projects/
nav_order: 1
description: Every recovered Dash project with its cohort, system area, and evidence-backed implementation status.
---

# Project index
{: .no_toc }

Forty projects across six cohorts, with the part of Dash each one touched and
whether it is in the running system. This page is the index; the write-ups live
on the [cohort pages]({{ '/cohorts/' | relative_url }}), and the ideas behind
the work are in [Concepts]({{ '/concepts/' | relative_url }}).

<details open markdown="block">
  <summary>Table of contents</summary>
  {: .text-delta }
1. TOC
{:toc}
</details>

## How to read the status column

The distinction that carries weight is between *integrated* and everything
else. A project counts as integrated only if it can be pointed at in the
current `master` branch of Dash-Web: a document type registered in
`Documents.ts`, an entry in `CollectionViewType`, a tool constructed in the
agent registry, or code one of those calls.

A merged branch does not qualify on its own, and neither does a demo recording,
a screenshot, or a finished report. Several projects below have all three and
are still not in the application. Each write-up records what was checked, under
"Evidence for the status above".

{% include status-key.html %}

## All projects

<div class="filter-bar">
  <div>
    <label for="filter-cohort">Cohort</label>
    <select id="filter-cohort">
      <option value="">Any</option>
      {%- for c in site.data.cohorts %}
      <option value="{{ c.id }}">{{ c.title }}</option>
      {%- endfor %}
    </select>
  </div>
  <div>
    <label for="filter-area">System area</label>
    <select id="filter-area">
      <option value="">Any</option>
      {%- assign areas = "" | split: "" -%}
      {%- for c in site.data.cohorts -%}
        {%- for p in site.data.projects[c.id] -%}
          {%- assign areas = areas | push: p.area -%}
        {%- endfor -%}
      {%- endfor -%}
      {%- assign areas = areas | uniq | sort -%}
      {%- for a in areas %}
      <option value="{{ a }}">{{ a }}</option>
      {%- endfor %}
    </select>
  </div>
  <div>
    <label for="filter-status">Status</label>
    <select id="filter-status">
      <option value="">Any</option>
      {%- for st in site.data.statuses %}
      <option value="{{ st.key }}">{{ st.label }}</option>
      {%- endfor %}
    </select>
  </div>
</div>

<p class="filter-status" id="filter-count" role="status"></p>

<div class="table-scroll">
<table class="project-table" id="project-table">
  <thead>
    <tr>
      <th scope="col">Project</th>
      <th scope="col">Cohort</th>
      <th scope="col">Area</th>
      <th scope="col">Status</th>
      <th scope="col">Concepts</th>
    </tr>
  </thead>
  <tbody>
  {%- for c in site.data.cohorts -%}
    {%- for p in site.data.projects[c.id] -%}
      {%- assign anchor = p.title | slugify -%}
      {%- capture href %}/cohorts/{{ c.id }}/#{{ anchor }}{% endcapture %}
    <tr data-cohort="{{ c.id }}" data-status="{{ p.status }}" data-area="{{ p.area }}">
      <th scope="row">
        <a href="{{ href | relative_url }}">{{ p.title }}</a>
        {%- if p.people %}<span class="project-table__people">{{ p.people | join: ", " }}</span>{%- endif %}
      </th>
      <td class="nowrap">{{ c.short }}</td>
      <td>{{ p.area }}</td>
      <td>{% include status-badge.html key=p.status %}</td>
      <td class="project-table__concepts">{% include concept-links.html concepts=p.concepts %}</td>
    </tr>
    {%- endfor -%}
  {%- endfor %}
  </tbody>
</table>
</div>

<script>
    // Progressive enhancement. Without JavaScript the full table renders, which
    // is the useful default; the filters only hide rows already in the page.
    (function () {
        const table = document.getElementById('project-table');
        const count = document.getElementById('filter-count');
        const selects = ['filter-cohort', 'filter-area', 'filter-status'].map(id => document.getElementById(id));
        if (!table || !count || selects.some(s => !s)) return;

        const rows = Array.from(table.tBodies[0].rows);
        const keys = ['cohort', 'area', 'status'];

        function apply() {
            let shown = 0;
            rows.forEach(row => {
                const ok = selects.every((sel, i) => !sel.value || row.dataset[keys[i]] === sel.value);
                row.hidden = !ok;
                if (ok) shown++;
            });
            count.textContent = shown === rows.length
                ? `Showing all ${rows.length} projects.`
                : `Showing ${shown} of ${rows.length} projects.`;
        }

        selects.forEach(s => s.addEventListener('change', apply));
        apply();
    })();
</script>

## Where the work went

Counted by system area, which is a rough map of what the group has spent seven
years on.

<div class="table-scroll" markdown="1">

| Area | Projects | Integrated |
| :--- | ---: | ---: |
{%- assign all_areas = "" | split: "" -%}
{%- for c in site.data.cohorts -%}
  {%- for p in site.data.projects[c.id] -%}
    {%- assign all_areas = all_areas | push: p.area -%}
  {%- endfor -%}
{%- endfor -%}
{%- assign uniq_areas = all_areas | uniq | sort -%}
{%- for a in uniq_areas -%}
  {%- assign total = 0 -%}
  {%- assign integ = 0 -%}
  {%- for c in site.data.cohorts -%}
    {%- for p in site.data.projects[c.id] -%}
      {%- if p.area == a -%}
        {%- assign total = total | plus: 1 -%}
        {%- if p.status == "integrated" %}{% assign integ = integ | plus: 1 %}{% endif -%}
      {%- endif -%}
    {%- endfor -%}
  {%- endfor %}
| {{ a }} | {{ total }} | {{ integ }} |
{%- endfor %}

</div>

The document model and the agent system dominate, for different reasons.
Document types are the cheapest thing to add, so that is what a one-semester
project often becomes. The agent system is recent and concentrated: nearly all
of it arrived in 2025 and 2026, on top of the tool registry.
