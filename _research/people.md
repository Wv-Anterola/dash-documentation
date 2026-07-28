---
layout: default
title: People
permalink: /research-team/
nav_order: 3
---

# People
{: .no_toc }

<details open markdown="block">
  <summary>Table of contents</summary>
  {: .text-delta }
1. TOC
{:toc}
</details>

## Faculty and staff

<div class="table-scroll" markdown="1">

| Name | Role |
| :--- | :--- |
{%- for f in site.data.people.faculty %}
| {{ f.name }} | {{ f.role }} |
{%- endfor %}

</div>

For questions about the project or about joining it, contact Andries van Dam at
[andries_van_dam@brown.edu](mailto:andries_van_dam@brown.edu).

## Current cohort

{%- assign current = site.data.cohorts | where: "current", true | first %}

[{{ current.title }}]({{ '/cohorts/' | append: current.id | append: '/' | relative_url }})

{% include cohort-roster.html cohort_id=current.id %}

<div class="img-container">
  <img src="{{ '/assets/images/team/mccormick.jpg' | relative_url }}" alt="McCormick Breviu" class="portrait"/>
  <img src="{{ '/assets/images/team/wilber.jpg' | relative_url }}" alt="Wilber Sean Anterola" class="portrait"/>
  <img src="{{ '/assets/images/team/jacob.png' | relative_url }}" alt="Jacob Elson" class="portrait"/>
  <img src="{{ '/assets/images/team/alicia.jpg' | relative_url }}" alt="Alicia Yoon" class="portrait"/>
  <img src="{{ '/assets/images/team/camden.jpg' | relative_url }}" alt="Camden Wright" class="portrait"/>
  <img src="{{ '/assets/images/team/nathan.jpeg' | relative_url }}" alt="Nathan Robbins" class="portrait"/>
</div>

## Everyone, by cohort

Rosters for every period, drawn from commit authorship. Follow a cohort to see
what that group worked on.

{% for c in site.data.cohorts %}
### [{{ c.title }}]({{ '/cohorts/' | append: c.id | append: '/' | relative_url }})
{: .no_toc }

{% include cohort-roster.html cohort_id=c.id %}
{% endfor %}

## Names we could not recover

These accounts appear in the 2019 and 2020 commit history under a handle or a
first name only. They contributed, in some cases substantially, and we could not
work out who they are.

<ul class="cohort-roster">
{%- for u in site.data.people.unresolved %}
  <li>{{ u }}</li>
{%- endfor %}
</ul>

One more, recorded in the 2025 and 2026 history under the GitHub handle
`Skitty1238`, wrote the selection-aware text formatting work that is in `master`
today. If any of these are you, or you know who they are, please open an issue
on the documentation repository.

## A note on this page

The previous version had a flat grid of current students and an alphabetical
list of past ones. The list was missing most of the 2019 and 2020 contributors,
which is where more than half of all work on Dash happened, and it gave no
indication of when anyone was here or what they did.

Rosters now come from `_data/people.yml`, so adding next year's cohort is one
edit in one file. See [Contributing]({{ '/contributing/' | relative_url }}).
