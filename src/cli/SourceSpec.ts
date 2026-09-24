/**
 * `kind:value` source specs, so a command that needs two sources does not
 * need six flags.
 *
 *   dag:notes/plan.json        the task-dag JSON schema
 *   tasklist:TODO.md           a Markdown task list
 *   snapshot:out/snap.json     a snapshot this tool wrote
 *   linear:Growth Marketing    a Linear project by name or UUID
 *
 * The split is on the first colon only, so a value may contain colons.
 */
export type SourceKind = "dag" | "tasklist" | "snapshot" | "linear";

const KINDS: readonly SourceKind[] = ["dag", "tasklist", "snapshot", "linear"];

export class SourceSpec {
  private constructor(
    readonly kind: SourceKind,
    readonly value: string,
  ) {
    Object.freeze(this);
  }

  static parse(spec: string): SourceSpec {
    const at = spec.indexOf(":");
    const kind = KINDS.find((k) => k === spec.slice(0, at));
    const value = spec.slice(at + 1);
    if (at < 0 || kind === undefined || value.length === 0) {
      throw new Error(`usage: source must be one of ${KINDS.join(":, ")}: followed by a value, got "${spec}"`);
    }
    return new SourceSpec(kind, value);
  }

  get needsKey(): boolean {
    return this.kind === "linear";
  }

  toString(): string {
    return `${this.kind}:${this.value}`;
  }
}
