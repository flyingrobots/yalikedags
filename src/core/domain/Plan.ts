/**
 * Plan: an ordered, reviewable list of mutations, plus what could not be
 * matched between the two sources.
 *
 * A plan is a document, not an action. It is computed by `plan`, read by a
 * human, and only then handed to `apply`. That separation is the whole safety
 * model: nothing this tool writes was ever decided in the same breath as being
 * performed.
 */
import type { Label, Mutation } from "./Mutation.ts";

/** A desired task that has no counterpart at the source, with the reason. */
export class Unmatched {
  constructor(
    readonly desiredId: string,
    readonly desiredKey: string,
    readonly reason: string,
  ) {
    Object.freeze(this);
  }

  toJSON(): Record<string, unknown> {
    return { desiredId: this.desiredId, desiredKey: this.desiredKey, reason: this.reason };
  }
}

export interface PlanFields {
  mutations: readonly Mutation[];
  unmatched: readonly Unmatched[];
  /** Source specs, recorded so `apply` can refuse a plan aimed at something else. */
  desiredSource: string;
  currentSource: string;
  createdAt: string;
  /** Source-side id to human key, so a plan reads without re-fetching. */
  labels: Readonly<Record<string, string>>;
}

export class Plan {
  readonly mutations: readonly Mutation[];
  readonly unmatched: readonly Unmatched[];
  readonly desiredSource: string;
  readonly currentSource: string;
  readonly createdAt: string;
  readonly labels: Readonly<Record<string, string>>;

  constructor(f: PlanFields) {
    this.mutations = Object.freeze([...f.mutations]);
    this.unmatched = Object.freeze([...f.unmatched]);
    this.desiredSource = f.desiredSource;
    this.currentSource = f.currentSource;
    this.createdAt = f.createdAt;
    this.labels = Object.freeze({ ...f.labels });
    Object.freeze(this);
  }

  get isEmpty(): boolean {
    return this.mutations.length === 0;
  }

  get destructive(): readonly Mutation[] {
    return this.mutations.filter((m) => m.destructive);
  }

  /** Render an id the way a reader recognises it, falling back to the id itself. */
  label(): Label {
    return (id: string): string => this.labels[id] ?? id;
  }

  counts(): Map<string, number> {
    const out = new Map<string, number>();
    for (const m of this.mutations) {
      out.set(m.kind, (out.get(m.kind) ?? 0) + 1);
    }
    return out;
  }

  toJSON(): Record<string, unknown> {
    return {
      desiredSource: this.desiredSource,
      currentSource: this.currentSource,
      createdAt: this.createdAt,
      labels: this.labels,
      mutations: this.mutations.map((m) => m.toJSON()),
      unmatched: this.unmatched.map((u) => u.toJSON()),
    };
  }
}
