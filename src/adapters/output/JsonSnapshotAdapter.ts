import { DependencyDiscoveryService } from "../../core/services/DependencyDiscoveryService.ts";
import type { Analysis } from "../../core/services/Analysis.ts";
import { DependencyReviewCodec } from "../review/DependencyReviewCodec.ts";
import type { DependencyReview } from "../../core/domain/DependencyReview.ts";
import type { RendererPort } from "../../ports/RendererPort.ts";
import { PlanningCoverageAdapter } from "./PlanningCoverageAdapter.ts";

export const SNAPSHOT_SCHEMA = "yalikedags/snapshot/2";

/**
 * The snapshot is the file the CLI writes and the viewer reads: tasks as
 * plain fields plus every derived view, so a consumer never has to
 * recompute anything to draw the graph. Serialization lives here, not on
 * the domain classes (TypeScript standard, Rule 3).
 */
export class JsonSnapshotAdapter implements RendererPort {
  readonly contentType = "application/json";

  render(a: Analysis, review: DependencyReview | undefined = a.review): string {
    return JSON.stringify(this.toObject(a, review), null, 2);
  }

  toObject(a: Analysis, review: DependencyReview | undefined = a.review): Record<string, unknown> {
    return {
      schema: SNAPSHOT_SCHEMA,
      dependencyProposals: { method: "local-key-references/1", candidates: new DependencyDiscoveryService().discover(a.dag).map(c => ({ blocker: c.blocker, dependent: c.dependent, evidence: c.evidence, confidence: c.confidence })) },
      planning: new PlanningCoverageAdapter().toObject(a.planning),
      ...(review !== undefined && { dependencyReview: new DependencyReviewCodec().encode(review) }),
      source: a.source,
      ...(a.account !== undefined && { account: a.account }),
      asOf: a.asOf,
      capturedAt: a.capturedAt,
      warnings: a.warnings,
      quality: {
        unresolvedDependencies: a.dag.tasks.flatMap((t) => t.blockedBy.filter((id) => !a.dag.has(id))).length,
        unknownStatuses: a.dag.tasks.filter((t) => t.status === "unknown").length,
        cycles: a.dag.validate().cycles.length,
      },
      tasks: a.dag.tasks.map((t) => ({ ...t.toFields(), state: a.stateOf(t.id), workstream: a.workstreamOf(t.id) ?? null, critical: a.isCritical(t.id) })),
      edges: a.dag.tasks.flatMap((t) => a.dag.blockers(t.id).map((b) => ({ from: b, to: t.id }))),
      frontier: a.frontier.map((e) => ({ task: e.task.id, daysUntilDue: e.daysUntilDue, immediatelyUnblocks: e.immediatelyUnblocks, downstreamImpact: e.downstreamImpact, unlocks: e.downstreamImpact, conflicts: a.conflicts.get(e.task.id) ?? [] })),
      waves: a.waves,
      gatekeepers: a.gatekeepers,
      workstreams: a.workstreams.map((w) => ({ id: w.id, tasks: w.tasks })),
      grid: { waves: a.grid.waves, rows: a.grid.rows.map((r) => ({ workstream: r.workstream ?? null, cells: r.cells })) },
      criticalPath: {
        byDepth: { tasks: a.criticalByDepth.tasks, length: a.criticalByDepth.length },
        byEffort: { tasks: a.criticalByEffort.tasks, length: a.criticalByEffort.length },
      },
      findings: a.findings.map((f) => ({ kind: f.kind, task: f.task, detail: f.detail, wouldKill: f.wouldKill })),
    };
  }
}
