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

The page opens with a DAG and Ready work. Search for a task or click a node: Task details opens and unrelated work dims. Open the header’s **Workspace settings** cog and choose **Wave grid** to inspect the same selection in a table, or drag its tab beside the DAG to see both at once. Drag tabs and dividers to arrange the workspace; the cog menu’s **Reset layout** restores the default. The page loads without further network requests. **Refresh source** explicitly rereads the source through the local server; the key stays on the server.

## Common variations

- `/snapshot.json`, `/graph.svg`, `/graph.dot` on the same host return the raw artifacts.
- **Task table** adds sorting, search, and state/assignee/milestone/label filters while keeping the wave grid.
- **Refresh source** preserves layout, selection, filters, and sorting. It shows the exact capture time and retains the previous snapshot on failure.
- **Changes** shows changes since the last successful refresh or compares a chosen snapshot JSON locally.
- **Keep it, or send it to somebody**: `render --format html --out dag.html` writes the same page as one file. It opens by double-clicking, needs no process and no key, and fetches nothing. Use it for a graph somebody else should look at, or for a copy of today you can put beside a copy of last week.

  ```bash
  bun src/cli.ts render --project "My Project" --format html --out dag.html
  ```

  An export embeds the source capture time. It stays fixed until regenerated. Serving `--snapshot` rereads that snapshot file on refresh and preserves its capture time.

## Related reference

- [Viewer](../reference/viewer.md), [`serve`](../reference/cli.md#serve)
