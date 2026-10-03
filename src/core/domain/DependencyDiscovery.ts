import type { DependencyCandidate } from "./DependencyCandidate.ts";

/** Retained candidates and whether additional distinct pairs were omitted. */
export class DependencyDiscovery {
  static readonly limit = 2000;
  readonly candidates: readonly DependencyCandidate[];

  constructor(candidates: readonly DependencyCandidate[], readonly truncated: boolean) {
    if (candidates.length > DependencyDiscovery.limit) { throw new Error("discovery: candidate limit exceeded"); }
    this.candidates = Object.freeze([...candidates]);
    Object.freeze(this);
  }
}
