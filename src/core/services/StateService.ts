import type { Dag } from "../domain/Dag.ts";

/** The computed state of a task: a fold over `status` and the blockers' `status`, never stored. */
export type TaskState = "done" | "in-progress" | "blocked" | "ready";

export class StateService {
  stateOf(dag: Dag, id: string): TaskState {
    const task = dag.get(id);
    if (task.isDone()) {
      return "done";
    }
    if (task.isInProgress()) {
      return "in-progress";
    }
    return this.blockersDone(dag, id) ? "ready" : "blocked";
  }

  /** True when every blocker that exists in the graph is done. Dangling refs do not block. */
  blockersDone(dag: Dag, id: string): boolean {
    return dag.blockers(id).every((b) => dag.get(b).isDone());
  }

  /** Open tasks (not done) in the graph's own order. */
  open(dag: Dag): string[] {
    return dag.tasks.filter((t) => !t.isDone()).map((t) => t.id);
  }

  states(dag: Dag): Map<string, TaskState> {
    return new Map(dag.tasks.map((t) => [t.id, this.stateOf(dag, t.id)]));
  }
}
