# Exit codes

Defined in `src/cli/ExitCode.ts`; a refusal's leading `name:` token selects the code.

| Code | Name | Meaning | What remains trustworthy | Recommended response |
|---|---|---|---|---|
| 0 | `OK` | the command completed | everything printed | none |
| 1 | `FINDINGS` | `audit --strict` and there was at least one finding | the report | read the findings |
| 2 | `USAGE` | bad arguments, or no command | nothing was read | fix the command line; `help` prints usage |
| 3 | `LINEAR_UNAUTHORIZED` | Linear rejected the key (HTTP 401 or 403) | nothing was read | re-store the key |
| 4 | `LINEAR_PROJECT_NOT_FOUND` | zero or several projects matched `--project` | nothing was read | use the UUID |
| 5 | `SOURCE_ERROR` | the source could not be read or decoded (missing file, bad snapshot schema, GraphQL error, HTTP error) | nothing was written | read the message; it names the cause |
| 6 | `GRAPH_INVALID` | the graph has a cycle | the report, which names the cycle members | break the cycle in Linear |
| 7 | `NO_KEY` | `LINEAR_API_KEY` is in neither the environment nor the keychain | nothing was read | `key --set` |
| 8 | `APPLY_INCOMPLETE` | `apply --confirm` ran, but a mutation is not confirmed, verification failed, or the final graph has newly cyclic edges | the receipt, which names each outcome | read the receipt; re-running the same plan is safe, and a `stale` outcome means to plan again instead |
| 9 | `PLAN_MISMATCH` | `--current` disagrees with the target the plan was computed against | nothing was written | compute a new plan against the project you mean |
| 10 | `PLAN_WOULD_CYCLE` | performing the plan would leave a graph that does not schedule | nothing was written; `plan` emits no plan, and `apply` refuses the unsafe effective plan | review the desired edges and any skipped removals; re-plan, or allow reviewed removals if intended |

A write to `--out` happens only on the success path, so a nonzero exit never leaves a partial file. Exit 8 is the exception in spirit rather than in fact: the file is written, and it is written precisely because the run was incomplete.
