# Contributing

Tests are the spec. Write the failing test first, then the code, then `bun run check`.

- `bun install` once. `bun test` runs the hermetic suite; `bun run lint` runs ESLint (strict, every warning is an error) and `tsc --noEmit`; `bun run check` runs all of it.
- Viewer changes: `bun run build:viewer`, then `bunx playwright install chromium` once and `bun run test:browser`. Browser TypeScript and CSS live in `src/viewer/browser/`; the ignored generated bundle is rebuilt by `bun install` and `bun run check`.
- `bun run test:live` runs the tier that talks to a real Linear workspace. It is skipped by default and needs its own fixture: see [live testing](docs/contributing/live-testing.md). Never point it at a workspace holding real work.
- Hooks are plain shell scripts in `scripts/hooks/`. Enable them with `git config --local core.hooksPath scripts/hooks`. Pre-commit runs lint and the docs lint; pre-push runs the tests.
- Keep real project data and credentials out of commits, fixtures, screenshots, and public issues. Examples use synthetic data, short keys like `PRO-1`, and the project placeholder `example-project`.
- Conventional commits. Update `CHANGELOG.md` and the README with any user-visible change.
- Architecture is ports and adapters: `src/core` has no I/O and no imports from `src/adapters`. New sources (Linear, GitHub, a task list) are input adapters behind `TaskRepository`; new outputs (DOT, SVG, JSON) are output adapters behind `Renderer`.
- Zero Python. The prototype it replaced lives in the first commit if you want to read it.
