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

The page opens on **Start here**, with ready work, unblocking impact, and the critical path. Select a task to open its details. Choose **Dependencies**, **Waves**, or **Tasks** from the navigation rail to explore the same project. Search in Dependencies finds and centers a task in the graph. Close details or press Escape to reclaim the working area. The browser loads `/viewer.json` from the local server and renders the workspace; it makes no external asset requests. **Import/Export → Refresh source** explicitly rereads the source; the key stays on the server.

## Common variations

- `/viewer.json` provides server-analyzed data for the client-rendered interface.
- `/snapshot.json`, `/graph.svg`, `/graph.dot` on the same host return the raw artifacts.
- **Tasks** adds sorting, search, and state/assignee/milestone/label filters while keeping the wave grid.
- **Refresh source** preserves the active view, selection, filters, and sorting. It shows the exact capture time and retains the previous snapshot on failure.
- Linear sources show the workspace, project, capture identity, and issue assignees. Snapshot files preserve captured metadata; old files may not contain it.
- **Import/Export** holds source details, refresh, JSON export, and local comparison with an earlier snapshot.
- **Keep it, or send it to somebody**: `render --format html --out dag.html` writes the same page as one file. It opens by double-clicking, needs no process and no key, and fetches nothing. Use it for a graph somebody else should look at, or for a copy of today you can put beside a copy of last week.

  ```bash
  bun src/cli.ts render --project "My Project" --format html --out dag.html
  ```

  An export embeds the source capture time. It stays fixed until regenerated. Serving `--snapshot` rereads that snapshot file on refresh and preserves its capture time.

## Related reference

- [Viewer](../reference/viewer.md), [`serve`](../reference/cli.md#serve)
