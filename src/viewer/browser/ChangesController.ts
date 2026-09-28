import { JsonSnapshotRepositoryAdapter } from "../../adapters/input/JsonSnapshotRepositoryAdapter.ts";
import { Dag } from "../../core/domain/Dag.ts";
import { SnapshotChangesService } from "../../core/services/SnapshotChangesService.ts";
import type { SnapshotChange } from "../../core/services/SnapshotChangesService.ts";
import { element, button } from "./Dom.ts";
import type { ViewerState } from "./ViewerState.ts";

export class ChangesController {
  private readonly list = element("changes-list");
  private readonly status = element("changes-status");
  constructor(private readonly state: ViewerState) {
    const input = element("compare-snapshot");
    if (!(input instanceof HTMLInputElement)) { return; }
    input.addEventListener("change", () => { void this.compare(input.files?.[0]); });
  }

  private async compare(file: File | undefined): Promise<void> {
    if (file === undefined) { return; }
    try {
      const repo = new JsonSnapshotRepositoryAdapter(await file.text(), file.name);
      const before = new Dag(await repo.load());
      const changes = new SnapshotChangesService().compare(before, this.state.dag);
      this.list.replaceChildren(...changes.map((change) => this.row(change)));
      this.status.textContent = `${String(changes.length)} changes since ${repo.capturedAt ?? "an unknown capture time"} (${file.name}).`;
    } catch {
      this.status.textContent = "Could not compare: choose a valid yalikedags snapshot JSON file.";
    }
  }

  private row(change: SnapshotChange): HTMLElement {
    const row = document.createElement("li");
    if (this.state.dag.has(change.task)) { row.append(button(change.key, change.task)); }
    else { row.append(document.createTextNode(change.key)); }
    row.append(document.createTextNode(` · ${change.kind}: ${change.detail}`));
    return row;
  }
}
