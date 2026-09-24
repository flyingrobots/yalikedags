import type { SecretsPort } from "../../ports/SecretsPort.ts";

/** First store that has the target wins. Environment first (explicit), then the keychain. */
export class ChainSecretsAdapter implements SecretsPort {
  constructor(private readonly stores: readonly SecretsPort[]) {}

  describe(): string {
    return this.stores.map((s) => s.describe()).join(", then ");
  }

  async get(target: string): Promise<string | undefined> {
    for (const store of this.stores) {
      const v = await store.get(target);
      if (v !== undefined) {
        return v;
      }
    }
    return undefined;
  }
}
