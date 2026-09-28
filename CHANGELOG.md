# Changelog

All notable changes to this project are documented here. The format follows Keep a Changelog; versions follow SemVer.

## [Unreleased]

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
