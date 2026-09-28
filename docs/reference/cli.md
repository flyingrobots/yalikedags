# CLI reference

```text
yalikedags <command> [--project <name|id> | --tasklist <file> | --snapshot <file> | --dag <file>] [options]
```

Every command except `key`, `help`, `plan` and `apply` takes exactly one source flag. Only `apply --confirm` writes anything.

Boolean switches take no value: use `--confirm`, never `--confirm false` or `--confirm=false`. Omit a switch to leave it off. Value-taking flags require a value, and repeated flags are rejected.

An unrecognised flag is a usage error, exit 2, and the parser suggests the flag you meant when one is obviously close. This matters most for the flags whose absence is the quiet answer: a mistyped `--allow-destructive` or `--prune` would otherwise read to the parser as a decision you never made.

| Command | Purpose |
|---|---|
| [`sync`](#sync) | read the source, write a snapshot JSON |
| [`audit`](#audit) | report findings |
| [`frontier`](#frontier) | the ready tasks, most urgent first |
| [`render`](#render) | emit json, dot, svg, or the text report |
| [`serve`](#serve) | local viewer on 127.0.0.1 |
| [`key`](#key) | store or check `LINEAR_API_KEY` in the OS keychain |
| [`plan`](#plan) | diff a desired graph against a tracker and write a plan document |
| [`apply`](#apply) | perform a plan, then read it back and report what landed |
| `help` | print usage; exit 0 |

## Source flags

| Flag | Meaning |
|---|---|
| `--project <name or UUID>` | a Linear project. A name must match exactly one project (case-insensitive). Needs the key. |
| `--tasklist <file>` | a Markdown task list: `- [ ] Title (depends on: Other, Another)`, `[x]` done, `[/]` or `[WIP]` in progress, two-space indent for parent and child |
| `--snapshot <file>` | a snapshot written by `sync` (schema `yalikedags/snapshot/1`) |
| `--dag <file>` | the task-dag JSON schema: `{ "nodes": [ { "id", "title", "done", "blocked_by", "pri", "resources" } ], "resources": [...] }`. Its `resources` block also supplies the frontier's conflict policy. |

## Choosing a credential

| Flag | Meaning |
|---|---|
| `--key-target <name>` | read the key from this keychain entry instead of `LINEAR_API_KEY`. Accepted by every command that reaches Linear. |

This is how a command is pointed at a test workspace rather than the one `LINEAR_API_KEY` reaches, and it is a flag rather than a convention because the default is somebody's production tracker. The live fixture uses `YALIKEDAGS_LIVE_KEY`.

## `sync`

Read the source and write the snapshot.

| Option | Meaning |
|---|---|
| `--out <file>` | write here instead of stdout |

Output: the snapshot JSON ([reference](snapshot.md)). Stderr: `loaded N tasks from <source>`, any `warning:` lines, `wrote <file>`.

## `audit`

Print the text report and exit by what it found.

| Option | Meaning |
|---|---|
| `--json` | findings as a JSON array of `{kind, task, key, detail, wouldKill}` instead of the report |
| `--strict` | exit 1 when there is any finding |

Exit 6 whenever a cycle is present, regardless of `--strict`.

## `frontier`

Print only the frontier section of the report.

## `render`

| Option | Meaning |
|---|---|
| `--format json|dot|svg|html|text` | default `text` |
| `--out <file>` | write here instead of stdout |

`dot` is GraphViz input (`dot -Tsvg graph.dot > graph.svg`). `svg` is standalone and needs nothing. `text` is the report `audit` prints.

`html` is the whole viewer as one file: the same page `serve` returns, with the CSS, the graph, the snapshot and the script inline. It opens from disk with no process behind it and fetches nothing, so it travels — to a laptop with no key on it, to somebody who does not have this tool, into a directory beside last week's copy. Its only outbound links are the per-card "Open in Linear" ones, which come from the source data. The page is a reading, fixed at the moment you rendered it; `serve` offers explicit source refresh.

## `serve`

| Option | Meaning |
|---|---|
| `--port <n>` | default `0`, which lets the OS pick; the chosen URL is printed |

Binds `127.0.0.1` only. Read routes: `/`, `/snapshot.json`, `/graph.svg`, `/graph.dot`. The viewer sends an explicit same-origin `POST /refresh` to reread the source; it does not poll or write to the tracker. Stop with Ctrl-C.

## `key`

| Option | Meaning |
|---|---|
| `--set` | read a secret from **stdin** and store it under keychain account `git-stunts`. Never from argv, so it cannot reach shell history or the process table. |
| `--check` | print whether the secret is present; exit 0 or 7. Never prints it. |
| `--target <name>` | which keychain entry. Default `LINEAR_API_KEY`; the live test fixture uses `YALIKEDAGS_LIVE_KEY`. |

```bash
printf 'Paste: '; read -rs K; echo
printf '%s' "$K" | yalikedags key --set --target LINEAR_API_KEY
unset K
```

## `plan`

Compute the difference between a desired graph and a tracker, and write it as a document. Reads only.

```text
yalikedags plan --desired <kind:value> --current <kind:value> [options]
```

| Option | Meaning |
|---|---|
| `--desired <spec>`, `--current <spec>` | required. A spec is `dag:<file>`, `tasklist:<file>`, `snapshot:<file>` or `linear:<project>`. |
| `--prune` | also propose removing edges the tracker has and the desired graph does not. Destructive; off by default. |
| `--no-estimates`, `--no-milestones` | leave those fields out of the plan |
| `--groups-as-milestones` | map each task-dag node's `group` onto its milestone. Off by default. |
| `--out <file>` | write the plan JSON here; the readable form goes to stderr |
| `--json` | print the plan JSON instead of the readable form |
| `--strict` | exit 1 when the plan is not empty, for drift detection in CI |

Matching between the two graphs is by id, then by key, case-insensitively. Titles are never compared. A desired task with no counterpart is reported under `unmatched` and produces no mutation.

A plan that would leave the tracker with a cycle it did not already have is refused rather than written: exit 10, and the message names the cards. See [plan and receipt JSON](plan.md).

## `apply`

Perform a plan. Without `--confirm` it is a dry run that writes nothing.

```text
yalikedags apply --plan <file> [options]
```

| Option | Meaning |
|---|---|
| `--plan <file>` | required. A document written by `plan`. |
| `--confirm` | actually write. Without it, the same code path runs against a recording writer and nothing leaves the machine. |
| `--allow-destructive` | also perform the destructive mutations, which are otherwise skipped |
| `--receipt <file>` | write the receipt JSON here |
| `--current <spec>` | assert the target; a value that disagrees with the plan's own `currentSource` is refused with exit 9 |

The tracker is read before writing and again afterwards. The read before is what decides whether each mutation still applies: a mutation already in place is `confirmed` without a write, and one whose recorded `from` value has moved since the plan was made is `stale`, written nowhere, and reported. `--allow-destructive` does not waive that. The read after is what confirms: every mutation is asked whether it can see itself.

Exit `0` when all are `confirmed` or `skipped`, `8` otherwise. Re-running a plan is safe, and a `stale` result means to plan again rather than to re-run.

## Environment

| Variable | Effect |
|---|---|
| `LINEAR_API_KEY` | used before the keychain when set and non-empty |

## Exit status

See [exit codes](exit-codes.md).
