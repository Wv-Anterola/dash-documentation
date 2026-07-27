---
layout: default
title: How Dash is built
permalink: /system/
nav_order: 5
---

# How Dash is built
{: .no_toc }

This page describes the structure of the current system and the small number of
places you extend it. It is aimed at someone about to work on Dash, or someone
trying to judge what a project on the [Projects]({{ '/projects/' | relative_url }})
page actually touched.

<details open markdown="block">
  <summary>Table of contents</summary>
  {: .text-delta }
1. TOC
{:toc}
</details>

## The stack

TypeScript throughout, React and MobX on the client, Express and MongoDB on the
server, webpack for bundling. Since March 2026 there is also an Electron build
that packages the whole thing as a desktop application and bundles Ollama, so
the AI features can run against a local model instead of a remote API.

The repository is a monorepo. The web application lives at the root; the shared
component library is a workspace under `packages/components` with its own
Storybook.

## One document abstraction

The idea the rest of the system depends on is that everything is a document.

A PDF is a document. So is a collection of PDFs. So is the link between two of
them, and so is a presentation trail, and so is a chat message. They differ by
their type and the fields they carry, not by being different kinds of object.

Documents are created from prototypes. `client/documents/Documents.ts` holds a
factory function per type, each one calling `InstanceFromProto` with the
prototype fetched by `Prototypes.get(DocumentType.SOMETHING)`. Those two
functions have been the way you make a document since 2019.

This is why linking works the way it does. If a link only had to connect two
documents, it could be a row in a table. Because a link is itself a document, it
can carry a description, be annotated, appear in a collection, and be created by
an agent tool, all without special cases.

## The four extension points

Almost every project in the [Projects]({{ '/projects/' | relative_url }}) list
extends one of four things. If you are planning work, it is worth knowing which
one you are aiming at, because the projects that reached `master` are
overwhelmingly the ones that fit an existing slot.

### Document types

`client/documents/DocumentTypes.ts` declares the `DocumentType` enum;
`Documents.ts` registers a factory for each. Adding a type means an enum value,
a factory, a view component, and a case in `DocumentView.tsx`.

The enum currently runs from the core types (rich text, image, web, PDF,
collection, video, audio, ink) through to types added by recent cohorts: the
3D viewer and sketch canvas, the data visualisation box, the video generator,
the life coach workspace and its events, policy testimony and policy checker,
journals, tasks, scrapbooks, and the agent itself.

### Collection view types

`CollectionViewType` decides how a collection displays what it holds. Freeform,
stacking, schema, tree, carousel, and docking come from 2019 and 2020. Calendar
came from 2023. Graph came from 2026. Adding one means an enum value and a view
component; every existing collection can then be switched into it without
converting any data.

### Agent tools

`client/views/nodes/chatbot/agentsystem/Agent.ts` constructs a registry of tools
the agent can call. A tool is a class with a schema and an execute method, and
there are around forty of them: searching documents, filtering and sorting and
tagging them, creating links, reading file contents, running a calculation,
scraping a page, driving the interface, walking a user through a tutorial.

There is also a `tools/dynamic/` directory, because the agent can generate a new
tool and have it compiled into the running application.

This is the extension point that grew fastest. Most of the 2025 and 2026 agent
work is entries in this registry rather than new UI.

### Undo batches

Mutations run through `util/UndoManager`, and `UndoManager.RunInBatch` groups a
set of changes under a name so they revert together. This matters more than it
sounds: it is what makes an agent action individually revertible, and it is the
hook the 2026 provenance work attaches to.

## Where the AI surfaces are

There are two separate ones, which is a common source of confusion.

The **chatbot** (`nodes/chatbot/`) is the retrieval-augmented surface. Documents
are chunked into a vector store, retrieved chunks go into the model's context,
and answers come back with citations that resolve to a source document and
navigate to it.

The **agent** (`nodes/agent/`) is the acting surface. It runs a ReAct-style loop
in `services/openaiService.ts` or `services/ollamaService.ts`, appending each
tool result back into the message stream, and its tools write to the workspace.

They share the tool registry. The distinction that matters is that one of them
answers and the other one edits.

{: .note }
> Because retrieved content and tool results both enter the model's context as
> messages, untrusted document content can carry instructions the model treats
> as its own. That is the problem the [2026 oversight
> study]({{ '/cohorts/2026/#post-hoc-oversight-of-prompt-injected-agents' | relative_url }})
> was built to measure. The provenance capture it added is off by default.

## What this means for a new project

Look for the slot before you build the thing. A new document type, a new
collection view, or a new agent tool will merge; a parallel subsystem next to
one of those generally will not, however good it is. The unmerged branches on
the cohort pages are mostly the second kind.
