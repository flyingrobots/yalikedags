import { element } from "./Dom.ts";
import { ScrollMotion } from "./ScrollMotion.ts";
import type { ViewerState } from "./ViewerState.ts";
import type { Workspace } from "./Workspace.ts";
import type { GraphController } from "./GraphController.ts";

/** Follow selection across views, revealing its page without silently clearing filters. */
export class SelectionNavigation {
  private readonly scroll = new ScrollMotion();
  private frame = 0;
  private selected: string | undefined;
  constructor(private readonly state: ViewerState, private readonly workspace: Workspace, private readonly graph: GraphController) {
    state.subscribe(() => {
      if (this.selected === state.selected) { return; }
      this.selected = state.selected; this.schedule();
    });
    document.addEventListener("yalikedags:view", () => { this.schedule(); });
    for (const type of ["wheel", "pointerdown"]) { document.addEventListener(type, () => { cancelAnimationFrame(this.frame); }, { passive: true }); }
  }
  private schedule(): void {
    cancelAnimationFrame(this.frame); this.scroll.stop();
    this.frame = requestAnimationFrame(() => { this.frame = requestAnimationFrame(() => { this.reveal(); }); });
  }
  private reveal(): void {
    const id = this.state.selected;
    if (id === undefined) { return; }
    const view = this.workspace.layout().view;
    if (view === "graph") { this.graph.focus(); return; }
    const panel = element(`${view}-panel`);
    panel.dataset["revealTask"] = id; panel.dispatchEvent(new Event("yalikedags:reveal"));
    const candidates = panel.querySelectorAll<HTMLElement>(`[data-task="${CSS.escape(id)}"],[data-id="${CSS.escape(id)}"]`);
    for (const target of candidates) {
      if (target.hidden || target.closest("[hidden]") !== null) { continue; }
      for (let parent = target.parentElement; parent !== null && parent !== panel; parent = parent.parentElement) {
        if (parent instanceof HTMLDetailsElement) { parent.open = true; }
      }
      if (target.getClientRects().length > 0) { this.scroll.reveal(target); break; }
    }
  }
}
