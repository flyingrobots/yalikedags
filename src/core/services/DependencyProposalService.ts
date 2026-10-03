import type { Analysis } from "./Analysis.ts";
import type { DependencyReview } from "../domain/DependencyReview.ts";
import { ReviewDecision } from "../domain/ReviewDecision.ts";
import { DependencyDiscoveryService } from "./DependencyDiscoveryService.ts";
import { GraphSafetyService } from "./GraphSafetyService.ts";
import { AddBlockingRelation } from "../domain/Mutation.ts";
import { Plan } from "../domain/Plan.ts";
import { DependencyReviewService } from "./DependencyReviewService.ts";
import { AnalysisService } from "./AnalysisService.ts";

/** The captured source stays immutable; selected candidate edges only affect a separate analysis. */
export class DependencyProposalService {
  preview(a: Analysis, decisions: readonly ReviewDecision[], mode: "proposed" | "accepted"): Analysis {
    const mutations = this.additions(a, decisions, mode);
    const dag = new GraphSafetyService().project(a.dag, mutations);
    return new AnalysisService({ today: (): string => a.asOf }).analyse(dag.tasks, `${mode} preview of ${a.source}`, { capturedAt: a.capturedAt, warnings: a.warnings, account: a.account });
  }

  plan(a: Analysis, review: DependencyReview, sourceVersion: string): Plan {
    if (new DependencyReviewService().state(review, sourceVersion, a) === "stale") { throw new Error("Proposal evidence is stale; review this capture again."); }
    const project = a.account?.project.id;
    if (project === undefined) { throw new Error("A captured Linear project is required to export a tracker plan."); }
    const mutations = this.additions(a, review.decisions, "accepted");
    new GraphSafetyService().assertSafe(a.dag, mutations);
    return new Plan({ mutations, unmatched: [], desiredSource: "snapshot:reviewed-dependency-proposals", currentSource: `linear:${project}`,
      createdAt: review.reviewedAt, labels: Object.fromEntries(a.dag.tasks.map(t => [t.id, t.key])), prerequisiteVersion: sourceVersion });
  }

  private additions(a: Analysis, decisions: readonly ReviewDecision[], mode: "proposed" | "accepted"): AddBlockingRelation[] {
    const byEdge = new Map(decisions.map(d => [ReviewDecision.key(d.blocker, d.dependent), d]));
    return new DependencyDiscoveryService().discover(a.dag).filter(candidate => {
      const decision = byEdge.get(ReviewDecision.key(candidate.blocker, candidate.dependent));
      return mode === "proposed" ? decision?.outcome !== "rejected" : this.accepted(decision);
    }).map(candidate => new AddBlockingRelation(candidate.blocker, candidate.dependent));
  }

  private accepted(decision: ReviewDecision | undefined): boolean {
    if (decision?.outcome !== "accepted") { return false; }
    if (!decision.note.trim()) { throw new Error("Accepted candidate requires an evidence and direction rationale."); }
    return true;
  }

}
