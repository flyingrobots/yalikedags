import { element } from "./Dom.ts";
import type { ViewerState } from "./ViewerState.ts";

export class SelectionController {
  private readonly detail = element("detail");
  private readonly templates = new Map(Array.from(document.querySelectorAll<HTMLTemplateElement>("template[data-detail]"), (t) => [t.dataset["detail"], t]));

  constructor(private readonly state: ViewerState, private readonly panels: readonly HTMLElement[]) {
    state.subscribe(() => { this.render(); });
    for (const panel of panels) { this.bind(panel); }
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") { state.select(undefined); }
    });
  }

  private bind(panel: HTMLElement): void {
    panel.addEventListener("click", (event) => {
      if (!(event.target instanceof Element)) { return; }
      const node = event.target.closest("[data-task],.node[data-id]");
      const id = node?.getAttribute("data-task") ?? node?.getAttribute("data-id");
      if (id) { this.state.select(id); }
    });
    panel.addEventListener("keydown", (event) => {
      if (!(event.target instanceof SVGElement) || !["Enter", " "].includes(event.key)) { return; }
      event.preventDefault();
      this.state.select(event.target.getAttribute("data-id") ?? undefined);
    });
  }

  private render(): void {
    const related = this.state.related();
    for (const panel of this.panels) {
      for (const node of panel.querySelectorAll(".node,.card")) {
        const id = node.getAttribute("data-id") ?? "";
        node.classList.toggle("selected", id === this.state.selected);
        node.classList.toggle("dim", this.state.selected !== undefined && !related.has(id));
        node.setAttribute("aria-pressed", String(id === this.state.selected));
      }
      this.highlightEdges(panel);
    }
    this.renderDetail();
  }

  private highlightEdges(panel: HTMLElement): void {
    const id = this.state.selected;
    const ancestors = new Set<string>();
    const descendants = new Set<string>();
    if (id !== undefined) {
      ancestors.add(id); descendants.add(id);
      this.state.dag.ancestors(id).forEach((n) => ancestors.add(n));
      this.state.dag.descendants(id).forEach((n) => descendants.add(n));
    }
    for (const edge of panel.querySelectorAll(".edge")) {
      const from = edge.getAttribute("data-from") ?? "";
      const to = edge.getAttribute("data-to") ?? "";
      const keep = (ancestors.has(from) && ancestors.has(to)) || (descendants.has(from) && descendants.has(to));
      edge.classList.toggle("dim", id !== undefined && !keep);
    }
  }

  private renderDetail(): void {
    const template = this.templates.get(this.state.selected);
    if (template === undefined) {
      this.detail.textContent = "Select a task to see its details and dependencies.";
      element("selection-status").textContent = "Select a task to trace its dependencies.";
      return;
    }
    this.detail.replaceChildren(template.content.cloneNode(true));
    const task = this.state.dag.get(this.state.selected ?? "");
    element("selection-status").textContent = `${task.key} · ${task.title}`;
  }
}
