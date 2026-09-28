/**
 * ApplyService: perform a plan, then read the source again and ask every
 * mutation whether it can see itself.
 *
 * Nothing here trusts a write because it did not throw. A mutation is
 * `confirmed` only when a fresh read of the source satisfies it, `failed`
 * when the write itself refused, and `unconfirmed` when the write returned
 * cleanly but the re-read does not show the effect. That last state is the
 * one worth having: it is what a silently ignored field, a permissions
 * boundary, or an eventually-consistent source looks like from outside.
 */
import type { Dag } from "../domain/Dag.ts";
import type { Mutation } from "../domain/Mutation.ts";
import type { Plan } from "../domain/Plan.ts";
import type { TaskWriterPort } from "../../ports/TaskWriterPort.ts";
import { GraphSafetyService } from "./GraphSafetyService.ts";

/**
 * `stale` is the outcome that keeps the destructive gate honest: the state
 * this mutation was planned against has moved, so applying it would write
 * over something the plan never showed anybody. It is not `skipped`, because
 * nobody chose it, and it leaves the plan incomplete so the exit code says
 * to re-plan.
 */
export type Outcome = "confirmed" | "unconfirmed" | "failed" | "skipped" | "stale";

export class MutationResult {
  constructor(
    readonly mutation: Mutation,
    readonly outcome: Outcome,
    /** The refusal message when `failed`, otherwise empty. */
    readonly detail: string,
  ) {
    Object.freeze(this);
  }

  toJSON(): Record<string, unknown> {
    return { ...this.mutation.toJSON(), outcome: this.outcome, detail: this.detail };
  }
}

export interface ApplyReceiptFields {
  results: readonly MutationResult[];
  target: string;
  at: string;
  /** True when the source was read again after writing. */
  verified: boolean;
  graphSafe: boolean;
}

export class ApplyReceipt {
  readonly results: readonly MutationResult[];
  readonly target: string;
  readonly at: string;
  readonly verified: boolean;
  readonly graphSafe: boolean;

  constructor(f: ApplyReceiptFields) {
    this.results = Object.freeze([...f.results]);
    this.target = f.target;
    this.at = f.at;
    this.verified = f.verified;
    this.graphSafe = f.graphSafe;
    Object.freeze(this);
  }

  count(outcome: Outcome): number {
    return this.results.filter((r) => r.outcome === outcome).length;
  }

  get complete(): boolean {
    return this.verified && this.graphSafe && this.results.every((r) => r.outcome === "confirmed");
  }

  toJSON(): Record<string, unknown> {
    return {
      target: this.target,
      at: this.at,
      verified: this.verified,
      graphSafe: this.graphSafe,
      complete: this.complete,
      counts: { confirmed: this.count("confirmed"), unconfirmed: this.count("unconfirmed"), failed: this.count("failed"), skipped: this.count("skipped"), stale: this.count("stale") },
      results: this.results.map((r) => r.toJSON()),
    };
  }
}

export interface ApplyRequest {
  plan: Plan;
  writer: TaskWriterPort;
  /** The source as it stands now. Preconditions are checked against this, not against the plan. */
  before: Dag;
  /** Reads the source again after writing, for verification. */
  reread: () => Promise<Dag>;
  /** Refuse destructive mutations rather than performing them. Default true. */
  refuseDestructive?: boolean;
  at: string;
}

export class ApplyService {
  private readonly safety = new GraphSafetyService();
  /**
   * Validate the permitted plan before any write. Observe removals before
   * deciding which additions remain safe, then verify all effects and graph
   * safety in a final read. These reads do not make the remote API transactional.
   */
  async apply(request: ApplyRequest): Promise<ApplyReceipt> {
    this.safety.assertSafe(request.before, request.plan.mutations.filter((m) => this.decide(m, request) === undefined));
    const written = await this.write(request);
    const after = await this.readQuietly(request.reread);
    const results = written.map((r) => this.verify(r, after));
    const graphSafe = after !== undefined && !this.safety.introducedCycle(request.before, after);
    return new ApplyReceipt({ results, target: request.writer.describe(), at: request.at, verified: after !== undefined, graphSafe });
  }

  private async write(request: ApplyRequest): Promise<MutationResult[]> {
    const results = new Map<Mutation, MutationResult>();
    const pending = request.plan.mutations.filter((m) => {
      const result = this.decide(m, request);
      if (result !== undefined) { results.set(m, result); }
      return result === undefined;
    });
    const removals = pending.filter((m) => m.kind === "remove-blocking-relation");
    for (const m of removals) { results.set(m, await this.writeOne(m, request.writer)); }
    const refreshed = removals.length > 0 ? await this.readQuietly(request.reread) : request.before;
    let projected = refreshed;
    for (const m of pending.filter((mutation) => mutation.kind !== "remove-blocking-relation")) {
      const checked = refreshed === undefined ? undefined : this.decide(m, { ...request, before: refreshed });
      const refusal = checked ?? this.edgeRefusal(m, projected);
      const result = refusal ?? (await this.writeOne(m, request.writer));
      results.set(m, result);
      // A failed request can have landed before its response was lost. Keep
      // every attempted addition in the safety projection until a fresh read.
      if (projected !== undefined && refusal === undefined) {
        projected = this.safety.project(projected, [m]);
      }
    }
    return request.plan.mutations.map((m) => {
      const result = results.get(m);
      if (result === undefined) { throw new Error("internal: missing mutation result"); }
      return result;
    });
  }

  /** Only observed removals can justify an addition. Failed/ignored removals remain in the graph. */
  private edgeRefusal(m: Mutation, graph: Dag | undefined): MutationResult | undefined {
    if (m.kind !== "add-blocking-relation") { return undefined; }
    if (graph === undefined) {
      return new MutationResult(m, "stale", "could not verify removals; no dependent additions were attempted");
    }
    if (!m.preconditionHolds(graph)) {
      return new MutationResult(m, "stale", "an endpoint disappeared during apply; re-plan");
    }
    if (this.safety.introducedCycle(graph, this.safety.project(graph, [m]))) {
      return new MutationResult(m, "stale", "addition would introduce a cycle in the observed graph; re-plan after verifying removals");
    }
    return undefined;
  }

  /**
   * Everything that settles a mutation without writing, in the order that
   * matters. Already-in-place comes first, which is what makes re-running a
   * half-applied plan free rather than stale: a mutation that landed on the
   * previous run is recognised as done instead of failing its precondition
   * against the state it already changed.
   */
  private decide(m: Mutation, request: ApplyRequest): MutationResult | undefined {
    if (m.satisfiedBy(request.before)) {
      return new MutationResult(m, "confirmed", "already in place before this run");
    }
    if (request.refuseDestructive !== false && m.destructive) {
      return new MutationResult(m, "skipped", "destructive and not allowed by this run");
    }
    if (!m.preconditionHolds(request.before)) {
      return new MutationResult(m, "stale", "the source has changed since this plan was made; re-plan rather than write over it");
    }
    return undefined;
  }

  private async writeOne(m: Mutation, writer: TaskWriterPort): Promise<MutationResult> {
    try {
      await m.apply(writer);
      return new MutationResult(m, "unconfirmed", "");
    } catch (error: unknown) {
      return new MutationResult(m, "failed", error instanceof Error ? error.message : String(error));
    }
  }

  /** A failed verification read is reported as an unverified receipt, never as success. */
  private async readQuietly(reread: () => Promise<Dag>): Promise<Dag | undefined> {
    try {
      return await reread();
    } catch {
      return undefined;
    }
  }

  private verify(result: MutationResult, after: Dag | undefined): MutationResult {
    if (result.outcome !== "unconfirmed" && result.outcome !== "confirmed") {
      return result;
    }
    if (after === undefined) { return new MutationResult(result.mutation, "unconfirmed", "verification read failed"); }
    return result.mutation.satisfiedBy(after)
      ? new MutationResult(result.mutation, "confirmed", result.detail)
      : new MutationResult(result.mutation, "unconfirmed", "the write returned cleanly but a fresh read does not show it");
  }
}
