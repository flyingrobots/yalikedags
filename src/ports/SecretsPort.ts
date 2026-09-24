/** Where credentials come from. Never a file in this repository. */
export interface SecretsPort {
  /** The secret, or undefined when the store has no such target. Never throws on absence. */
  get(target: string): Promise<string | undefined>;
  /** One line naming where the secret was looked for, safe to print. */
  describe(): string;
}
