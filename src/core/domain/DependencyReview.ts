import { ReviewDecision } from "./ReviewDecision.ts";

export interface DependencyReviewFields {
  sourceVersion: string;
  taskIds: readonly string[];
  basis: string;
  exceptions: readonly string[];
  reviewedAt: string;
  reviewer: string;
  decisions?: readonly ReviewDecision[];
}

/** A scoped human assertion about captured evidence, never proof that all dependencies exist. */
export class DependencyReview {
  readonly sourceVersion: string;
  readonly taskIds: readonly string[];
  readonly basis: string;
  readonly exceptions: readonly string[];
  readonly reviewedAt: string;
  readonly reviewer: string;
  readonly decisions: readonly ReviewDecision[];

  constructor(f: DependencyReviewFields) {
    DependencyReview.validate(f);
    this.sourceVersion = f.sourceVersion;
    this.taskIds = Object.freeze([...f.taskIds].sort());
    this.basis = f.basis;
    this.exceptions = Object.freeze([...f.exceptions]);
    this.reviewedAt = f.reviewedAt;
    this.reviewer = f.reviewer;
    this.decisions = Object.freeze([...(f.decisions ?? [])]);
    const identities = this.decisions.map(decision => ReviewDecision.key(decision.blocker, decision.dependent));
    const scope = new Set(this.taskIds);
    if (new Set(identities).size !== identities.length || this.decisions.some(decision => !scope.has(decision.dependent))) { throw new Error("review: invalid decision scope"); }
    Object.freeze(this);
  }

  private static validate(f: DependencyReviewFields): void {
    if (!/^[a-f0-9]{64}$/.test(f.sourceVersion)) { throw new Error("review: invalid source identity"); }
    if (!f.basis.trim() || !f.reviewer.trim() || !Number.isFinite(Date.parse(f.reviewedAt))) { throw new Error("review: basis, reviewer, and capture time are required"); }
    if (f.taskIds.some(id => !id.trim()) || new Set(f.taskIds).size !== f.taskIds.length) { throw new Error("review: scope must contain unique task identities"); }
    DependencyReview.limits(f);
  }

  private static limits(f: DependencyReviewFields): void {
    if ((f.decisions?.length ?? 0) > 20000) { throw new Error("review: maximum combined recorded and candidate decisions is 20000; use a smaller capture"); }
    if (f.basis.length > 65536 || f.reviewer.length > 256 || f.taskIds.length > 5000 || f.exceptions.length > 5000) { throw new Error("review: evidence exceeds supported limits"); }
    if (f.exceptions.some(value => !value.trim() || value.length > 65536)) { throw new Error("review: invalid exception"); }
  }
}
