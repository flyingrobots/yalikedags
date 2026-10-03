import { PlanningEvidence } from "../core/services/PlanningEvidence.ts";
import type { Analysis } from "../core/services/Analysis.ts";
import { escapeXml as esc } from "../adapters/output/SvgRendererAdapter.ts";

/** The overview turns existing analysis into a short, actionable reading order. */
export class OverviewMarkup {
  constructor(private readonly analysis: Analysis) {}

  header(): string {
    const a = this.analysis;
    const count = (state: string): number => [...a.states.values()].filter((value) => value === state).length;
    const planning = new PlanningEvidence();
    const active = a.dag.tasks.filter(task => !task.isDone());
    const isolated = active.filter(task => a.dag.blockers(task.id).length + a.dag.dependents(task.id).length === 0).length;
    return `
    <div class="planning-warning" role="note"><strong>Dependency review is incomplete.</strong><p>${String(isolated)} active cards have no recorded connections. This does not establish independence or implementation readiness. Only recorded blockers are analyzed; proposed dependencies require review.</p><p>${["Tracking container", "Implementation", "Research", "Decision", "Investigation", "Needs disposition"].map(kind => `${String(active.filter(task => planning.kind(task) === kind).length)} ${kind.toLowerCase()}`).join(" · ")}. Containers are not additional executable PRs.</p></div>
    ${a.warnings.length + a.findings.filter((f) => ["cycle", "dangling-blocker", "canceled-blocker"].includes(f.kind)).length + count("unresolved") > 0 ? `<div class="analysis-warning" role="note"><strong>Readiness is based on incomplete data.</strong><p>Unresolved work, cycles, or source warnings may affect this plan.</p><button data-panel="findings">Review uncertainty →</button></div>` : ""}
    <div class="project-stats" aria-label="Project summary">
    <div class="ready"><strong>${String(a.frontier.filter(entry => planning.kind(entry.task) !== "Tracking container").length)}</strong><span>No recorded open blockers</span></div>
    <div class="in-progress"><strong>${String(count("in-progress"))}</strong><span>In progress</span></div>
    <div class="blocked"><strong>${String(count("blocked"))}</strong><span>Blocked</span></div>
    <div class="unresolved"><strong>${String(count("unresolved"))}</strong><span>Unresolved</span></div>
    <div class="done"><strong>${String(count("done"))}</strong><span>Completed / canceled</span></div></div>`;
  }

  path(): string {
    const a = this.analysis;
    const steps = a.criticalByDepth.tasks.map((id, index) => {
      const task = a.dag.get(id);
      return `<li class="${esc(a.stateOf(id))}"><span class="path-step">${String(index + 1).padStart(2, "0")}</span><button data-task="${esc(id)}"><span>${esc(task.title)}</span><small>${esc(a.stateOf(id))} · ${esc(task.assignee ?? "Unassigned")}</small></button></li>`;
    }).join("");
    return `<aside class="critical-summary"><div class="section-heading"><div><h3>Critical path <span class="count">${String(a.criticalByDepth.tasks.length)}</span></h3></div></div>
    <p class="panel-intro">Longest chain of open tasks by depth, excluding unresolved prerequisite obligations. Each hand-off holds up the next.</p><ol class="critical-steps">${steps || '<li class="empty">No resolved open chain in this snapshot; check Findings for unresolved work.</li>'}</ol>
    <button class="text-action" data-panel="graph">Explore dependencies <span aria-hidden="true">↗</span></button>
    <div class="audit-callout"><strong>${String(a.findings.length)} audit findings</strong><button data-panel="findings">Review findings →</button></div></aside>`;
  }
}
