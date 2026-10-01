# Security

yalikedags reads your Linear workspace with **your** personal API key. The key never touches this repository, a config file, or the browser page.

- The key is resolved from the `LINEAR_API_KEY` environment variable, or from your OS keychain through [`@git-stunts/vault`](https://github.com/git-stunts/vault) (target `LINEAR_API_KEY`, account `git-stunts`). It is held in process memory only.
- Requests must name the bound loopback authority (`127.0.0.1` or `localhost` and the actual port). Snapshot routes accept GET/HEAD only; refresh accepts POST with its same-origin header checks. The loopback service is not an authentication boundary against other local processes.
- The viewer is served on `127.0.0.1` only and makes no external requests. The page never receives the key; the local process does the talking to Linear.
- Only `apply --confirm` writes to Linear, and only the mutations listed in a plan file you passed it. Everything else, `plan` included, is read-only. Destructive mutations need a second flag, `--allow-destructive`.
- The write port has no method for status, assignee, priority or title, so no plan can change them.

To report a vulnerability, open a private security advisory on this repository or email the maintainer. Do not open a public issue with exploit details.
