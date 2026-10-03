import { DependencyDiscoveryService } from "./DependencyDiscoveryService.ts";
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
    if (review.sourceVersion !== sourceVersion || !this.sameScope(review, analysis)) { return "stale"; }
    if (this.knownExceptions(analysis).length > 0) { return "exceptions"; }
    const recorded = new Set(dag.tasks.flatMap(task => task.blockedBy.map(blocker => ReviewDecision.key(blocker, task.id))));
    const discovered = new DependencyDiscoveryService().discover(dag);
    if (discovered.length === 2000) { return "exceptions"; }
    const candidates = new Set(discovered.map(c => ReviewDecision.key(c.blocker, c.dependent)));
    const required = new Set([...recorded, ...candidates]);
    if (required.size !== review.decisions.length || review.decisions.some(decision => !required.has(ReviewDecision.key(decision.blocker, decision.dependent)))) { return "exceptions"; }
    return review.exceptions.length > 0 || review.decisions.some(decision => this.incompleteDecision(decision, recorded, candidates)) ? "exceptions" : "reviewed";
  }

  private incompleteDecision(decision: ReviewDecision, recorded: ReadonlySet<string>, candidates: ReadonlySet<string>): boolean {
    if (decision.outcome === "unreviewed") { return true; }
    const key = ReviewDecision.key(decision.blocker, decision.dependent);
    if (decision.outcome === "rejected") { return recorded.has(key); }
    return candidates.has(key) && !decision.note.trim();
  }

  private sameScope(review: DependencyReview, analysis: Analysis): boolean {
    const scope = analysis.dag.tasks.map(task => task.id).sort();
    return scope.length === review.taskIds.length && scope.every((id, index) => id === review.taskIds[index]);
  }

  knownExceptions(analysis: Analysis): string[] {
    const findings = new AuditService().audit(analysis.dag);
    const states = new StateService().states(analysis.dag);
    return [...new Set([...analysis.warnings,
      ...(new DependencyDiscoveryService().discover(analysis.dag).length === 2000 ? ["Candidate discovery reached 2,000 results; remaining references have not been inspected."] : []),
      ...findings.filter(finding => ["cycle", "dangling-blocker", "canceled-blocker"].includes(finding.kind)).map(finding => finding.detail),
      ...analysis.dag.tasks.filter(task => states.get(task.id) === "unresolved").map(task => `Unresolved task: ${task.key}`)])];
  }

  candidateExceptions(review: DependencyReview, analysis: Analysis): string[] {
    const candidates = new Set(new DependencyDiscoveryService().discover(analysis.dag).map(edge => ReviewDecision.key(edge.blocker, edge.dependent)));
    return review.decisions.filter(decision => candidates.has(ReviewDecision.key(decision.blocker, decision.dependent)) && decision.outcome === "accepted" && !decision.note.trim())
      .map(decision => `${decision.blocker} → ${decision.dependent}: accepted candidate lacks an evidence and direction rationale.`);
  }

  missingDecisions(review: DependencyReview, analysis: Analysis): ReviewDecision[] {
    const decisions = new Set(review.decisions.map(decision => ReviewDecision.key(decision.blocker, decision.dependent)));
    return this.requiredDecisions(analysis).filter(decision => !decisions.has(ReviewDecision.key(decision.blocker, decision.dependent)));
  }

  outsideDecisions(review: DependencyReview, analysis: Analysis): string[] {
    const recorded = new Set(this.requiredDecisions(analysis).map(decision => ReviewDecision.key(decision.blocker, decision.dependent)));
    return review.decisions.filter(decision => !recorded.has(ReviewDecision.key(decision.blocker, decision.dependent)))
      .map(decision => `${decision.blocker} → ${decision.dependent}: decision is outside the recorded relationships or discovered candidates in this capture.`);
  }

  private requiredDecisions(analysis: Analysis): ReviewDecision[] {
    const recorded = analysis.dag.tasks.flatMap(task => task.blockedBy.map(blocker => ({ blocker, dependent: task.id })));
    return [...recorded, ...new DependencyDiscoveryService().discover(analysis.dag)].map(edge => new ReviewDecision({
      blocker: edge.blocker, dependent: edge.dependent, outcome: "unreviewed", note: "No decision recorded for this captured relationship or candidate." }));
  }

}
