---
layout: default
title: About Dash
permalink: /about/
nav_order: 1
---

# About Dash
{: .no_toc }

<details open markdown="block">
  <summary>Table of contents</summary>
  {: .text-delta }
1. TOC
{:toc}
</details>

## The workflow this is for

Say you are reading Vannevar Bush's [As We May
Think](https://www.theatlantic.com/magazine/archive/1945/07/as-we-may-think/303881/),
annotating it in a PDF reader. You are also listening to a recorded interview
where someone makes an argument about linking that Bush anticipates, and you
half-remember a lecture that covered the same ground, so that Zoom recording is
open in a third window.

The three are related. Nothing you are using can hold that relationship. You can
put a note in the PDF saying "cf. the interview around 12 minutes", and next
month the note will still be there and the interview will not be findable.

<div class="img-container">
  <img src="{{ '/assets/images/dash1.png' | relative_url }}" alt="A Dash dashboard showing several documents of different types arranged on a freeform canvas with links drawn between them." class="img"/>
</div>

Dash is an attempt to make that relationship a first-class thing. Because
websites, PDFs, audio, video, ink, and rich text all use the same underlying
document implementation, a link can start at a word in one and end at a
timestamp in another, and the link itself is a document you can describe,
annotate, and file.

## What Dash actually is

A collaborative, browser-based hypermedia system, with a desktop build as of
2026.

The pieces that make it different from a note-taking application:

**Collections are documents too.** A collection holds other documents, and how
it displays them is a property you change rather than a different kind of
object. The same collection can be a freeform canvas, a spreadsheet-style
schema table, a calendar, a stack, or a link graph. Nothing is converted when
you switch.

**Links anchor to regions, not files.** A word, a marquee selection on an image,
a page of a PDF, an ink stroke, a moment in a recording.

**Metadata travels across types.** Tags and fields work the same way on a video
as on a text note, so you can filter and sort a mixed corpus.

**Trails are not slideshows.** A trail is a prepared path through a corpus, but
you can stop anywhere in it and start following links by association instead.
That is the specific thing Bush described and that presentation software
deliberately does not do.

<div class="img-container">
  <img src="{{ '/assets/images/dash2.jpg' | relative_url }}" alt="Documents in Dash shown across several collection view types." class="img"/>
</div>

## Where the project stands

Dash has been developed continuously since December 2018, almost entirely by
Brown undergraduates working in semester-length cohorts, with Andries van Dam
and Bob Zeleznik providing continuity across them.

The direction has shifted over that time. The first two years built the document
model, collections, and linking. The middle years consolidated and shipped
releases. Since 2023 the centre of gravity has moved to generative AI and, since
2025, to agents that can act on the workspace rather than only describe it. The
2026 cohort added a strand of work on what happens when an agent with write
access reads content it should not trust.

For the full record, see [Cohorts]({{ '/cohorts/' | relative_url }}) and
[Projects]({{ '/projects/' | relative_url }}).

## Architecture

The [how Dash is built]({{ '/system/' | relative_url }}) page describes the
current system and the four places you extend it.

There is also a longer [architecture
write-up](https://hackmd.io/@CS1951V-2023/DashArchitecture) by Jenny Yu and Bob
Zeleznik from October 2023, which goes deeper on the client-server protocol,
optimistic updates, and how concurrent edits are merged.

{: .caveat }
> That document is worth reading for the synchronisation model, but its core
> vocabulary has drifted. It builds its explanation on "Fobs" and "Facets", and
> neither term is used in the current codebase in that sense. Read it for the
> concepts, not for the names.

<div class="img-container">
  <img src="{{ '/assets/images/dash-doc-representation.png' | relative_url }}" alt="Diagram of how a Dash document is represented internally." class="img"/>
</div>

## Use cases built by the group

### Semester planner

<div class="video">
  <iframe src="https://www.youtube.com/embed/eQSrDkAqky0" title="Dash use case: semester planner" allowfullscreen loading="lazy"></iframe>
</div>

### Linguistic documentation

<div class="video">
  <iframe src="https://www.youtube.com/embed/2xL78f_McgQ" title="Dash use case: linguistic documentation" allowfullscreen loading="lazy"></iframe>
</div>

## Use cases from CS1951V

Dash is used in [CS1951V](http://cs.brown.edu/courses/csci1951-v/), Brown's
hypertext and hypermedia course. These are corpora students built for it.

### Fall 2023

<div class="video">
  <iframe src="https://www.youtube.com/embed/jbrBC8QdjLI" title="CS1951V student project: virtual wellness retreat" allowfullscreen loading="lazy"></iframe>
</div>
Virtual wellness retreat.

<div class="video">
  <iframe src="https://www.youtube.com/embed/Wu2x3dSE8Gw" title="CS1951V student project: a cappella arranging" allowfullscreen loading="lazy"></iframe>
</div>
A cappella arranging.

<div class="video">
  <iframe src="https://www.youtube.com/embed/sCmRkN4hpNg" title="CS1951V student project: tour of Singapore" allowfullscreen loading="lazy"></iframe>
</div>
Tour of Singapore.

### Fall 2021

<div class="video">
  <iframe src="https://www.youtube.com/embed/qE2A5PKJQe0" title="CS1951V student project: Domestic Jungle plant corpus by Mikey Abela" allowfullscreen loading="lazy"></iframe>
</div>
Domestic Jungle, a plant corpus, by Mikey Abela.

<div class="video">
  <iframe src="https://youtube.com/embed/sy_YtdTpKSo" title="CS1951V student project: Antoni Gaudi by Adwith Mukherjee" allowfullscreen loading="lazy"></iframe>
</div>
Antoni Gaudi, by Adwith Mukherjee.

## Trying it

Dash runs at [browndash.com](https://browndash.com/signup). Start with
[Getting started]({{ '/getting-started/' | relative_url }}), or
[Overall environment]({{ '/environment/' | relative_url }}) for a tour of the
interface.
