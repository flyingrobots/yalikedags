import type { DockviewApi, DockviewGroupPanel } from "dockview";
import { element } from "./Dom.ts";
import { Sidebars } from "./Sidebars.ts";

/** Pop out the active tab; the parent continues to own its state and listeners. */
export class PopoutActions {
  constructor(private readonly current: () => DockviewApi) {}

  async open(group: DockviewGroupPanel): Promise<void> {
    const api = this.current();
    const panel = group.activePanel;
    if (panel === undefined) { return; }
    const sidebar = group.api.location.type === "edge";
    if (sidebar) { panel.api.moveTo({ group: api.addGroup({ direction: "right" }) }); }
    const restore = (): void => {
      if (sidebar && this.current() === api && api.getPanel(panel.id) !== undefined) {
        panel.api.moveTo({ group: new Sidebars().group(api) });
      }
    };
    try {
      const opened = await api.addPopoutGroup(panel, {
        popoutUrl: "/popout.html",
        onWillClose: () => { queueMicrotask(restore); },
      });
      if (opened) { return; }
    } catch { /* Leave the view usable when the browser denies a window. */ }
    restore();
    const notice = element("viewer-notice");
    notice.hidden = false;
    notice.textContent = "Could not open the view. Allow pop-ups for this local viewer and try again.";
  }
}
