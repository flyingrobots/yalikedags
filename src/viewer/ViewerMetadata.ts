import type { Analysis } from "../core/services/Analysis.ts";
import type { SnapshotChange } from "../core/services/SnapshotChangesService.ts";
import { escapeXml as esc } from "../adapters/output/SvgRendererAdapter.ts";

export interface ViewerOptions { refresh?: boolean; changes?: readonly SnapshotChange[]; previous?: { source: string; capturedAt: string | null } }

export function viewerMetadata(a: Analysis, _options: ViewerOptions): string {
  const missing = a.dag.tasks.reduce((sum, task) => sum + task.blockedBy.filter((id) => !a.dag.has(id)).length, 0);
  const unknown = a.dag.tasks.filter((task) => task.status === "unknown").length;
  const cycles = a.findings.filter((finding) => finding.kind === "cycle").length;
  const partial = missing + unknown + cycles + a.warnings.length > 0;
  const quality = partial ? `Partial analysis: ${String(missing)} unresolved dependency references · ${String(unknown)} unknown statuses · ${String(cycles)} cycles. Readiness and forecasts may be incomplete.` : "No unresolved dependencies or unknown statuses detected.";
  const captured = a.capturedAt === null ? "Capture time unknown" : `Captured ${esc(a.capturedAt)}`;
  return `
    <details class="snapshot-info${partial ? " partial" : ""}"><summary>Snapshot details${partial ? " · partial analysis" : ""}</summary>
    <div id="captured-at">${captured}</div>${a.account === undefined ? "<p>No Linear account metadata in this snapshot.</p>" : `<div class="snapshot-account"><p>Linear workspace: ${esc(a.account.workspace.name)}</p><p>Captured by: ${esc(a.account.user.name)}</p><p>Project: ${esc(a.account.project.name)}</p></div>`}<p>${quality}</p>
    ${a.warnings.length ? `<ul>${a.warnings.map((warning) => `<li>${esc(warning)}</li>`).join("")}</ul>` : ""}</details>`;
}
