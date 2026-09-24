# What Linear owns and what this tool derives

## The problem it solves

If dependencies live in a file, teammates need the file, and the file needs merging. If they live in Linear, everyone already has them, and this tool has nothing to reconcile except its own reading.

## The split

| Owner | Holds |
|---|---|
| **Linear** | issues, state, assignee, priority, estimate, labels, milestone, and the edges as `blocks` / `blocked by` relations |
| **derived here** | state (ready, blocked), frontier, waves, gatekeepers, workstreams, critical path, findings |
| **the desired graph, a file** | which edges you mean there to be, and resource attributes. It proposes; it never wins by default. |

Reading is therefore never a merge: a sync is a read, and a stale view is fixed by reading again.

The write path does not change that ownership; it is how a file-held graph gets its edges **into** Linear so that Linear can own them. `plan` computes the difference and `apply` performs it, and from that moment the edges are Linear's, visible to everyone, and read back like any other. See [Reconcile a graph into Linear](../how-to/reconcile-into-linear.md).

## Consequences

- To add a dependency, add the relation in Linear (M then B on the blocked card). The next sync shows it.
- Linear moves a `blocks` relation to Related once the blocker is resolved. For scheduling that is correct; for history it is lossy, and the audit's `stale-blocker` finding is where you see the moment it happens.
- Effort uses Linear's estimate field. Enable estimates on the team with the Linear scale and zero estimates allowed, and use 0 to 3; higher values are clamped and reported.
- Workstreams are computed, not assigned. A milestone can be pushed from a desired graph's own `milestone` field, or from a task-dag node's `group` with `--groups-as-milestones`, but the tool never invents a milestone name from a computed workstream id, and it never creates a milestone that does not already exist.
- Status, assignee, priority and title have no method on the writer port at all, so no plan can contain them. Ownership is enforced by the shape of the interface rather than by remembering.

## What was considered and deferred

A shared overlay store (a git-warp graph in a dedicated bare repository) was designed for edge history, resources, and an offline outbox, and set aside once it was clear Linear can carry the edges. It remains the answer if a need appears that Linear cannot express.

An offline outbox was considered for the write path and left out: every queued write has exactly one destination, so a failed `apply` needs no log to recover from. Re-running the plan is the recovery, which is why every mutation reads before it writes.
