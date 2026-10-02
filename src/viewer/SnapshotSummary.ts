import type { Analysis } from "../core/services/Analysis.ts";
import type { ViewerOptions } from "./ViewerMetadata.ts";
import { escapeXml as esc } from "../adapters/output/SvgRendererAdapter.ts";

/** Capture identity stays visible in every view; a reload is not a source refresh. */
export class SnapshotSummary {
  render(a: Analysis, options: ViewerOptions): string {
    const active = a.dag.tasks.filter(task => !task.isDone()).length;
    const edges = a.dag.tasks.reduce((sum, task) => sum + a.dag.blockers(task.id).length, 0);
    const captured = a.capturedAt ?? "unknown";
    return `<div class="snapshot-summary"><div><time id="snapshot-capture" datetime="${esc(captured)}">Captured ${esc(captured)}</time><span id="snapshot-counts">${String(a.dag.size)} total cards · ${String(active)} active · ${String(a.dag.size - active)} completed/canceled · ${String(edges)} recorded edges</span></div><button id="refresh" ${options.refresh ? "" : 'disabled title="Offline export: regenerate from source"'}>Refresh source</button><span id="refresh-status" role="status">${options.refresh ? "Reload displays this capture; Refresh source reads upstream." : "Offline snapshot · regenerate to update."}</span></div>`;
  }
}
