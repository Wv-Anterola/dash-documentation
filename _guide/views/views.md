---
layout: default
title: Views
nav_order: 4
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

Two of the newer ones came out of student projects, and both are worth knowing
about even though neither has a tutorial page yet.

{% include project-note.html title="Graph view for collections"
   note="Adds a force-directed layout where links are edges, so you can see the
   shape of a link set instead of only following it one hop at a time. The
   settings panel exposes the physics constants because the defaults do not
   suit every graph density." %}

{% include project-note.html title="Calendar collection view and Mapbox documents"
   note="Where the calendar view came from. Any collection whose documents carry
   a date can be switched into it." %}

{: .caveat }
> Only the four novice-mode views have tutorial pages. The rest work but are
> undocumented, and a carousel page was started in 2021 and never written.

## Why layout is a property

Switching views converts nothing because a collection is a document and its
layout is a field on that document, not a different kind of container. That
decision dates from 2019 and is why the graph view above could be added in 2026
and immediately work on collections created seven years earlier.

[Collections and views]({{ '/concepts/collections/' | relative_url }}) explains
the reasoning and its limits, including the performance problem the graph view
ran into.
