import { DockviewGroupPanel } from "dockview";
import type { DockviewApi } from "dockview";

export const SIDEBAR_PANELS = ["details", "ready", "findings", "changes"];
export const EDGES: readonly ("left" | "right" | "top" | "bottom")[] = ["left", "right", "top", "bottom"];

export class Sidebars {
  group(api: DockviewApi): DockviewGroupPanel {
    const side = window.innerWidth < 800 ? "bottom" : "right";
    const edge = api.getEdgeGroup(side) ?? api.addEdgeGroup(side, { id: "sidebar", initialSize: side === "bottom" ? 220 : 340, minimumSize: 150 });
    const group = api.getGroup(edge.id);
    if (!(group instanceof DockviewGroupPanel)) { throw new Error("Sidebar group was not created"); }
    return group;
  }

  /** Upgrade an older, separate inspector group without moving mixed/main-view groups. */
  migrate(api: DockviewApi): void {
    const groups = api.groups.filter((group) => group.api.location.type === "grid" && group.panels.length > 0 && group.panels.every((panel) => SIDEBAR_PANELS.includes(panel.id)));
    if (groups.length === 0) { return; }
    const target = this.group(api);
    for (const group of groups) {
      const active = group.activePanel;
      for (const panel of [...group.panels]) { panel.api.moveTo({ group: target }); }
      active?.api.setActive();
    }
  }

  removeEmpty(api: DockviewApi): void {
    for (const edge of EDGES) {
      const group = api.getEdgeGroup(edge);
      if (group !== undefined && api.getGroup(group.id)?.size === 0) { api.removeEdgeGroup(edge); }
    }
  }
}
