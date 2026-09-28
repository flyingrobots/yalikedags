import { Orientation } from "dockview";
import type { DockviewApi } from "dockview";
import { isRec, list, rec, str, num } from "../../adapters/linear/GraphqlJson.ts";

type Layout = ReturnType<DockviewApi["toJSON"]>;
type GridNode = Layout["grid"]["root"];
export const PANEL_TITLES = new Map([
  ["graph", "DAG"], ["table", "Task table"], ["changes", "Changes"], ["grid", "Wave grid"], ["details", "Task details"], ["ready", "Ready work"], ["findings", "Findings"],
]);

/** Untrusted local storage is decoded into a bounded, docked-only layout. No URLs or task data. */
export class LayoutStorage {
  private readonly key = "yalikedags.layout.v1";

  save(api: DockviewApi): void {
    try { localStorage.setItem(this.key, JSON.stringify(api.toJSON())); } catch { /* file URLs and private mode may deny storage */ }
  }

  restore(api: DockviewApi, saved?: unknown): boolean {
    try {
      const raw: unknown = saved ?? JSON.parse(localStorage.getItem(this.key) ?? "null");
      const layout = this.decode(raw);
      if (layout === undefined) { return false; }
      api.fromJSON(layout);
      return true;
    } catch { return false; }
  }

  private decode(raw: unknown): Layout | undefined {
    if (!isRec(raw)) { return undefined; }
    const grid = rec(raw["grid"]);
    const ids = new Set<string>();
    const root = this.node(grid["root"], ids, 0);
    if (root === undefined) { return undefined; }
    const panels = Object.fromEntries([...ids].map((id) => [id, { id, contentComponent: id, title: PANEL_TITLES.get(id) ?? id }]));
    const orientation = grid["orientation"] === Orientation.VERTICAL ? Orientation.VERTICAL : Orientation.HORIZONTAL;
    return { grid: { root, width: this.size(grid["width"]), height: this.size(grid["height"]), orientation }, panels };
  }

  private node(raw: unknown, ids: Set<string>, depth: number): GridNode | undefined {
    if (!isRec(raw) || depth > 10) { return undefined; }
    const size = this.size(raw["size"]);
    if (raw["type"] === "branch") {
      const children = list(raw["data"]);
      if (children.length > PANEL_TITLES.size) { return undefined; }
      const decoded = children.map((child) => this.node(child, ids, depth + 1));
      if (decoded.some((child) => child === undefined)) { return undefined; }
      return { type: "branch", size, data: decoded.filter((child) => child !== undefined) };
    }
    if (raw["type"] !== "leaf") { return undefined; }
    return this.leaf(raw, ids);
  }

  private leaf(raw: Record<string, unknown>, ids: Set<string>): GridNode | undefined {
    const data = rec(raw["data"]);
    const views = list(data["views"]);
    if (!views.every((id): id is string => typeof id === "string" && PANEL_TITLES.has(id))) { return undefined; }
    if (views.length === 0 || views.some((id) => ids.has(id))) { return undefined; }
    views.forEach((id) => ids.add(id));
    const activeView = str(data["activeView"]) ?? views[0] ?? "graph";
    return { type: "leaf", size: this.size(raw["size"]), data: {
      id: str(data["id"]) ?? views.join("-"), views, activeView: views.includes(activeView) ? activeView : (views[0] ?? "graph"),
    } };
  }

  private size(value: unknown): number {
    const n = num(value);
    return n !== undefined && Number.isFinite(n) && n > 0 ? Math.min(n, 10000) : 500;
  }
}
