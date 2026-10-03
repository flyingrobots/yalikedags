import type { Dag } from "../domain/Dag.ts";

/** Unresolved prerequisite evidence through unfinished work; completed outputs end traversal. */
export class PrerequisiteService {
  unresolved(dag: Dag, id: string): string[] {
    const pending = [...dag.get(id).blockedBy];
    const seen = new Set<string>([id]);
    const unresolved = new Set<string>();
    while (pending.length > 0) {
      const next = pending.pop();
      if (next === undefined || seen.has(next)) { continue; }
      seen.add(next);
      if (!dag.has(next)) { unresolved.add(next); continue; }
      const task = dag.get(next);
      if (task.satisfiesPrerequisite()) { continue; }
      if (task.isCanceled() || task.status === "unknown") { unresolved.add(next); }
      pending.push(...task.blockedBy);
    }
    return [...unresolved].sort();
  }
}
