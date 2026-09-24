import type { Analysis } from "../core/services/Analysis.ts";
import type { GridRow } from "../core/services/GridService.ts";
import { escapeXml } from "../adapters/output/SvgRendererAdapter.ts";

/**
 * The grid as an HTML table: one column per wave, one row per workstream,
 * and a shared row first for the gatekeepers. Each open task is one card,
 * carrying the same state, critical and gatekeeper classes as its node in
 * the graph, so the two views read with one legend and one selection.
 */
export function gridTable(a: Analysis): string {
  if (a.grid.waves === 0) {
    return "<p>Nothing open.</p>";
  }
  const heads = Array.from({ length: a.grid.waves }, (_, i) => `<th>Wave ${String(i + 1)}</th>`).join("");
  const rows = a.grid.rows.map((r) => gridRow(a, r)).join("\n");
  return `<table id="grid-table"><thead><tr><th></th>${heads}</tr></thead>\n<tbody>\n${rows}\n</tbody></table>`;
}

function gridRow(a: Analysis, r: GridRow): string {
  const label = r.workstream === undefined ? "shared prerequisites" : `workstream ${a.dag.get(r.workstream).key}`;
  const cls = r.workstream === undefined ? ' class="shared"' : "";
  const cells = r.cells.map((ids) => `<td>${ids.map((id) => card(a, id)).join("")}</td>`).join("");
  return `<tr${cls}><th>${escapeXml(label)}</th>${cells}</tr>`;
}

function card(a: Analysis, id: string): string {
  const t = a.dag.get(id);
  const classes = ["card", a.stateOf(id), a.isCritical(id) ? "critical" : "", a.gatekeepers.includes(id) ? "gatekeeper" : ""].filter((c) => c.length > 0).join(" ");
  return `<span class="${classes}" data-id="${escapeXml(id)}" title="${escapeXml(t.title)}"><b>${escapeXml(t.key)}</b> ${escapeXml(t.title)}</span>`;
}
