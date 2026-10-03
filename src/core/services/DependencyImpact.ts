import type { Dag } from "../domain/Dag.ts";

/** Exact task sets behind the frontier's impact counts. */
export class DependencyImpact {
  immediate(dag: Dag, id: string): string[] {
    return dag.dependents(id).filter((next) => {
      const task = dag.get(next);
      return task.status === "open" && task.blockedBy.every((b) => b === id || (dag.has(b) && dag.get(b).satisfiesPrerequisite()));
    });
  }

  downstream(dag: Dag, id: string): string[] {
    return [...dag.descendants(id)].filter((next) => !dag.get(next).isDone());
  }
}
