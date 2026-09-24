# See your first DAG

You will load the bundled example task list, read the frontier and the critical path from the terminal, open the viewer, and change one dependency to watch the graph react. You need no Linear key for this; the example is a file.

## Before you begin

- bun 1.2 or newer is installed (`bun --version`).
- You have cloned this repository and run `bun install` once.
- You are in the repository root.

## 1. Load the example and read the report

Run:

```bash
bun src/cli.ts render --tasklist examples/example-tasklist.txt
```

Expected output (exact, except the date):

```text
loaded 12 tasks from task list examples/example-tasklist.txt
task list examples/example-tasklist.txt, as of 2026-09-23: 12 tasks (2 done, 2 ready, 7 blocked, 1 in-progress)

frontier (2 ready tasks, most urgent first):
  implement-core-dag-builder  Implement core DAG builder  unlocks:7
  write-documentation  Write documentation  unlocks:2

waves: [implement-core-dag-builder, write-documentation] -> [add-github-issue-parser, add-task-list-parser, create-example-files, implement-state-determination-logic] -> [create-graphviz-dot-generator] -> [add-cli-interface] -> [add-unit-tests] -> [deploy-to-production]
gatekeepers: implement-core-dag-builder
workstreams (1):
  add-cli-interface: add-cli-interface, add-github-issue-parser, add-task-list-parser, add-unit-tests, create-example-files, create-graphviz-dot-generator, deploy-to-production, implement-state-determination-logic, write-documentation

critical path by depth: 6 tasks: implement-core-dag-builder then implement-state-determination-logic then create-graphviz-dot-generator then add-cli-interface then add-unit-tests then deploy-to-production
critical path by effort: 6: implement-core-dag-builder then implement-state-determination-logic then create-graphviz-dot-generator then add-cli-interface then add-unit-tests then deploy-to-production

findings (1):
  stale-blocker  implement-core-dag-builder  blocked by create-basic-project-structure, which is done  [would kill: the relation is kept deliberately as history]
```

Read it top to bottom. The **frontier** is what you could start right now; `unlocks:7` means starting the DAG builder frees seven other tasks, so it sorts first. **Waves** are the layers of parallel work if everything went to plan. There is one **gatekeeper**: the task with two or more open dependents, which is why there is only one workstream once it is cut out. The **critical path** is the longest chain of open work; here depth and effort agree because nothing carries an estimate. The one **finding** is a dependency on a task that is already done, which is harmless but worth knowing.

## 2. Open the viewer

Run:

```bash
bun src/cli.ts serve --tasklist examples/example-tasklist.txt
```

Expected output:

```text
loaded 12 tasks from task list examples/example-tasklist.txt
viewer at http://127.0.0.1:<port>/  (127.0.0.1 only; Ctrl-C to stop)
```

Open that address in a browser. You will see the graph laid out left to right, blockers before dependents, with the legend in the sidebar. Click `implement-core-dag-builder`: everything not upstream or downstream of it dims, and the sidebar shows its fields. Drag to pan, wheel to zoom, press <kbd>Esc</kbd> to clear. Press Ctrl-C in the terminal when you are done.

## 3. Try one variation

Copy the example and give the documentation task a dependency:

```bash
cp examples/example-tasklist.txt /tmp/example-variant.txt
sed -i '' 's/^- \[ \] Write documentation$/- [ ] Write documentation (depends on: Add CLI interface)/' /tmp/example-variant.txt
bun src/cli.ts render --tasklist /tmp/example-variant.txt
```

Expected: the frontier drops to one ready task, the critical path grows from six to seven because the deploy now waits on documentation through the examples, and there are four workstreams instead of one, because `add-cli-interface` has become a second gatekeeper.

```text
frontier (1 ready task, most urgent first):
  implement-core-dag-builder  Implement core DAG builder  unlocks:9
...
critical path by depth: 7 tasks: implement-core-dag-builder then implement-state-determination-logic then create-graphviz-dot-generator then add-cli-interface then write-documentation then create-example-files then deploy-to-production
```

## What you learned

The graph stores two facts per task, its status and what blocks it. Everything else you read, ready, blocked, frontier, waves, gatekeepers, workstreams, critical path, is computed from those two facts every time. Change an edge and every view moves with it.

## Next steps

- [Store your Linear key](../how-to/store-the-linear-key.md), then [sync a real project](../how-to/sync-a-project.md).
- [Audit it](../how-to/audit-a-project.md) for the cards that are not in the graph at all.
- [How the derived views are computed](../explanation/derived-views.md).
