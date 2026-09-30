import { element } from "./Dom.ts";
import { TABLE_COLUMNS } from "../TaskTableMarkup.ts";

const DEFAULT = ["Title", "State", "Assignee", "Priority"];
export class TableColumns {
  private visible = new Set(DEFAULT);
  constructor() {
    try {
      const raw: unknown = JSON.parse(localStorage.getItem("yalikedags.columns.v1") ?? "null");
      if (Array.isArray(raw) && raw.every((v): v is string => typeof v === "string" && TABLE_COLUMNS.includes(v))) { this.visible = new Set(["Title", ...raw]); }
    } catch { /* storage is optional */ }
    for (const input of element("table-columns").querySelectorAll<HTMLInputElement>("input")) {
      input.checked = this.visible.has(input.value);
      input.addEventListener("change", () => {
        if (input.checked) { this.visible.add(input.value); } else { this.visible.delete(input.value); }
        this.apply();
        try { localStorage.setItem("yalikedags.columns.v1", JSON.stringify([...this.visible])); } catch { /* storage is optional */ }
      });
    }
    this.apply();
  }
  apply(): void {
    element("task-table").querySelectorAll<HTMLElement>("[data-column]").forEach((cell) => { cell.hidden = !this.visible.has(cell.dataset["column"] ?? ""); });
  }
}
