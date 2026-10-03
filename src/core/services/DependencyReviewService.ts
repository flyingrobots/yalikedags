import { DependencyDiscoveryService } from "./DependencyDiscoveryService.ts";
import type { DependencyReview } from "../domain/DependencyReview.ts";
import type { Dag } from "../domain/Dag.ts";
import { ReviewDecision } from "../domain/ReviewDecision.ts";

export type DependencyReviewState = "unreviewed" | "reviewed" | "exceptions" | "stale";

/** Review coverage is specific to an exact source version and the complete captured task scope. */
export class DependencyReviewService {
  state(review: DependencyReview | undefined, sourceVersion: string, dag: Dag): DependencyReviewState {
    if (review === undefined) { return "unreviewed"; }
    const scope = dag.tasks.map(task => task.id).sort();
    if (review.sourceVersion !== sourceVersion || scope.length !== review.taskIds.length || scope.some((id, index) => id !== review.taskIds[index])) { return "stale"; }
    const recorded = new Set(dag.tasks.flatMap(task => task.blockedBy.map(blocker => ReviewDecision.key(blocker, task.id))));
    const discovered = new DependencyDiscoveryService().discover(dag);
    if (discovered.length === 2000) { return "exceptions"; }
    const candidates = new Set(discovered.map(c => ReviewDecision.key(c.blocker, c.dependent)));
    const required = new Set([...recorded, ...candidates]);
    if (required.size !== review.decisions.length || review.decisions.some(decision => !required.has(ReviewDecision.key(decision.blocker, decision.dependent)))) { return "exceptions"; }
    return review.exceptions.length > 0 || review.decisions.some(decision => decision.outcome === "unreviewed" || (decision.outcome === "rejected" && recorded.has(ReviewDecision.key(decision.blocker, decision.dependent)))) ? "exceptions" : "reviewed";
  }
}
