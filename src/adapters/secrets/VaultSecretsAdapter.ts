import Vault from "@git-stunts/vault";
import type { SecretsPort } from "../../ports/SecretsPort.ts";

/**
 * The OS keychain through @git-stunts/vault. The account is the keychain
 * service label; `git-stunts` is the one the other git-stunts tools already
 * use for LINEAR_API_KEY, so somebody who has stored the key there for one of
 * them needs no setup here.
 */
export class VaultSecretsAdapter implements SecretsPort {
  private readonly vault: Vault;

  constructor(private readonly account = "git-stunts") {
    this.vault = new Vault({ account });
  }

  describe(): string {
    return `OS keychain via @git-stunts/vault (account ${this.account})`;
  }

  async get(target: string): Promise<string | undefined> {
    const value = await this.vault.getSecret({ target });
    return value === null || value === undefined || value.length === 0 ? undefined : value;
  }
}
