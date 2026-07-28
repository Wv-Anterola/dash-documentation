---
layout: default
title: Trails
parent: Concepts
permalink: /concepts/trails/
nav_order: 4
concept_id: trails
description: Prepared paths through a corpus that a reader can leave at any point to follow links by association.
---

# Trails
{: .no_toc }

<details open markdown="block">
  <summary>Table of contents</summary>
  {: .text-delta }
1. TOC
{:toc}
</details>

## The idea

A trail is an ordered path through documents. You can play it like a
presentation, but you can also stop at any point, follow a link sideways, and
keep going from wherever you end up.

## Why it matters

The distinction from a slideshow is the whole point, and it is easy to miss
because a trail playing forward looks exactly like one.

Presentation software makes the sequence authoritative. The audience gets your
path and nothing else, and the material underneath is flattened into what fit
on the slide. Bush's trailblazer was doing something different: laying down a
path through a body of material that stays intact and stays navigable, so the
next person can pick it up and diverge from it.

That is why trails point at live documents rather than copies. A slide in a
trail is a view onto a document that still exists, still has its links, and can
still be opened and explored.

## How Dash represents it

`DocumentType.PRES` and `DocumentType.PRESSLIDE` are registered types, and the
UI lives in `client/views/nodes/trails/`. A trail belongs to a dashboard.

Slides carry their own pinning and layout options, so the same document can
appear in two trails at different zoom levels without either affecting the
document.

Transitions are spring-based. Stiffness, damping, and mass are the parameters,
which is why the AI customisation path in `apis/gpt/PresCustomization.ts` can
map a phrase like "settle gently" onto numbers.

## Current limitations

Branching exists but is not fully integrated with the rest of the trail UI. It
was added in 2024 and the dropdown navigation between branches works, but
authoring a branch is still closer to editing a data structure than to drawing
a path.

Trails also have no notion of audience or state. A trail cannot record where a
reader diverged, which is the piece that would make trails genuinely
collaborative rather than a better presentation format.

## Projects that exercised this

{% include projects-for-concept.html id="trails" %}

{% include project-note.html title="Branching presentation trails"
   note="The closest anyone has come to making trails non-linear in the way the
   original memex description implies. It works, and the fact that authoring is
   still awkward is the honest reason trails are not yet the centre of Dash." %}

{% include project-note.html title="Animation remodel for presentation trails"
   note="Why transitions have physics parameters at all. Before this, moving
   between slides was mechanical, and tuning it by hand was work nobody was
   going to do." %}

## Related documentation

- [Trails]({{ '/features/trails/' | relative_url }}) for creating and playing
  them.
- [Tips and tricks]({{ '/features/trails/tips/' | relative_url }}) for pinning
  behaviour that is not obvious.
- [Animation]({{ '/features/animation/' | relative_url }}) for the timeline,
  which shares the transition model.
- [Links and anchors]({{ '/concepts/links/' | relative_url }}), which trails
  are built on.
