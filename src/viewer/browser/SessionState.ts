import { rec, str } from "../../adapters/linear/GraphqlJson.ts";
import type { ViewerState } from "./ViewerState.ts";
import type { Workspace } from "./Workspace.ts";

/** Only explicit refresh uses history state; ordinary exports remain independent. */
export class SessionState {
  private readonly saved = rec(history.state);

  restore(state: ViewerState): void {
    const controls = rec(this.saved["controls"]);
    document.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input[id],select[id]").forEach((control) => {
      const value = str(controls[control.id]);
      if (value !== undefined && control.type !== "file") {
        control.value = value; control.dispatchEvent(new Event(control instanceof HTMLSelectElement ? "change" : "input"));
      }
    });
    state.select(str(this.saved["selected"]));
    // The refresh handoff is consumed; subsequent reloads use the latest saved layout.
    history.replaceState(null, "");
  }

  layout(): unknown { return this.saved["layout"]; }

  save(state: ViewerState, workspace: Workspace): void {
    const roots = [document, ...workspace.panels.values()];
    const inputs = new Set(roots.flatMap((root) => Array.from(root.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input[id],select[id]"))));
    const controls = Object.fromEntries([...inputs]
      .filter((control) => control.type !== "file").map((control) => [control.id, control.value]));
    history.replaceState({ bannerHidden: document.getElementById("page-banner")?.hidden === true, selected: state.selected, controls, layout: workspace.layout() }, "");
  }
}
