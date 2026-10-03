export interface DependencyCandidateFields {
  blocker: string;
  dependent: string;
  evidence: string;
  confidence: "explicit" | "uncertain";
}

/** A cited direction for human review, never an accepted tracker relation. */
export class DependencyCandidate {
  readonly blocker: string;
  readonly dependent: string;
  readonly evidence: string;
  readonly confidence: "explicit" | "uncertain";
  constructor(f: DependencyCandidateFields) {
    if (!f.blocker || !f.dependent || f.blocker === f.dependent || !f.evidence.trim()) { throw new Error("candidate: endpoints and evidence required"); }
    this.blocker = f.blocker; this.dependent = f.dependent;
    this.evidence = f.evidence; this.confidence = f.confidence;
    Object.freeze(this);
  }
}
