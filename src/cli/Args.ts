/** `--flag value` and `--flag` (boolean) parsing. Small on purpose; no dependency. */

/**
 * Every flag the CLI understands, in one place.
 *
 * An unknown flag is a refusal rather than a shrug. Silently ignoring one is
 * the failure that matters here: `--allow-destructve` reads as a typo to a
 * person and as "not allowed" to the parser, so the run looks like it obeyed
 * an instruction it never saw. The same goes for `--prune`, `--confirm` and
 * `--no-estimates`, where the ignored spelling is the unsafe direction.
 */
export const KNOWN_FLAGS: ReadonlySet<string> = new Set([
  "allow-destructive",
  "check",
  "confirm",
  "current",
  "dag",
  "desired",
  "format",
  "groups-as-milestones",
  "help",
  "json",
  "key-target",
  "no-estimates",
  "no-milestones",
  "offline",
  "out",
  "plan",
  "port",
  "project",
  "prune",
  "receipt",
  "redact",
  "set",
  "snapshot",
  "strict",
  "target",
  "tasklist",
]);

const BOOLEAN_FLAGS = new Set(["allow-destructive", "check", "confirm", "groups-as-milestones", "help", "json", "no-estimates", "no-milestones", "offline", "prune", "redact", "set", "strict"]);

export class Args {
  readonly command: string | undefined;
  private readonly flags = new Map<string, string | true>();

  constructor(argv: readonly string[], known: ReadonlySet<string> = KNOWN_FLAGS) {
    const [command, ...rest] = argv;
    this.command = command;
    for (let i = 0; i < rest.length; i += 1) {
      const a = rest[i] ?? "";
      if (!a.startsWith("--")) {
        throw new Error(`usage: unexpected argument ${a}`);
      }
      const name = a.slice(2);
      if (!known.has(name)) {
        throw new Error(`usage: unknown flag --${name}${Args.nearest(name, known)}`);
      }
      if (this.flags.has(name)) { throw new Error(`usage: duplicate flag --${name}`); }
      const next = rest[i + 1];
      if (BOOLEAN_FLAGS.has(name)) {
        this.flags.set(name, true);
      } else {
        if (!Args.isValue(next)) { throw new Error(`usage: --${name} needs a value`); }
        this.flags.set(name, next);
        i += 1;
      }
    }
  }

  private static isValue(value: string | undefined): value is string {
    return value !== undefined && value.length > 0 && !value.startsWith("--");
  }

  /**
   * A suggestion when exactly one known flag is within two edits, and silence
   * otherwise. Two guesses is not a suggestion, and a wrong one on a flag like
   * `--allow-destructive` is worse than none.
   */
  private static nearest(name: string, known: ReadonlySet<string>): string {
    const close = [...known].filter((k) => Args.editDistance(name, k) <= 2);
    return close.length === 1 ? `. Did you mean --${close[0] ?? ""}?` : "";
  }

  /** Levenshtein, one row at a time. Flag names are short; nothing here needs to be clever. */
  private static editDistance(a: string, b: string): number {
    let previous = [...Array(b.length + 1).keys()];
    for (let i = 1; i <= a.length; i += 1) {
      const row = [i];
      for (let j = 1; j <= b.length; j += 1) {
        const substitution = (previous[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1);
        row.push(Math.min((row[j - 1] ?? 0) + 1, (previous[j] ?? 0) + 1, substitution));
      }
      previous = row;
    }
    return previous[b.length] ?? 0;
  }

  get(name: string): string | undefined {
    const v = this.flags.get(name);
    return typeof v === "string" ? v : undefined;
  }

  has(name: string): boolean {
    return this.flags.has(name);
  }
}
