import type { Analysis } from "../../core/services/Analysis.ts";
import type { RendererPort } from "../../ports/RendererPort.ts";

const plural = (n: number, word: string): string => `${String(n)} ${word}${n === 1 ? "" : "s"}`;

/** The terminal report. Plain text, one section per derived view, findings last. */
export class TextReportRendererAdapter implements RendererPort {
  readonly contentType = "text/plain";

  render(a: Analysis): string {
    const key = (id: string): string => a.dag.get(id).key;
    const counts = new Map<string, number>();
    for (const s of a.states.values()) {
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    const lines = [
      `${a.source}, as of ${a.asOf}: ${plural(a.dag.size, "task")} (${[...counts].map(([s, n]) => `${String(n)} ${s}`).join(", ")})`,
      "",
      `frontier (${plural(a.frontier.length, "ready task")}, most urgent first):`,
      ...a.frontier.map((e) => `  ${key(e.task.id)}  ${e.task.title}  immediately-unblocks:${String(e.immediatelyUnblocks)}  downstream-impact:${String(e.downstreamImpact)}${e.daysUntilDue < 9999 ? `  due in ${String(e.daysUntilDue)}d` : ""}${(a.conflicts.get(e.task.id) ?? []).map((c) => `  CONFLICT ${c}`).join("")}`),
      "",
      `waves: ${a.waves.map((w) => `[${w.map(key).join(", ")}]`).join(" -> ") || "(none schedulable)"}`,
      `gatekeepers: ${a.gatekeepers.map(key).join(", ") || "(none)"}`,
      `workstreams (${String(a.workstreams.length)}):`,
      ...a.workstreams.map((w) => `  ${w.id}: ${w.tasks.map(key).join(", ")}`),
      "",
      `critical path by depth: ${plural(a.criticalByDepth.length, "task")}: ${a.criticalByDepth.tasks.map(key).join(" then ") || "(nothing open)"}`,
      `critical path by effort: ${String(a.criticalByEffort.length)}: ${a.criticalByEffort.tasks.map(key).join(" then ") || "(nothing open)"}`,
      "",
      `findings (${String(a.findings.length)}):`,
      ...a.findings.map((f) => `  ${f.kind}  ${a.dag.has(f.task) ? key(f.task) : f.task}  ${f.detail}${f.wouldKill.length > 0 ? `  [would kill: ${f.wouldKill}]` : ""}`),
    ];
    return `${lines.join("\n")}\n`;
  }
}
