# Changelog

All notable changes to this project are documented here. The format follows Keep a Changelog; versions follow SemVer.

## [Unreleased]

- Validate exact Kahn wave positions, planning coverage, and the displayed wave grid against the captured graph, expose unresolved work separately from shared prerequisites and temporary workstreams, and retain exact topology/state evidence in snapshot exports. Preserve full-analysis task state when filtering the displayed graph.

- Record a manual dependency review with explicit source scope, evidence basis, relationship dispositions, and unresolved exceptions. Recompute structural uncertainty from captured task facts even when imported claims or derived metadata omit it. Refuse unreopenable combined review exports and served viewer payloads with visible recovery limits, including derived HTML snapshot data. Disclose missing relationship decisions and out-of-capture claims explicitly. Detect changed prerequisite evidence, distinguish local records from imported claims, preserve reviews in full exports, and omit them from structure-only exports.

- Keep canceled prerequisites unresolved instead of declaring their dependents ready. Exclude affected chains from waves and critical paths, preserve canceled tasks as inactive history, and expose the unresolved obligation in findings and task details without changing Linear.

- Preserve package license declarations and shipped README notices when an offline dependency has no standalone license file, including GSAP.

- Keep rapid puppy posture requests on the animation frame queue so they preserve the visible pose until the next paint.

- Give every viewer page a direct local URL with browser Back/Forward and offline hash routes.
- Pack dependency components independently and place unconnected cards in a labeled grid. Open at readable card scale, with active/history filters and viewport recovery after layout changes.
- Keep capture time, task/edge counts, and source refresh visible on every page. Report retained capture time after refresh failure and preserve valid controls and selection.
- Distinguish source-labeled work kinds and tracking containers. Describe dependency-only readiness as no recorded open blockers, with an explicit incomplete-review notice.

- Show the active page name as a visible H1 above every workspace view, with themeable typography and responsive gutters.

- Give the puppy an irregular idle repertoire with varied tail wags, head and ear gestures, occasional bows, no consecutive repeats, and interaction-aware pauses that preserve manually held poses.

- Curl the seated puppy tail around its haunches; add idle gestures, bounded pointer gaze, and click-to-bark without losing the held pose. Restore theme ripples during pose animation and use directional damped spring impulses for shock waves.

- Give the far foreleg a distinct wrist and paw; keep pose and secondary animation controls available when rig visualization is off.

- Close the far foreleg shoulder mesh and give the far hind leg a tapered shin, hock, and distinct paw instead of a rectangular silhouette.
- Add two-bone limb joints and bind-space skinning; widen far-side legs and the bow stance while preserving torso depth.
- Fill rig debug nodes and add region-colored triangle surfaces that deform with the puppy while keeping edges readable.
- Add an opt-in development toolbar with GSAP dragging, keyboard movement, tool widgets, and bounded diagnostics. Move puppy rig controls out of Appearance into the developer overlay. Enable with YALIKEDAGS_DEV=1 when serving.
- Add a layered puppy rig with independent body/limb, head, ear, and tail tracks; persistent standing/sitting/bowing poses; and theme-aware region/bone debug controls in the development overlay.
- Blend repeated puppy clicks and replacement clips from their current animated positions, avoiding a snap to standing.
- Add a five-keyframe GSAP sitting animation on puppy click, with rounded haunches, an upright chest and head over the forelegs, folded rear legs, and staggered front-paw adjustments.
- Animate the embedded DAG puppy’s tail with reusable node keyframe clips played by GSAP timelines; connected arrows follow the wag and reduced motion restores the resting pose.
- Bundle GSAP locally for DAG/puppy hover wiggles, expanding click/theme waves, and semantic theme-color transitions. Follow selection across paginated views with animated scrolling and DAG centering. Default the resizable task drawer to its maximum width, preserving saved sizes. Respect reduced motion and cancel effects on user navigation.

- Replace fixed text-size choices with a live relative-scale slider and reset control. Respect browser font preferences, migrate saved sizes, and widen the desktop navigation using rem units so it scales with the text.

- Face the DAG puppy right and show a centered, full-height credential setup screen when `serve --project` has no usable Linear credential. Include the actual key target, safe keychain alternative, restart guidance, and a local-file example.

- Embed the DAG puppy inline above the navigation wordmark, with a compact mobile layout and colors inherited from the active theme. Offline exports include the same artwork without an asset request.

- Add explicit full/structure-only snapshot export choices and `sync`/`render --redact`. Structure-only exports replace identifiers, remove content and provenance, and recompute analysis without changing the current workspace. Document plaintext export contents and local retention.

- Add host-specific offline executable packaging with embedded viewer/runtime, dependency and runtime notices, source archive, manifest, checksums, and disconnected artifact verification.

- Bound snapshot file size, graph cardinality, strings, and JSON structure; compare imports in an embedded local worker with cancel, timeout, and stale-result protection.

- Add hash-based script policies to served/offline HTML and security headers to viewer responses; offline files deny connections and served pages restrict them to the local origin.

- Validate viewer request host, bound port, and HTTP method before routing snapshot or refresh requests.

- Add `--offline` to refuse remote sources and tracker writes before credential access and block outbound HTTP while retaining local file workflows.

- Document the atomic work contract: one executable issue per independently mergeable PR, correctness prerequisites as edges, and explicit antichain/MECE scope. Add root agent guidance and distinguish planned dependency discovery from current analysis.

- Align table filters, counts, and outer cells with shared responsive gutters; inset table and wave pagination controls from the viewport edges.

- Remove the navigation collapse toggle and keep the navigation visible, including when older saved preferences requested collapse.

- Restore the yalikedags? logo, remove the global header, move appearance to the navigation footer, and consolidate snapshot details, refresh, comparison, and JSON export under Import/Export. Hide content scrollbars while preserving scrolling.

- Center readable graph zoom on selection, bound zoom, add client-side graph owner/state filters, make task rows fully selectable, and render sanitized Markdown descriptions. Add a saved, draggable inspector width and replace duplicate header dismissal controls with a single close button.

- Add client-side pagination to ready work, tasks, wave workstreams, unscheduled tasks, and grouped findings, changes, and impact lists; filters and sorting cover the complete project.

- Make impact counts expand into inspectable task lists, add selection-preserving inspector collapse, raise default text to 16 px with a saved size control, and remove decorative viewer copy.

- Add Tomorrow Night Eighties, Solarized, Dracula, Monokai, Gruvbox, Tokyo Night, and Monotone viewer palettes, each with light/dark variants, persisted selection, and contrast-tested semantic tokens.

- Add Palm (the supplied five-color palette) and paired Graphite light/dark stylesheets, with an accessible appearance picker and persistent Light/Dark/System preferences. System follows OS changes; offline exports support the same controls.

- Add stable-id owner filters, graph neighborhoods, local table filters and optional columns, grouped findings and assignment changes, capture provenance on mobile, and token-driven dark/light CSS themes.

- Render all viewer views and SVG in the browser from server-produced `/viewer.json`; embed the same payload in offline HTML. Preserve Linear workspace/project/capture identity in snapshots and display assigned owners or Unassigned throughout the viewer.

- Replace the Dockview panel manager with a workflow-first viewer: ready-work overview, critical-path steps, six full-area views, and an on-demand task inspector. Remove docking and pop-outs; retain offline export, graph navigation, filters, snapshot comparisons, and refresh restoration. Use graphite surfaces and semantic state colors.

- Discard graph drag state when the pointer returns after releasing outside the SVG.

- Resolve critical-path ties in stable task-id order so reordered snapshots do not report false chain changes.

- Confirm successful refresh comparisons with no changes instead of showing the initial comparison prompt.

- Limit cycle refusal diagnostics to tasks on newly cyclic edges, excluding unrelated existing cycles.

- Keep the latest selected snapshot in control of comparison results when file reads finish out of order.

- Clear previous comparison rows when a selected snapshot cannot be read.

- Export snapshot schema 2 for unknown statuses and exact estimates; continue reading legacy schema 1 files.

- Consume refresh restoration state once so later reloads honor the latest saved layout.

- Keep DAG nodes readable when reopening a panel that was closed in the saved layout.

- Give unresolved nodes a readable pale yellow fill in standalone SVG exports.

- Report cancellation as a status change in snapshot comparisons; only entering done counts as completion.

- Add README subheadings for the overview, Linear writes, team use, offline sharing, viewer layout, and bundled example.

- Add active-view pop-out windows to the local viewer, preserve cross-window interactions, and redock views when windows close or the parent reloads.

- Add repeatable Expand view / Restore view controls, including temporary expansion of sidebar views.

- Make inspector views a native collapsible Dockview sidebar and preserve sidebar placement and collapse state.

- Show a centered Reset layout button when all views are closed, and preserve intentionally empty layouts on reload.

- Remove the status strip; keep capture/quality details, Refresh source, and Reset layout in Views, with refresh failures visible in the footer.

- Add a persistent Hide banner option; keep the Views menu reachable in the footer while the banner is hidden.

- Replace the settings cog with a dashboard icon labeled Views menu.

- Move view and layout actions into a header cog dropdown with keyboard navigation, focus restoration, and outside-click dismissal.

- Remove the one-shot Split views action; arrange multiple views by dragging their tabs instead.

- Match task-table row colors to DAG node states, preserving state color when a row is selected.

- Fix sticky table headers by giving each table an unpadded scroll viewport; filter controls and introductions remain outside it.

- Replace speculative scaling guidance with current limits and a reproducible measurement approach.

- Add capture and partial-analysis notices, manual refresh preserving workspace state, and local snapshot comparison for task status, blockers, and critical chains.

- Add a sortable, searchable task table with state, assignee, milestone, and label filters while retaining the wave grid.

- Add a Dockview workspace with shared selection, search, keyboard navigation, graph controls, persistent layouts, and offline browser coverage.

- Preserve source capture timestamps and warnings across snapshot round trips, with explicit unknown legacy capture times.

- Include in-progress resource holders when reporting contention for ready work.

- Separate immediate unblocking from downstream impact in frontier ranking and reports.

- Keep external blockers and unknown statuses unresolved, and reject malformed or truncated Linear connections instead of trusting a partial graph.

- Preserve exact raw estimates, including fractions, through analysis and mutation verification; remove scale-specific split heuristics.

- Reject boolean flag values, missing option values, and duplicate CLI switches.

- Require exactly `YALIKEDAGS_LIVE=1` for live tests and guard teardown when fixture setup fails.

- Fix cycle safety across skipped/failed removals, attempted additions, and final verification. Skipped changes leave receipts incomplete.

### Added
- **The grid view.** The viewer now has two views of one selection. Graph is what it was. Grid is workstreams down the side and waves across the top, one card per open task, with a *shared prerequisites* row first for the gatekeepers, which sit in a wave but in no workstream. Reading down a column shows what could run in parallel this round; reading across a row shows one workstream's order of work; an empty cell is a workstream with nothing to do in that round. Cards carry the same state, critical-path and gatekeeper marks as the graph nodes, and selecting a task in either view highlights its ancestors and descendants in both. The grid is computed once by `GridService` from the waves, gatekeepers and workstreams the analysis already has, and shipped as a `grid` field in the snapshot JSON; the page draws the table from that data, as it already did for the frontier and the findings. The one-file export carries the same data, and a test pins that every open task lands in exactly one cell.
- **`render --format html`: the viewer as one self-contained file.** The same page `serve` returns, from the same function, with the CSS, the graph, the snapshot and the script inline. It opens from disk with no process behind it and fetches nothing, so it travels: to a laptop with no key on it, to somebody who does not have this tool, or into a directory beside last week's copy. Its only outbound links are the per-card "Open in Linear" ones, which come from the source data. A test asserts the file and the server's `/` are byte for byte identical, so neither can drift; another asserts the page requests nothing external. `--format`'s refusal message now derives from the registry rather than repeating it in prose.
- **The write path.** `plan` diffs a desired graph against a tracker and writes a reviewable plan document (`yalikedags/plan/1`); `apply` performs it and then reads the tracker again to report what actually landed. Safety is structural rather than remembered: a plan is a separate document from the act of performing it, `apply` is a dry run without `--confirm`, destructive mutations need `--prune` at plan time and `--allow-destructive` at apply time, a plan is bound to the target it was computed against, matching between graphs is by id or key and never by title, absence in the desired graph never clears a value, pruning only ever touches edges whose both endpoints were matched, and `TaskWriterPort` has no method for status, assignee, priority or title.
- `TaskWriterPort`, `Mutation` (add and remove a blocking relation, set estimate, set milestone), `Plan`, `ReconcileService`, `ApplyService`, `LinearTaskWriterAdapter` (reads before every write, so a half-applied plan is re-runnable), `DryRunTaskWriterAdapter`, `PlanJsonCodec`, `PlanTextAdapter`, `SourceSpec`, `ReconcileCommands`.
- `TaskDagJsonRepositoryAdapter` and a `--dag` source, which also supplies the resource policy the frontier's conflict report had no source for.
- `LinearGraphqlClient` and `GraphqlJson`, shared by the Linear reader and writer so they cannot drift in authentication, refusal naming, or project resolution.
- Exit codes 8 (`APPLY_INCOMPLETE`), 9 (`PLAN_MISMATCH`) and 10 (`PLAN_WOULD_CYCLE`); docs for the write path (how-to, plan and receipt reference, troubleshooting entries).
- `key --set --target <name>`, reading the secret from stdin rather than argv so it cannot reach shell history or the process table, and `key --check --target <name>`.
- A live test tier and an idempotent fixture provisioner (`scripts/live-fixture.ts`, `test/live/`, `bun run test:live`). The fixture is eight issues, two milestones and a team estimate scale, each present for a named reason; provisioning is also a reset, so a run leaves the workspace where it found it. It is fenced by three things: its own credential name (`YALIKEDAGS_LIVE_KEY`, in the keychain or the environment, deliberately never `LINEAR_API_KEY`), a sentinel the project name must contain, and a prefix every issue title it will touch must start with. The key resolves from the keychain, and the team and project from a flag, the environment, or the manifest, so a shell that exported nothing but the `YALIKEDAGS_LIVE` opt-in switch can still run it.
- TypeScript on bun rewrite of the Python prototype, which remains in the first commit as history. Zero Python.
- Binding standards under `docs/standards/`: documentation (reader-task), TypeScript code, testing.
- Domain: `Task` (validated, frozen, finite nonnegative raw effort, Linear-shaped priority) and `Dag` (blockedBy as the only stored edge; derived dependents, closures, Kahn order, Tarjan cycles, transitive redundancy). `ResourcePolicy` for exclusive, capacity, advisory resources.
- Services: state, frontier (due, priority, fan-out, age, id) with resource conflicts, waves and gatekeepers and MECE workstreams, critical path by depth and by summed effort, audit (isolated, redundant, stale and dangling blockers, cycles, split candidates with the observation that would kill each), layered layout, and `Analysis` composing them.
- Input adapters: Markdown task lists, snapshot JSON (`yalikedags/snapshot/1`), and Linear over GraphQL (read-only; pages at 50 under Linear's complexity cap; blocks relations in both directions; named refusals).
- Output adapters: snapshot JSON, GraphViz DOT, standalone SVG, plain-text report.
- CLI: `sync`, `audit` (`--json`, `--strict`), `frontier`, `render` (`json|dot|svg|text`), `serve` (loopback viewer with pan, zoom, selection, ancestor and descendant highlighting; no external requests; the key never reaches the page), `key --set | --check` (OS keychain via `@git-stunts/vault`, account `git-stunts`). Exit codes are a documented contract.
- Documentation set per the standard: tutorial, four how-tos, four reference pages, two explanations, troubleshooting, contributor guide, `docs/catalog.yaml`, and `bun run docs:lint`.
- CI on bun; plain shell hooks (lint and docs lint on commit, tests on push).

### Fixed
- **`apply` checked a mutation's destructiveness against a world that had stopped moving.** A plan classifies a write as destructive when the plan is made: set an estimate on a card that has none and the write is non-destructive, so `apply` performs it without `--allow-destructive`. If a teammate set an estimate in between, that write silently replaced theirs. `Mutation.preconditionHolds` is now checked against the read `apply` already performs before writing, and a mutation whose recorded `from` has moved is reported `stale`, written nowhere, and leaves the receipt incomplete. `--allow-destructive` does not waive it: one gate asks whether you accept losing a value you saw, the other asks whether it is still the value you saw. A mutation already in place is still `confirmed` without a write, and that check runs first, so re-running a half-applied plan stays free.
- **`plan` could write a cycle into the tracker.** A desired graph can be acyclic and still close a loop against edges the tracker already holds, and Linear accepts each of those writes in turn. `plan` now builds the graph the plan would leave behind and refuses to emit it, exit 10 (`PLAN_WOULD_CYCLE`), naming the cards. A cycle the source already had is not the plan's doing and does not block it.
- **An unknown flag was silently ignored.** Every typo failed safe except the ones where safe is the wrong direction: `--no-estimtes` meant estimates were written by somebody who asked for them not to be, and `--alow-destructive` read as a decision never made. Unknown flags are now a usage error naming the flag, with a suggestion when one known flag is obviously the one meant.
- The fixture provisioner asked Linear for 250 issues with a nested relation connection, which scored 18126 against a complexity cap of 10000, and never checked for a second page: over that limit it would have read part of the project and created duplicates of the part it missed. Now 100 per page with the second page refused by name. The guard was observed red before the fix.
- `--key-target <name>` on every CLI command. Without it the CLI could only ever use `LINEAR_API_KEY`, so pointing it at a test workspace was impossible and a command meant for one would silently authenticate as the production workspace instead.
- Five prototype-era examples deleted: two CSVs that loaded zero tasks (there is no CSV adapter) and three lists that encoded dependencies in prose for an inference engine the rewrite does not have, which produced zero edges. `examples/README.md` still told you to run them with `python3`. `test/Examples.test.ts` now pins what each surviving example produces, so one cannot rot silently again.
- Troubleshooting entries for the three refusals this release added (`stale` mutations, `plan_would_cycle`, an unknown flag), and the two-workspace key procedure `--key-target` needs, which shipped undocumented.
- `docs:lint` checks the catalog in both directions. It could previously see a catalog entry with no file, but not a file in no catalog entry, which is how a doc set acquires orphans.
