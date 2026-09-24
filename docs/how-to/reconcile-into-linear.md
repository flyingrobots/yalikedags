# Reconcile a graph into Linear

Use this when the dependencies you plan against live in a file and the tracker does not know about them yet. The procedure is two commands: one that writes a plan you read, and one that performs it.

Warning: `apply --confirm` changes issues in your Linear workspace, as you. Every other command on this page, `plan` included, writes nothing anywhere but your own disk. Read the plan before you confirm it.

## Prerequisites

- The key is stored ([Store your Linear key](store-the-linear-key.md)).
- A desired graph in a file: `dag:<file>` (the task-dag schema), `tasklist:<file>`, or `snapshot:<file>`.
- The desired graph's ids or keys must be the tracker's own identifiers. Matching is by id or key and never by title, so a desired task called `PRO-204` finds the issue `PRO-204`, and a desired task called `build-the-thing` finds nothing.

## Procedure

### 1. Write the plan

```bash
yalikedags plan --desired dag:plan.json --current "linear:example-project" --out plan.json
```

Expected output on stderr, representative:

```text
plan from dag:plan.json
       to linear:example-project
  made on 2026-09-23

12 changes (11 add-blocking-relation, 1 set-estimate)

changes:
  PRO-2 is blocked by PRO-1
  PRO-3 is blocked by PRO-2
  ...
  PRO-9 estimate (none) becomes 2

unmatched (2 tasks in the desired graph with no counterpart; nothing is written for these):
  local-only-note: no task at the source has this id or key
  PRO-1: would match PRO-1, which pro-1 already matched

wrote plan.json
```

### 2. Read it

Three things are worth checking before you go on.

- **The count.** If it is much larger than you expected, the desired graph and the project are probably not the same body of work.
- **The `DESTRUCTIVE` block, if there is one.** It appears only when you passed `--prune` or when a mutation replaces a value that is already set. `apply` refuses everything in that block unless you also pass `--allow-destructive`.
- **The unmatched list.** Nothing is written for those, so they are the part of your plan that will silently not happen.

### 3. Dry run

```bash
yalikedags apply --plan plan.json
```

This takes the same path the real run takes, including the ordering and the destructive gate, with a writer that records instead of writing. It ends with:

```text
DRY RUN: nothing was written. Re-run with --confirm to perform 12 change(s).
```

### 4. Apply

```bash
yalikedags apply --plan plan.json --confirm --receipt receipt.json
```

Expected output, representative:

```text
applied to Linear project example-project at 2026-09-23
confirmed 12, unconfirmed 0, failed 0, skipped 0, stale 0

  confirmed   PRO-2 is blocked by PRO-1
  ...
wrote receipt.json
```

## Verify

The receipt is the verification: after writing, the project is read again and every mutation is asked whether it can see itself. `confirmed` means a fresh read shows it. Anything else does not.

| Outcome | Means |
|---|---|
| `confirmed` | the write landed and a fresh read shows it |
| `unconfirmed` | the write returned cleanly but the re-read does not show it |
| `failed` | the write itself was refused; the message says why |
| `skipped` | destructive, and this run was not allowed to perform it |
| `stale` | the tracker moved after the plan was made, so this mutation no longer describes what it would do. Nothing was written for it. |

The command exits `0` only when every mutation is `confirmed` or `skipped`, and `8` otherwise.

A `stale` result is answered by planning again, not by re-running or by adding a flag. It means somebody changed that card between your plan and your apply, and the plan's account of what it was about to overwrite is out of date. `--allow-destructive` does not cover it: that flag says you accept losing a value you saw, and the point of `stale` is that the value is no longer the one you saw.

## Common variations

- **Remove edges the tracker has and your graph does not**: add `--prune` at plan time and `--allow-destructive` at apply time. Both are needed; neither alone does it.
- **Only edges**: `--no-estimates --no-milestones`.
- **Push each node's group as a milestone**: `--groups-as-milestones`. Off by default, because it turns a local label into a tracker write. The milestone must already exist; this tool does not create milestones.
- **Check for drift in CI**: `plan --desired ... --current ... --strict` exits `1` when there is anything to do.

## Troubleshooting

- `plan_mismatch` (exit 9): the plan names a different target than `--current`. A plan is bound to the project it was computed against; compute a new one rather than pointing this one somewhere else.
- `plan_would_cycle` (exit 10): your desired edges plus the ones Linear already holds would make a loop, and no plan was written. The message names the cards. Your desired graph can be perfectly acyclic on its own and still do this, because the tracker has edges your file does not.
- Some mutations came back `unconfirmed`: run the same plan again. Every mutation reads before it writes, so repeating a landed one is a no-op, and a plan that half-landed is safe to re-run.
- Some mutations came back `stale`: plan again. Re-running this one will report the same thing, because the tracker has moved past what it describes.
- `linear_milestone_not_found`: create the milestone in Linear first.

## Related reference

- [Plan and receipt JSON](../reference/plan.md), [`plan` and `apply`](../reference/cli.md#plan), [exit codes](../reference/exit-codes.md), [what Linear owns](../explanation/source-of-truth.md)
