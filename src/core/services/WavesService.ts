import type { Dag } from "../domain/Dag.ts";
import { StateService } from "./StateService.ts";

export class Workstream {
  constructor(
    /** Stable name derived from the smallest member id. */
    readonly id: string,
    readonly tasks: readonly string[],
  ) {
    Object.freeze(this);
  }
}

/**
 * Antichains and workstreams over the OPEN subgraph. Done tasks are
 * removed first: they block nothing and belong to no live workstream.
 *
 * Waves are Kahn layers, a forecast of parallelism, never a barrier.
 * Gatekeepers are open tasks with two or more open dependents: the shared
 * prerequisites. Workstreams are the connected components that remain once
 * gatekeepers are cut out. Every open non-gatekeeper task is in exactly
 * one workstream, which is what MECE means here.
 */
export class WavesService {
  private readonly state = new StateService();

  waves(dag: Dag): string[][] {
    const open = new Set(this.state.open(dag));
    const remaining = new Map<string, number>();
    for (const id of open) {
      const task = dag.get(id);
      remaining.set(id, task.blockedBy.filter((b) => !dag.has(b) || open.has(b)).length + (task.status === "unknown" ? 1 : 0));
    }
    const out: string[][] = [];
    let layer = [...remaining].filter(([, n]) => n === 0).map(([id]) => id).sort();
    while (layer.length > 0) {
      out.push(layer);
      const next: string[] = [];
      for (const id of layer) {
        remaining.delete(id);
        next.push(...this.release(dag, id, remaining));
      }
      layer = next.sort();
    }
    return out;
  }

  /** Decrement each open dependent of `id`; return the ones that just became unblocked. */
  private release(dag: Dag, id: string, remaining: Map<string, number>): string[] {
    const freed: string[] = [];
    for (const d of dag.dependents(id)) {
      const left = remaining.get(d);
      if (left !== undefined) {
        remaining.set(d, left - 1);
        if (left - 1 === 0) {
          freed.push(d);
        }
      }
    }
    return freed;
  }

  gatekeepers(dag: Dag): string[] {
    const open = new Set(this.state.open(dag));
    return [...open].filter((id) => dag.dependents(id).filter((d) => open.has(d)).length >= 2).sort();
  }

  workstreams(dag: Dag): Workstream[] {
    const open = new Set(this.state.open(dag));
    const gates = new Set(this.gatekeepers(dag));
    const members = [...open].filter((id) => !gates.has(id));
    const seen = new Set<string>();
    const streams: Workstream[] = [];
    for (const start of members.sort()) {
      if (!seen.has(start)) {
        const component = this.component(dag, start, (id) => open.has(id) && !gates.has(id));
        component.forEach((id) => seen.add(id));
        streams.push(new Workstream(component[0] ?? start, component));
      }
    }
    return streams.sort((a, b) => a.id.localeCompare(b.id));
  }

  /** Undirected connected component over blockers and dependents, restricted by `keep`. */
  private component(dag: Dag, start: string, keep: (id: string) => boolean): string[] {
    const out = new Set<string>([start]);
    const stack = [start];
    while (stack.length > 0) {
      const cur = stack.pop();
      if (cur === undefined) {
        break;
      }
      for (const n of [...dag.blockers(cur), ...dag.dependents(cur)]) {
        if (keep(n) && !out.has(n)) {
          out.add(n);
          stack.push(n);
        }
      }
    }
    return [...out].sort();
  }
}
