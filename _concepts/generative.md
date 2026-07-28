---
layout: default
title: Generative media
parent: Concepts
permalink: /concepts/generative/
nav_order: 6
concept_id: generative
description: Model-generated images, video, charts, and text produced inside Dash documents rather than pasted into them.
---

# Generative media
{: .no_toc }

<details open markdown="block">
  <summary>Table of contents</summary>
  {: .text-delta }
1. TOC
{:toc}
</details>

## The idea

Generated content in Dash is produced inside a document, keeps its relationship
to whatever it was generated from, and stays editable afterwards.

The distinction is against the usual workflow, where you leave for a separate
tool, generate something, and paste the result back as a flat image with no
memory of how it got there.

## Why it matters

The interesting part is not that a model can make an image. It is what the
model can be given as input when it runs inside a workspace that already holds
your material.

A style reference is a linked image already on your canvas, tagged
`style-ref`. A structure reference is a 3D scene you built. A chart's input is
a CSV document sitting next to it. Scene context for a generated video comes
from the documents around it. None of that requires uploading anything, because
the material is already there and already related.

The edit history follows the same principle: image edits produce a tree in a
collection rather than overwriting, so the versions are documents you can
compare and link to.

## How Dash represents it

Image generation goes through `client/apis/firefly` for Adobe Firefly and
through the OpenAI path for editing. Smart Draw, in `client/views/smartdraw/`,
is the drawing surface that hands a sketch to a model.

`DocumentType.VIDGEN` plans a video as a sequence of scenes, each individually
re-promptable, which matters because regenerating a whole video to fix scene
three is not a workflow anyone tolerates twice.

Text generation is bound to selections. The formatting work sends and receives
HTML rather than plain text so that styling survives the round trip, and it
normalises a selection to sentence and block boundaries first, because a
half-selected sentence produces a mangled rewrite.

## Current limitations

Provider dependence is the obvious one. Firefly, OpenAI, and Stable Diffusion
are each wired in separately, and there is no shared abstraction over them, so
adding a provider means touching each call site.

Generation is slow enough that it changes the interaction. Most of these
surfaces have had loading states and click-guards added after the fact, by
different students, in slightly different ways.

Quality is not evaluated anywhere. Nothing in the codebase measures whether a
generated chart is a reasonable reading of the data or whether a rewritten
paragraph preserved the meaning.

## Projects that exercised this

{% include projects-for-concept.html id="generative" %}

{% include project-note.html title="Image generation with style and structure references"
   note="The clearest case of the argument above: it uses documents already on
   the canvas as generation inputs. It is also unmerged, so the capability
   described here is not in the shipped application." %}

{% include project-note.html title="Selection-aware text formatting actions"
   note="Most of the work here went into the boundary handling rather than the
   prompting, which is a fair summary of what makes generative features usable
   or not." %}

## Related documentation

- [Generative AI]({{ '/features/generativeai/' | relative_url }}) for how to use
  these features.
- [Ink]({{ '/features/ink/' | relative_url }}) for drawing, which Smart Draw
  builds on.
- [Data visualization]({{ '/documents/dataViz/' | relative_url }}) for
  chart generation from CSVs.
- [Agents and tools]({{ '/concepts/agents/' | relative_url }}) for models that
  act rather than produce.
