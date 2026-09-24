/** Minimal typing for the parts of @git-stunts/vault this repo calls. The library ships no types. */
declare module "@git-stunts/vault" {
  export default class Vault {
    constructor(options?: { account?: string });
    getSecret(args: { target: string }): Promise<string | null | undefined>;
    setSecret(args: { target: string; value: string }): Promise<void>;
    deleteSecret(args: { target: string }): Promise<boolean>;
  }
}
