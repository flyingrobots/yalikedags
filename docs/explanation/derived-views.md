# How the frontier, the workstreams and the critical path are derived

## The problem it solves

A project of a few hundred cards has more structure than anyone can hold in their head, and the structure changes every time a card closes. Storing "ready" or "blocked" on a card means it is wrong the moment a blocker finishes. So the tool stores almost nothing and computes everything at read time.

## Mental model

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

**State.** A task is `done` when its status is done or canceled (both stop blocking). Otherwise it is `in-progress` if Linear says so, `unresolved` if its status or a blocker status is unknown or a blocker is absent, `ready` if every stored blocker is known and done, else `blocked`. The audit also reports missing references as dangling.

**Frontier.** The ready tasks, sorted by days until due (undated last), then priority (1 first, unset last), then how many direct dependents become ready upon its completion, then the number of open descendants (more first), then creation time, then id. Priority is a tiebreaker inside the frontier and never overrides an edge.

**Resource conflicts.** Resources are attributes on tasks, never edges, because contention is symmetric and non-transitive. Ready tasks are flagged when their combined contention with in-progress holders exceeds an exclusive or capacity limit. `advisory` never blocks. The task-dag file source supplies resource policy; sources without a policy report no capacity conflicts.

**Waves.** Kahn layering over the open subgraph: wave 0 is every task with a known open status whose stored blockers are all known and done, wave 1 what those free, and so on. Each wave is an antichain, a set that could be worked in parallel. Waves are a forecast, not a barrier; the frontier rolls.

**Gatekeepers and workstreams.** A gatekeeper is an open task with two or more open dependents: a shared prerequisite. Cut the gatekeepers out of the open graph and the connected pieces that remain are the workstreams. Every open non-gatekeeper task is in exactly one workstream, so the decomposition is mutually exclusive and collectively exhaustive by construction.

**Grid.** Waves cut the open graph by time and workstreams cut it by topology, and both partition the same open tasks, so their product is a grid in which every open schedulable task has exactly one cell. One row per workstream, one column per wave, and a shared row first for the gatekeepers, which belong to a wave but to no workstream. This is what the viewer's Grid view draws.

**Critical path.** The longest chain of open tasks, computed twice: by depth (number of hand-offs) and by effort (summed estimate, unestimated tasks weighing 1 as Linear counts them). The two can disagree, and both are reported. There is no float, no forward or backward pass: those need durations, and this graph carries effort.

## Important invariants

- Done tasks never block and belong to no wave, workstream, or grid cell.
- Every schedulable open task is in exactly one wave. Every open non-gatekeeper task is in one workstream; unschedulable tasks have no grid cell.
- `dependents` is derived; storing both directions would be two sources of truth for one edge.
- The layout used by the SVG and the viewer is the same pure service, so what you see is what the report computed.

## Failure and degradation behaviour

Critical-path ties use stable task-id traversal for both terminal candidates and blockers. Reordering task arrays or blocker sets therefore does not create comparison changes.

A cycle makes the graph invalid: Kahn ordering stops early, the critical path treats the back edge as absent, and the audit reports the cycle members. `audit` exits 6 until it is broken.

## Tradeoffs and alternatives

Time-based CPM, PERT and critical-chain buffers were deliberately not implemented: they need durations, and raw effort estimates are not durations. Balancing workstreams by summed effort across people was also left out: that is assignment, a different step from partition, and doing it inside the partition step is how a MECE split stops being one.

## Related tasks and reference

- [Audit a project](../how-to/audit-a-project.md), [snapshot JSON](../reference/snapshot.md)
