import type { Analysis } from "../../core/services/Analysis.ts";
import type { Task } from "../../core/domain/Task.ts";
import type { ViewerState } from "./ViewerState.ts";
import type { GraphNeighborhood } from "./GraphNeighborhood.ts";
import { element } from "./Dom.ts";

/** Filter the full dataset before laying out the induced graph; source task states stay intact. */
export class GraphFilters {
  private readonly owner: HTMLSelectElement;
  private readonly status: HTMLSelectElement;
  private ids: Set<string>;
  constructor(private readonly analysis: Analysis, state: ViewerState, private readonly neighborhood: GraphNeighborhood) {
    const owner = element("graph-owner"); const status = element("graph-status");
    if (!(owner instanceof HTMLSelectElement) || !(status instanceof HTMLSelectElement)) { throw new Error("Missing graph filters"); }
    this.owner = owner; this.status = status; this.ids = new Set(analysis.dag.tasks.map((t) => t.id));
    const mine = new Option("My tasks", "mine"); mine.disabled = analysis.account === undefined;
    owner.add(new Option("Everyone", "all")); owner.add(mine); owner.add(new Option("Unassigned", "unassigned"));
    owner.addEventListener("change", () => { this.apply(); }); status.addEventListener("change", () => { this.apply(); });
    element("graph-clear-filters").addEventListener("click", () => { this.clear(); });
    this.apply();
    state.subscribe(() => { if (state.selected !== undefined && !this.ids.has(state.selected)) { this.clear(); } });
  }
  private clear(): void { this.owner.value = "all"; this.status.value = "all"; this.apply(); }
  private matches(task: Task): boolean {
    const owner = this.owner.value;
    if (owner === "mine" && (task.assigneeId === undefined || task.assigneeId !== this.analysis.account?.user.id)) { return false; }
    if (owner === "unassigned" && (task.assigneeId !== undefined || task.assignee !== undefined)) { return false; }
    if (this.status.value === "open") { return !task.isDone(); }
    return this.status.value === "all" || this.analysis.stateOf(task.id) === this.status.value;
  }
  private apply(): void {
    this.ids = new Set(this.analysis.dag.tasks.filter((task) => this.matches(task)).map((task) => task.id));
    this.neighborhood.filter(this.ids);
    element("graph-filter-status").textContent = `${String(this.ids.size)} of ${String(this.analysis.dag.size)} tasks · connections shown between matching tasks`;
  }
}
