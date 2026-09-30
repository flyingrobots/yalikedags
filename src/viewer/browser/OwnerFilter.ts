import { ElementPagination } from "./ElementPagination.ts";
import type { Task } from "../../core/domain/Task.ts";
import type { Analysis } from "../../core/services/Analysis.ts";
import { element } from "./Dom.ts";

/** Local view filters use ids for known Linear users, never display-name equality for My work. */
export class OwnerFilter {
  private readonly readyPages: ElementPagination | undefined;
  private readonly unscheduledPages: ElementPagination | undefined;
  private readonly wavePages: ElementPagination | undefined;
  constructor(private readonly analysis: Analysis, private readonly scope: "ready" | "grid") {
    this.readyPages = scope === "ready" && analysis.frontier.length > 0 ? new ElementPagination([...element("frontier").querySelectorAll<HTMLElement>(":scope > li")], "Ready work", element("frontier")) : undefined;
    const table = document.getElementById("grid-table");
    this.wavePages = scope === "grid" && table !== null ? new ElementPagination([...table.querySelectorAll<HTMLElement>("tbody > tr")], "Workstreams", table) : undefined;
    this.unscheduledPages = this.unscheduled(scope);
    const select = element(`${scope}-owner`);
    if (!(select instanceof HTMLSelectElement)) { return; }
    const mine = new Option("My work (snapshot account)", "mine");
    mine.disabled = analysis.account === undefined || !analysis.dag.tasks.some((t) => t.assigneeId !== undefined);
    select.add(new Option("Everyone", "all")); select.add(mine); select.add(new Option("Unassigned", "unassigned"));
    const owners = new Map(analysis.dag.tasks.filter((t) => t.assignee !== undefined).map((t) => [t.assigneeId === undefined ? `name:${t.assignee ?? ""}` : `id:${t.assigneeId}`, t.assignee ?? "Unnamed owner"]));
    for (const [id, name] of owners) { select.add(new Option(name, id)); }
    select.addEventListener("change", () => { this.render(select.value); });
    element(`${scope}-owner-help`).textContent = analysis.account === undefined ? "" : `My work: ${analysis.account.user.name}`;
    this.render("all");
  }

  private unscheduled(scope: string): ElementPagination | undefined {
    const cards = [...document.querySelectorAll<HTMLElement>("#unscheduled > .card")];
    return scope === "grid" && cards[0] !== undefined ? new ElementPagination(cards, "Unscheduled tasks", cards[0]) : undefined;
  }

  private matches(task: Task, value: string): boolean {
    if (value === "all") { return true; }
    if (value === "unassigned") { return task.assignee === undefined && task.assigneeId === undefined; }
    if (value === "mine") { return task.assigneeId !== undefined && task.assigneeId === this.analysis.account?.user.id; }
    return value === (task.assigneeId === undefined ? `name:${task.assignee ?? ""}` : `id:${task.assigneeId}`);
  }

  private paginate(root: HTMLElement, matching: HTMLElement[]): void {
    this.readyPages?.set(matching);
    this.wavePages?.set([...root.querySelectorAll<HTMLElement>("tbody > tr")].filter((row) => row.querySelector(".card:not([hidden])") !== null));
    this.unscheduledPages?.set(matching.filter((card) => card.parentElement?.id === "unscheduled"));
  }

  private render(value: string): void {
    const root = element(this.scope === "ready" ? "frontier" : "grid-panel");
    let visible = 0;
    const matching: HTMLElement[] = [];
    for (const card of root.querySelectorAll<HTMLElement>(".card[data-id]")) {
      const task = this.analysis.dag.get(card.dataset["id"] ?? "");
      const show = this.matches(task, value);
      const target = this.scope === "ready" ? card.closest("li") : card;
      if (target instanceof HTMLElement) { target.hidden = !show; }
      if (show) { visible += 1; if (target instanceof HTMLElement) { matching.push(target); } }
    }
    this.paginate(root, matching);
    element(`${this.scope}-owner-count`).textContent = `${String(visible)} matching tasks${value === "all" ? "" : " · owner filter active"}`;
  }
}
