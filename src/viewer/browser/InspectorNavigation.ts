import { element } from "./Dom.ts";
import type { ViewerState } from "./ViewerState.ts";
import type { Workspace } from "./Workspace.ts";
import type { GraphController } from "./GraphController.ts";

/** Link traversal reveals the graph; closing returns keyboard focus to a usable origin. */
export class InspectorNavigation {
  private origin: HTMLElement | SVGElement | undefined;
  constructor(state: ViewerState, workspace: Workspace, graph: GraphController) {
    document.addEventListener("click", (event) => {
      if (!(event.target instanceof Element)) { return; }
      const target = event.target.closest("[data-task],.node[data-id]");
      if (target !== null && !event.composedPath().includes(element("inspector")) && (target instanceof HTMLElement || target instanceof SVGElement)) { this.origin = target; }
      if (event.target.closest("[data-inspect-graph]") !== null) {
        workspace.show("graph"); graph.focus();
      }
    });
    state.subscribe(() => {
      element("toggle-details").hidden = state.selected === undefined;
      if (state.selected !== undefined) { workspace.show("details"); return; }
      const needsFocus = element("inspector").contains(document.activeElement);
      workspace.closeDetails();
      if (needsFocus) { this.returnFocus(); }
    });
    element("close-details").addEventListener("click", () => { state.select(undefined); });
  }

  private returnFocus(): void {
    if (this.origin?.isConnected && this.origin.getClientRects().length) { this.origin.focus(); return; }
    document.querySelector<HTMLElement>('.primary-nav [aria-current="page"]')?.focus();
  }
}
