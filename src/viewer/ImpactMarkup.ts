import type { Analysis } from "../core/services/Analysis.ts";
import { DependencyImpact } from "../core/services/DependencyImpact.ts";
import { escapeXml as esc } from "../adapters/output/SvgRendererAdapter.ts";

/** Disclosure lists let a count answer which tasks, without losing the overview. */
export class ImpactMarkup {
  render(a: Analysis, id: string): string {
    const impact = new DependencyImpact();
    return `<div class="impact">${this.list(a, impact.immediate(a.dag, id), { title: "Immediately unblocked", explanation: "Ready when this task finishes." })}${this.list(a, impact.downstream(a.dag, id), { title: "Downstream", explanation: "Open descendants; other blockers may still prevent readiness." })}</div>`;
  }

  private list(a: Analysis, ids: string[], copy: { title: string; explanation: string }): string {
    return `<details class="impact-list"><summary><strong>${String(ids.length)}</strong> ${copy.title}</summary><p>${copy.explanation}</p><ul>${ids.map((id) => {
      const task = a.dag.get(id);
      return `<li><button data-task="${esc(id)}">${esc(task.title)}</button><small>${esc(task.key)} · ${esc(a.stateOf(id))} · ${esc(task.assignee ?? "Unassigned")}</small></li>`;
    }).join("") || '<li>No tasks.</li>'}</ul></details>`;
  }
}
