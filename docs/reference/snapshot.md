# Snapshot JSON

Written by `sync` and `render --format json`; read by `--snapshot` and served at `/snapshot.json`. Schema id `yalikedags/snapshot/1`. Defined in `src/adapters/output/JsonSnapshotAdapter.ts`; decoded (tasks only) in `src/adapters/input/JsonSnapshotRepositoryAdapter.ts`.

```json
{
  "schema": "yalikedags/snapshot/1",
  "source": "Linear project example-project",
  "asOf": "2026-09-23",
  "tasks": [ { "id": "...", "key": "PRO-1", "title": "...", "status": "open", "blockedBy": ["..."], "children": [], "labels": [], "resources": [], "state": "ready", "workstream": "PRO-1", "critical": false } ],
  "edges": [ { "from": "<blocker id>", "to": "<blocked id>" } ],
  "frontier": [ { "task": "...", "daysUntilDue": 9999, "unlocks": 3, "conflicts": [] } ],
  "waves": [ ["..."], ["..."] ],
  "gatekeepers": ["..."],
  "workstreams": [ { "id": "...", "tasks": ["..."] } ],
  "grid": { "waves": 2, "rows": [ { "workstream": null, "cells": [ ["..."], [] ] }, { "workstream": "...", "cells": [ [], ["..."] ] } ] },
  "criticalPath": { "byDepth": { "tasks": ["..."], "length": 3 }, "byEffort": { "tasks": ["..."], "length": 5 } },
  "findings": [ { "kind": "isolated", "task": "...", "detail": "...", "wouldKill": "..." } ]
}
```

## Task fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | Linear issue id, or a slug for file sources |
| `key` | string | yes | human key, `PRO-123`; equals `id` for file sources |
| `title` | string | yes | |
| `status` | `open`, `in-progress`, `done`, `canceled`, `unknown` | yes | stored fact |
| `blockedBy` | string[] | yes | stored fact; the only edge |
| `children`, `labels`, `resources` | string[] | yes | may be empty |
| `parent`, `assignee`, `milestone`, `due`, `url`, `createdAt`, `description` | string | no | absent when unknown |
| `priority` | 1 to 4 | no | Linear's scale; 0 (none) is absent |
| `effort` | finite nonnegative number | no | Exact source estimate, including fractions; no rounding or clamping |
| `state` | `done`, `in-progress`, `blocked`, `ready`, `unresolved` | derived | not read back |
| `workstream` | string or null | derived | not read back |
| `critical` | boolean | derived | on either critical path |

`grid` is waves by workstreams: `waves` is the number of columns, each row is one workstream (`workstream` is its id, or `null` for the shared gatekeepers row, which comes first when there are any), and `cells[i]` lists the row's tasks in wave `i`. Every open schedulable task appears in exactly one cell. Cycles, unknown statuses, and missing blockers can prevent tasks and their descendants from receiving a wave. The viewer draws its Grid view from this field.

Only the stored fields are read back by `--snapshot`; derived fields are recomputed. `daysUntilDue` is `9999` for undated tasks.
