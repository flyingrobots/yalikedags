import { GroupControls } from "./GroupControls.ts";
import { Sidebars, SIDEBAR_PANELS } from "./Sidebars.ts";
import { createDockview, themeLight } from "dockview";
import type { DockviewApi } from "dockview";
import { element } from "./Dom.ts";
import { LayoutStorage, PANEL_TITLES } from "./LayoutStorage.ts";

/** Dockview hosts existing panel elements. Closing a panel does not discard selection or content. */
export class Workspace {
  readonly panels = new Map<string, HTMLElement>();
  private api: DockviewApi;
  private readonly storage = new LayoutStorage();
  private resetting = false;
  private readonly sidebars = new Sidebars();

  constructor(saved?: unknown) {
    for (const id of PANEL_TITLES.keys()) { this.panels.set(id, element(`${id}-panel`)); }
    this.api = this.createApi();
    this.size();
    if (!this.storage.restore(this.api, saved)) { this.reset(); }
    else { this.sidebars.migrate(this.api); }
  }

  private createApi(): DockviewApi {
    const api = createDockview(element("workspace"), {
      createRightHeaderActionComponent: (group) => new GroupControls(group, () => { if (!this.resetting) { this.storage.save(this.api); } }),
      createWatermarkComponent: () => {
        const host = document.createElement("div"); host.className = "empty-workspace";
        const reset = document.createElement("button");
        reset.textContent = "Reset layout"; reset.dataset["action"] = "reset";
        host.append(reset);
        return { element: host, init: (): void => { /* watermark content is static */ } };
      },
      theme: themeLight, disableFloatingGroups: true, defaultRenderer: "always",
      createComponent: ({ name }) => {
        const content = this.panels.get(name);
        if (content === undefined) { throw new Error(`Unknown panel: ${name}`); }
        const host = document.createElement("div");
        host.className = "panel-host";
        return { element: host, init: (): void => { host.append(content); } };
      },
    });
    api.onDidRemovePanel(() => { queueMicrotask(() => { if (this.api === api && !this.resetting) { this.sidebars.removeEmpty(api); } }); });
    api.onDidLayoutChange(() => { if (!this.resetting) { this.storage.save(api); } });
    return api;
  }

  private size(): void {
    const host = element("workspace");
    this.api.layout(host.clientWidth, host.clientHeight);
  }

  layout(): ReturnType<DockviewApi["toJSON"]> { return this.api.toJSON(); }

  show(id: string): void {
    const title = PANEL_TITLES.get(id);
    if (title === undefined) { return; }
    const existing = this.api.getPanel(id);
    if (existing !== undefined) { existing.api.setActive(); existing.group.api.expand(); return; }
    const group = SIDEBAR_PANELS.includes(id) ? this.sidebars.group(this.api) : undefined;
    this.api.addPanel({ id, component: id, title, ...(group && { position: { referenceGroup: group.id } }) });
  }

  reset(): void {
    this.resetting = true;
    this.api.dispose();
    this.api = this.createApi();
    this.size();
    this.api.addPanel({ id: "graph", component: "graph", title: "DAG" });
    this.api.addPanel({ id: "grid", component: "grid", title: "Wave grid", position: { referencePanel: "graph" } });
    this.api.addPanel({ id: "table", component: "table", title: "Task table", position: { referencePanel: "graph" } });
    const sidebar = this.sidebars.group(this.api);
    this.api.addPanel({ id: "details", component: "details", title: "Task details", position: { referenceGroup: sidebar.id } });
    this.api.addPanel({ id: "ready", component: "ready", title: "Ready work", position: { referencePanel: "details" } });
    this.api.addPanel({ id: "findings", component: "findings", title: "Findings", position: { referencePanel: "details" } });
    this.api.addPanel({ id: "changes", component: "changes", title: "Changes", position: { referencePanel: "details" } });
    this.api.getPanel("ready")?.api.setActive();
    this.api.getPanel("graph")?.api.setActive();
    this.resetting = false;
    this.storage.save(this.api);
  }
}
