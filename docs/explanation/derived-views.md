# How the frontier, the workstreams and the critical path are derived

## The problem it solves

A project of a few hundred cards has more structure than anyone can hold in their head, and the structure changes every time a card closes. Storing "ready" or "blocked" on a card means it is wrong the moment a blocker finishes. So the tool stores almost nothing and computes everything at read time.

## Mental model

Two stored facts per task: its **status** and its **blockedBy** list. Every other word in the report is a fold over those two facts across the graph.

```text
STORED:  status, blockedBy
FOLDS:   done ─┐
               ├─ state (done | in-progress | blocked | ready)
               ├─ dependents (the inverse of blockedBy)
               ├─ frontier (ready, ordered)
               ├─ waves (Kahn layers over open tasks)
               ├─ gatekeepers and workstreams
               └─ critical path (depth, effort)
```

## Main mechanism

**State.** A task is `done` when its status is done or canceled (both stop blocking). Otherwise it is `in-progress` if Linear says so, `ready` if every blocker present in the graph is done, else `blocked`. A blocker that is not in the graph does not block; the audit reports it as dangling instead.

**Frontier.** The ready tasks, sorted by days until due (undated last), then priority (1 first, unset last), then how many open tasks the task transitively unblocks (more first), then creation time, then id. Priority is a tiebreaker inside the frontier and never overrides an edge.

**Resource conflicts.** Resources are attributes on tasks, never edges, because contention is symmetric and non-transitive. Ready tasks sharing an `exclusive` resource, or more of them than a `capacity` allows, are flagged. `advisory` never blocks. Phase 1 has no resource source; the policy is empty until one exists.

**Waves.** Kahn layering over the open subgraph: wave 0 is every open task whose open blockers are none, wave 1 what those free, and so on. Each wave is an antichain, a set that could be worked in parallel. Waves are a forecast, not a barrier; the frontier rolls.

**Gatekeepers and workstreams.** A gatekeeper is an open task with two or more open dependents: a shared prerequisite. Cut the gatekeepers out of the open graph and the connected pieces that remain are the workstreams. Every open non-gatekeeper task is in exactly one workstream, so the decomposition is mutually exclusive and collectively exhaustive by construction.

**Critical path.** The longest chain of open tasks, computed twice: by depth (number of hand-offs) and by effort (summed estimate, unestimated tasks weighing 1 as Linear counts them). The two can disagree, and both are reported. There is no float, no forward or backward pass: those need durations, and this graph carries effort.

## Important invariants

- Done tasks never block and belong to no wave or workstream.
- `dependents` is derived; storing both directions would be two sources of truth for one edge.
- The layout used by the SVG and the viewer is the same pure service, so what you see is what the report computed.

## Failure and degradation behaviour

A cycle makes the graph invalid: Kahn ordering stops early, the critical path treats the back edge as absent, and the audit reports the cycle members. `audit` exits 6 until it is broken.

## Tradeoffs and alternatives

Time-based CPM, PERT and critical-chain buffers were deliberately not implemented: they need durations, and estimates on a 0 to 3 scale are not durations. Balancing workstreams by summed effort across people was also left out: that is assignment, a different step from partition, and doing it inside the partition step is how a MECE split stops being one.

## Related tasks and reference

- [Audit a project](../how-to/audit-a-project.md), [snapshot JSON](../reference/snapshot.md)
