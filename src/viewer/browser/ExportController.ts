import type { Analysis } from "../../core/services/Analysis.ts";
import { JsonSnapshotAdapter } from "../../adapters/output/JsonSnapshotAdapter.ts";
import { StructureOnlyAnalysisAdapter } from "../../adapters/output/StructureOnlyAnalysisAdapter.ts";
import { element } from "./Dom.ts";

/** Export a separate copy; changing export scope never mutates the captured dataset. */
export class ExportController {
  constructor(analysis: Analysis) {
    element("export-content").addEventListener("change", () => { this.describe(); });
    element("export-snapshot").addEventListener("click", () => {
      const structure = this.structureOnly();
      const output = structure ? new StructureOnlyAnalysisAdapter().transform(analysis) : analysis;
      this.download(new JsonSnapshotAdapter().render(output), structure ? "yalikedags-structure.json" : "yalikedags-snapshot.json");
    });
    this.describe();
  }
  private structureOnly(): boolean {
    const choice = element("export-content");
    return choice instanceof HTMLSelectElement && choice.value === "structure";
  }
  private describe(): void {
    element("export-warning").textContent = this.structureOnly()
      ? "Removes issue text, original IDs, people, account metadata, dates, labels, and estimates. Keeps statuses and relationships. Graph shape and counts may still identify a project."
      : "Plaintext file: includes issue descriptions, people, account metadata, and project details present in this snapshot. Downloaded files remain on your device until you delete them.";
  }
  private download(json: string, filename: string): void {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = filename;
    link.click(); setTimeout(() => { URL.revokeObjectURL(url); }, 1000);
  }
}
