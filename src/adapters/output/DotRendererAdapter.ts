import type { Analysis } from "../../core/services/Analysis.ts";
import type { RendererPort } from "../../ports/RendererPort.ts";

const FILL: Record<string, string> = { done: "#d4edda", "in-progress": "#fff3cd", blocked: "#f8d7da", ready: "#d1ecf1" };

export const escapeDot = (s: string): string => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

/** GraphViz DOT. Render with `dot -Tsvg`, or hand it to anything that reads DOT. */
export class DotRendererAdapter implements RendererPort {
  readonly contentType = "text/vnd.graphviz";

  render(a: Analysis): string {
    const lines = ["digraph tasks {", "  rankdir=LR;", '  node [shape=box, style="rounded,filled", fontname="Helvetica"];'];
    for (const t of a.dag.tasks) {
      const state = a.stateOf(t.id);
      const classes = [state, a.isCritical(t.id) ? "critical" : "", a.gatekeepers.includes(t.id) ? "gatekeeper" : ""].filter((c) => c.length > 0).join(" ");
      const label = `${escapeDot(t.key)}\\n${escapeDot(t.title)}`;
      const pen = a.isCritical(t.id) ? ", penwidth=3" : "";
      lines.push(`  "${escapeDot(t.id)}" [label="${label}", fillcolor="${FILL[state] ?? "#ffffff"}", class="${classes}"${pen}];`);
    }
    for (const t of a.dag.tasks) {
      for (const b of a.dag.blockers(t.id)) {
        lines.push(`  "${escapeDot(b)}" -> "${escapeDot(t.id)}";`);
      }
    }
    lines.push("}");
    return `${lines.join("\n")}\n`;
  }
}
