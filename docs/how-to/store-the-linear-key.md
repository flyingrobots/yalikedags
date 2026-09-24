# Store your Linear key in the keychain

Use this once per machine. Afterwards every `--project` command finds the key without you typing it, and the key never lives in a file.

## Prerequisites

- A Linear personal API key (Linear: Settings, Security and access, Personal API keys). It starts with `lin_api_`.
- `bun install` has run, which brings in `@git-stunts/vault`.
- On macOS the Keychain may prompt for your login password on first write.

## Procedure

Run:

```bash
bun src/cli.ts key --set
```

Paste the key when prompted and press Enter. Input is not echoed.

Expected output:

```text
stored LINEAR_API_KEY in the keychain (account git-stunts)
```

## Verify

```bash
bun src/cli.ts key --check
```

```text
LINEAR_API_KEY is present in the keychain
```

The command exits `0` when the key is present and `7` when it is not; it never prints the key.

## Common variations

- **CI or a one-off shell**: set `LINEAR_API_KEY` in the environment instead. The environment is checked before the keychain.
- **A second key, for a test workspace**: store it under its own name and then name it per command.

  ```bash
  bun src/cli.ts key --set --target YALIKEDAGS_LIVE_KEY
  bun src/cli.ts audit --project my-test-project --key-target YALIKEDAGS_LIVE_KEY
  ```

  Two entries, two workspaces, and the one you reach is the one you named. Keep the production key under `LINEAR_API_KEY` and give every other workspace its own name, because the default is somebody's real tracker.
- **A different keychain account**: the account label is `git-stunts`, shared with other git-stunts tools. There is no flag to change it; `--target` changes which entry under that account, not the account.

## Troubleshooting

- `vault_unavailable`: `bun install` did not complete, or the platform has no supported keychain. See [Troubleshooting](../troubleshooting/index.md).
- `no_key` from a `--project` command: the key is in neither the environment nor the keychain. Run this procedure.

## Related reference

- [`key`](../reference/cli.md#key) in the CLI reference
- [SECURITY.md](../../SECURITY.md) for where the key is and is not allowed to go
