import { paginateGroups } from "./ElementPagination.ts";
import { ChangesMarkup } from "../ChangesMarkup.ts";
import { SnapshotBudget } from "../../adapters/input/SnapshotBudget.ts";
import { ComparisonWorker } from "./ComparisonWorker.ts";
import { element } from "./Dom.ts";
import type { ViewerState } from "./ViewerState.ts";

export class ChangesController {
  private comparison = 0;
  private readonly worker = new ComparisonWorker();
  private readonly list = element("changes-list");
  private readonly status = element("changes-status");
  private readonly cancel = element("cancel-comparison");
  constructor(private readonly state: ViewerState) {
    paginateGroups(this.list);
    this.cancel.addEventListener("click", () => { this.worker.cancel(); });
    const input = element("compare-snapshot");
    if (!(input instanceof HTMLInputElement)) { return; }
    input.addEventListener("change", () => { void this.compare(input.files?.[0]); });
  }

  private async compare(file: File | undefined): Promise<void> {
    const comparison = ++this.comparison;
    this.worker.cancel(); this.cancel.hidden = true;
    if (file === undefined) { this.status.textContent = "No comparison file selected."; return; }
    try {
      if (file.size > SnapshotBudget.bytes) { throw new Error("snapshot_limit: maximum file size is 8 MiB"); }
      this.cancel.hidden = false;
      this.status.textContent = "Comparing locally… Current snapshot remains available.";
      const current = JSON.stringify({ schema: "yalikedags/snapshot/2", tasks: this.state.dag.tasks });
      const result = await this.worker.run(file, current);
      if (comparison !== this.comparison) { return; }
      this.list.innerHTML = new ChangesMarkup().render(result.changes, (id) => this.state.dag.has(id));
      paginateGroups(this.list);
      element("comparison-before").textContent = `${file.name} · ${result.capturedAt ?? "Capture time unknown"}`;
      this.status.textContent = `${String(result.changes.length)} changes since ${result.capturedAt ?? "an unknown capture time"} (${file.name}).`;
    } catch (error) {
      if (comparison !== this.comparison) { return; }
      this.list.replaceChildren();
      element("comparison-before").textContent = `${file.name} · could not read snapshot`;
      this.status.textContent = `Could not compare: ${error instanceof Error ? error.message : "choose a valid snapshot JSON file."}`;
    } finally { if (comparison === this.comparison) { this.cancel.hidden = true; } }
  }
}
