# yalikedags documentation

yalikedags turns a Linear project into a dependency DAG, reports the ready frontier, the workstreams and the critical path, audits the cards, and draws the graph in a local viewer. Reading and viewing never change the tracker; only an explicitly confirmed reconcile plan writes to Linear.

## Start here
- [See your first DAG](tutorials/first-dag.md)

## Common tasks
- [Store your Linear key in the keychain](how-to/store-the-linear-key.md)
- [Sync a Linear project to a snapshot](how-to/sync-a-project.md)
- [Audit a project](how-to/audit-a-project.md)
- [Open the local viewer](how-to/open-the-viewer.md)
- [Reconcile a graph into Linear](how-to/reconcile-into-linear.md) (the write path)

## Look up
- [CLI commands](reference/cli.md)
- [Exit codes](reference/exit-codes.md)
- [Snapshot JSON](reference/snapshot.md)
- [Plan and receipt JSON](reference/plan.md)
- [Viewer](reference/viewer.md)

## Understand
- [One issue, one independently mergeable PR](explanation/atomic-work.md)
- [Derived views: frontier, waves, workstreams, critical path, audit](explanation/derived-views.md)
- [Source of truth: what Linear owns](explanation/source-of-truth.md)

## Troubleshoot
- [Troubleshooting](troubleshooting/index.md)

## Contribute
- [Architecture and safe change guide](contributing/architecture.md)
- [Live testing against a real Linear workspace](contributing/live-testing.md)
- [Standards](standards/): [documentation](standards/documentation.md), [TypeScript](standards/typescript.md), [testing](standards/testing.md)
