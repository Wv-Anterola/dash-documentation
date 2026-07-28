---
layout: default
title: Links and anchors
parent: Concepts
permalink: /concepts/links/
nav_order: 3
concept_id: links
description: Why Dash links point at regions and timestamps rather than at files, and why a link is itself a document.
---

# Links and anchors
{: .no_toc }

<details open markdown="block">
  <summary>Table of contents</summary>
  {: .text-delta }
1. TOC
{:toc}
</details>

## The idea

A link in Dash connects two anchors. An anchor can be a whole document, but it
can equally be a word, a marquee selection on an image, a region of a PDF page,
an ink stroke, or a moment in an audio recording.

The link itself is a document, so it carries its own title, description, and
metadata.

## Why it matters

This is the feature the project is named after, and it is the one Bush's
description of the memex actually requires. A trail between items is only
useful if the items can be parts of things. "This paragraph responds to that
objection, made 14 minutes into this recording" is the claim you want to store.
A file-to-file link cannot express it.

Making the link a document has a second consequence that took years to pay off.
Because links are documents, an agent tool that creates links needs no new
persistence, no new undo handling, and no new sharing rules. `CreateLinksTool`
in the agent registry is a thin wrapper over machinery from 2019.

## How Dash represents it

`DocumentType.LINK` is a registered type. The linking UI lives in
`client/views/linking/`, with the link menu, link editor, and description popup.

Creating a link is a two-step interaction rather than a drag: one document
becomes the source, then a second becomes the destination. This exists because
the endpoints are frequently not visible at the same time, which a drag
gesture assumes.

Anchors are stored against the document they point into, which is what lets a
PDF remember that a link lands on page 12 rather than on the file.

## Current limitations

Link density is the unsolved problem. Dash makes links cheap to create and, for
most of its history, gave you no way to see the structure you had built. You
could follow a link but not survey them. The graph view added in 2026 is the
first real answer, and it is a view rather than a fix: it shows the shape of
the link set but does not help you prune it.

There is also no notion of link type or strength. Every link is the same kind
of assertion, so a citation, a contradiction, and a passing association are
indistinguishable except by the description someone remembered to write.

## Projects that exercised this

{% include projects-for-concept.html id="links" %}

{% include project-note.html title="Linking and annotation"
   note="The original anchor model. Everything on this page rests on it, and it
   has needed no fundamental revision in seven years, which is the strongest
   evidence available that the region-anchor decision was the right one." %}

{% include project-note.html title="Graph view for collections"
   note="Relevant here as well as under collections: it is the first tool that
   treats the link set itself as the object of interest rather than as
   navigation." %}

## Related documentation

- [Linking]({{ '/features/linking/' | relative_url }}) for how to create,
  follow, and edit links.
- [Markup]({{ '/features/markup/' | relative_url }}) for annotation and
  highlighting, which produce anchors.
- [Linked to]({{ '/properties/linked-to/' | relative_url }}) for inspecting a
  selected document's links.
- [Trails]({{ '/concepts/trails/' | relative_url }}), which are built on links.
