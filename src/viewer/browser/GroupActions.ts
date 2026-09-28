import type { DockviewApi, DockviewGroupPanel } from "dockview";
import { Sidebars } from "./Sidebars.ts";

/** A sidebar panel temporarily joins the main grid while maximized. */
export class GroupActions {
  private expandedSidebar: string | undefined;
  constructor(private readonly current: () => DockviewApi) {}

  maximize(group: DockviewGroupPanel): void {
    const api = this.current();
    if (api.hasMaximizedGroup()) { api.exitMaximizedGroup(); this.restoreSidebar(); return; }
    const panel = group.activePanel;
    if (panel === undefined) { return; }
    if (group.api.location.type === "edge") {
      this.expandedSidebar = panel.id;
      panel.api.moveTo({ group: api.addGroup({ direction: "right" }) });
    }
    panel.api.maximize();
  }

  restoreSidebar(): void {
    const api = this.current();
    if (api.hasMaximizedGroup() || this.expandedSidebar === undefined) { return; }
    const panel = api.getPanel(this.expandedSidebar);
    this.expandedSidebar = undefined;
    if (panel !== undefined) { panel.api.moveTo({ group: new Sidebars().group(api) }); }
  }
}
