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

  constructor() {
    for (const id of PANEL_TITLES.keys()) { this.panels.set(id, element(`${id}-panel`)); }
    this.api = this.createApi();
    this.size();
    if (!this.storage.restore(this.api)) { this.reset(); }
  }

  private createApi(): DockviewApi {
    const api = createDockview(element("workspace"), {
      theme: themeLight, disableFloatingGroups: true, defaultRenderer: "always",
      createComponent: ({ name }) => {
        const content = this.panels.get(name);
        if (content === undefined) { throw new Error(`Unknown panel: ${name}`); }
        const host = document.createElement("div");
        host.className = "panel-host";
        return { element: host, init: (): void => { host.append(content); } };
      },
    });
    api.onDidLayoutChange(() => { if (!this.resetting) { this.storage.save(api); } });
    return api;
  }

  private size(): void {
    const host = element("workspace");
    this.api.layout(host.clientWidth, host.clientHeight);
  }

  show(id: string): void {
    const title = PANEL_TITLES.get(id);
    if (title === undefined) { return; }
    const existing = this.api.getPanel(id);
    if (existing !== undefined) { existing.api.setActive(); return; }
    this.api.addPanel({ id, component: id, title });
  }

  split(): void {
    this.show("graph"); this.show("grid");
    const graph = this.api.getPanel("graph");
    if (graph === undefined) { return; }
    this.api.getPanel("grid")?.api.moveTo({ group: graph.group, position: "bottom" });
  }

  reset(): void {
    this.resetting = true;
    this.api.dispose();
    this.api = this.createApi();
    this.size();
    this.api.addPanel({ id: "graph", component: "graph", title: "DAG" });
    this.api.addPanel({ id: "grid", component: "grid", title: "Wave grid", position: { referencePanel: "graph" } });
    const direction = window.innerWidth < 800 ? "within" : "right";
    this.api.addPanel({ id: "details", component: "details", title: "Task details", initialWidth: 340, position: { referencePanel: "graph", direction } });
    this.api.addPanel({ id: "ready", component: "ready", title: "Ready work", position: { referencePanel: "details" } });
    this.api.addPanel({ id: "findings", component: "findings", title: "Findings", position: { referencePanel: "details" } });
    this.api.getPanel("ready")?.api.setActive();
    this.api.getPanel("graph")?.api.setActive();
    this.resetting = false;
    this.storage.save(this.api);
  }
}
