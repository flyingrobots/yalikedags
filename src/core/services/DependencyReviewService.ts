import type { DependencyReview } from "../domain/DependencyReview.ts";
import type { Analysis } from "./Analysis.ts";
import { ReviewDecision } from "../domain/ReviewDecision.ts";
import { AuditService } from "./AuditService.ts";
import { StateService } from "./StateService.ts";

export type DependencyReviewState = "unreviewed" | "reviewed" | "exceptions" | "stale";

/** Review coverage is specific to an exact source version and the complete captured task scope. */
export class DependencyReviewService {
  state(review: DependencyReview | undefined, sourceVersion: string, analysis: Analysis): DependencyReviewState {
    if (review === undefined) { return "unreviewed"; }
    const dag = analysis.dag;
    const scope = dag.tasks.map(task => task.id).sort();
    if (review.sourceVersion !== sourceVersion || scope.length !== review.taskIds.length || scope.some((id, index) => id !== review.taskIds[index])) { return "stale"; }
    if (this.knownExceptions(analysis).length > 0) { return "exceptions"; }
    const recorded = new Set(dag.tasks.flatMap(task => task.blockedBy.map(blocker => ReviewDecision.key(blocker, task.id))));
    if (recorded.size !== review.decisions.length || review.decisions.some(decision => !recorded.has(ReviewDecision.key(decision.blocker, decision.dependent)))) { return "exceptions"; }
    return review.exceptions.length > 0 || review.decisions.some(decision => decision.outcome !== "accepted") ? "exceptions" : "reviewed";
  }

  knownExceptions(analysis: Analysis): string[] {
    const findings = new AuditService().audit(analysis.dag);
    const states = new StateService().states(analysis.dag);
    return [...new Set([...analysis.warnings,
      ...findings.filter(finding => ["cycle", "dangling-blocker", "canceled-blocker"].includes(finding.kind)).map(finding => finding.detail),
      ...analysis.dag.tasks.filter(task => states.get(task.id) === "unresolved").map(task => `Unresolved task: ${task.key}`)])];
  }

}
