# Snapshot JSON

Written by `sync` and `render --format json`; read by `--snapshot` and served at `/snapshot.json`. Schema id `yalikedags/snapshot/2`. Defined in `src/adapters/output/JsonSnapshotAdapter.ts`; decoded (stored tasks and provenance) in `src/adapters/input/JsonSnapshotRepositoryAdapter.ts`.

```json
{
  "schema": "yalikedags/snapshot/2",
  "source": "Linear project example-project",
  "asOf": "2026-09-23",
  "capturedAt": "2026-09-23T12:00:00.000Z",
  "warnings": [],
  "quality": { "unresolvedDependencies": 0, "unknownStatuses": 0, "cycles": 0 },
  "tasks": [ { "id": "...", "key": "PRO-1", "title": "...", "status": "open", "blockedBy": ["..."], "children": [], "labels": [], "resources": [], "state": "ready", "workstream": "PRO-1", "critical": false } ],
  "edges": [ { "from": "<blocker id>", "to": "<blocked id>" } ],
  "frontier": [ { "task": "...", "daysUntilDue": 9999, "immediatelyUnblocks": 1, "downstreamImpact": 3, "unlocks": 3, "conflicts": [] } ],
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
| `parent`, `assignee`, `assigneeId`, `milestone`, `due`, `url`, `createdAt`, `description` | string | no | absent when unknown |
| `priority` | 1 to 4 | no | Linear's scale; 0 (none) is absent |
| `effort` | finite nonnegative number | no | Exact source estimate, including fractions; no rounding or clamping |
| `state` | `done`, `in-progress`, `blocked`, `ready`, `unresolved` | derived | not read back |
| `workstream` | string or null | derived | not read back |
| `critical` | boolean | derived | on either critical path |

`grid` is waves by workstreams: `waves` is the number of columns, each row is one workstream (`workstream` is its id, or `null` for the shared gatekeepers row, which comes first when there are any), and `cells[i]` lists the row's tasks in wave `i`. Every open schedulable task appears in exactly one cell. Cycles, unknown statuses, and missing blockers can prevent tasks and their descendants from receiving a wave. The viewer draws its Waves view from this field.

Only the stored task fields and provenance are read back by `--snapshot`; derived fields are recomputed. `daysUntilDue` is `9999` for undated tasks.


## Linear account metadata

Fresh Linear reads optionally include `account`, an additive schema-2 field. It contains `user`, `workspace`, and `project`, each with an `id` and `name`. `user` is the API identity that captured the snapshot; it does not describe whoever opens the file later. This metadata survives `--snapshot` reads and subsequent exports. Legacy snapshots and other sources can omit it. No key or email address is stored. Optional `assigneeId` preserves stable tracker identity for owner filters and assignment comparisons. Issue `assignee` remains the optional display-name string; the viewer labels an absent value Unassigned.

```json
{
  "account": {
    "user": { "id": "user-example", "name": "Sam Example" },
    "workspace": { "id": "workspace-example", "name": "Example workspace" },
    "project": { "id": "project-example", "name": "Example project" }
  }
}
```

## Provenance and uncertainty

`capturedAt` records when the source read completed. Reading a snapshot preserves its original timestamp; missing or invalid legacy timestamps become `null`, displayed as unknown. `asOf` is the analysis date used for urgency calculations, not proof of fresh tracker data. A multi-page tracker read is not an atomic snapshot.

`quality.unresolvedDependencies` counts missing blocker references; `unknownStatuses` counts tasks whose status cannot be mapped; `cycles` counts detected cyclic components. Source warnings survive snapshot round trips. Missing external blockers are retained in `blockedBy` and cause an `unresolved` state, never automatic readiness. Known edges remain in `edges`; consult `blockedBy` for references outside the loaded graph.

`immediatelyUnblocks` counts open direct dependents that become ready if this task completes. `downstreamImpact` counts all open descendants, including tasks with other blockers. `unlocks` remains a deprecated alias for downstream impact for schema-1 consumers; it does not mean those tasks immediately become ready.

Effort-based paths sum raw estimates, using one for unestimated tasks. Estimates from different team scales are not normalized or comparable as durations. Old snapshots that clamped estimates cannot recover the originals; take a fresh source reading.

Schema 2 preserves unknown statuses and finite nonnegative estimates, including fractions and values above 3. Readers accept legacy schema 1 snapshots; writers always emit schema 2. Older schema 1 readers must be upgraded before reading schema 2 exports.

## Structure-only exports

Choose **Structure only** in Import/Export, or pass `--redact` to `sync` or `render`. The schema stays `/2`, but this is a lossy copy, unsuitable for restoring original issue content or matching a live tracker.

- Retained: task order, statuses, blocker edges, parent/child relationships, and unresolved references. Graph shape and counts can still identify a project.
- Replaced: known IDs and keys become `task-1`, `task-2`, etc.; titles become `Task 1`, `Task 2`, etc. External references receive consistent `external-1`, `external-2`, etc. Mapping is deterministic for the same ordered input, with no original-ID mapping included.
- Removed: descriptions, URLs, assignments, account metadata, labels, resources, milestones, estimates, priorities, dates, original source, and source warnings.
- Recomputed: all derived views and findings. Effort defaults to one, due dates are absent, `asOf` is the placeholder `1970-01-01`, `capturedAt` is `null`, and a fixed warning describes the reduction. Resource conflicts and urgency cannot preserve their original meaning.

Full export remains the default and preserves all snapshot fields. Neither choice modifies the loaded project. The regression tests in `test/Redaction.test.ts` verify content removal and relation preservation through CLI JSON/HTML exports; `e2e/export-privacy.pw.ts` verifies both browser choices and unchanged task content in served and offline viewers.
