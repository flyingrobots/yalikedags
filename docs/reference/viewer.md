# The viewer

## Two ways to get it

`serve` hosts it on `127.0.0.1`; `render --format html --out <file>` writes the identical page as one self-contained file. Everything on this page describes both, because both call the same function. A test asserts they are byte for byte the same, so neither can quietly drift from the other.

## What it shows

One page, two views of the same selection, with a sidebar on the right holding the legend, the selected card, the frontier, and the findings.

- **Graph** (the default): the tasks laid out left to right with blockers before dependents. It answers "how does the work fit together, and why is this blocked".
- **Grid**: workstreams down the side, waves across the top, one card per open task. It answers "who could be doing what, in which round". The first row, *shared prerequisites*, is the gatekeepers: the tasks every row below is waiting on. Reading down a column shows what could run in parallel; reading across a row shows one workstream's own order of work; an empty cell means that workstream has nothing to do in that round.

## When to use it

The graph: to follow a chain upstream or downstream, to see which cards sit on the critical path, and to read a card's fields without opening Linear. The grid: to see how many people the project can keep busy this round, which workstream is idle, and how far down the columns the shared prerequisites reach.

## Screen anatomy

- **View switch**: two buttons above the main pane, Graph and Grid. The sidebar and the selection are the same under both.
- **Graph**: one rounded box per task showing the key and a truncated title. Fill colour is the state (legend in the sidebar); a thick border marks the critical path; a dashed border marks a gatekeeper. Edges run from blocker to dependent; red edges join two critical tasks.
- **Grid**: a table, drawn by the page from the snapshot's `grid` field, with one column per wave (`Wave 1` is now) and one row per workstream, the shared prerequisites row first. Each cell holds cards for that row's tasks in that wave. A card carries the same fill, thick border and dashed border as its node in the graph. Column headings and row labels stay put while the table scrolls.
- **Sidebar**: legend; the selected card (key, title, state, status, priority, effort, assignee, milestone, workstream, due, blocked by, blocks, labels, a link to Linear when the source was Linear, the description); the frontier as a numbered list; the findings.

## Controls and keybindings

| Action | Control |
|---|---|
| switch view | the Graph and Grid buttons above the main pane |
| pan | drag on the graph |
| zoom | mouse wheel over the graph, centred on the pointer |
| select | click a node in the graph, a card in the grid, or a key in the frontier or findings lists |
| clear selection | <kbd>Esc</kbd> |

## Selection and focus behaviour

Selecting a task, from either view, dims every node and card that is neither an ancestor nor a descendant of it, and every edge not on one of those paths. The selection is shared: switch views and it is still highlighted. Selection is a page state only; nothing is sent anywhere.

## Loading, empty, success, and error states

The page is rendered by the local process from the source loaded at start; there is no loading state and no live refresh. An empty project renders an empty graph, a grid reading "Nothing open." and "Nothing selected." A project with nothing open renders the same grid message under a graph of done tasks. An unknown path returns `404 not found`.

## Related workflows

- [Open the local viewer](../how-to/open-the-viewer.md)
- [Audit a project](../how-to/audit-a-project.md)
