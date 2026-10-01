# The viewer

## Open a workspace

`serve` hosts the viewer on `127.0.0.1`. `render --format html --out dag.html` writes the same workspace as one self-contained file. The browser renders all views and the SVG graph. The local server delivers a minimal HTML shell, then `/viewer.json` supplies the analyzed project data and refresh/comparison metadata. No external assets are fetched. Offline HTML embeds that same JSON payload alongside the client code and styles, and opens without a key, running server, or network request.

![Start here: ready work, unblocking impact, and the critical path](../images/viewer-overview.png)

## Rendering and data

The server computes task states, frontier order, unblocking counts, waves, workstreams, critical paths, audit findings, and resource conflicts. The browser decodes those results and builds the interface; it does not rerun scheduling to draw the views. Graph positioning is a client rendering step. Comparing a locally chosen JSON file remains entirely client-side. `/snapshot.json` is the portable snapshot export; `/viewer.json` wraps it in schema `yalikedags/viewer/1` with refresh capability and optional changes. Neither endpoint writes a JSON file to disk. Use `sync --out` or `render --format json --out` to save one.

## Linear account and assignments

For a fresh Linear read, the navigation rail and **Snapshot details** show the workspace, project, and user who captured the data. These are capture metadata, not a claim that the person opening an export is signed in. Older snapshots and file sources without this metadata say so. Credentials and email addresses are not included.

Ready cards, wave cards, critical-path steps, graph nodes, the task table, and the inspector show assignment names. Missing assignment displays **Unassigned**. The existing Tasks assignee filter includes an Unassigned option. Long assignee names can be shortened in graph labels; the full name is available in the node tooltip and inspector. Refresh the source to see assignment changes; the viewer never assigns or reassigns issues.

## Start with the next move

The first visit opens **Start here**. The summary counts ready, in-progress, blocked, unresolved, and finished tasks separately. Ready work is ranked by urgency. Click **Immediately unblocked** or **Downstream** on a card to expand the exact task list; each result opens its details. Immediate results become ready when that card finishes; downstream results include unfinished descendants that may still have other blockers. Resource warnings include in-progress holders and ready contenders.

The critical path lists the longest chain of open tasks by depth, in dependency order. Select any step to inspect it. This is a dependency forecast, not a duration estimate or calendar schedule. The graph's bold borders include both depth-based and effort-based critical chains.

## Views

The navigation rail switches the main working area between six views. On narrow screens it becomes a horizontally scrollable navigation bar.

| View | Use it to |
|---|---|
| **Start here** | Find ready work, its impact, and the longest open chain. |
| **Dependencies** | Trace blockers and dependents. Arrows point from blocker to dependent. **Readable size** restores a readable scale; **Fit all** shows the complete graph. |
| **Waves** | Compare workstreams across waves. Shared prerequisites appear first. Columns retain their width and scroll horizontally. |
| **Tasks** | Search, sort, and filter by state, assignee, milestone, or label. Filters apply only to Tasks. Click anywhere on a row to open details; the column chooser remembers optional columns. |
| **Findings** | Review audit findings, supporting details, and evidence that would invalidate them. |
| **Import/Export** | Inspect and refresh the source, export snapshot JSON, or compare an earlier snapshot locally. |

Only one main view is shown at a time. The active view is remembered when browser storage is available. Invalid or unavailable storage falls back to Start here. Old Dockview layouts are ignored; docking, split panes, and pop-out windows have been removed.

A wave is a forecast of parallel work, not a deadline or scheduling barrier. Tasks with unknown statuses, unresolved external blockers, cycles, or dependencies on such work appear under **Outside the wave forecast**. Workstreams use titles and wave headings include task counts. An external blocker is a task outside the loaded project whose status cannot be established here.

![Waves show workstreams and parallel work](../images/viewer-split.png)

## Pagination

Ready work, Tasks, wave workstream rows, unscheduled tasks, and each findings/change/impact group use client-side pagination. The default is 25 items, with 10, 25, 50, or 100 per page and First/Previous/Next/Last controls. The range and page count describe the filtered results. Lists of ten or fewer omit unnecessary controls.

Task filters and sorting operate across the full dataset before paging. Owner filters reset Ready work and Waves to page one. Each view has independent paging; changing pages preserves task selection. Page sizes and positions last for the current view session and reset on reload. Wave column counts remain project-wide. The dependency graph is not paginated; use graph filters or neighborhood focus to narrow it.

## Find and inspect a task

1. Open **Dependencies** and enter a key, title, or assignee in **Find a task**.
2. Choose a result, or press Enter for the first match. Arrow Down moves focus into the results.
3. Dependencies opens, centers the task, and opens its details.
4. Follow clickable blockers and dependents, or switch views to inspect the same selection.
5. Use **Close task details** or Escape to clear selection and reclaim the space.

The left navigation stays visible. The **Task details** edge button hides or restores the drawer while retaining selection. Its single **Close task details** button clears selection. Drag the drawer's left edge to resize it, or focus that edge and use arrow keys; its width survives reloads. On smaller screens the inspector overlays the working area. Content scrollbars are hidden while scrolling remains available.

Search displays up to 30 results and tells you when to narrow the query. Task descriptions render sanitized GitHub-flavored Markdown, including lists, tables, code, and disabled checkboxes. Description images become links rather than fetching external assets. Valid links open in a new tab.

Before selection, the graph has the whole working area:

![Dependencies before task selection](../images/viewer-graph.png)

After selecting the DAG builder, its dependency chain and details are visible:

![Dependencies with the selected task and its inspector](../images/viewer-selection.png)

Dependencies has independent owner filters (**Everyone**, **My tasks**, **Unassigned**) and state filters, including **Open** for unfinished tasks. My tasks uses the captured account's stable user id. Filtering redraws matching nodes and their connecting edges client-side. Selecting a search result outside the filters clears them to reveal it. **Readable size** centers the selected node. Zoom is bounded between 200% and 25%, allowing a wider fit when needed to show the entire graph.

## Controls and visual cues

| Action | Control |
|---|---|
| switch view | navigation rail |
| pan | drag inside the graph |
| zoom | mouse wheel, or **+** / **−** |
| show the whole graph | **Fit all** |
| return to readable node sizes | **Readable size** |
| center the selected task | **Focus selection** |
| select a task | click a node, card, path step, or task key; keyboard users can press Enter or Space |
| close details and clear selection | **Close task details**, or Escape |
| inspect freshness, refresh, or export JSON | **Import/Export** |

The graphite surfaces use cyan for navigation and selection. Task states use mint (ready), blue (in progress), coral (blocked), pink (unresolved), and slate (done). State names remain visible as text. A bold graph border marks critical-chain membership; a dashed border marks a shared prerequisite. Unrelated edges recede on selection while task labels stay readable. The table uses colored state text rather than full-row state fills.

![A full-width task table with filters](../images/viewer-table.png)

## Freshness, comparison, and errors

**Import/Export → Export snapshot JSON** downloads the current snapshot as `yalikedags-snapshot.json`, including task descriptions and captured account metadata. This works in offline HTML too. Importing an earlier JSON file compares it with the current project; it does not replace the current project or write to Linear.

**Import/Export → Snapshot details** shows the exact capture timestamp, or **Capture time unknown** for legacy snapshots. Partial-analysis details identify missing blocker references, unknown statuses, cycles, and source warnings. Reading a snapshot file preserves its original capture time.

**Import/Export → Refresh source** explicitly rereads through the local server. There is no polling. Selection, filters, sorting, and active view survive a successful refresh; failed reads preserve the current snapshot and display a notice. Offline exports disable refresh. A refresh of a snapshot file rereads that file, not its original tracker.

Snapshot comparison runs in an embedded local worker, including in offline HTML. Files above 8 MiB are refused before reading; [snapshot import budgets](snapshot.md#import-budgets) also bound graph and JSON structure. **Cancel comparison** terminates work, and a 15-second timeout stops expensive comparisons. A newer selection cancels the previous request. Failure or cancellation leaves the current project intact and clears incomplete comparison results.

**Import/Export** reports added and removed tasks, completed tasks, status changes, assignment changes, blocker changes, and changes in critical-chain membership. After refresh it compares the previous successful read and confirms when no changes were found. **Compare snapshot JSON** compares a chosen earlier file locally. It uses stable task ids, so files from unrelated projects can give misleading results. It is not a complete field-by-field audit.

Empty snapshots, unschedulable waves, no ready work, and no audit findings have explicit empty states. Invalid embedded data produces a visible startup error. Local storage holds the active view, column preferences, inspector width, and appearance preferences; a refresh handoff temporarily uses browser history state for selection and controls. Ordinary reload resets selection.

## Ownership, graph neighborhoods, and findings

Start here and Waves have independent owner filters, including **Unassigned** and **My work (snapshot account)**. My work compares stable Linear user ids, not display names, and is unavailable when identity metadata is missing. Account and capture information are available in Import/Export on mobile. An incomplete-analysis notice distinguishes uncertainty from ordinary blocked work.

Select a graph task, then **Focus neighborhood** to lay out its immediate blockers and dependents. **Expand one hop** reveals more connections; **Whole project** restores the previous viewport within the current graph filters. Switching views preserves zoom. Inspector dependency links reveal and center the graph; closing details returns focus to the originating control when it remains available.

Findings separate structural problems from suggestions and group them by kind. **Inspect affected chain** opens a focused neighborhood. Changes group events by type, including reassignment, and show before/current capture provenance when available.

## CSS themes

The interface is custom HTML, CSS, and TypeScript, without a component framework. Styling uses three token levels:

- `src/viewer/browser/theme.css`: reference palette, semantic roles (canvas, surface, ink, accent, task states), shared typography, spacing, sizes, and effects.
- `src/viewer/browser/component-tokens.css`: named component defaults for every visual declaration, including responsive variants and graph styles.
- `src/viewer/browser/viewer.css`: selectors consume tokens; locally inherited task colors resolve at the component.

The default base text size is 16 px. **Theme → Base text size** offers 14, 16, 18, and 20 px, scales shared typography tokens, and saves the choice locally. Introductory slogans, navigation numbering, repeated view subtitles, and idle footer instructions have been removed. Task data, uncertainty explanations, and operational controls remain.

Use the **Theme** button at the bottom of the left navigation to choose a palette independently of **Light**, **Dark**, or **System** display mode. System is the default and follows operating-system changes immediately. Preferences stay in browser storage; selections still work for the current session when storage is unavailable. The same controls work in offline HTML and on mobile. Escape closes the appearance panel and returns focus to its button.

Graphite pairs `themes/light.css` with `themes/dark.css`. Palm (`themes/palm.css`) preserves the supplied Carbon Black `#1b2021`, Ebony `#51513d`, Palm Leaf `#a6a867`, Vanilla Custard `#e3dc95`, and Sand Dune `#e3dcc2` anchors. Its dark mode uses Carbon Black surfaces, Sand Dune text, Custard accents, and Palm Leaf readiness. Its light mode reverses the luminance hierarchy and derives darker readable accents. OKLab mixes derive intermediate surfaces; blue, coral, and pink retain the other task-state meanings.

The HTML element records the palette as `data-palette`, the preference as `data-mode`, and the resolved light/dark mode as `data-theme`. To ship another theme, import its stylesheet after the token defaults in viewer.css, register its option in ThemeCatalog, and rebuild with `bun run build:viewer`. Offline exports embed the compiled styles too.

Available palettes include Graphite, Palm, Tomorrow Night Eighties, Solarized, Dracula, Monokai, Gruvbox, Tokyo Night, and Monotone. All support Light, Dark, and System. Monotone is neutral grayscale; written state labels remain visible. Each palette has a separate CSS file; the shared catalog drives both the picker and contrast-test coverage.

These are viewer adaptations, not exact editor-theme ports. Original palette anchors stay in reference tokens. Semantic text colors use bounded OKLCH lightness (and reduced red chroma where needed) to maintain 4.5:1 contrast on panels and tinted graph cards. Light Dracula and Monokai are custom companions; Tomorrow Night Eighties pairs with Tomorrow's light palette.

Palette sources:

- [Tomorrow by Chris Kempson](https://github.com/chriskempson/tomorrow-theme)
- [Solarized by Ethan Schoonover](https://ethanschoonover.com/solarized/)
- [Dracula specification](https://draculatheme.com/spec)
- [Monokai palette in VS Code](https://github.com/microsoft/vscode/blob/main/extensions/theme-monokai/themes/monokai-color-theme.json)
- [Gruvbox by morhetz](https://github.com/morhetz/gruvbox)
- [Tokyo Night palette](https://github.com/tokyo-night/tokyo-night-vscode-theme)

For example, a theme can override these values without rewriting component selectors:

```css
:root {
  --accent: oklch(82% .12 195);
  --font-sans: system-ui, sans-serif;
  --space-unit: 1px;
  --ui-button-border-radius: 10px;
  --ui-button-padding: 10px 16px;
  --ui-graph-node-gatekeeper-dash: 8 4;
}
```

Colors, type, spacing, borders, radii, shadows, opacity, component dimensions, and SVG paint styles have token hooks. Browser tests check text contrast for dark and light themes and verify that overrides reach controls, cards, and SVG nodes. Accessibility hiding rules remain fixed; responsive breakpoints are CSS media queries. Graph layout coordinates are computed by the renderer, not CSS presentation rules.

## Related workflows

- [Open the local viewer](../how-to/open-the-viewer.md)
- [Audit a project](../how-to/audit-a-project.md)
