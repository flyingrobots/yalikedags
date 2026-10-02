# Sync a Linear project to a snapshot

Use this to pull a project's issues and blocking relations into one JSON file you can commit, diff, render, or open in the viewer without hitting Linear again.

## Prerequisites

- The key is stored ([Store your Linear key](store-the-linear-key.md)).
- You know the project's exact name as it appears in Linear, or its UUID.

## Procedure

Run:

```bash
bun src/cli.ts sync --project "example-project" --out output/example-project.json
```

Expected output (representative):

```text
loaded 84 tasks from Linear project example-project
wrote output/example-project.json
```

Estimates are preserved exactly, including fractions and values above 3, without coercion warnings. Any `warning:` lines name source uncertainty, such as an unknown status whose readiness remains unresolved.

## Verify

```bash
bun src/cli.ts render --snapshot output/example-project.json | head -3
```

The first line names the snapshot and the task count you just saw.

## Common variations

- **Pipe instead of a file**: omit `--out` and the snapshot goes to stdout.
- **A project by UUID**: pass the UUID to `--project`; no name lookup is made.
- **Several teams share the project**: sync reads the project regardless of team.

## Troubleshooting

- Exit `3`, `linear_unauthorized`: the key was rejected. Re-store it.
- Exit `4`, `linear_project_not_found`: zero or several projects matched the name. Use the UUID.
- `linear_http_error: HTTP 400 ... Query too complex`: should not happen at the default page size of 25; report it with the message.

## Related reference

- [`sync`](../reference/cli.md#sync), [snapshot JSON](../reference/snapshot.md), [exit codes](../reference/exit-codes.md)
