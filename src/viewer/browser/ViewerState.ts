import { Dag } from "../../core/domain/Dag.ts";
import type { Task } from "../../core/domain/Task.ts";

/** Selection belongs to the workspace, not to any panel or its lifetime. */
export class ViewerState {
  readonly dag: Dag;
  selected: string | undefined;
  private readonly listeners = new Set<() => void>();

  constructor(tasks: readonly Task[]) { this.dag = new Dag(tasks); }

  select(id: string | undefined): void {
    if (id !== undefined && !this.dag.has(id)) { return; }
    this.selected = id;
    this.listeners.forEach((listener) => { listener(); });
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  search(query: string): Task[] {
    const needle = query.trim().toLocaleLowerCase();
    if (needle.length === 0) { return []; }
    return this.dag.tasks.filter((t) => `${t.key} ${t.title} ${t.assignee ?? ""}`.toLocaleLowerCase().includes(needle));
  }

  related(): Set<string> {
    const id = this.selected;
    return id === undefined ? new Set() : new Set([id, ...this.dag.ancestors(id), ...this.dag.descendants(id)]);
  }
}
