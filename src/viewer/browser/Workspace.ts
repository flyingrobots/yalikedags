import { VIEW_ROUTES } from "../ViewRoutes.ts";
import { revealDrawer, stopDrawer } from "./DrawerMotion.ts";
import { element } from "./Dom.ts";
import { rec, str } from "../../adapters/linear/GraphqlJson.ts";

const VIEWS = new Map([
  ["ready", "Start here"],
  ["graph", "Dependencies"],
  ["grid", "Waves"],
  ["table", "Tasks"],
  ["findings", "Findings"],
  ["changes", "Import/Export"],
]);

/** One primary view with an on-demand inspector. Storage holds only the view name. */
export class Workspace {
  readonly panels = new Map<string, HTMLElement>();
  private active = "ready";

  constructor(saved?: unknown) {
    for (const id of [...VIEWS.keys(), "details"]) {
      const panel = element(`${id}-panel`);
      this.panels.set(id, panel);
      element(id === "details" ? "inspector" : "view-content").append(panel);
    }
    let initial = str(rec(saved)["view"]);
    try { initial ??= localStorage.getItem("yalikedags.view.v2") ?? undefined; } catch { /* storage is optional */ }
    this.show(this.route() ?? (initial !== undefined && VIEWS.has(initial) ? initial : "ready"), false);
    window.addEventListener("popstate", () => { this.show(this.route() ?? "ready", false); });
  }

  private route(): string | undefined {
    const path = location.protocol === "file:" ? location.hash.slice(1) : location.pathname;
    return [...VIEW_ROUTES].find(([, slug]) => slug === path)?.[0];
  }

  private navigate(id: string, push: boolean): void {
    const slug = VIEW_ROUTES.get(id);
    if (slug !== undefined) {
      const target = location.protocol === "file:" ? `#${slug}` : slug;
      const current = location.protocol === "file:" ? location.hash : location.pathname;
      if (current !== target) { if (push) { history.pushState(null, "", target); } else { history.replaceState(history.state, "", target); } }
    }
  }

  show(id: string, push = true): void {
    if (id === "details") {
      const panel = element("inspector"); const opening = panel.hidden;
      panel.hidden = false;
      if (opening) { revealDrawer(panel); }
      element("toggle-details").setAttribute("aria-expanded", "true");
      element("details-panel").hidden = false;
      return;
    }
    if (!VIEWS.has(id)) { return; }
    this.navigate(id, push);
    this.active = id;
    for (const [key, panel] of this.panels) {
      if (key !== "details") { panel.hidden = key !== id; }
    }
    document.querySelectorAll<HTMLButtonElement>(".primary-nav [data-panel]").forEach((button) => {
      button.setAttribute("aria-current", button.dataset["panel"] === id ? "page" : "false");
    });
    element("view-title").textContent = VIEWS.get(id) ?? "";
    document.dispatchEvent(new Event("yalikedags:view"));
    try { localStorage.setItem("yalikedags.view.v2", id); } catch { /* storage is optional */ }
  }

  closeDetails(): void { stopDrawer(element("inspector")); element("inspector").hidden = true; element("toggle-details").setAttribute("aria-expanded", "false"); }
  toggleDetails(): void { if (element("inspector").hidden) { this.show("details"); } else { this.closeDetails(); } }
  layout(): { view: string } { return { view: this.active }; }
  reset(): void { this.closeDetails(); this.show("ready"); }
}
