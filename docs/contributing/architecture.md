# Architecture and safe change guide

## Purpose and boundaries

yalikedags reads tasks from a source, computes derived views over the dependency graph, renders them, and can write a reviewed plan of dependency edges back to a tracker. Everything except `apply --confirm` writes nothing anywhere but stdout, `--out`, and a loopback HTTP port. The three standards under [`../standards/`](../standards/) are binding; read them first.

## The model

Two stored facts per task (`status`, `blockedBy`), everything else derived. [Derived views](../explanation/derived-views.md) explains the folds. Ports and adapters keep the folds pure:

```text
src/core/domain/      Task, Dag, ResourcePolicy          classes with invariants, frozen
src/core/domain/      Mutation (+ subclasses), Plan
src/core/services/    State, Frontier, Waves, CriticalPath, Audit, LayeredLayout, Analysis(Service)
src/core/services/    Reconcile (the diff), Apply (perform and verify)
src/ports/            ClockPort, HttpPort, SecretsPort, TaskRepositoryPort, RendererPort, TaskWriterPort
src/adapters/input/   TaskListParserAdapter, JsonSnapshotRepositoryAdapter, LinearTaskRepositoryAdapter, TaskDagJsonRepositoryAdapter
src/adapters/output/  JsonSnapshotAdapter, DotRendererAdapter, SvgRendererAdapter, TextReportRendererAdapter
src/adapters/output/  LinearTaskWriterAdapter, DryRunTaskWriterAdapter, PlanTextAdapter
src/adapters/linear/  LinearGraphqlClient, GraphqlJson (shared by the reader and the writer)
src/adapters/plan/    PlanJsonCodec
src/adapters/{http,clock,secrets}/  the hosts: fetch, wall clock, env, vault, chain
src/viewer/           ViewerPage (shell), ViewerData (JSON), ViewerMarkup + ViewerPanels (client HTML), ViewerRequestHandler (pure), ViewerServerAdapter (Bun.serve)
src/viewer/browser/   single-view workspace, selection, search and SVG navigation
scripts/build-viewer.ts  bundles JS/CSS into ignored src/viewer/generated/assets.ts
src/cli/              Args, ExitCode, SourceResolver, SourceSpec, ReconcileCommands
src/cli.ts            the composition root; the only file that constructs host adapters
```

`src/core` and `src/ports` import nothing from adapters, the CLI, `node:*` or `bun`; ESLint refuses it.

## Invariants worth knowing before you edit

- `Task` validates in its constructor: no self-blocking, effort is a finite nonnegative number. The Linear adapter preserves raw estimates, including fractions, for both analysis and mutation verification.
- `Dag.dependents` is derived from `blockedBy`; never store the inverse.
- `unknown` becomes a domain class only in `JsonSnapshotRepositoryAdapter.decodeTask`, `LinearTaskRepositoryAdapter.toTask`, `TaskDagJsonRepositoryAdapter.toTask` and `PlanJsonCodec.decode`.
- `TaskWriterPort` has no method for status, assignee, priority or title. Adding one would move ownership of that field; do not do it to make a plan more convenient.
- Both relation methods on the Linear writer read before they write, so `apply` is re-runnable. Any new mutation must keep that property or the recovery story breaks.
- A mutation's `satisfiedBy` is what verification means. A mutation whose effect cannot be observed in a re-read must not be added.
- Renderers never mutate; the domain never serializes.
- The viewer receives public account provenance and assignment names, never the key. The server produces analysis JSON; the browser renders all project markup.

## Edit paths by change type

| You want to | Touch | Test at |
|---|---|---|
| a new source (GitHub issues, Jira) | `src/adapters/input/<Name>Adapter.ts` implementing `TaskRepositoryPort`; wire in `SourceResolver` | the adapter over a recorded fixture |
| a new output | `src/adapters/output/<Name>RendererAdapter.ts` implementing `RendererPort`; add to `RENDERERS` in `cli.ts` | the renderer over an `Analysis` built from a few tasks |
| a new derived view | `src/core/services/<Name>Service.ts`; add its result to `Analysis`; surface in the JSON and text renderers | the service over a `Dag` |
| a new audit finding | `AuditService.audit`, a new `FindingKind` | one behaviour test per kind |
| a new mutation kind | a `Mutation` subclass; a method on `TaskWriterPort`; both writer adapters; `PlanJsonCodec.decodeMutation` | `satisfiedBy` both ways, the codec round trip, and the writer over a recorded fixture |
| a Linear field | the GraphQL string and `toTask` in the Linear adapter; `TaskFields`; the snapshot codec both ways; `docs/reference/snapshot.md` | the Linear fixture test and the snapshot round-trip |
| the viewer | `ViewerPage.ts`, `ViewerPanels.ts`, `browser/` or `ViewerRequestHandler.ts` | `test/Viewer.test.ts` and `e2e/viewer.pw.ts` |

## Verification

```bash
bun run check        # lint, typecheck, docs lint, hermetic suite; what the hooks and CI run
bun run test:live    # the tier that talks to a real workspace; see contributing/live-testing.md
bun test test/Linear.test.ts   # one file
bun run docs:lint    # links, fenced-block languages, catalog ids
```

Live check against a real project (read-only, needs the key): `bun src/cli.ts sync --project "<name>" --out output/live.json`. `output/` is ignored; delete the file afterwards if it holds a real workspace.

## Viewer build and browser checks

`bun install` builds the viewer through `postinstall`. After browser-code edits, run `bun run build:viewer`; `bun run check` also rebuilds it. The generated module is ignored by Git and imported by both HTML renderers, sharing the client renderer between the local shell and offline export. The local shell fetches `/viewer.json`; the offline file embeds that same payload. Neither fetches external assets. The browser workspace has no UI framework dependency. Marked parses task descriptions; DOMPurify sanitizes the resulting markup before insertion. Description images become explicit links so exports do not fetch remote assets.

Install the test browser with `bunx playwright install chromium`, then run `bun run test:browser`. CI installs Chromium and runs this separately from the offline Bun suite. The browser suite exercises both `file://` export and loopback serving, storage fallback, shared selection, view navigation and inspector lifecycle, graph navigation and filtering, Markdown sanitization, pagination, palette contrast, inspector resizing, escaping, and crowded/empty graphs.

`bun run viewer:screenshots` regenerates the viewer documentation screenshots using only the bundled public example and a fixed date.

## Known gaps

- Resources are read only from a `--dag` source; every other source leaves the policy empty.
- Refresh is manual; the viewer does not poll.
- The writer's behaviour against the real API is established only by the live tier, which must actually be run; recorded fixtures describe what Linear's responses look like, not what Linear does.
- Milestones are matched by name and never created.
- No `OverlayRepository` port; see [source of truth](../explanation/source-of-truth.md).
