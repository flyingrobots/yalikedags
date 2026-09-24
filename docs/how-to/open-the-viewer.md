# Open the local viewer

Use this to look at the graph, follow chains upstream and downstream, and read a card without leaving the page.

## Prerequisites

- A source: `--project` with the key stored, a `--snapshot`, or a `--tasklist`.
- A browser on the same machine. The server binds `127.0.0.1` only.

## Procedure

Run:

```bash
bun src/cli.ts serve --snapshot output/example-project.json
```

Expected output:

```text
loaded 84 tasks from snapshot output/example-project.json
viewer at http://127.0.0.1:<port>/  (127.0.0.1 only; Ctrl-C to stop)
```

Open the address. To pick the port yourself, add `--port 8787`.

## Verify

The page shows the graph left to right and the sidebar lists the frontier. Click a node: everything not upstream or downstream dims. The page makes no network request of its own; the key never reaches it.

## Common variations

- `/snapshot.json`, `/graph.svg`, `/graph.dot` on the same host return the raw artifacts.
- The page reflects the source as loaded at start. Restart `serve` to pick up changes; there is no live refresh in phase 1.
- **Keep it, or send it to somebody**: `render --format html --out dag.html` writes the same page as one file. It opens by double-clicking, needs no process and no key, and fetches nothing. Use it for a graph somebody else should look at, or for a copy of today you can put beside a copy of last week.

  ```bash
  bun src/cli.ts render --project "My Project" --format html --out dag.html
  ```

  A file is a reading, taken when you rendered it. `serve` re-reads nothing either, so the difference is not freshness; it is that one of them survives the process ending.

## Related reference

- [Viewer](../reference/viewer.md), [`serve`](../reference/cli.md#serve)
