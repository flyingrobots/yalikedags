import { Task } from "../../core/domain/Task.ts";
import type { Analysis } from "../../core/services/Analysis.ts";
import { AnalysisService } from "../../core/services/AnalysisService.ts";

/** Deliberately lossy export: allowlisted facts only; topology is still identifying. */
export class StructureOnlyAnalysisAdapter {
  transform(analysis: Analysis): Analysis {
    const ids = new Map(analysis.dag.tasks.map((task, index) => [task.id, `task-${String(index + 1)}`]));
    let external = 0;
    const mapped = (id: string): string => {
      const existing = ids.get(id);
      if (existing !== undefined) { return existing; }
      const replacement = `external-${String(++external)}`;
      ids.set(id, replacement);
      return replacement;
    };
    const tasks = analysis.dag.tasks.map((task, index) => new Task({
      id: mapped(task.id), title: `Task ${String(index + 1)}`, status: task.status,
      blockedBy: task.blockedBy.map(mapped), children: task.children.map(mapped),
      ...(task.parent !== undefined && { parent: mapped(task.parent) }),
    }));
    // Recompute all derived fields so warnings, findings, and grouping never retain original text.
    return new AnalysisService({ today: (): string => "1970-01-01" }).analyse(tasks, "Structure-only snapshot", {
      capturedAt: null,
      warnings: ["Structure-only export: content and provenance removed. Graph shape, counts, and statuses may still identify a project. Analysis uses unit effort and a placeholder date."],
    });
  }
}
