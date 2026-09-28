import type { Task } from "../../core/domain/Task.ts";
import { StateService } from "../../core/services/StateService.ts";
import { TABLE_COLUMNS } from "../TaskTableMarkup.ts";
import { element, button } from "./Dom.ts";
import type { ViewerState } from "./ViewerState.ts";

export class TableController {
  private readonly panel = element("table-panel");
  private sort = "Key";
  private ascending = true;
  private readonly states = new StateService();
  private readonly filters = new Map<string, HTMLSelectElement>();
  private readonly query: HTMLInputElement;

  constructor(private readonly state: ViewerState) {
    const query = this.control("table-query");
    if (!(query instanceof HTMLInputElement)) { throw new Error("Missing table query"); }
    this.query = query;
    this.bindSort();
    for (const name of ["state", "assignee", "milestone", "label"]) { this.addFilter(name); }
    query.addEventListener("input", () => { this.render(); });
    this.control("clear-filters").addEventListener("click", () => {
      query.value = ""; this.filters.forEach((select) => { select.value = ""; }); this.render();
    });
    this.control("task-table").querySelectorAll<HTMLButtonElement>("[data-sort]").forEach((control) => {
      control.addEventListener("click", () => {
        const column = control.dataset["sort"] ?? "Key";
        this.ascending = column === this.sort ? !this.ascending : true;
        this.sort = column;
        const saved = this.control("table-sort");
        if (saved instanceof HTMLInputElement) { saved.value = `${column}:${this.ascending ? "asc" : "desc"}`; }
        this.render();
      });
    });
    state.subscribe(() => { this.highlight(); });
    this.render();
  }

  private control(id: string): HTMLElement {
    const found = this.panel.querySelector<HTMLElement>(`#${id}`);
    if (found === null) { throw new Error(`Missing table control ${id}`); }
    return found;
  }

  private bindSort(): void {
    const saved = this.control("table-sort");
    if (!(saved instanceof HTMLInputElement)) { return; }
    saved.addEventListener("input", () => {
      const [column, direction] = saved.value.split(":");
      if (column === undefined || !TABLE_COLUMNS.includes(column)) { return; }
      this.sort = column; this.ascending = direction !== "desc"; this.render();
    });
  }

  private addFilter(name: string): void {
    const select = this.control(`filter-${name}`);
    if (!(select instanceof HTMLSelectElement)) { throw new Error("Missing filter"); }
    const values = this.state.dag.tasks.flatMap((task) => this.values(task, name));
    select.add(new Option(`All ${name === "state" ? "states" : `${name}s`}`, ""));
    for (const value of [...new Set(values)].sort()) { select.add(new Option(value, value)); }
    select.addEventListener("change", () => { this.render(); });
    this.filters.set(name, select);
  }

  private values(task: Task, name: string): string[] {
    if (name === "state") { return [this.states.stateOf(this.state.dag, task.id)]; }
    if (name === "label") { return [...task.labels]; }
    return [name === "assignee" ? task.assignee ?? "Unassigned" : task.milestone ?? "No milestone"];
  }

  private matches(task: Task): boolean {
    const query = this.query.value.trim().toLocaleLowerCase();
    if (!`${task.key} ${task.title} ${task.assignee ?? ""}`.toLocaleLowerCase().includes(query)) { return false; }
    return [...this.filters].every(([name, select]) => !select.value || this.values(task, name).includes(select.value));
  }

  private value(task: Task, column: string): string | number | undefined {
    const values = new Map<string, string | number | undefined>([
      ["Key", task.key], ["Title", task.title], ["State", this.states.stateOf(this.state.dag, task.id)],
      ["Assignee", task.assignee], ["Priority", task.priority], ["Estimate", task.effort],
      ["Milestone", task.milestone], ["Due", task.due], ["Labels", task.labels.join(", ")],
    ]);
    return values.get(column);
  }

  private compare(a: Task, b: Task): number {
    const left = this.value(a, this.sort); const right = this.value(b, this.sort);
    if (left === undefined) { return right === undefined ? a.id.localeCompare(b.id) : 1; }
    if (right === undefined) { return -1; }
    const order = typeof left === "number" && typeof right === "number" ? left - right : String(left).localeCompare(String(right), undefined, { numeric: true });
    return order * (this.ascending ? 1 : -1) || a.id.localeCompare(b.id);
  }

  private render(): void {
    const table = this.control("task-table");
    const body = table.querySelector("tbody");
    const tasks = this.state.dag.tasks.filter((task) => this.matches(task)).sort((a, b) => this.compare(a, b));
    body?.replaceChildren(...tasks.map((task) => this.row(task)));
    for (const control of table.querySelectorAll<HTMLElement>("[data-sort]")) {
      control.parentElement?.setAttribute("aria-sort", control.dataset["sort"] === this.sort ? (this.ascending ? "ascending" : "descending") : "none");
    }
    this.control("table-count").textContent = `${String(tasks.length)} of ${String(this.state.dag.size)} tasks · Filters also highlight matches in the DAG and wave grid.`;
    const summary = element("filter-summary");
    summary.hidden = tasks.length === this.state.dag.size;
    summary.textContent = `Filters: ${String(tasks.length)}/${String(this.state.dag.size)} tasks · edit in Task table`;
    const ids = new Set(tasks.map((task) => task.id));
    document.querySelectorAll<HTMLElement | SVGElement>(".node,.card").forEach((node) => {
      node.classList.toggle("filtered-out", !ids.has(node.dataset["id"] ?? ""));
    });
    this.highlight();
  }

  private row(task: Task): HTMLTableRowElement {
    const row = document.createElement("tr"); row.dataset["id"] = task.id;
    for (const column of TABLE_COLUMNS) {
      const cell = row.insertCell();
      if (column === "Key") { const control = button(task.key, task.id); cell.append(control); }
      else { cell.textContent = String(this.value(task, column) ?? "—"); }
    }
    return row;
  }

  private highlight(): void {
    this.control("task-table").querySelectorAll<HTMLTableRowElement>("tbody tr").forEach((row) => {
      row.classList.toggle("selected", row.dataset["id"] === this.state.selected);
    });
  }
}
