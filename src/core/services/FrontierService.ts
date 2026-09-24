import type { Dag } from "../domain/Dag.ts";
import type { Task } from "../domain/Task.ts";
import type { ResourcePolicy } from "../domain/ResourcePolicy.ts";
import type { ClockPort } from "../../ports/ClockPort.ts";
import { StateService } from "./StateService.ts";

/** Undated tasks sort after every dated one. */
export const UNDATED = 9999;
const DAY_MS = 86_400_000;

export class FrontierEntry {
  constructor(
    readonly task: Task,
    /** Days from the clock's today until `due`; UNDATED when there is no due date. */
    readonly daysUntilDue: number,
    /** How many open tasks this one transitively unblocks. */
    readonly unlocks: number,
  ) {
    Object.freeze(this);
  }
}

/**
 * The frontier is the ready antichain ordered for scheduling: hard-date
 * urgency first, then priority (1 is most urgent, unset sorts last), then
 * fan-out (how many tasks it unblocks), then age, then id. Priority never
 * overrides an edge; it only orders tasks that are all ready.
 */
export class FrontierService {
  private readonly state = new StateService();

  constructor(private readonly clock: ClockPort) {}

  frontier(dag: Dag): FrontierEntry[] {
    const today = Date.parse(`${this.clock.today()}T00:00:00Z`);
    const entries = dag.tasks
      .filter((t) => this.state.stateOf(dag, t.id) === "ready")
      .map((t) => new FrontierEntry(t, this.daysUntil(today, t.due), this.openDescendants(dag, t.id)));
    return entries.sort((a, b) => this.compare(a, b));
  }

  /** Ready tasks that contend for a resource the policy does not allow them to share. */
  resourceConflicts(dag: Dag, policy: ResourcePolicy): Map<string, string[]> {
    const holders = new Map<string, string[]>();
    for (const entry of this.frontier(dag)) {
      for (const r of entry.task.resources) {
        holders.set(r, [...(holders.get(r) ?? []), entry.task.id]);
      }
    }
    const out = new Map<string, string[]>();
    for (const [resource, tasks] of holders) {
      const message = policy.conflict(resource, tasks.length);
      if (message !== undefined) {
        for (const id of tasks) {
          out.set(id, [...(out.get(id) ?? []), message]);
        }
      }
    }
    return out;
  }

  private openDescendants(dag: Dag, id: string): number {
    let n = 0;
    for (const d of dag.descendants(id)) {
      if (!dag.get(d).isDone()) {
        n += 1;
      }
    }
    return n;
  }

  private daysUntil(todayMs: number, due: string | undefined): number {
    if (due === undefined) {
      return UNDATED;
    }
    return Math.round((Date.parse(`${due}T00:00:00Z`) - todayMs) / DAY_MS);
  }

  private compare(a: FrontierEntry, b: FrontierEntry): number {
    return (
      a.daysUntilDue - b.daysUntilDue ||
      (a.task.priority ?? 5) - (b.task.priority ?? 5) ||
      b.unlocks - a.unlocks ||
      (a.task.createdAt ?? "").localeCompare(b.task.createdAt ?? "") ||
      a.task.id.localeCompare(b.task.id)
    );
  }
}
