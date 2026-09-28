import type { DockviewGroupPanel, IHeaderActionsRenderer, IGroupHeaderProps } from "dockview";

import type { GroupActions } from "./GroupActions.ts";

/** Dockview group actions follow the group's live location and collapsed state. */
export class GroupControls implements IHeaderActionsRenderer {
  readonly element = document.createElement("div");
  private readonly popout = document.createElement("button");
  private readonly expand = document.createElement("button");
  private readonly collapse = document.createElement("button");
  private readonly subscriptions: { dispose(): void }[];

  constructor(private readonly group: DockviewGroupPanel, changed: () => void, actions: GroupActions) {
    this.element.className = "group-controls";
    this.element.append(this.collapse, this.expand, this.popout);
    this.popout.addEventListener("click", () => { actions.popout(group); });
    this.expand.addEventListener("click", () => { actions.maximize(group); });
    this.collapse.addEventListener("click", () => {
      if (group.api.isCollapsed()) { group.api.expand(); } else { group.api.collapse(); }
    });
    this.subscriptions = [group.api.onDidCollapsedChange(() => { queueMicrotask(() => { this.render(); changed(); }); }), group.api.onDidLocationChange(() => { this.render(); })];
  }

  init(params: IGroupHeaderProps): void {
    this.subscriptions.push(params.containerApi.onDidMaximizedGroupChange(() => { this.render(); }));
    queueMicrotask(() => { this.render(); });
  }
  dispose(): void { this.subscriptions.forEach((subscription) => { subscription.dispose(); }); }

  private render(): void {
    const detached = this.group.api.location.type === "popout";
    this.expand.disabled = detached;
    this.popout.hidden = detached;
    this.popout.textContent = "↗";
    this.popout.setAttribute("aria-label", "Pop out view");
    this.popout.disabled = !["http:", "https:"].includes(location.protocol);
    this.popout.title = this.popout.disabled ? "Pop out requires the local server; open this snapshot with serve." : "Pop out view";
    const expanded = this.group.api.isMaximized();
    this.expand.textContent = expanded ? "⊡" : "⛶";
    this.expand.setAttribute("aria-label", expanded ? "Restore view" : "Expand view");
    this.expand.title = expanded ? "Restore view" : "Expand view";
    this.collapse.hidden = this.group.api.location.type !== "edge";
    const label = this.group.api.isCollapsed() ? "Expand sidebar" : "Collapse sidebar";
    this.collapse.textContent = this.group.api.isCollapsed() ? "◂" : "▸";
    this.collapse.setAttribute("aria-label", label); this.collapse.title = label;
  }
}
