# The viewer

## Two ways to get it

`serve` hosts it on `127.0.0.1`; `render --format html --out <file>` writes the identical page as one self-contained file. Everything on this page describes both, because both call the same function. A test asserts they are byte for byte the same, so neither can quietly drift from the other.

## What it shows

One page: the graph on the left, laid out left to right with blockers before dependents; a sidebar on the right with the legend, the selected card, the frontier, and the findings.

## When to use it

To follow a chain upstream or downstream, to see which cards sit on the critical path, and to read a card's fields without opening Linear.

## Screen anatomy

- **Graph**: one rounded box per task showing the key and a truncated title. Fill colour is the state (legend in the sidebar); a thick border marks the critical path; a dashed border marks a gatekeeper. Edges run from blocker to dependent; red edges join two critical tasks.
- **Sidebar**: legend; the selected card (key, title, state, status, priority, effort, assignee, milestone, workstream, due, blocked by, blocks, labels, a link to Linear when the source was Linear, the description); the frontier as a numbered list; the findings.

## Controls and keybindings

| Action | Control |
|---|---|
| pan | drag on the graph |
| zoom | mouse wheel over the graph, centred on the pointer |
| select | click a node, or a key in the frontier or findings lists |
| clear selection | <kbd>Esc</kbd> |

## Selection and focus behaviour

Selecting a node dims every node that is neither an ancestor nor a descendant of it, and every edge not on one of those paths. Selection is a page state only; nothing is sent anywhere.

## Loading, empty, success, and error states

The page is rendered by the local process from the source loaded at start; there is no loading state and no live refresh. An empty project renders an empty graph and "Nothing selected." An unknown path returns `404 not found`.

## Related workflows

- [Open the local viewer](../how-to/open-the-viewer.md)
- [Audit a project](../how-to/audit-a-project.md)
