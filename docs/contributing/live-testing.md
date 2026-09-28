# Live testing against a real Linear workspace

The hermetic suite establishes that this code does what it means to. It cannot establish that Linear agrees. The live suite exists for that one question, and it runs against a fixture in a workspace kept for the purpose.

Warning: never point this at a workspace that holds real work. Two guards make that hard rather than merely discouraged, but they are guards, not guarantees, and the first line of defence is which workspace you put in the environment.

## What protects you

| Guard | Effect |
|---|---|
| The token is `YALIKEDAGS_LIVE_KEY`, in the keychain or the environment | A production key sitting in `LINEAR_API_KEY` cannot be picked up by the fixture script or the live suite. They do not read that name, from either place. |
| The project name must contain `yalikedags-test` | `assertFixtureProject` refuses anything else, before a single query is sent. |
| Every issue title must start with `yld-fixture` | Even inside the fixture project, an issue a person created is invisible: it is never read into the fixture, never written to, and never a candidate for relation removal. |
| `bun test` skips the live suite | The suite runs only when `YALIKEDAGS_LIVE=1`, so the default suite stays offline even on a machine where the fixture is provisioned. |

## Set it up

1. Create a **separate Linear workspace** for testing, or at minimum a team in one that holds nothing real.
2. Create a team in it and note its key (the short prefix, such as `TST`).
3. Create a personal API key in that workspace.
4. Put the key in the OS keychain. Do this in a terminal, and in this exact shape: `read -rs` keeps it off the screen and out of shell history, and the pipe keeps it out of the process table, which a `vault set <target> <value>` style command would not.

```bash
printf 'Paste the test key: '; read -rs K; echo
printf '%s' "$K" | bun src/cli.ts key --set --target YALIKEDAGS_LIVE_KEY
unset K
```

Check it landed without printing it:

```bash
bun src/cli.ts key --check --target YALIKEDAGS_LIVE_KEY
```

5. Tell it which team. The project does not need to exist; the script creates it, and its name defaults to `yalikedags-test`.

```bash
bun run fixture:plan -- --team TST
```

That shows what provisioning would do and writes nothing. Team and project are not secrets, so they can equally be `YALIKEDAGS_LIVE_TEAM` and `YALIKEDAGS_LIVE_PROJECT` in the environment; after the first successful provision they are recorded in the manifest and neither needs to be passed again.

Expected output on a fresh workspace, abridged:

```text
live fixture: checking "yalikedags-test" in team TST
  would create project "yalikedags-test"
  would create milestone "yld-fixture Stream One"
  would create issue "yld-fixture A root"
  ...
live fixture: 13 difference(s) from the baseline
```

6. Provision it:

```bash
bun run fixture:provision -- --team TST
```

It writes `.live-fixture.json` (gitignored) mapping each logical name to the real issue id and identifier.

## Run the live suite

```bash
bun run test:live
```

`0`, `false`, an empty value, and an unset `YALIKEDAGS_LIVE` all keep the live tier disabled. The default Bun report includes eight skipped tests and two unnamed setup/teardown entries. Fixture teardown is guarded when configuration fails.

That provisions first, then runs `test/live/` with `YALIKEDAGS_LIVE=1`. To run the suite without re-provisioning: `YALIKEDAGS_LIVE=1 bun test test/live/`. Provisioning is also a **reset**: it drives the fixture back to its declared baseline, removing relations a previous run added and restoring estimates it changed. That is what makes the suite repeatable rather than one-shot.

## The fixture

Eight issues, declared in `scripts/live-fixture.ts`, each present for a reason:

| Issue | Baseline | Exercises |
|---|---|---|
| `A root` | no blockers | a root, and the blocker in most tests |
| `B blocked by A` | blocked by A | an edge that already exists, so adding it again must write nothing |
| `C blocked by B` | blocked by B | a two-hop chain for the critical path |
| `D isolated` | nothing either way | the audit's isolated finding, and the edge tests add and remove |
| `E estimated` | estimate 2 | replacing an estimate, which is destructive |
| `F milestoned` | milestone Stream One | replacing a milestone, which is destructive |
| `G link target` | nothing | the blocker in the prune case |
| `H prune source` | blocked by G | an edge no desired graph declares, so `--prune` has something to remove |

Plus two project milestones, and the team's estimate scale set to Linear with zero allowed, because the synthetic tests write values from zero through three. The reader itself preserves any finite nonnegative estimate exactly.

## Two declared deviations from the testing standard

Both are recorded at the top of `test/live/Live.test.ts` as well.

- **Not hermetic** (rule 8). These tests talk to a real workspace. That is the point: the property under test is what happens when this code meets the real API, which no fake can establish.
- **Order-dependent within the file** (rule 9's spirit). Each test leaves state the next reads. The file resets the fixture before and after itself, so the file as a whole is repeatable even though its tests are not independent.

Neither deviation applies to the hermetic suite, and neither may leak into it.

## If it goes wrong

- `no YALIKEDAGS_LIVE_KEY in the environment or the keychain`: store it with the recipe above. The message repeats it.
- `no team`: pass `--team <KEY>`, or provision once so the manifest records it.
- `refusing to touch project "..."`: the project name lacks the sentinel. That is the guard working.
- `N teams have key "..."`: create the team first; the script does not create teams.
- `two issues ... are titled "..."`: an earlier run half-created the fixture. Archive the duplicate in Linear and re-provision.
- The suite left relations behind after a crash: run `bun run fixture:provision` again. Reset is idempotent.
