import type { Analysis } from "../core/services/Analysis.ts";
import { escapeXml as esc } from "../adapters/output/SvgRendererAdapter.ts";

/** Group repeated audit kinds, with a separate reading order for structural failures. */
export class FindingsMarkup {
  render(a: Analysis): string {
    return [this.group(a, true), this.group(a, false)].join("");
  }
  private group(a: Analysis, structural: boolean): string {
    const findings = a.findings.filter((f) => ["cycle", "dangling-blocker"].includes(f.kind) === structural);
    const title = structural ? "Structural problems" : "Suggestions to review";
    const kinds = [...new Set(findings.map((f) => f.kind))];
    return `<section class="finding-section"><h3>${title} <span class="count">${String(findings.length)}</span></h3>${kinds.map((kind) => {
      const rows = findings.filter((f) => f.kind === kind);
      return `<details class="finding-group" open><summary>${esc(kind)} · ${String(rows.length)}</summary><ul>${rows.map((f) => `<li><p>${esc(f.detail)}</p>${f.wouldKill ? `<p class="muted">Check this assumption: ${esc(f.wouldKill)}</p>` : ""}${a.dag.has(f.task) ? `<button data-task="${esc(f.task)}" data-inspect-graph>Inspect affected chain · ${esc(a.dag.get(f.task).title)}</button>` : ""}</li>`).join("")}</ul></details>`;
    }).join("") || '<p class="empty">None in this snapshot.</p>'}</section>`;
  }
}
