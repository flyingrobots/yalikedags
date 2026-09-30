/**
 * ReconcileService: the difference between the graph you meant and the graph
 * the source holds, expressed as mutations.
 *
 * Three rules keep it from writing something nobody asked for.
 *
 * 1. **Matching is by identity, never by resemblance.** A desired task finds
 *    its counterpart by id or by key. Titles are not compared, because a title
 *    match is a guess, and a guess here writes to the wrong card.
 * 2. **Absence is not instruction.** A desired task with no estimate means
 *    "not specified", never "clear it". Only a value that differs produces a
 *    mutation.
 * 3. **Pruning is bounded by what was matched.** An edge is only ever removed
 *    when both of its endpoints are counterparts of desired tasks. An edge
 *    touching a card the desired source has never heard of belongs to someone
 *    else and is left alone.
 * 4. **A plan that would close a cycle is refused, not emitted.** Each edge
 *    can be individually reasonable while the set of them is not, and the
 *    source will accept every one of those writes in turn. The check is on the
 *    whole plan applied to the current graph, because that is the graph a
 *    person is left with.
 */
import type { Dag } from "../domain/Dag.ts";
import type { Task } from "../domain/Task.ts";
import type { Mutation } from "../domain/Mutation.ts";
import { AddBlockingRelation, RemoveBlockingRelation, SetEstimate, SetMilestone } from "../domain/Mutation.ts";
import { Plan, Unmatched } from "../domain/Plan.ts";
import type { ClockPort } from "../../ports/ClockPort.ts";
import { GraphSafetyService } from "./GraphSafetyService.ts";

export interface ReconcileOptions {
  /** Emit removals for edges the source has and the desired graph does not. Off by default. */
  prune?: boolean;
  /** Emit estimate mutations. On by default. */
  estimates?: boolean;
  /** Emit milestone mutations. On by default. */
  milestones?: boolean;
}

export interface ReconcileSources {
  desired: Dag;
  current: Dag;
  desiredSource: string;
  currentSource: string;
}

interface Matching {
  /** desired id to current id. */
  map: Map<string, string>;
  unmatched: Unmatched[];
}

const pairKey = (blocker: string, blocked: string): string => `${blocker}\u0000${blocked}`;

export class ReconcileService {
  constructor(private readonly clock: ClockPort) {}

  plan(sources: ReconcileSources, options: ReconcileOptions = {}): Plan {
    const { desired, current } = sources;
    const matching = this.match(desired, current);
    const mutations = [
      ...this.edgeMutations(sources, matching, options.prune === true),
      ...this.fieldMutations(sources, matching, options),
    ].sort((a, b) => a.sortKey().localeCompare(b.sortKey()));
    new GraphSafetyService().assertSafe(current, mutations);
    return new Plan({
      mutations,
      unmatched: matching.unmatched,
      desiredSource: sources.desiredSource,
      currentSource: sources.currentSource,
      createdAt: this.clock.today(),
      labels: Object.fromEntries(current.tasks.map((t) => [t.id, t.key])),
    });
  }

  /** Counterparts by id first, then by key, case-insensitively. Nothing else. */
  private match(desired: Dag, current: Dag): Matching {
    const byKey = new Map<string, Task>();
    for (const t of current.tasks) {
      byKey.set(t.key.toUpperCase(), t);
    }
    const map = new Map<string, string>();
    const taken = new Map<string, string>();
    const unmatched: Unmatched[] = [];
    for (const d of desired.tasks) {
      const found = current.has(d.id) ? current.get(d.id) : byKey.get(d.key.toUpperCase());
      if (found === undefined) {
        unmatched.push(new Unmatched(d.id, d.key, "no task at the source has this id or key"));
        continue;
      }
      const alreadyBy = taken.get(found.id);
      if (alreadyBy !== undefined) {
        unmatched.push(new Unmatched(d.id, d.key, `would match ${found.key}, which ${alreadyBy} already matched`));
        continue;
      }
      taken.set(found.id, d.key);
      map.set(d.id, found.id);
    }
    return { map, unmatched };
  }

  private edgeMutations(sources: ReconcileSources, matching: Matching, prune: boolean): Mutation[] {
    const desiredPairs = this.desiredPairs(sources.desired, matching.map);
    const out: Mutation[] = [];
    for (const pair of desiredPairs.values()) {
      if (!this.currentHasEdge(sources.current, pair)) {
        out.push(new AddBlockingRelation(pair.blocker, pair.blocked));
      }
    }
    if (prune) {
      out.push(...this.pruneMutations(sources.current, matching, desiredPairs));
    }
    return out;
  }

  private desiredPairs(desired: Dag, map: Map<string, string>): Map<string, { blocker: string; blocked: string }> {
    const out = new Map<string, { blocker: string; blocked: string }>();
    for (const d of desired.tasks) {
      const blocked = map.get(d.id);
      if (blocked === undefined) {
        continue;
      }
      for (const b of desired.blockers(d.id)) {
        const blocker = map.get(b);
        if (blocker !== undefined) {
          out.set(pairKey(blocker, blocked), { blocker, blocked });
        }
      }
    }
    return out;
  }

  private currentHasEdge(current: Dag, pair: { blocker: string; blocked: string }): boolean {
    return current.has(pair.blocked) && current.blockers(pair.blocked).includes(pair.blocker);
  }

  /** Only edges whose both endpoints are counterparts of desired tasks are eligible. */
  private pruneMutations(current: Dag, matching: Matching, desiredPairs: Map<string, unknown>): Mutation[] {
    const inScope = new Set(matching.map.values());
    const out: Mutation[] = [];
    for (const t of current.tasks) {
      if (!inScope.has(t.id)) {
        continue;
      }
      for (const b of current.blockers(t.id)) {
        if (inScope.has(b) && !desiredPairs.has(pairKey(b, t.id))) {
          out.push(new RemoveBlockingRelation(b, t.id));
        }
      }
    }
    return out;
  }

  private fieldMutations(sources: ReconcileSources, matching: Matching, options: ReconcileOptions): Mutation[] {
    const out: Mutation[] = [];
    for (const [desiredId, currentId] of matching.map) {
      const d = sources.desired.get(desiredId);
      const c = sources.current.get(currentId);
      if (options.estimates !== false && d.effort !== undefined && d.effort !== c.effort) {
        out.push(new SetEstimate(currentId, d.effort, c.effort ?? null));
      }
      if (options.milestones !== false && d.milestone !== undefined && d.milestone !== c.milestone) {
        out.push(new SetMilestone(currentId, d.milestone, c.milestone ?? null));
      }
    }
    return out;
  }
}
