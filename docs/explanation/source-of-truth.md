# What Linear owns and what this tool derives

## The problem it solves

If dependencies live in a file, teammates need the file, and the file needs merging. If they live in Linear, everyone already has them, and this tool has nothing to reconcile except its own reading.

## The split

| Owner | Holds |
|---|---|
| **Linear** | issues, state, assignee, priority, estimate, labels, milestone, and the edges as `blocks` / `blocked by` relations |
| **derived here** | state (ready, blocked), frontier, waves, gatekeepers, workstreams, critical path, findings |
| **the desired graph, a file** | which edges you mean there to be, and resource attributes. It proposes; it never wins by default. |
| **a dependency-review record** | a self-reported human review of a captured scope, with evidence basis, edge dispositions, exceptions, and source identity. Stored locally or carried in an export; never authoritative tracker state. |

Reading is therefore never a merge: a sync is a read, and a stale view is fixed by reading again.

The write path does not change that ownership; it is how a file-held graph gets its edges **into** Linear so that Linear can own them. `plan` computes the difference and `apply` performs it, and from that moment the edges are Linear's, visible to everyone, and read back like any other. See [Reconcile a graph into Linear](../how-to/reconcile-into-linear.md).

## Consequences

- To add a dependency, add the relation in Linear (M then B on the blocked card). The next sync shows it.
- The main viewer analyzes captured prerequisite relations. A separate proposed/accepted preview can analyze locally reviewed candidates without changing the source. If Linear removes or reclassifies a relation, the next capture no longer proves that obligation existed; dependency review must resolve that uncertainty. A remaining edge to completed work is a `stale-blocker` finding. A remaining edge to canceled work is an unresolved `canceled-blocker`, not evidence that the required output exists.
- Effort preserves Linear's estimate field exactly, including values above three and fractions. The team controls its scale. Effort-based paths sum these values without converting them to durations or normalizing different team scales.
- Workstreams are computed, not assigned. A milestone can be pushed from a desired graph's own `milestone` field, or from a task-dag node's `group` with `--groups-as-milestones`, but the tool never invents a milestone name from a computed workstream id, and it never creates a milestone that does not already exist.
- Status, assignee, priority and title have no method on the writer port at all, so no plan can contain them. Ownership is enforced by the shape of the interface rather than by remembering.

## What was considered and deferred

A shared overlay store (a git-warp graph in a dedicated bare repository) was designed for edge history, resources, and an offline outbox, and set aside once it was clear Linear can carry the edges. It remains the answer if a need appears that Linear cannot express.

An offline outbox was considered for the write path and left out: every queued write has exactly one destination, so a failed `apply` needs no log to recover from. Legacy mutation plans can be rerun because every mutation reads before it writes. Evidence-guarded proposal plans instead require a fresh capture and review after any source change, including partial application.
