import type { DockviewGroupPanel, IHeaderActionsRenderer } from "dockview";

/** Dockview group actions follow the group's live location and collapsed state. */
export class GroupControls implements IHeaderActionsRenderer {
  readonly element = document.createElement("div");
  private readonly collapse = document.createElement("button");
  private readonly subscriptions: { dispose(): void }[];

  constructor(private readonly group: DockviewGroupPanel, changed: () => void) {
    this.element.className = "group-controls";
    this.element.append(this.collapse);
    this.collapse.addEventListener("click", () => {
      if (group.api.isCollapsed()) { group.api.expand(); } else { group.api.collapse(); }
    });
    this.subscriptions = [group.api.onDidCollapsedChange(() => { queueMicrotask(() => { this.render(); changed(); }); }), group.api.onDidLocationChange(() => { this.render(); })];
  }

  init(): void { queueMicrotask(() => { this.render(); }); }
  dispose(): void { this.subscriptions.forEach((subscription) => { subscription.dispose(); }); }

  private render(): void {
    this.collapse.hidden = this.group.api.location.type !== "edge";
    const label = this.group.api.isCollapsed() ? "Expand sidebar" : "Collapse sidebar";
    this.collapse.textContent = this.group.api.isCollapsed() ? "◂" : "▸";
    this.collapse.setAttribute("aria-label", label); this.collapse.title = label;
  }
}
