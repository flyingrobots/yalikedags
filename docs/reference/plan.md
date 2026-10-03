# Plan and receipt JSON

A plan is written by `plan --out <file>` or `plan --json`, and read by `apply --plan <file>`. Ordinary plans use schema `yalikedags/plan/1`; evidence-guarded proposals use `yalikedags/plan/2`. Encoded and decoded in `src/adapters/plan/PlanJsonCodec.ts`; the mutation classes are in `src/core/domain/Mutation.ts`.

## Plan

```json
{
  "schema": "yalikedags/plan/1",
  "desiredSource": "dag:plan.json",
  "currentSource": "linear:example-project",
  "createdAt": "2026-09-23",
  "labels": { "<source id>": "PRO-1" },
  "mutations": [
    { "kind": "add-blocking-relation", "blockerId": "<id>", "blockedId": "<id>" },
    { "kind": "remove-blocking-relation", "blockerId": "<id>", "blockedId": "<id>" },
    { "kind": "set-estimate", "taskId": "<id>", "from": null, "to": 2 },
    { "kind": "set-milestone", "taskId": "<id>", "from": null, "to": "Stream One" }
  ],
  "unmatched": [
    { "desiredId": "<id>", "desiredKey": "<key>", "reason": "no task at the source has this id or key" }
  ]
}
```

| Field | Meaning |
|---|---|
| `desiredSource`, `currentSource` | the `kind:value` specs the plan was computed from. `apply` refuses a `--current` that disagrees with `currentSource`. |
| `createdAt` | the day the plan was computed, from the clock port |
| `labels` | source-side id to human key, so a plan reads without fetching anything |
| `mutations` | performed in this order; ordering is deterministic for the same inputs |
| `unmatched` | desired tasks with no counterpart. Nothing is written for these. |

All ids in `mutations` are **source-side** ids, so a plan is meaningless against a different project. That is what `currentSource` guards.

`set-estimate` values are exact finite nonnegative source estimates or `null`. Reading 8 cannot satisfy a planned value of 3; fractions are preserved.

`from` records what the source held when the plan was computed. It is there so a reviewer can see what is being replaced, so a mutation that overwrites a value can be classified as destructive, and so `apply` can tell whether the source has moved since (see **Stale mutations** below).

## A plan that would not schedule is never written

`plan` builds the graph the plan would leave behind and refuses to emit it if that graph has a cycle the source did not already have. Exit code `10`, `PLAN_WOULD_CYCLE`, and the message names the cards.

Each edge in such a plan is individually reasonable, which is why this is checked on the set rather than one at a time, and why it is checked here rather than trusted to the source: Linear will accept every one of those writes in turn and leave you with a project that no longer schedules.

A cycle the source *already* has is reported by `audit`. Apply safety compares cyclic edges, so an unchanged existing cycle does not prevent unrelated changes.

`apply` checks the effective plan against its initial fresh read, after permissions and stale-state checks. If skipping a removal would leave an unsafe addition, it refuses before any write with exit `10`. Permitted removals run first. A further read establishes which removals actually landed; each addition is checked against that observed graph plus every earlier attempted addition (a failed response may still have landed). Failed or silently ignored removals cannot justify an unsafe addition. If this read fails, additions are withheld.

A final read verifies every mutation, including those already satisfied at startup, and checks for newly cyclic edges. Skipped changes leave the receipt incomplete. These are client-side checks, not a transaction: another person can change the tracker between a read and a write. A cycle detected on the final read leaves `graphSafe: false` and exits `8`.

## Which mutations are destructive

| Mutation | Destructive when |
|---|---|
| `add-blocking-relation` | never |
| `remove-blocking-relation` | always |
| `set-estimate` | `from` is not `null` |
| `set-milestone` | `from` is not `null` |

`apply` skips every destructive mutation unless `--allow-destructive` is passed. Removals are only ever put in a plan when `--prune` was passed.

## Stale mutations

The table above is decided when the plan is made. `apply` re-reads the source first and checks each mutation against it, because otherwise that verdict is frozen against a world that moves.

Plan while a card has no estimate and the plan calls the write non-destructive. If a teammate sets an estimate in the meantime, performing it would clobber their value as a change nobody reviewed. So `apply` reports that mutation as `stale`, writes nothing for it, and leaves the receipt incomplete, which exits `8`.

| Mutation | Its precondition |
|---|---|
| `add-blocking-relation` | both tasks still exist |
| `remove-blocking-relation` | the blocked task still exists |
| `set-estimate` | the estimate is still `from` |
| `set-milestone` | the milestone is still `from` |

`--allow-destructive` does not waive this. The two gates answer different questions: one is whether you accept losing a value you saw, the other is whether the value is still the one you saw.

A mutation whose effect is *already* in place is `confirmed` without a write, and that check runs first, so re-running a half-applied plan stays free.

## Decoding refuses rather than skips

An unknown `kind`, a missing required field, or the wrong `schema` is a refusal for the whole document. A plan that silently dropped a mutation would make `apply` do less than the plan a person reviewed said it would.

## Receipt

Written by `apply --confirm --receipt <file>`.

```json
{
  "target": "Linear project example-project",
  "at": "2026-09-23",
  "verified": true,
  "graphSafe": true,
  "complete": true,
  "counts": { "confirmed": 12, "unconfirmed": 0, "failed": 0, "skipped": 0, "stale": 0 },
  "results": [
    { "kind": "add-blocking-relation", "blockerId": "<id>", "blockedId": "<id>", "outcome": "confirmed", "detail": "" }
  ]
}
```

| Field | Meaning |
|---|---|
| `verified` | the source was read again after writing. When `false`, no outcome below it is trustworthy. |
| `graphSafe` | the verification read found no newly cyclic edges relative to the initial read; false if verification failed |
| `complete` | `verified`, `graphSafe`, and every result is `confirmed` |
| `outcome` | one of `confirmed`, `unconfirmed`, `failed`, `skipped`, `stale` |
| `detail` | the refusal for `failed`, the reason for `skipped` or `stale`, and for `unconfirmed` the note that a fresh read does not show the write |

`stale` is not `skipped`: nobody chose it, and it means the plan no longer describes the source. Plan again rather than passing another flag.

`apply --confirm` exits `0` when `complete` is true and `8` otherwise.

## Plans exported from dependency review

The viewer downloads accepted candidate additions in schema `yalikedags/plan/2`. Older CLIs refuse this schema instead of silently dropping its freshness guard. The plan model rejects all mutation kinds except `add-blocking-relation` when a prerequisite guard is present, including hand-edited removals, estimates, and milestones. These plans contain only `add-blocking-relation` mutations, the captured Linear project ID, and a required `prerequisiteVersion` SHA-256 field. Before obtaining a writer, `apply` compares this identity against a fresh capture of prerequisite evidence. Changed task keys, titles, descriptions, statuses, scope, hierarchy, labels, relations, warnings, or project/workspace identity refuse the plan with `stale_proposal`. Capture time, assignment, priority, and estimates do not change prerequisite evidence.

This check is not a tracker transaction: concurrent edits after the read remain possible. The existing cycle checks and final verification still apply. An incomplete receipt is never success. Since a successful or partially successful apply changes the evidence, capture and review again before retrying a guarded proposal plan. Legacy schema `/1` plans retain their existing mutation preconditions. The decoder rejects a `/1` document containing `prerequisiteVersion` and a `/2` document missing it; changing only the schema cannot silently disable the guard.

The prerequisite version is an evidence-freshness check, not a signature or authentication of the mutation list. A person can edit a `/2` file to propose different additions; the CLI still enforces source freshness, additions-only scope, cycle safety, and post-write verification, but cannot attest that those additions came from saved viewer decisions. Inspect the exact file passed to `apply --confirm`; never treat its hash as approval of its contents.
