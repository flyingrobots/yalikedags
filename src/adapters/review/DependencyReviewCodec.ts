import { DependencyReview } from "../../core/domain/DependencyReview.ts";
import { ReviewDecision } from "../../core/domain/ReviewDecision.ts";
import { rec } from "../linear/GraphqlJson.ts";

/** A review imported from a file remains a claimed review, not authenticated reviewer identity. */
export class DependencyReviewCodec {
  decode(raw: unknown): DependencyReview | undefined {
    if (raw === undefined) { return undefined; }
    const data = rec(raw);
    if (data["schema"] !== "yalikedags/dependency-review/1") { throw new Error("review: unsupported schema"); }
    return new DependencyReview({ sourceVersion: this.text(data["sourceVersion"]), taskIds: this.list(data["taskIds"]), basis: this.text(data["basis"]),
      exceptions: this.list(data["exceptions"]), reviewedAt: this.text(data["reviewedAt"]), reviewer: this.text(data["reviewer"]), decisions: this.decisions(data["decisions"]) });
  }
  encode(review: DependencyReview): Record<string, unknown> {
    return { schema: "yalikedags/dependency-review/1", sourceVersion: review.sourceVersion, taskIds: review.taskIds,
      basis: review.basis, exceptions: review.exceptions, reviewedAt: review.reviewedAt, reviewer: review.reviewer,
      decisions: review.decisions.map(decision => ({ blocker: decision.blocker, dependent: decision.dependent, outcome: decision.outcome, note: decision.note })) };
  }
  private decisions(value: unknown): ReviewDecision[] {
    if (value === undefined) { return []; }
    if (!Array.isArray(value) || value.length > 20000) { throw new Error("review: expected bounded relationship decisions"); }
    return value.map((item: unknown) => {
      const data = rec(item); const outcome = data["outcome"];
      if (outcome !== "accepted" && outcome !== "rejected" && outcome !== "unreviewed") { throw new Error("review: invalid relationship decision"); }
      return new ReviewDecision({ blocker: this.text(data["blocker"]), dependent: this.text(data["dependent"]), outcome, note: this.text(data["note"]) });
    });
  }
  private text(value: unknown): string {
    if (typeof value !== "string") { throw new Error("review: expected text"); }
    return value;
  }
  private list(value: unknown): string[] {
    if (!Array.isArray(value) || value.length > 5000) { throw new Error("review: expected a bounded list"); }
    return value.map((item: unknown) => this.text(item));
  }
}
