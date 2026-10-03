export type ReviewDecisionOutcome = "accepted" | "rejected" | "unreviewed";

export interface ReviewDecisionFields {
  blocker: string;
  dependent: string;
  outcome: ReviewDecisionOutcome;
  note: string;
}

/** An edge disposition supported only by the source version and basis of its enclosing review. */
export class ReviewDecision {
  static key(blocker: string, dependent: string): string { return `${String(blocker.length)}:${blocker}${dependent}`; }
  readonly blocker: string;
  readonly dependent: string;
  readonly outcome: ReviewDecisionOutcome;
  readonly note: string;
  constructor(f: ReviewDecisionFields) {
    if (!f.blocker.trim() || !f.dependent.trim() || f.blocker === f.dependent) { throw new Error("review: invalid relationship identities"); }
    if (f.outcome === "rejected" && !f.note.trim()) { throw new Error("review: explain each rejected relationship"); }
    if (f.note.length > 65536) { throw new Error("review: relationship note exceeds supported limits"); }
    this.blocker = f.blocker; this.dependent = f.dependent; this.outcome = f.outcome; this.note = f.note;
    Object.freeze(this);
  }
}
