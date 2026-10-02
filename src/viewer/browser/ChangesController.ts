import { paginateGroups } from "./ElementPagination.ts";
import { ChangesMarkup } from "../ChangesMarkup.ts";
import { JsonSnapshotRepositoryAdapter } from "../../adapters/input/JsonSnapshotRepositoryAdapter.ts";
import { Dag } from "../../core/domain/Dag.ts";
import { SnapshotChangesService } from "../../core/services/SnapshotChangesService.ts";
import { element } from "./Dom.ts";
import type { ViewerState } from "./ViewerState.ts";

export class ChangesController {
  private comparison = 0;
  private readonly list = element("changes-list");
  private readonly status = element("changes-status");
  constructor(private readonly state: ViewerState) {
    paginateGroups(this.list);
    const input = element("compare-snapshot");
    if (!(input instanceof HTMLInputElement)) { return; }
    input.addEventListener("change", () => { void this.compare(input.files?.[0]); });
  }

  private async compare(file: File | undefined): Promise<void> {
    const comparison = ++this.comparison;
    if (file === undefined) { return; }
    try {
      const repo = new JsonSnapshotRepositoryAdapter(await file.text(), file.name);
      const before = new Dag(await repo.load());
      if (comparison !== this.comparison) { return; }
      const changes = new SnapshotChangesService().compare(before, this.state.dag);
      this.list.innerHTML = new ChangesMarkup().render(changes, (id) => this.state.dag.has(id));
      paginateGroups(this.list);
      element("comparison-before").textContent = `${file.name} · ${repo.capturedAt ?? "Capture time unknown"}`;
      this.status.textContent = `${String(changes.length)} changes since ${repo.capturedAt ?? "an unknown capture time"} (${file.name}).`;
    } catch {
      if (comparison !== this.comparison) { return; }
      this.list.replaceChildren();
      element("comparison-before").textContent = `${file.name} · could not read snapshot`;
      this.status.textContent = "Could not compare: choose a valid yalikedags snapshot JSON file.";
    }
  }

}
