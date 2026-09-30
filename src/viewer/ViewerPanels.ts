import type { Analysis } from "../core/services/Analysis.ts";
import type { Task } from "../core/domain/Task.ts";
import { escapeXml as esc } from "../adapters/output/SvgRendererAdapter.ts";

import { taskTableMarkup } from "./TaskTableMarkup.ts";
import type { SnapshotChange } from "../core/services/SnapshotChangesService.ts";

/** Static, escaped panel content. Browser controllers own interaction, never tracker writes. */
export class ViewerPanels {
  constructor(private readonly analysis: Analysis, private readonly changes?: readonly SnapshotChange[]) {}

  render(svg: string): string {
    return `<div id="panel-staging" hidden>
      <section id="graph-panel" class="panel graph-panel"><div class="panel-toolbar">
      <button data-action="fit">Fit all</button><button data-action="focus">Focus selection</button>
      <button data-action="zoom-in" aria-label="Zoom in">+</button><button data-action="zoom-out" aria-label="Zoom out">−</button>
      <span>Drag to pan · scroll to zoom</span></div><div id="graph">${svg}</div>
      ${this.analysis.dag.size === 0 ? '<p class="empty">No tasks in this snapshot.</p>' : ""}
      <div class="graph-legend"><span>→ blocker to dependent</span><span>Bold: critical path</span><span>Dashed: shared prerequisite</span></div></section>
      ${taskTableMarkup()}
      ${this.changePanel()}
      <section id="grid-panel" class="panel scroll-panel"><p class="panel-intro">Workstreams × waves. A forecast of parallel work, not a schedule.</p><div id="grid">${this.grid()}</div></section>
      <section id="details-panel" class="panel scroll-panel"><div id="detail"><p class="empty">Select a task to see its details and dependencies.</p></div></section>
      <section id="ready-panel" class="panel scroll-panel"><p class="panel-intro">Ready to start, most urgent first.</p><ol id="frontier" class="task-list">${this.frontier()}</ol></section>
      <section id="findings-panel" class="panel scroll-panel"><p class="panel-intro">${String(this.analysis.findings.length)} findings in this snapshot.</p><ul id="findings" class="task-list">${this.findings()}</ul></section>
      </div>${this.analysis.dag.tasks.map((task) => this.detail(task)).join("")}`;
  }

  private changePanel(): string {
    const rows = (this.changes ?? []).map((c) => `<li>${esc(c.key)} · ${esc(c.kind)}: ${esc(c.detail)}</li>`).join("");
    const status = this.changes === undefined ? "Choose an earlier snapshot to compare with this one. Files stay in your browser."
      : this.changes.length > 0 ? "Changes since the previous successful refresh." : "No changes since the previous successful refresh.";
    return `<section id="changes-panel" class="panel scroll-panel"><label>Compare snapshot JSON<input id="compare-snapshot" type="file" accept=".json,application/json"></label><p id="changes-status" role="status">${status}</p><ul id="changes-list">${rows}</ul></section>`;
  }

  private card(id: string): string {
    const a = this.analysis;
    const t = a.dag.get(id);
    const classes = ["card", a.stateOf(id), a.isCritical(id) ? "critical" : "", a.gatekeepers.includes(id) ? "gatekeeper" : ""].join(" ");
    return `<button class="${classes}" data-task="${esc(id)}" data-id="${esc(id)}"><b>${esc(t.key)}</b><span>${esc(t.title)}</span><small>${esc(a.stateOf(id))}${t.assignee ? ` · ${esc(t.assignee)}` : ""}</small></button>`;
  }

  private grid(): string {
    const grid = this.analysis.grid;
    if (grid.waves === 0) { return '<p class="empty">Nothing schedulable. All tasks are closed, or open tasks have unresolved dependencies or cycles; check Findings.</p>'; }
    const heads = Array.from({ length: grid.waves }, (_, i) => `<th scope="col">Wave ${String(i + 1)}</th>`).join("");
    const rows = grid.rows.map((row) => {
      const label = row.workstream === undefined ? "Shared prerequisites" : this.analysis.dag.get(row.workstream).key;
      return `<tr><th scope="row">${esc(label)}</th>${row.cells.map((cell) => `<td>${cell.map((id) => this.card(id)).join("")}</td>`).join("")}</tr>`;
    }).join("");
    return `<table id="grid-table"><thead><tr><th scope="col">Workstream</th>${heads}</tr></thead><tbody>${rows}</tbody></table>`;
  }

  private frontier(): string {
    return this.analysis.frontier.map((entry) => {
      const conflicts = this.analysis.conflicts.get(entry.task.id) ?? [];
      return `<li>${this.card(entry.task.id)}<span class="muted">Immediately unblocks ${String(entry.immediatelyUnblocks)} · Downstream impact ${String(entry.downstreamImpact)}${conflicts.length ? ` · ${esc(conflicts.join("; "))}` : ""}</span></li>`;
    }).join("") || '<li class="empty">No tasks ready to start.</li>';
  }

  private findings(): string {
    return this.analysis.findings.map((f) => `<li><strong>${esc(f.kind)}</strong>
      ${this.analysis.dag.has(f.task) ? this.card(f.task) : ""}<p>${esc(f.detail)}</p><small>${esc(f.wouldKill)}</small></li>`).join("") || '<li class="empty">No audit findings.</li>';
  }

  private links(ids: readonly string[]): string {
    return ids.map((id) => this.analysis.dag.has(id)
      ? `<button class="task-link" data-task="${esc(id)}">${esc(this.analysis.dag.get(id).key)}</button>`
      : `<span>${esc(id)} (outside snapshot)</span>`).join(" ") || "None";
  }

  private detail(t: Task): string {
    const a = this.analysis;
    const fields = [["State", a.stateOf(t.id)], ["Status", t.status], ["Priority", t.priority], ["Effort", t.effort],
      ["Assignee", t.assignee], ["Milestone", t.milestone], ["Due", t.due], ["Labels", t.labels.join(", ")],
      ["Workstream", a.workstreamOf(t.id)]];
    const rows = fields.filter(([, value]) => value !== undefined && value !== "")
      .map(([label, value]) => `<dt>${esc(String(label))}</dt><dd>${esc(String(value))}</dd>`).join("");
    const link = t.url !== undefined && /^https?:\/\//i.test(t.url)
      ? `<p><a href="${esc(t.url)}" target="_blank" rel="noopener noreferrer">Open in Linear ↗</a></p>` : "";
    return `<template data-detail="${esc(t.id)}"><p class="eyebrow">${esc(t.key)}</p><h2>${esc(t.title)}</h2><dl>${rows}
      <dt>Blocked by</dt><dd>${this.links(t.blockedBy)}</dd><dt>Blocks</dt><dd>${this.links(a.dag.dependents(t.id))}</dd></dl>
      ${link}${t.description ? `<pre>${esc(t.description)}</pre>` : ""}</template>`;
  }
}
