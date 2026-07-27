---
layout: default
title: Release notes
permalink: /release-notes/
nav_order: 14
---

# Release notes
{: .no_toc }

<details open markdown="block">
  <summary>Table of contents</summary>
  {: .text-delta }
1. TOC
{:toc}
</details>

## About this record

Dash stopped cutting numbered releases after 0.8 in May 2022. Development did
not stop; it kept going for four more years and roughly 5,600 further commits.
What stopped was the practice of naming a version.

That left this page claiming 0.8 was current until 2026, while the site
configuration separately said "v1.0.0" and the homepage advertised "stable
release V0.5". Three different answers, none of them right.

Rather than invent version numbers after the fact, everything from 2023 onward
is recorded by cohort. Those pages carry the detail, including which work
reached `master` and which did not.

- [Spring 2026 to Fall 2026]({{ '/cohorts/2026/' | relative_url }})
- [Spring 2025 to Fall 2025]({{ '/cohorts/2025/' | relative_url }})
- [Spring 2024 to Fall 2024]({{ '/cohorts/2024/' | relative_url }})
- [Spring 2023 to Fall 2023]({{ '/cohorts/2023/' | relative_url }})

## Since the last numbered release

The changes since 0.8 that most affect how Dash is used:

**A desktop application, March 2026.** Electron builds for macOS and Windows
that bundle Ollama, so the AI features can run against a model on your own
machine instead of a remote API.

**An agent that acts, from 2025.** The chatbot answers questions about your
documents. The agent, built on a tool registry, filters, sorts, tags, links,
creates documents, and drives the interface. Twenty-two tools are registered at
startup, and it can generate another.

**New document types**: 3D model viewing and sketching, video generation, policy
analysis, life-coach workspaces, scrapbooks, journals, tasks, and equations with
a symbolic solver.

**New collection views**: calendar in 2023, link graph in 2026.

**Generative AI beyond text nodes**: image generation with style and structure
references, chart generation from CSVs, presentation transitions described in
words, selection-aware text reformatting.

## Numbered releases, 2020 to 2022

The original release notes, unchanged apart from a repaired link.

### 0.8, May 2022
{: .no_toc }

Sharing and dashboard updates so that new users arrive at a homepage. Updated
video mode for trails that tracks movement around the canvas.

### 0.6, January 2022
{: .no_toc }

Performance optimisation involving caching, and rendering low-resolution images
of websites instead of rendering the entire website.

### 0.5, October 2021
{: .no_toc }

Stable release including significant bug fixes.

### 0.4, September 2021
{: .no_toc }

UI overhaul and a completely updated novice mode.

### 0.3, May 2021
{: .no_toc }

Document toolbar redesign; schema view updates.

### 0.2, December 2020
{: .no_toc }

The version used in the seminar taught in Fall 2020. Extended functionality for
[presentation trails]({{ '/features/trails/' | relative_url }}); sharing and
access controls.

### 0.1, January 2020
{: .no_toc }

The earliest version of Dash.

## Feature requests

The [feature request form](https://forms.gle/yjPYSGzqb2CmqPo47) is still open.

{: .caveat }
> This page used to open with an "in the works" list: integrated maps,
> progressivised trails, branching trails, mathematical notetaking, smart
> transcription, schema autofill. It had not been edited since 2022. Maps,
> branching trails, symbolic mathematics, and dictation have since been built.
> The rest have not, and nobody is currently working on them. The list has been
> removed rather than left standing as a four-year-old roadmap.
