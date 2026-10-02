# Security

yalikedags reads your Linear workspace with **your** personal API key. The key never touches this repository, a config file, or the browser page.

- The key is resolved from the `LINEAR_API_KEY` environment variable, or from your OS keychain through [`@git-stunts/vault`](https://github.com/git-stunts/vault) (target `LINEAR_API_KEY`, account `git-stunts`). It is held in process memory only.
- `--offline` refuses remote sources/writers before credential access and installs a deny-network HTTP adapter. Use file sources in this mode; OS network controls remain the enforcement boundary for a strict air gap.
- The viewer is served on `127.0.0.1` only and makes no external requests. The page never receives the key; the local process does the talking to Linear.
- Only `apply --confirm` writes to Linear, and only the mutations listed in a plan file you passed it. Everything else, `plan` included, is read-only. Destructive mutations need a second flag, `--allow-destructive`.
- The write port has no method for status, assignee, priority or title, so no plan can change them.

To report a vulnerability, open a private security advisory on this repository or email the maintainer. Do not open a public issue with exploit details.

## Export contents and retention

Full JSON and HTML exports are plaintext project data: issue titles, descriptions, original IDs, links, assignments, labels, dates, estimates, and optional account/project/capture metadata. Secrets are not deliberately exported, but any secret pasted into an issue description is ordinary issue content and will be included. Store and share exported files accordingly.

The viewer offers **Export content → Structure only** before download. CLI `sync --redact` and `render --redact` offer the same reduction, including offline HTML. They replace identifiers and remove content, people, account metadata, and dates; [the exact retained fields](docs/reference/snapshot.md#structure-only-exports) remain visible. This is neither encryption nor guaranteed anonymization: topology, order, statuses, and task counts can still identify a project. Redaction covers the artifact, not CLI stderr diagnostics or source files.

The app does not automatically persist snapshots in browser storage. Browser local storage holds appearance (`yalikedags.appearance.v1`), text scale (`yalikedags.text-scale.v1`, with migration from the legacy `yalikedags.text-size`), visible columns (`yalikedags.columns.v1`), last view (`yalikedags.view.v2`), and inspector width (`yalikedags.inspector-width`). Refresh restoration temporarily puts selection IDs, filter/search values, and layout in the current browser history entry; restoration clears that entry, but browser session/crash recovery may retain it. Clear this origin's site data and history to remove browser-managed state.

Downloaded snapshots, rendered HTML, CLI output, logs, and source files remain on disk until you remove them. Clearing browser site data does not delete these files. The app has no expiry or secure-erasure guarantee; backups and browser download history have their own retention.
