# Agent instructions

## Planning unit: one issue, one independently mergeable PR

An executable Linear issue represents one atomic unit of work: one coherent PR with a testable outcome that leaves the target branch in a working state when merged after its prerequisites. Read [the atomic work contract](docs/explanation/atomic-work.md) when proposing issues, dependencies, splits, workstreams, or implementation plans.

- Discover prerequisite relationships by asking: **Which other PRs must already be merged for this PR to be correct?** Theme similarity, shared files, parent/child hierarchy, and resource contention are not sufficient evidence for an edge.
- Split work at independently verifiable merge boundaries. Do not split merely because a title contains a conjunction, several files/layers change, or many tasks depend on it.
- Each proposed issue needs an outcome, scope and exclusions, acceptance checks, prerequisites with reasons, and a safe intermediate state. A later PR must not be required to restore correctness.
- A tracking parent may group several executable issues, but must be labeled as a container rather than counted as an additional executable PR. Account explicitly for shared prerequisites and unresolved work.
- Preserve traceability from issue to PR to the resulting mainline commit. The intended history supports first-parent bisection to an introducing PR; do not promise that green CI proves absence of regressions.
- Dependency discovery produces an evidence-backed proposed graph before antichain/workstream analysis. Distinguish recorded, proposed, and accepted edges. No recorded blocker does not prove real-world independence.
- Current implementation analyzes supplied edges; automatic discovery, split proposals, and split application are planned capabilities. Do not describe them as implemented.

## Repository guidance

Follow [CONTRIBUTING.md](CONTRIBUTING.md), the [architecture guide](docs/contributing/architecture.md), and the binding [TypeScript](docs/standards/typescript.md), [testing](docs/standards/testing.md), and [documentation](docs/standards/documentation.md) standards. Keep real project data and credentials out of commits, fixtures, screenshots, and public issues.
