# Troubleshooting

Each entry starts with what you see.

## `no_key: LINEAR_API_KEY was not found in environment, then OS keychain ...` (exit 7)

**Check 1**: `bun src/cli.ts key --check`. If it says not present, run `key --set`. **Check 2**: if you meant to use the environment, `echo ${LINEAR_API_KEY:+set}` prints `set` when it is. **Recover**: [Store your Linear key](../how-to/store-the-linear-key.md). **Verify**: `key --check` exits 0.

## `linear_unauthorized: Linear rejected the API key (HTTP 401)` (exit 3)

The key is present but wrong or revoked. Generate a new personal API key in Linear and run `key --set` again. Nothing was read; nothing is trustworthy from this run.

## `linear_project_not_found: 0 projects match "..."` or `2 projects match` (exit 4)

The name lookup is exact and case-insensitive and needs exactly one hit. Copy the project's UUID from its URL and pass that to `--project`.

## `linear_http_error: HTTP 400: {"errors":[{"message":"Query too complex" ...` (exit 5)

Linear caps GraphQL complexity at 10000; this tool pages at 25 issues after a 50-issue query exceeded the cap on 2026-09-30. If Linear lowers the cap or adds cost to a field, this returns. Evidence to include when reporting: the full message, which carries the computed complexity.

## `linear_incomplete: ...`

The source response is missing required connection data, repeats a pagination cursor, or has more nested labels/children/relations than were returned. The read fails instead of presenting a partial graph as complete. Retry and inspect the affected source response; nested connection pagination is not implemented yet. During viewer refresh, the previous successful snapshot stays visible.

## `warning: PRO-123: unknown state type "..."; readiness is unresolved`

The workflow state type is not mapped. The task keeps status `unknown` and is excluded from ready work and waves until the type is understood. Report the type name.

## The graph has a cycle (exit 6)

The report's findings name every member: `cycle among PRO-1, PRO-2, PRO-3`. Open one of them in Linear and remove the relation that closes the loop. Until then, cyclic work and its downstream dependents receive no wave. Critical paths are advisory on an invalid graph and should not be planned from.

## `vault_unavailable` or a keychain prompt loop

`@git-stunts/vault` could not open the OS keychain. On macOS, allow the prompt once for the `bun` binary. On Linux a Secret Service provider must be running. Fall back to `LINEAR_API_KEY` in the environment for the session.

## The viewer shows an old graph

Check the capture timestamp. In `serve`, use **Refresh source** to read again. A failed refresh retains the old graph and shows an error. With `--snapshot`, refresh rereads that file; it does not contact the original tracker. Offline exports must be regenerated.

## `apply` reported some mutations as `unconfirmed` (exit 8)

The write returned cleanly and a fresh read does not show it. **Check 1**: open one of the named issues in Linear; if the relation is there, the read was taken before the change settled and re-running will confirm it. **Check 2**: if it is not there, the field may be one your workspace does not accept (an estimate when the team has estimates disabled, for instance). **Recover**: run the same plan again; every mutation reads before it writes, so repeating a landed one is a no-op. **Verify**: the receipt shows `complete: true`.

## `apply` reported some mutations as `stale` (exit 8)

Something changed at the tracker after the plan was made, so the plan's account of what it was about to overwrite is out of date. Nothing was written for those mutations. **Check**: open a named issue; the field will hold a value other than the `from` the plan recorded. **Recover**: plan again. Re-running this plan reports the same thing, because the mutation no longer describes the source. **Do not** reach for `--allow-destructive`: that flag says you accept losing a value you saw, and the point of `stale` is that the value is no longer the one you saw. **Verify**: the new plan either shows the change you still want, against the current value, or is empty because somebody else made it.

## `plan_mismatch` (exit 9)

A plan carries the target it was computed against, and `--current` named a different one. Plans are not portable between projects, because every id in them is a source-side id. Compute a new plan.

## `plan_would_cycle` (exit 10)

Your desired edges, plus the ones the tracker already holds, would make a loop, so no plan was written. The message names the cards in the cycle. **Check**: your desired graph can be perfectly acyclic on its own and still do this, so look at what the tracker holds for those cards — `audit` and the viewer both show it. **Recover**: drop or reverse one of the named edges in your desired graph, or remove the tracker's edge with `--prune` in the same plan. **Verify**: `plan` emits a document.

This is checked before anything is written rather than left to Linear, which will accept each of those writes in turn and leave you with a project that no longer schedules.

## `usage: unknown flag --...` (exit 2)

A flag was not recognised, and the message suggests the one you meant when exactly one is close. Nothing was read and nothing was written. It is a refusal rather than a shrug because some typos fail in the unsafe direction: `--no-estimtes` would otherwise mean estimates get written by somebody who asked for them not to be.

## `linear_milestone_not_found`

The plan sets a milestone by name and no milestone with that name exists in the project. This tool does not create milestones. Create it in Linear, then re-run.

## `linear_write_refused`

A Linear mutation returned `success: false`. That is Linear declining, not a transport failure: check that the issues are in the project you think, and that your key's user can edit them.

## A dependency in Linear is missing from the graph

Only `blocks` / `blocked by` relations are edges. `related to` and `duplicate of` are not dependencies. Sub-issues are recorded as parent and children but do not block.
