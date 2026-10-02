# Security

yalikedags reads your Linear workspace with **your** personal API key. The key never touches this repository, a config file, or the browser page.

- The key is resolved from the `LINEAR_API_KEY` environment variable, or from your OS keychain through [`@git-stunts/vault`](https://github.com/git-stunts/vault) (target `LINEAR_API_KEY`, account `git-stunts`). It is held in process memory only.
- A Content Security Policy authorizes only the bundled script by hash. Served pages connect only to their own origin; offline files allow no connections. Inline styles remain allowed for theme variables and SVG geometry. Server responses deny framing and MIME sniffing and suppress referrers. Offline meta policies cannot enforce frame-ancestors; do not treat arbitrary modified HTML exports as trusted code.
- `--offline` refuses remote sources/writers before credential access and installs a deny-network HTTP adapter. Use file sources in this mode; OS network controls remain the enforcement boundary for a strict air gap.
- The viewer is served on `127.0.0.1` only and makes no external requests. The page never receives the key; the local process does the talking to Linear.
- Only `apply --confirm` writes to Linear, and only the mutations listed in a plan file you passed it. Everything else, `plan` included, is read-only. Destructive mutations need a second flag, `--allow-destructive`.
- The write port has no method for status, assignee, priority or title, so no plan can change them.

To report a vulnerability, open a private security advisory on this repository or email the maintainer. Do not open a public issue with exploit details.
