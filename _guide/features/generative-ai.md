---
layout: default
title: Generative AI
parent: Features
permalink: /features/generativeai/
---

# Generative AI
{: .no_toc }

![A Dash canvas with several AI-generated documents on it.]({{ '/assets/images/gen_ai.png' | relative_url }}){:.img}

<details open markdown="block">
  <summary>
    Table of contents
  </summary>
  {: .text-delta }
1. TOC
{:toc}
</details>

## Overview

Dash calls OpenAI models for text and image generation, sorting and
categorising, document analysis, and study tools, reachable from most document
types. Since March 2026 the desktop build can also run these against a local
model through Ollama instead of a remote API.

There are two distinct surfaces, and it is worth knowing which one you are in:

- The **assistant** answers questions about your documents, with citations that
  navigate back to the source.
- The **agent** acts on the workspace: filtering, sorting, tagging, linking, and
  creating documents through a registry of tools.

[How Dash is built]({{ '/system/' | relative_url }}) covers the difference in
more detail, including why it matters for what you should trust.

{: .caveat }
> Screen recordings on this page were made between 2024 and 2025. The
> interactions still work; the interface around them has moved on.

## Text

Open the context menu on a text node (three bars icon) and choose the "Ask GPT"
entry. The model responds by typing into the text node that holds the prompt.

![Invoking GPT from a text node's context menu; the response is typed into the node.]({{ '/assets/gifs/ai/ai-text.gif' | relative_url }}){:.img}

## AI assistant

The assistant analyses and summarises PDFs and CSVs conversationally, augments
its answers with material from the web, and helps you navigate linked documents.

Drag it from the Tools tab on the left onto your dashboard to open it. To use it
on a PDF or CSV, link that document to the assistant and type a prompt.

Citations in its answers resolve back to the chunk of the source they came from
and navigate you there, which is the part worth using: it is the only way to
check what it told you.

To search the web, link an empty collection to the assistant box and prompt it
to search.

![Prompting the assistant to search the web; results are placed into a linked collection.]({{ '/assets/gifs/ai/ai-websearch-1.gif' | relative_url }}){:.img}

You can then refine the search through conversation.

![Iteratively narrowing web search results by talking to the assistant.]({{ '/assets/gifs/ai/ai-websearch-2.gif' | relative_url }}){:.img}

## Images

### Generation

Open Smart Draw from the Ink tab at the top of the dashboard. It creates Dash
ink drawings or canvases from Adobe Firefly.

Generation takes a while.

![Generating an image from a text prompt with Adobe Firefly inside Smart Draw.]({{ '/assets/gifs/ai/ai-firefly-image-1.gif' | relative_url }}){:.img}

You can also give Firefly a reference image drawn in Dash. Select the ink
drawing you want as a reference, then open the options menu on the right (the
blue arrow, or the double-arrow at the top right) and set up your generation.

![Selecting an ink drawing to use as a generation reference.]({{ '/assets/gifs/ai/ai-firefly-template-image-1.gif' | relative_url }}){:.img}
![The generated image alongside the ink drawing it was based on.]({{ '/assets/gifs/ai/ai-firefly-template-image-2.gif' | relative_url }}){:.img}

### Editing

Edit an existing image to generate new content into part of it.

**Open the editor.** From the image context menu, choose Open Image Editor.

![Opening the image editor from an image document's context menu.]({{ '/assets/gifs/ai/ai-edit-1.gif' | relative_url }}){:.img}

**Erase and prompt.** Use the eraser on the part you want replaced, optionally
add a prompt, then click `Get Edits`. Variations appear on the right; clicking
one draws it to the main canvas. You can generate further edits from a result
the same way.

Generation is slow, and the model will not always match the prompt. Describing
the whole image, including the parts you are leaving alone, gives noticeably
better results than describing only the replacement.

![Erasing a region, prompting, and picking from the generated variations.]({{ '/assets/gifs/ai/ai-edit-2.gif' | relative_url }}){:.img}

**Version history.** Closing the editor leaves a tree of the edit history in a
new collection, which you can drag back onto the main canvas.

![The edit version history rendered as a tree in a new collection.]({{ '/assets/gifs/ai/ai-edit-3.gif' | relative_url }}){:.img}

#### Additional editor features

- You can undo/redo erase strokes and adjust the brush size with the controls on the left
- You can remove all erase strokes with the reset button at the top
- For the version history, you can choose to branch directly from the original image rather than creating a new collection by toggling `Create New Collection` off

## Making documents from a CSV

Generate a document per row of a CSV, using a template the model helps you
build.

**Open the template creator.** From a CSV document's context menu, click
`Create Docs` near the top.

**Choose your columns.** Select the columns to generate from, then open the
field options menu (the cog at the top right of "Suggested Templates") to add
AI-generated fields.

**Generate templates.** Click generate to get recommended templates for the
content. The edit button at the bottom right of each one lets you adjust it.

![Generating suggested templates from the selected columns of a CSV.]({{ '/assets/gifs/ai/ai-template-csv-1.gif' | relative_url }}){:.img}

**Lay out the results.** Select the rows you want, click a template to select
it, then use the layout menu (the magnifying glass at the top) to choose how
the content is displayed. The plus button adds the finished collection to Dash.

![Selecting rows, applying a template, and adding the generated collection to the canvas.]({{ '/assets/gifs/ai/ai-template-csv-2.gif' | relative_url }}){:.img}

## Not documented here yet

Several AI features shipped after this page was last substantially revised and
do not have tutorial pages. They are described, with their implementation
status, on the cohort pages:

- The [agent tool registry]({{ '/cohorts/2025/' | relative_url }}) and what the
  agent can do to your workspace
- [Video generation]({{ '/cohorts/2026/' | relative_url }}) from canvas content
- [Policy analysis documents]({{ '/cohorts/2026/' | relative_url }})
- [Selection-aware text reformatting]({{ '/cohorts/2026/' | relative_url }})
- Running models locally through the desktop build

{: .note }
> A copy of this page's text is also embedded in the application itself, in
> `apis/gpt/dashDocumentation.ts`, so the assistant can answer questions about
> Dash. The two copies have already drifted; the in-app copy still refers to
> "Ask GPT3" in places. If you edit this page substantially, that file needs the
> same edit.
