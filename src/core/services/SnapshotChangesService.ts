import type { Task } from "../domain/Task.ts";
import type { Dag } from "../domain/Dag.ts";
import { CriticalPathService } from "./CriticalPathService.ts";

export interface SnapshotChange { kind: string; task: string; key: string; detail: string }

/** Stable-id comparison. Removed tasks remain readable even though they cannot be selected. */
export class SnapshotChangesService {
  compare(before: Dag, after: Dag): SnapshotChange[] {
    const out: SnapshotChange[] = [];
    for (const task of after.tasks) {
      if (!before.has(task.id)) { out.push({ kind: "added", task: task.id, key: task.key, detail: task.title }); continue; }
      const old = before.get(task.id);
      if (!old.isDone() && task.isDone()) { out.push({ kind: "completed", task: task.id, key: task.key, detail: `${old.status} → ${task.status}` }); }
      if (old.status !== task.status && !task.isDone()) { out.push({ kind: "status", task: task.id, key: task.key, detail: `${old.status} → ${task.status}` }); }
      out.push(...this.blockers(old, task, { before, after }));
    }
    for (const task of before.tasks.filter((t) => !after.has(t.id))) { out.push({ kind: "removed", task: task.id, key: task.key, detail: task.title }); }
    return [...out, ...this.paths(before, after)];
  }

  private blockers(old: Task, task: Task, graphs: { before: Dag; after: Dag }): SnapshotChange[] {
    const added = task.blockedBy.filter((id) => !old.blockedBy.includes(id)).map((id) => ({
      kind: "blocker added", task: task.id, key: task.key, detail: graphs.after.has(id) ? graphs.after.get(id).key : id,
    }));
    const removed = old.blockedBy.filter((id) => !task.blockedBy.includes(id)).map((id) => ({
      kind: "blocker removed", task: task.id, key: task.key, detail: graphs.before.has(id) ? graphs.before.get(id).key : id,
    }));
    return [...added, ...removed];
  }

  private paths(before: Dag, after: Dag): SnapshotChange[] {
    const service = new CriticalPathService();
    const old = [service.byDepth(before).tasks, service.byEffort(before).tasks];
    const current = [service.byDepth(after).tasks, service.byEffort(after).tasks];
    return current.flatMap((path, i) => JSON.stringify(path) === JSON.stringify(old[i]) ? [] : [{
      kind: i === 0 ? "critical chain by depth" : "critical chain by effort", task: "", key: "Project",
      detail: `${(old[i] ?? []).map((id) => before.get(id).key).join(" → ") || "none"} → [${path.map((id) => after.get(id).key).join(" → ") || "none"}]`,
    }]);
  }
}
