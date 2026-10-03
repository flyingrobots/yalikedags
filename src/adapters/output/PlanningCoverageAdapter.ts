import type { PlanningCoverage } from "../../core/services/PlanningCoverage.ts";

/** Exact, canonical topology/state coordinates accompany every partition; no collision-prone compact identity. */
export class PlanningCoverageAdapter {
  toObject(coverage: PlanningCoverage): Record<string, unknown> {
    return {
      schema: "yalikedags/planning/1",
      graph: { kind: "supplied", nodes: coverage.graphTasks.map(task => ({ id: task.id, status: task.status, blockedBy: [...task.blockedBy].sort() })) },
      universe: "active captured cards, including labeled containers; not executable PR counts",
      included: coverage.included, excluded: coverage.excluded, containers: coverage.containers,
      shared: coverage.shared, exceptions: coverage.exceptions,
      workstreams: coverage.workstreams.map(stream => ({ id: stream.id, tasks: stream.tasks })),
      crossGroupEdges: coverage.crossGroupEdges,
      grouping: "connected components after removing shared prerequisites; temporary analysis, not ownership or deliverables",
    };
  }
}
