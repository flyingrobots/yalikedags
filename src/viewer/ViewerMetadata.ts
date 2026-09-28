import type { Analysis } from "../core/services/Analysis.ts";
import type { SnapshotChange } from "../core/services/SnapshotChangesService.ts";
import { escapeXml as esc } from "../adapters/output/SvgRendererAdapter.ts";

export interface ViewerOptions { refresh?: boolean; changes?: readonly SnapshotChange[] }

export function viewerMetadata(a: Analysis, options: ViewerOptions): string {
  const missing = a.dag.tasks.reduce((sum, task) => sum + task.blockedBy.filter((id) => !a.dag.has(id)).length, 0);
  const unknown = a.dag.tasks.filter((task) => task.status === "unknown").length;
  const cycles = a.findings.filter((finding) => finding.kind === "cycle").length;
  const partial = missing + unknown + cycles + a.warnings.length > 0;
  const quality = partial ? `Partial analysis: ${String(missing)} unresolved dependency references · ${String(unknown)} unknown statuses · ${String(cycles)} cycles. Readiness and forecasts may be incomplete.` : "No unresolved dependencies or unknown statuses detected.";
  const captured = a.capturedAt === null ? "Capture time unknown" : `Captured ${esc(a.capturedAt)}`;
  return `<aside class="snapshot-status${partial ? " partial" : ""}"><span id="captured-at">${captured}</span>
    <span>${quality}</span>${a.warnings.length ? `<details><summary>${String(a.warnings.length)} source warnings</summary><ul>${a.warnings.map((warning) => `<li>${esc(warning)}</li>`).join("")}</ul></details>` : ""}
    <button id="refresh" ${options.refresh ? "" : 'disabled title="Offline export: regenerate from the source to refresh"'}>Refresh source</button>
    <span id="refresh-status" role="status">${options.refresh ? "Manual refresh · reads source only" : "Offline snapshot"}</span></aside>`;
}
