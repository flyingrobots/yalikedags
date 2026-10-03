# How the frontier, the workstreams and the critical path are derived

## The problem it solves

A project of a few hundred cards has more structure than anyone can hold in their head, and the structure changes every time a card closes. Storing "ready" or "blocked" on a card means it is wrong the moment a blocker finishes. So the tool stores almost nothing and computes everything at read time.

## Mental model

These calculations operate on supplied edges. The intended planning unit and dependency meaning are defined in [one issue, one independently mergeable PR](atomic-work.md); automatic discovery of missing edges is planned, not implemented.

Two stored facts per task: its **status** and its **blockedBy** list. Every other word in the report is a fold over those two facts across the graph.

```text
STORED:  status, blockedBy
FOLDS:   done ─┐
               ├─ state (done | in-progress | blocked | ready | unresolved)
               ├─ dependents (the inverse of blockedBy)
               ├─ frontier (ready, ordered)
               ├─ waves (Kahn layers over open tasks)
               ├─ gatekeepers and workstreams
               ├─ grid (waves by workstreams)
               └─ critical path (depth, effort)
```

## Main mechanism

**State.** A task is terminal history (`done` in the derived state) when its source status is done or canceled; neither is executable work. Only completed work satisfies a prerequisite. Otherwise a task is `in-progress` if Linear says so, `unresolved` if its status is unknown or an unfinished prerequisite chain reaches a canceled, unknown, or absent task, `ready` if every stored blocker is completed, else `blocked`. An in-progress task retains its source execution status while unresolved prerequisite obligations remain visible in its inspector. Completed outputs end prerequisite traversal: an old cancellation upstream of a completed prerequisite does not invalidate the completed output.

**Cancellation and resolution.** Canceling a prerequisite does not deliver its required output. The dependent chain stays outside the wave forecast until the source dependency is explicitly corrected after review. Remove an obsolete edge or replace it with the task that now supplies the output; an unfinished replacement still blocks. Duplicate labels or closure alone are not evidence that another task delivered the output. There is no automatic waiver, edge deletion, or reopening of canceled work.

**Frontier.** The ready tasks, sorted by days until due (undated last), then priority (1 first, unset last), then how many direct dependents become ready upon its completion, then the number of open descendants (more first), then creation time, then id. Priority is a tiebreaker inside the frontier and never overrides an edge.

**Resource conflicts.** Resources are attributes on tasks, never edges, because contention is symmetric and non-transitive. Ready tasks are flagged when their combined contention with in-progress holders exceeds an exclusive or capacity limit. `advisory` never blocks. The task-dag file source supplies resource policy; sources without a policy report no capacity conflicts.

**Waves.** Kahn layering over the open subgraph: wave 0 is every task with a known open status whose stored blockers are all known and done, wave 1 what those free, and so on. Each wave is an antichain in the active graph, where completed outputs end prerequisite paths. This is dependency-compatible parallelism, not a maximum-antichain optimization or a resource-feasible schedule. Waves are a forecast, not a barrier; the frontier rolls.

**Gatekeepers and workstreams.** A gatekeeper is a schedulable task with two or more schedulable dependents: a shared prerequisite. Cut the gatekeepers out of the schedulable graph and the connected pieces that remain are temporary analytical workstreams. Each schedulable card belongs to either the shared category or exactly one workstream. Active cards without a wave belong to a separate exception category.

This partition does not establish deliverables or ownership. In a diamond A → B/C → D, A is shared and B, C, D form one workstream. A workstream ID is its smallest member ID; completing that member can change the ID. Different member sets can reuse an ID, so compare the captured graph and member list, not the ID alone. Selection and filters use task identities. Source assignees on shared prerequisites remain visible without assigning their effort to multiple groups.

**Grid.** Waves layer the schedulable graph by prerequisite order and workstreams partition it by topology, so their product is a grid in which every open schedulable task has exactly one cell. One row per workstream, one column per wave, and a shared row first for the gatekeepers, which belong to a wave but to no workstream. This is what the viewer's Grid view draws.

**Critical path.** The longest chain of open tasks without unresolved prerequisite obligations, computed twice: by depth (number of hand-offs) and by effort (summed estimate, unestimated tasks weighing 1 as Linear counts them). Unknown tasks and chains reaching canceled, unknown, or missing prerequisites are excluded; Findings and the wave exceptions retain their evidence. The two lengths can disagree, and both are reported. There is no float, no forward or backward pass: those need durations, and this graph carries effort.

## Important invariants

- Completed tasks satisfy prerequisites and belong to no wave, workstream, or grid cell. Canceled tasks also remain outside executable work, but do not satisfy remaining prerequisite edges.
- Every schedulable open task is in exactly one wave. Every schedulable non-gatekeeper task is in one workstream; unschedulable tasks have no grid cell or workstream.
- `dependents` is derived; storing both directions would be two sources of truth for one edge.
- The layout used by the SVG and the viewer is the same pure service, so what you see is what the report computed.

## Failure and degradation behaviour

Critical-path ties use stable task-id traversal for both terminal candidates and blockers. Reordering task arrays or blocker sets therefore does not create comparison changes.

A cycle makes the graph invalid: Kahn ordering stops early, the critical path treats the back edge as absent, and the audit reports the cycle members. `audit` exits 6 until it is broken.

## Tradeoffs and alternatives

Time-based CPM, PERT and critical-chain buffers were deliberately not implemented: they need durations, and raw effort estimates are not durations. Balancing workstreams by summed effort across people was also left out: that is assignment, a different step from partition, and doing it inside the partition step is how a MECE split stops being one.

## Related tasks and reference

- [Audit a project](../how-to/audit-a-project.md), [snapshot JSON](../reference/snapshot.md)

## Coverage evidence

Every analysis validates wave ordering, complete schedulable coverage, disjoint group membership, shared prerequisites, and connected components. Exported planning evidence identifies the exact sorted task IDs, statuses, and recorded blocker lists used by that plan. It accounts for active included cards, terminal exclusions, labeled containers, shared prerequisites, grouped cards, unresolved exceptions, and cross-group edges. The three active categories cover each included card once. Containers remain explicitly annotated; card counts do not claim an executable-PR count. Missing dependency discovery can still change the graph and invalidate the plan.
