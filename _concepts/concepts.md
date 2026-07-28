---
layout: default
title: Concepts
permalink: /concepts/
nav_order: 1
has_children: true
---

# Concepts

Six ideas account for most of how Dash behaves. If you understand these, the
rest of the system tends to follow; if you skip them, a lot of Dash looks
arbitrary.

Each page explains the idea, how Dash represents it in code, where it currently
falls short, and which student projects have exercised it. The projects are
there as evidence. A concept that no project has stressed is a concept we have
mostly theorised about, and it is worth being able to tell the difference.

<div class="table-scroll" markdown="1">

| Concept | What it covers |
| :--- | :--- |
{%- for c in site.data.concepts %}
| [{{ c.title }}]({{ c.url | relative_url }}) | {{ c.summary }} |
{%- endfor %}

</div>

## Reading order

The first three build on each other and are worth reading in sequence.
Documents come first because collections and links are both documents.
[Trails]({{ '/concepts/trails/' | relative_url }}) depends on links.
[Agents]({{ '/concepts/agents/' | relative_url }}) and
[generative media]({{ '/concepts/generative/' | relative_url }}) are recent and
can be read on their own.

For how these are actually put together, see
[architecture]({{ '/system/' | relative_url }}). For what people built while
working on them, see [the project index]({{ '/projects/' | relative_url }}).
