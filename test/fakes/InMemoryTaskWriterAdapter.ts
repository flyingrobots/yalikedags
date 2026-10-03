import type { Task } from "../../src/core/domain/Task.ts";
import type { TaskWriterPort } from "../../src/ports/TaskWriterPort.ts";

/** Stateful deterministic tracker for relation proposal acceptance. Unsupported mutations fail loudly. */
export class InMemoryTaskWriterAdapter implements TaskWriterPort {
  tasks: readonly Task[];
  constructor(tasks: readonly Task[]) { this.tasks = [...tasks]; }
  describe(): string { return "in-memory relation tracker"; }
  addBlockingRelation(blocker: string, dependent: string): Promise<void> {
    this.tasks = this.tasks.map(task => task.id === dependent ? task.with({ blockedBy: [...new Set([...task.blockedBy, blocker])] }) : task);
    return Promise.resolve();
  }
  removeBlockingRelation(): Promise<void> { return Promise.reject(new Error("unsupported fixture mutation")); }
  setEstimate(): Promise<void> { return Promise.reject(new Error("unsupported fixture mutation")); }
  setMilestone(): Promise<void> { return Promise.reject(new Error("unsupported fixture mutation")); }
}
