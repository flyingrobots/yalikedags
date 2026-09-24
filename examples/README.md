# Examples

Two task lists, both used by the tutorial and both pinned by `test/Examples.test.ts`, which asserts what each one produces. An example that stops working fails the suite rather than quietly becoming a lie.

| File | What it is |
|---|---|
| `example-tasklist.txt` | Twelve tasks with explicit dependencies. Produces a twelve-edge graph with one gatekeeper and a six-task critical path. This is the file the [tutorial](../docs/tutorials/first-dag.md) walks through. |
| `test-parent-child.txt` | Ten tasks nested by indentation. Produces parent and child relationships and **no edges**, which is correct: a sub-issue is not a blocker. It is here to show that distinction. |

## Use them

```bash
bun src/cli.ts render --tasklist examples/example-tasklist.txt
bun src/cli.ts audit --tasklist examples/example-tasklist.txt
bun src/cli.ts serve --tasklist examples/example-tasklist.txt
```

## The format

```text
- [ ] Open task
- [x] Done task
- [/] In progress, or [ ] with a [WIP] suffix
- [ ] Task with dependencies (depends on: Open task, Done task)
  - [ ] Child task, by two-space indentation
```

`depends on:`, `blocked by:` and `requires:` are all accepted. A name that matches no task is kept as a dangling reference rather than dropped, and the audit reports it.

## What is not here

Five files were removed in the TypeScript rewrite: two CSVs and three lists that encoded their dependencies in prose ("after the login API is done") for the prototype's inference engine. There is no CSV adapter and no inference engine, so those files loaded zero tasks or zero edges and advertised features that do not exist. They are in the first commit if you want them.
