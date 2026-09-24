import type { Analysis } from "../../core/services/Analysis.ts";
import type { RendererPort } from "../../ports/RendererPort.ts";

export const SNAPSHOT_SCHEMA = "yalikedags/snapshot/1";

/**
 * The snapshot is the file the CLI writes and the viewer reads: tasks as
 * plain fields plus every derived view, so a consumer never has to
 * recompute anything to draw the graph. Serialization lives here, not on
 * the domain classes (TypeScript standard, Rule 3).
 */
export class JsonSnapshotAdapter implements RendererPort {
  readonly contentType = "application/json";

  render(a: Analysis): string {
    return JSON.stringify(this.toObject(a), null, 2);
  }

  toObject(a: Analysis): Record<string, unknown> {
    return {
      schema: SNAPSHOT_SCHEMA,
      source: a.source,
      asOf: a.asOf,
      tasks: a.dag.tasks.map((t) => ({ ...t.toFields(), state: a.stateOf(t.id), workstream: a.workstreamOf(t.id) ?? null, critical: a.isCritical(t.id) })),
      edges: a.dag.tasks.flatMap((t) => a.dag.blockers(t.id).map((b) => ({ from: b, to: t.id }))),
      frontier: a.frontier.map((e) => ({ task: e.task.id, daysUntilDue: e.daysUntilDue, unlocks: e.unlocks, conflicts: a.conflicts.get(e.task.id) ?? [] })),
      waves: a.waves,
      gatekeepers: a.gatekeepers,
      workstreams: a.workstreams.map((w) => ({ id: w.id, tasks: w.tasks })),
      criticalPath: {
        byDepth: { tasks: a.criticalByDepth.tasks, length: a.criticalByDepth.length },
        byEffort: { tasks: a.criticalByEffort.tasks, length: a.criticalByEffort.length },
      },
      findings: a.findings.map((f) => ({ kind: f.kind, task: f.task, detail: f.detail, wouldKill: f.wouldKill })),
    };
  }
}
