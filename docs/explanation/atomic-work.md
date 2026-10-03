# One issue, one independently mergeable PR

## The unit of work

An executable Linear issue represents one coherent PR: a reviewable change with a meaningful acceptance test and a safe merge boundary. After its prerequisite PRs have landed, merging it leaves the target branch in a working state. It must not depend on a future PR to repair a deliberately broken intermediate state.

Atomic means one verifiable outcome, not one file, one layer, or one commit inside the PR. An API change and its consumers may belong together. Conversely, one feature may require several independently mergeable PRs.

This is the planning contract for yalikedags. The current tool analyzes supplied dependency edges and flags possible splits; it does not yet discover dependencies or generate and apply split proposals.

## A working state at every merge

Each PR must build and pass the checks relevant to its outcome and affected existing behavior. It must preserve the compatibility and operational invariants declared by the project. Its acceptance criteria must explain how to verify the result, including relevant migration or deployment conditions.

A working state does not require a complete user-facing feature. A behavior-preserving refactor, an additive schema change compatible with existing readers, or a feature behind a disabled flag can each be a valid unit. The flag must actually isolate unfinished behavior; it is not a substitute for correctness.

A useful issue describes:

- The observable outcome and why it is needed.
- Scope and explicit exclusions.
- Acceptance checks and the evidence that will establish success.
- Prerequisite issues, with the output required from each.
- The safe intermediate state after this PR merges.

Tracking parents can summarize a feature containing multiple such issues. Mark these as containers, not additional executable work, so they do not duplicate effort or coverage in the plan. Parent/child membership alone does not imply merge order.

## Dependencies are prerequisites for correctness

For each candidate edge, ask: **Which other PR must already be merged for this PR to be correct?** An edge from A to B means B requires the result of A.

Shared vocabulary, touching the same file, or belonging to the same feature is not enough. Resource contention can constrain execution without being a prerequisite edge. Keep uncertain inferred relationships separate from recorded or accepted ones, and retain their evidence.

For example, adding an optional data field while preserving old readers can be one PR. A second PR can expose that field in the UI and depend on the first. Removing the old representation may require a later compatibility step. Splitting an incompatible producer change from the consumer fix would fail the safe-merge criterion.

## How to split an issue

The question is not whether the ticket mentions multiple things. It is whether it can become one reviewable PR with a testable outcome and a safe intermediate state.

A split proposal must account for the original requirements, make child scope boundaries explicit, and identify prerequisites between the children and existing work. It must explain what remains in the parent. Do not duplicate a shared deliverable across children or invent unrelated work to make the partition look complete.

A broad change may legitimately remain one PR when its pieces must land together. High fan-out may describe one indivisible prerequisite. In those cases, recommend no split and explain why.

## Antichains and MECE workstreams

Discover and review the prerequisite graph before treating its derived plan as evidence of independence. No recorded dependency is not proof that none exists.

Antichain waves contain tasks with no prerequisite reachability between them in the chosen graph. They describe dependency-compatible parallelism, not guaranteed freedom from merge conflicts, resource contention, or staffing constraints. Kahn layers are an antichain layering, not a maximum-antichain optimization.

Workstreams should partition the executable planning scope without duplicate ownership or missing work: mutually exclusive, collectively exhaustive (MECE). Declare shared prerequisites and unresolved exceptions explicitly. Preserve dependencies across workstreams; a partition does not mean every workstream can start immediately.

The current implementation uses connected components after removing shared gatekeepers. That provides a validated topological partition of schedulable tasks, with shared prerequisites and unschedulable exceptions separately accounted for, but does not by itself establish cohesive PR-sized deliverables. See [derived views](derived-views.md) for the implemented algorithm.

## Why the mainline should be bisectable

Keep a durable link from each executable issue to its PR and resulting mainline integration commit. With merge commits, the intended first-parent history is a sequence of working integration states. Squash-based workflows should retain the same issue/PR linkage on their resulting commits.

Given a known-good revision, a known-bad revision, and a reproducible regression check, first-parent bisection can identify the PR that introduced the regression. It identifies an integration boundary, not necessarily the faulty commit within the PR. Green CI only establishes what its checks cover; historical environments, migrations, and external services can also limit reproducibility.

## Implementation and planned extensions

- [Dependency discovery](https://github.com/flyingrobots/yalikedags/issues/20) supplies local issue-reference candidates, reviewed graph previews, and explicit relation-plan export. General semantic discovery remains outside this implementation.
- [Antichain and MECE contracts](https://github.com/flyingrobots/yalikedags/issues/21) validate coverage and qualify temporary grouping for the resulting plan.
- [Split proposals](https://github.com/flyingrobots/yalikedags/issues/24) apply this merge-boundary criterion to decomposition.
- [Reviewed split application](https://github.com/flyingrobots/yalikedags/issues/25) turns approved plans into tracker tasks; generating a proposal alone never writes to Linear.

See also [source ownership](source-of-truth.md) and [the contributor guide](../contributing/architecture.md).
