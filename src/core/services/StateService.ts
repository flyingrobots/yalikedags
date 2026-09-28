import type { Dag } from "../domain/Dag.ts";

/** The computed state of a task: a fold over `status` and the blockers' `status`, never stored. */
export type TaskState = "done" | "in-progress" | "blocked" | "ready" | "unresolved";

export class StateService {
  stateOf(dag: Dag, id: string): TaskState {
    const task = dag.get(id);
    if (task.isDone()) {
      return "done";
    }
    if (task.isInProgress()) {
      return "in-progress";
    }
    if (task.status === "unknown" || task.blockedBy.some((b) => !dag.has(b) || dag.get(b).status === "unknown")) { return "unresolved"; }
    return this.blockersDone(dag, id) ? "ready" : "blocked";
  }

  /** Unknown or external blocker status cannot establish readiness. */
  blockersDone(dag: Dag, id: string): boolean {
    return dag.get(id).blockedBy.every((b) => dag.has(b) && dag.get(b).isDone());
  }

  /** Open tasks (not done) in the graph's own order. */
  open(dag: Dag): string[] {
    return dag.tasks.filter((t) => !t.isDone()).map((t) => t.id);
  }

  states(dag: Dag): Map<string, TaskState> {
    return new Map(dag.tasks.map((t) => [t.id, this.stateOf(dag, t.id)]));
  }
}
