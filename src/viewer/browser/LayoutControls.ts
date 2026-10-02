import { element } from "./Dom.ts";
import type { Workspace } from "./Workspace.ts";

export class LayoutControls {
  bind(workspace: Workspace): void {
    document.querySelector(".brand")?.addEventListener("click", (event) => { event.preventDefault(); workspace.show("ready"); });
    element("toggle-details").addEventListener("click", () => { workspace.toggleDetails(); });
  }
}
