import type { Dag } from "../domain/Dag.ts";
import { PrerequisiteService } from "./PrerequisiteService.ts";

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
    if (task.status === "unknown" || new PrerequisiteService().unresolved(dag, id).length > 0) { return "unresolved"; }
    return this.blockersDone(dag, id) ? "ready" : "blocked";
  }

  /** Only completed prerequisites establish readiness; terminal cancellation is insufficient. */
  blockersDone(dag: Dag, id: string): boolean {
    return dag.get(id).blockedBy.every((b) => dag.has(b) && dag.get(b).satisfiesPrerequisite());
  }

  /** Open tasks (not done) in the graph's own order. */
  open(dag: Dag): string[] {
    return dag.tasks.filter((t) => !t.isDone()).map((t) => t.id);
  }

  states(dag: Dag): Map<string, TaskState> {
    return new Map(dag.tasks.map((t) => [t.id, this.stateOf(dag, t.id)]));
  }
}
