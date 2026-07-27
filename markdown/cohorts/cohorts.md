---
layout: default
title: Cohorts
permalink: /cohorts/
nav_order: 2
has_children: true
---

# Cohorts

Dash is worked on by students, mostly for a semester or two at a time, mostly
through independent study. That is the unit the project actually moves in, so it
is the unit this section is organised around.

Each cohort page lists who was there and what they built, with an
implementation status for every project. The statuses are checked against the
current `master` branch of Dash-Web rather than inferred from whether a branch
exists, because plenty of good work in this project never got merged and
pretending otherwise would make the rest untrustworthy.

{% include status-key.html %}

## All cohorts

<ul class="cohort-list">
  {%- for c in site.data.cohorts %}
  <li class="cohort-card{% if c.current %} cohort-card--current{% endif %}">
    <h3><a href="{{ '/cohorts/' | append: c.id | append: '/' | relative_url }}">{{ c.title }}</a></h3>
    <span class="cohort-card__meta">
      {%- assign n = site.data.projects[c.id] | size -%}
      {{ c.commits }} commits · {{ n }} project{% if n != 1 %}s{% endif %} recorded
      {%- if c.current %} · current{% endif %}
    </span>
    <p>{{ c.summary }}</p>
  </li>
  {%- endfor %}
</ul>

## What counts as a cohort here

The boundaries are approximate. People overlap terms, some stay for years, and
a few of the strongest contributors are staff rather than students and appear
across every period. Commit counts cover the whole repository including merges,
so treat them as a rough measure of activity and nothing finer.

For the two earliest periods we grouped two calendar years together, because
the record from before the documentation site existed is thinner and splitting
it further would imply a precision we do not have.
