import type { Analysis } from "../../core/services/Analysis.ts";
import { JsonSnapshotAdapter } from "../../adapters/output/JsonSnapshotAdapter.ts";
import { element } from "./Dom.ts";

/** Export the current captured dataset locally, including provenance but never credentials. */
export class ExportController {
  constructor(analysis: Analysis) {
    element("export-snapshot").addEventListener("click", () => { this.download(new JsonSnapshotAdapter().render(analysis)); });
  }
  private download(json: string): void {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "yalikedags-snapshot.json";
    link.click(); setTimeout(() => { URL.revokeObjectURL(url); }, 1000);
  }
}
