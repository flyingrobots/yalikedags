# The viewer

## Open a workspace

`serve` hosts the viewer on `127.0.0.1`. `render --format html --out dag.html` writes the same workspace as a self-contained file. Both include the styles, Dockview code, graph, and task data; neither fetches assets or sends task data anywhere. The export opens from disk without a key or running server.

![DAG workspace with ready work alongside it](../images/viewer-overview.png)

## Views

| View | Use it to |
|---|---|
| **DAG** | Trace blockers and dependents. Arrows point from blocker to dependent. The graph opens at a readable scale; use **Fit all** for the whole graph. |
| **Wave grid** | Compare workstreams across waves. Each open, schedulable task appears in one cell. Shared prerequisites appear first. Columns keep their width and scroll horizontally. |
| **Task table** | Search and sort all tasks; filter by state, assignee, milestone, or label. Filter matches are also highlighted in the DAG and wave grid. |
| **Changes** | See changes since refresh, or compare an earlier snapshot JSON locally. |
| **Task details** | Read the selected task and follow clickable blocker/dependent keys. Descriptions are displayed as text. |
| **Ready work** | Find tasks that can start, ordered by urgency, with separate immediate-unblocking and downstream-impact counts. Resource warnings count in-progress holders as well as ready contenders. |
| **Findings** | Review audit findings and the evidence that would invalidate each finding. Select a card to inspect it. |

A wave is a forecast of parallel work, not a deadline or a scheduling barrier. Tasks with unknown statuses, unresolved external blockers, cycles, or dependencies on such work have no wave; check Findings and the partial-analysis notice. An external blocker is a task outside the loaded project: for example, “Launch checkout” depending on another project’s “Provision payment credentials.” Its status is unknown here, so readiness cannot be established.

## Arrange your views

Drag a tab to dock it beside or beneath another view, or keep several views together as tabs. Drag dividers to resize. Close tabs you do not need; the header’s **Views menu** reopens them.

Docked layout and sizes are saved locally in the browser, shared between snapshots on the same origin. Storage contains panel layout, not task data or selection. File URL storage behavior depends on the browser. When storage is unavailable or invalid, the viewer starts with its default layout. **Reset layout** restores the default arrangement without clearing the selection.

Task details, Ready work, Findings, and Changes share a collapsible sidebar on the right (bottom on narrow screens). Use its collapse/expand arrow or click the active tab. Choosing a sidebar view from Views opens it again. Sidebar sizes and collapsed state survive reload; older standalone inspector groups migrate into a sidebar.

Use **Pop out view** (↗) to move the active tab into its own browser window. Selection, filters, and graph controls remain shared. Closing that window returns the view; reloading the parent brings popped-out views back into the workspace without reopening windows. Allow pop-ups for the local server if prompted. Pop-out is disabled in HTML files opened directly from disk; run the local viewer with `serve` to use it.

Use **Expand view** in a group header to maximize it; **Restore view** returns the arrangement. A sidebar view temporarily joins the main area and returns to its sidebar on restore.

![DAG and wave grid docked together, with a shared task selection](../images/viewer-split.png)

## Find and inspect a task

1. Enter a task key, title, or assignee in **Find a task**.
2. Choose a result, or press Enter to choose the first match. Arrow Down moves focus into the results.
3. Task details opens and the graph focuses on the selected task.
4. Follow the blocker or dependent buttons in the details panel, or switch to Wave grid. The selection stays shared across views.
5. Press Escape to clear the selection and dismiss search results.

Selecting a task dims unrelated nodes, cards, and edges. Its ancestors and descendants remain visible. Search displays up to 30 results and tells you when to narrow the query. Selection is kept when a panel is closed and reopened, and preserved across **Refresh source** along with filters, sorting, and layout. Ordinary reloads without a saved refresh session reset selection.

![Selected task with its dependency chain emphasized and details visible](../images/viewer-selection.png)

The header Views button opens the view/layout dropdown. Choose an action to close it; Escape returns focus to the Views button, and clicking outside dismisses it. Arrow keys, Home, and End navigate its buttons. A green dot indicates active table filters.

Choose **Hide banner** in the Views menu to reclaim vertical space. The Views button moves to the footer; **Show banner** brings it back. The preference persists when browser storage is available.

## Controls and visual cues

| Action | Control |
|---|---|
| open or reopen a view | **Views menu** → view |
| arrange views | drag tabs or dividers |
| show DAG and grid together | drag the Wave grid tab to the bottom edge of the DAG group |
| restore the default arrangement | **Views menu** → **Reset layout** |
| pan | drag inside the graph; dragging does not select a node |
| zoom | mouse wheel over the graph, or **+** / **−** |
| show the whole graph | **Fit all** |
| center the selected task | **Focus selection** |
| select a task | click a node/card/key, or focus it and press Enter or Space |
| clear selection | Escape |

Task state appears as text as well as color. Task-table rows share the DAG state colors; selection adds an outline without replacing the state color. Ready tasks are green, blocked tasks peach, in-progress tasks blue, and closed tasks gray. A bold border marks the critical path; a dashed border marks a shared prerequisite. The selected task has a stronger green outline. Full node titles are available on hover and in Task details.

## Empty and error states

An empty snapshot says **No tasks in this snapshot**. A grid with no schedulable open work explains that tasks may be closed or have cycles or unresolved dependencies. Ready work and Findings each have explicit empty states.

The snapshot is loaded before the page opens. **Views menu → Refresh source** explicitly rereads it through the local server, then reloads the page with the workspace state restored. There is no polling. A failed read keeps the previous snapshot and displays an error in the footer; concurrent refresh requests share one read. Offline exports disable refresh. Invalid embedded data produces a visible startup error. Closing every panel shows a centered **Reset layout** button; the empty layout is preserved on reload. The Views menu also remains available to reopen individual views. An unknown server path returns `404 not found`.

## Freshness and comparison

Open **Views menu → Snapshot details** for the exact capture timestamp, or **Capture time unknown** for legacy snapshots. Reading or refreshing a snapshot file preserves that file’s capture time; it does not refresh the original tracker. An amber dot on the Views button flags partial data; Snapshot details identifies missing blocker references, unknown statuses, cycles, and source warnings.

**Changes** reports added and removed tasks, completed tasks, status changes, added/removed blockers, and changes in critical-chain membership. After a successful refresh it compares the previous successful read. **Compare snapshot JSON** instead compares a chosen earlier file against the current view; the file stays in the browser. This comparison uses stable task ids. It is not a full field-by-field audit, and different projects can produce misleading comparisons.

Local storage holds only panel layout. A refresh session uses browser history state to retain selected task id, search/filter values, sorting, and layout.

![Task table alongside the wave grid and task details](../images/viewer-table.png)

## Related workflows

- [Open the local viewer](../how-to/open-the-viewer.md)
- [Audit a project](../how-to/audit-a-project.md)
