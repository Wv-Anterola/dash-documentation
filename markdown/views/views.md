---
layout: default
title: Views
nav_order: 8
permalink: /views/
has_children: true
---

# Views

A view is how a collection displays the documents it holds. Because the view is
a property of the collection rather than a different kind of object, switching
between them converts nothing: the same documents are simply laid out
differently.

Four views are available in novice mode, with the rest in developer mode.

## The four in novice mode

<div class="table-scroll" markdown="1">

| View | What it is for |
| :--- | :--- |
| [Freeform]({{ '/views/freeform/' | relative_url }}) | An unbounded 2D canvas. Dash's primary view. |
| [Schema]({{ '/views/schema/' | relative_url }}) | A table of key-value pairs, for structured sorting and editing. |
| [Stacking]({{ '/views/stacking/' | relative_url }}) | Groups documents by a key, keeping a live preview of each. |
| [Notetaking]({{ '/views/notetaking/' | relative_url }}) | Multiple columns, so you can take notes in one while reading in another. |

</div>

## Changing views

Use the dropdown in the top toolbar. If you cannot see it, or you see a
document-specific toolbar for an image or text instead, click a blank area of
the main view first.

![Switching a collection between views using the toolbar dropdown.]({{ '/assets/gifs/views/dash-change-view.gif' | relative_url }}){:.img}

## The rest

`CollectionViewType` holds twenty-one entries. Besides the four above and
docking, which is the workspace itself, there are card, carousel, 3D carousel,
grid, masonry, multicolumn, multirow, pivot, time, tree, calendar, graph, and
pile-up.

{: .caveat }
> Only the four novice-mode views have tutorial pages. The others work but are
> undocumented, and a carousel page was started in 2021 and never written.
>
> Two of the undocumented ones came from student projects and are described on
> the cohort pages: the [calendar view]({{ '/cohorts/2023/' | relative_url }})
> from 2023 and the [link graph view]({{ '/cohorts/2026/' | relative_url }})
> from 2026.
