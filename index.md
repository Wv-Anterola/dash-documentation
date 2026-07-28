---
title: Dash
nav_exclude: true
layout: default
---

# Dash

<p class="lede">
Dash is a hypermedia system: one workspace where a PDF, a video, a web page, a
recording, a rich text note, and a collection of any of those are all the same
kind of object, and a link can start or end anywhere inside any of them. It is
built by Andries van Dam's research group at Brown University, and has been
under continuous development since December 2018.
</p>

## The problem it addresses

Most software is built around one document at a time. That works when the work
is one document at a time, and stops working the moment the thing you are
actually thinking about lives across a dozen of them.

Vannevar Bush's 1945 description of the memex is still the clearest statement of
the alternative: what matters is the trail between items, and the ability to
leave that trail for someone else to follow. Hypertext delivered part of it for
text. Dash is an attempt at the rest, for every kind of document a researcher
actually handles, with the relationships between them treated as data rather
than as something you keep in your head.

Concretely, that means links that anchor to a region of a page, a timestamp in
an audio recording, or a single ink stroke; collections that can be laid out
spatially, as a table, on a calendar, or as a link graph without converting
anything; and metadata that travels with a document across all of it.

## What is in it now

Fifty-one document types and twenty-one collection views, plus two AI surfaces:
a retrieval-augmented chatbot that answers with citations back into your own
documents, and an agent with twenty-two registered tools that can act on the
workspace, including one that lets it build itself another. Since March 2026
there is a desktop build that bundles Ollama, so those features can run against
a local model rather than a remote API.

The [architecture]({{ '/system/' | relative_url }}) page explains the structure
and the four places you extend it.

## Current work

The [Spring 2026 to Fall 2026 cohort]({{ '/cohorts/2026/' | relative_url }})
added a link-graph collection view, policy analysis documents, a life-coach
workspace, scene-based video generation, and a study instrument for measuring
whether people actually catch an agent that has been prompt-injected into
editing their documents.

That last one is the clearest example of how this documentation is meant to be
read. The study is described on the cohort page, the threat it addresses is
explained under [agents and tools]({{ '/concepts/agents/' | relative_url }}),
and the undo machinery it attaches to is on the
[architecture]({{ '/system/' | relative_url }}) page. The project is evidence
for the concept, and the concept is what makes the project legible.

## How this site is organised

Four sections, meant to be read in roughly this order if you are new.

**[Concepts]({{ '/concepts/' | relative_url }})** covers the six ideas that
explain most of Dash's behaviour: documents, collections, links, trails, agents,
and generative media. Each page ends with the projects that exercised the idea,
so you can see which parts have been stressed and which are mostly theory.

**[Using Dash]({{ '/getting-started/' | relative_url }})** is the practical
material: how to create documents, switch views, make links, build trails.

**[System and architecture]({{ '/system/' | relative_url }})** describes the
current implementation and the extension points, with the projects that
introduced each one.

**[Research and history]({{ '/projects/' | relative_url }})** holds the forty
recovered projects, organised by cohort, each with an implementation status
traceable to the code.

## Trying it

Dash runs at [browndash.com](https://browndash.com/signup).

{: .caveat }
> This is a research system under active development by students, not a
> product. Expect rough edges, and expect the interface in older screenshots
> and recordings on this site to differ from what you see. Where a
> documentation page describes something that is no longer in Dash, it is
> marked as such rather than removed.
