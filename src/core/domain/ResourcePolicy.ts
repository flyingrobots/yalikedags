/**
 * ResourcePolicy: how each named resource may be shared by tasks that are
 * ready at the same time. Resources are node attributes, never edges:
 * contention is symmetric and non-transitive, so encoding it as edges would
 * corrupt every number derived from the dependency closure.
 */

export type ResourceMode = "exclusive" | "capacity" | "advisory";

export interface ResourceRule {
  id: string;
  mode: ResourceMode;
  /** Only meaningful for `capacity`. Defaults to 1. */
  capacity?: number;
}

export class ResourcePolicy {
  private readonly rules = new Map<string, Required<ResourceRule>>();

  constructor(rules: readonly ResourceRule[] = []) {
    for (const r of rules) {
      if (r.mode === "capacity" && (r.capacity ?? 1) < 1) {
        throw new Error(`resource ${r.id}: capacity must be at least 1`);
      }
      this.rules.set(r.id, { id: r.id, mode: r.mode, capacity: r.capacity ?? 1 });
    }
    Object.freeze(this);
  }

  /** Unknown resources are advisory: flagged in reports, never blocking. */
  rule(id: string): Required<ResourceRule> {
    return this.rules.get(id) ?? { id, mode: "advisory", capacity: 1 };
  }

  /** The conflict message for `count` ready contenders, or undefined when the mode permits it. */
  conflict(id: string, count: number): string | undefined {
    const r = this.rule(id);
    if (r.mode === "exclusive" && count > 1) {
      return `${id} (exclusive, ${String(count)} ready contenders)`;
    }
    if (r.mode === "capacity" && count > r.capacity) {
      return `${id} (capacity ${String(r.capacity)}, ${String(count)} ready contenders)`;
    }
    return undefined;
  }
}
