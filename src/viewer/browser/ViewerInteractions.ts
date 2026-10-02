import { element, isElement } from "./Dom.ts";
import type { Workspace } from "./Workspace.ts";
import type { GraphController } from "./GraphController.ts";

export class ViewerInteractions {
  constructor(workspace: Workspace, graph: GraphController) {
    const actions = new Map<string, () => void>([
      ["readable", (): void => { graph.readable(); }], ["fit", (): void => { graph.fit(); }], ["focus", (): void => { graph.focus(); }],
      ["zoom-in", (): void => { graph.zoom(1 / 1.25); }], ["zoom-out", (): void => { graph.zoom(1.25); }],
    ]);
    document.addEventListener("click", (event) => {
      if (!isElement(event.target)) { return; }
      const control = event.target.closest("button");
      const panel = control?.dataset["panel"];
      if (panel !== undefined) { workspace.show(panel); if (panel === "graph") { graph.reveal(); } }
      actions.get(control?.dataset["action"] ?? "")?.();
    });
    this.bindGraph(graph);
  }

  private bindGraph(graph: GraphController): void {
    element("graph-panel").addEventListener("keydown", (event) => {
      if (event.key === "Escape") { graph.reveal(); }
    });
  }
}
