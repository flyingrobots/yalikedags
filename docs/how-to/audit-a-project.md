# Audit a project for missing dependencies and cards that want splitting

Use this before planning. The audit reports what the graph cannot know from Linear alone: cards with no dependencies at all, edges that are implied or stale, and cards whose shape suggests they are two things.

## Prerequisites

- A source: `--project` with the key stored, or a `--snapshot` from an earlier sync.

## Procedure

Run:

```bash
bun src/cli.ts audit --snapshot output/example-project.json
```

Expected output (abridged, representative):

```text
snapshot output/example-project.json, as of 2026-09-23: 84 tasks (41 ready, 30 done, 13 in-progress)
...
findings (22):
  isolated  PRO-118  no blockers and no dependents  [would kill: the task is genuinely independent of everything else in the project]
  split-candidate  PRO-204  4 open tasks depend on it  [would kill: every dependent needs all of it, not a part]
  ...
```

Every finding carries the observation that would kill it. The audit proposes; you decide.

## What the kinds mean

| Kind | Means | Usual fix |
|---|---|---|
| `isolated` | open card with no blockers and no dependents | add the `blocks` or `blocked by` relation in Linear, or accept that it is independent |
| `redundant-edge` | `blocked by X` is already implied through another blocker | remove the direct relation, or keep it if it carries meaning |
| `stale-blocker` | an edge to a completed card remains | retain it as history or review whether it is still needed |
| `canceled-blocker` | a canceled card still supplies a required prerequisite | review the obligation; explicitly remove an obsolete edge or replace it with the task supplying the output |
| `dangling-blocker` | blocked by a card outside this project | intended cross-project dependency, or a mistake |
| `cycle` | a set of cards that block each other | break the cycle; the graph is invalid until you do (exit `6`) |
| `split-candidate` | a title joining two things, or four or more open dependents | split the card, or record why it is one thing |

## Verify

Fix a relation in Linear, sync again, audit again: the finding is gone.

## Common variations

- `--json` emits the findings as JSON for another tool.
- `--strict` exits `1` when there is any finding, for a CI gate.

## Related reference

- [`audit`](../reference/cli.md#audit), [derived views](../explanation/derived-views.md)
