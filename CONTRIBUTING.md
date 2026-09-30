# Contributing

Tests are the spec. Write the failing test first, then the code, then `bun run check`.

- `bun install` once. `bun test` runs the hermetic suite; `bun run lint` runs ESLint (strict, every warning is an error) and `tsc --noEmit`; `bun run check` runs all of it.
- Viewer changes: `bun run build:viewer`, then `bunx playwright install chromium` once and `bun run test:browser`. Browser TypeScript and CSS live in `src/viewer/browser/`; the ignored generated bundle is rebuilt by `bun install` and `bun run check`.
- `bun run test:live` runs the tier that talks to a real Linear workspace. It is skipped by default and needs its own fixture: see [live testing](docs/contributing/live-testing.md). Never point it at a workspace holding real work.
- Hooks are plain shell scripts in `scripts/hooks/`. Enable them with `git config --local core.hooksPath scripts/hooks`. Pre-commit runs lint, the docs lint and the clean-room check; pre-push runs the tests.
- **Nothing from the project you happen to be using this on lands here.** `bun run clean-room` refuses a tracked file carrying an issue key of four digits or more, or a tracker URL with a real workspace slug. Examples use short keys like `PRO-1` and the project placeholder `example-project`; invent your numbers rather than pasting a real audit's, because a task count is a fingerprint too.
- If there are names that must never appear, put them one per line in `.clean-room.local`, which is gitignored. The check reads it when it is there. They are deliberately not in the tracked rules: a denylist publishes what it filters, so a committed rule naming an organisation tells every reader what the rule exists to hide.
- Conventional commits. Update `CHANGELOG.md` and the README with any user-visible change.
- Architecture is ports and adapters: `src/core` has no I/O and no imports from `src/adapters`. New sources (Linear, GitHub, a task list) are input adapters behind `TaskRepository`; new outputs (DOT, SVG, JSON) are output adapters behind `Renderer`.
- Zero Python. The prototype it replaced lives in the first commit if you want to read it.
