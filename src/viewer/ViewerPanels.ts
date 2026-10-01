import { viewerMetadata } from "./ViewerMetadata.ts";
import { ImpactMarkup } from "./ImpactMarkup.ts";
import { ChangesMarkup } from "./ChangesMarkup.ts";
import type { ViewerOptions } from "./ViewerMetadata.ts";
import { FindingsMarkup } from "./FindingsMarkup.ts";
import { OverviewMarkup } from "./OverviewMarkup.ts";
import type { Analysis } from "../core/services/Analysis.ts";
import type { Task } from "../core/domain/Task.ts";
import { escapeXml as esc } from "../adapters/output/SvgRendererAdapter.ts";

import { taskTableMarkup } from "./TaskTableMarkup.ts";

/** Static, escaped panel content. Browser controllers own interaction, never tracker writes. */
export class ViewerPanels {
  constructor(private readonly analysis: Analysis, private readonly options: ViewerOptions = {}) {}

  render(svg: string): string {
    return `<div id="panel-staging" hidden>
      <section id="graph-panel" class="panel graph-panel"><div class="graph-filters"><div class="search"><label class="sr-only" for="search">Find a task</label><input id="search" type="search" placeholder="Find a task…" autocomplete="off"><div id="search-results" hidden></div></div><label>Owner<select id="graph-owner" aria-label="Graph owner"></select></label><label>State<select id="graph-status" aria-label="Graph state"><option value="all">All tasks</option><option value="open">Open (unfinished)</option><option value="ready">Ready</option><option value="in-progress">In progress</option><option value="blocked">Blocked</option><option value="unresolved">Unresolved</option><option value="done">Finished</option></select></label><button id="graph-clear-filters">Clear graph filters</button><span id="graph-filter-status" role="status"></span></div><div class="panel-toolbar">
      <button data-action="readable">Readable size</button><button data-action="fit">Fit all</button><button data-action="focus">Focus selection</button>
      <button data-action="zoom-in" aria-label="Zoom in">+</button><button data-action="zoom-out" aria-label="Zoom out">−</button>
      </div><div class="graph-scope"><button id="graph-neighborhood" disabled>Focus neighborhood</button><button id="graph-expand" hidden>Expand one hop</button><button id="graph-all" hidden>Whole project</button><span id="graph-scope-status" role="status">Whole project · select a task to focus its neighborhood</span></div><div id="graph">${svg}</div>
      ${this.analysis.dag.size === 0 ? '<p class="empty">No tasks in this snapshot.</p>' : ""}
      <div class="graph-legend" aria-label="Task states and dependency notation"><span class="legend-state ready">Ready</span><span class="legend-state in-progress">In progress</span><span class="legend-state blocked">Blocked</span><span class="legend-state unresolved">Unresolved</span><span class="legend-state done">Done</span><span class="legend-guide">→ blocker to dependent · Bold: critical path · Dashed: shared prerequisite</span></div></section>
      ${taskTableMarkup()}
      ${this.changePanel()}
      <section id="grid-panel" class="panel scroll-panel"><div class="view-filter">${this.ownerControls("grid")}</div><p class="panel-intro">Workstreams × waves. A forecast of parallel work, not a schedule. Wave counts refer to the whole project.</p><div id="grid">${this.grid()}${this.unscheduled()}</div></section>
      <section id="details-panel" class="panel scroll-panel"><div id="detail"><p class="empty">Select a task to see its details and dependencies.</p></div></section>
      <section id="ready-panel" class="panel scroll-panel">${new OverviewMarkup(this.analysis).header()}<div class="overview-columns"><div class="ready-section"><div class="section-heading"><div><h3>Ready work</h3></div></div><div class="view-filter">${this.ownerControls("ready")}</div><ol id="frontier" class="task-list">${this.frontier()}</ol></div>${new OverviewMarkup(this.analysis).path()}</div></section>
      <section id="findings-panel" class="panel scroll-panel"><p class="panel-intro">${String(this.analysis.findings.length)} findings in this snapshot.</p><div id="findings">${new FindingsMarkup().render(this.analysis)}</div></section>
      </div>${this.analysis.dag.tasks.map((task) => this.detail(task)).join("")}`;
  }

  private changePanel(): string {
    const rows = new ChangesMarkup().render(this.options.changes ?? [], (id) => this.analysis.dag.has(id));
    const status = this.options.changes === undefined ? "Choose an earlier snapshot to compare with this one. Files stay in your browser."
      : this.options.changes.length > 0 ? "Changes since the previous successful refresh." : "No changes since the previous successful refresh.";
    return `<section id="changes-panel" class="panel scroll-panel"><h2>Import/Export</h2><div class="snapshot-actions">${viewerMetadata(this.analysis, this.options)}<button id="export-snapshot">Export snapshot JSON</button></div><h3>Compare snapshots</h3><div class="comparison-heading"><div><span class="eyebrow">BEFORE</span><p id="comparison-before">${esc(this.options.previous?.source ?? "Choose a snapshot")} · ${esc(this.options.previous?.capturedAt ?? "Capture time unknown")}</p></div><div><span class="eyebrow">CURRENT</span><p>${esc(this.analysis.source)} · ${esc(this.analysis.capturedAt ?? "Capture time unknown")}</p></div></div><label>Compare snapshot JSON<input id="compare-snapshot" type="file" accept=".json,application/json"></label><button id="cancel-comparison" hidden>Cancel comparison</button><p id="changes-status" role="status">${status}</p><div id="changes-list">${rows}</div></section>`;
  }

  private card(id: string): string {
    const a = this.analysis;
    const t = a.dag.get(id);
    const classes = ["card", a.stateOf(id), a.isCritical(id) ? "critical" : "", a.gatekeepers.includes(id) ? "gatekeeper" : ""].join(" ");
    return `<button class="${classes}" data-task="${esc(id)}" data-id="${esc(id)}"><b title="${esc(t.key)}">${esc(t.key)}</b><span>${esc(t.title)}</span><small>${esc(a.stateOf(id))}</small><span class="assignee" title="Assigned to">${esc(t.assignee ?? "Unassigned")}</span></button>`;
  }

  private grid(): string {
    const grid = this.analysis.grid;
    if (grid.waves === 0) { return '<p class="empty">Nothing schedulable. All tasks are closed, or open tasks have unresolved dependencies or cycles; check Findings.</p>'; }
    const heads = Array.from({ length: grid.waves }, (_, i) => `<th scope="col">Wave ${String(i + 1)}<small>${String(this.analysis.waves[i]?.length ?? 0)} tasks</small></th>`).join("");
    const rows = grid.rows.map((row) => {
      const label = row.workstream === undefined ? "Shared prerequisites" : this.analysis.dag.get(row.workstream).title;
      return `<tr><th scope="row">${esc(label)}</th>${row.cells.map((cell) => `<td>${cell.map((id) => this.card(id)).join("")}</td>`).join("")}</tr>`;
    }).join("");
    return `<table id="grid-table"><thead><tr><th scope="col">Workstream</th>${heads}</tr></thead><tbody>${rows}</tbody></table>`;
  }

  private ownerControls(scope: string): string {
    return `<label>Owner<select id="${scope}-owner" aria-label="${scope === "ready" ? "Ready work" : "Waves"} owner"></select></label><span id="${scope}-owner-count" role="status"></span><p id="${scope}-owner-help" class="muted"></p>`;
  }

  private unscheduled(): string {
    const scheduled = new Set(this.analysis.waves.flat());
    const tasks = this.analysis.dag.tasks.filter((t) => !t.isDone() && !scheduled.has(t.id));
    return `<details id="unscheduled" class="unscheduled" ${tasks.length ? "open" : ""}><summary>Outside the wave forecast · ${String(tasks.length)} tasks</summary><p class="muted">Unknown states, missing blockers, cycles, or dependencies on unresolved work prevent scheduling. Inspect a task for its blockers.</p>${tasks.map((t) => this.card(t.id)).join("") || '<p class="muted">All open work has a wave.</p>'}</details>`;
  }

  private frontier(): string {
    return this.analysis.frontier.map((entry) => {
      const conflicts = this.analysis.conflicts.get(entry.task.id) ?? [];
      return `<li>${this.card(entry.task.id)}${new ImpactMarkup().render(this.analysis, entry.task.id)}${conflicts.length ? `<p class="resource-warning">${esc(conflicts.join("; "))}</p>` : ""}</li>`;
    }).join("") || '<li class="empty">No tasks ready to start.</li>';
  }

  private links(ids: readonly string[]): string {
    return ids.map((id) => this.analysis.dag.has(id)
      ? `<button class="task-link" data-inspect-graph data-task="${esc(id)}">${esc(this.analysis.dag.get(id).key)}</button>`
      : `<span>${esc(id)} (outside snapshot)</span>`).join(" ") || "None";
  }

  private detail(t: Task): string {
    const a = this.analysis;
    const fields = [["State", a.stateOf(t.id)], ["Status", t.status], ["Priority", t.priority], ["Effort", t.effort],
      ["Assignee", t.assignee ?? "Unassigned"], ["Milestone", t.milestone], ["Due", t.due], ["Labels", t.labels.join(", ")],
      ["Workstream", a.workstreamOf(t.id)]];
    const rows = fields.filter(([, value]) => value !== undefined && value !== "")
      .map(([label, value]) => `<dt>${esc(String(label))}</dt><dd>${esc(String(value))}</dd>`).join("");
    const link = t.url !== undefined && /^https?:\/\//i.test(t.url)
      ? `<p><a href="${esc(t.url)}" target="_blank" rel="noopener noreferrer">Open in Linear ↗</a></p>` : "";
    return `<template data-detail="${esc(t.id)}"><p class="eyebrow">${esc(t.key)}</p><h2>${esc(t.title)}</h2><dl>${rows}
      <dt>Blocked by</dt><dd>${this.links(t.blockedBy)}</dd><dt>Blocks</dt><dd>${this.links(a.dag.dependents(t.id))}</dd></dl>
      ${link}${t.description ? `<div class="task-description">${esc(t.description)}</div>` : ""}</template>`;
  }
}
