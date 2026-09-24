import type { SecretsPort } from "../../ports/SecretsPort.ts";

/** Environment variables. Useful in CI and for one-off runs; the keychain is the default for people. */
export class EnvSecretsAdapter implements SecretsPort {
  constructor(private readonly env: Readonly<Record<string, string | undefined>>) {}

  describe(): string {
    return "environment";
  }

  get(target: string): Promise<string | undefined> {
    const v = this.env[target];
    return Promise.resolve(v === undefined || v.length === 0 ? undefined : v);
  }
}
