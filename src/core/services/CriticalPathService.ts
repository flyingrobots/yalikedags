import type { Dag } from "../domain/Dag.ts";

export class CriticalPath {
  constructor(
    /** Blockers first, the terminal task last. Empty when nothing is open. */
    readonly tasks: readonly string[],
    /** Node count for `byDepth`, summed weight for `byEffort`. */
    readonly length: number,
  ) {
    Object.freeze(this);
  }
}

/**
 * Longest chain through OPEN tasks. Two lengths are reported and both
 * matter: depth (how many hand-offs) and effort (how much work). There is no
 * float and no forward or backward pass: those are time machinery, and this
 * graph carries effort, not durations.
 */
export class CriticalPathService {
  byDepth(dag: Dag): CriticalPath {
    return this.longest(dag, () => 1);
  }

  byEffort(dag: Dag): CriticalPath {
    return this.longest(dag, (id) => dag.get(id).weight());
  }

  private longest(dag: Dag, weight: (id: string) => number): CriticalPath {
    const memo = new Map<string, CriticalPath>();
    const visiting = new Set<string>();
    const best = (id: string): CriticalPath => {
      const cached = memo.get(id);
      if (cached) {
        return cached;
      }
      if (visiting.has(id)) {
        return new CriticalPath([], 0); // cycle guard; the audit reports cycles
      }
      visiting.add(id);
      let result = new CriticalPath([id], weight(id));
      for (const b of dag.blockers(id).sort()) {
        if (!dag.get(b).isDone()) {
          const sub = best(b);
          if (sub.length + weight(id) > result.length) {
            result = new CriticalPath([...sub.tasks, id], sub.length + weight(id));
          }
        }
      }
      visiting.delete(id);
      memo.set(id, result);
      return result;
    };
    let top = new CriticalPath([], 0);
    // Stable traversal resolves equal-length candidates independently of source order.
    for (const id of dag.tasks.map((task) => task.id).sort()) {
      const t = dag.get(id);
      if (!t.isDone()) {
        const p = best(t.id);
        if (p.length > top.length) {
          top = p;
        }
      }
    }
    return top;
  }
}
