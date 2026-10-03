import type { Dag } from "../domain/Dag.ts";
import type { Task } from "../domain/Task.ts";

export type FindingKind = "isolated" | "redundant-edge" | "stale-blocker" | "canceled-blocker" | "dangling-blocker" | "cycle" | "split-candidate";

export interface FindingFields {
  kind: FindingKind;
  task: string;
  detail: string;
  /** The observation that would make this finding wrong. Empty only for structural facts. */
  wouldKill: string;
}

export class Finding {
  readonly kind: FindingKind;
  readonly task: string;
  readonly detail: string;
  readonly wouldKill: string;

  constructor(f: FindingFields) {
    this.kind = f.kind;
    this.task = f.task;
    this.detail = f.detail;
    this.wouldKill = f.wouldKill;
    Object.freeze(this);
  }
}

const finding =
  (kind: FindingKind) =>
  (task: string, detail: string, wouldKill = ""): Finding =>
    new Finding({ kind, task, detail, wouldKill });

/** Fan-out at or above this is a split candidate: a wide hub is often two things sharing one card. */
export const WIDE_FAN_OUT = 4;
const TWO_VERB_TITLE = /\b(and|then|plus)\b/i;

/**
 * The audit answers three questions about existing cards: is it in the
 * graph at all, do its edges make sense, and is it one thing or several.
 * It reports; it never mutates. Every split candidate carries its reason
 * and the observation that would kill it, because that call is a human's.
 */
export class AuditService {
  audit(dag: Dag): Finding[] {
    const v = dag.validate();
    return [
      ...v.cycles.map((c) => finding("cycle")([...c].sort()[0] ?? "", `cycle among ${[...c].sort().join(", ")}`, "")),
      ...v.dangling.map((d) => finding("dangling-blocker")(d.task, `blocked by ${d.ref}, which is not in this graph`, "the referenced issue is in another project and that is intended")),
      ...v.redundant.map((r) => finding("redundant-edge")(r.from, `blocked by ${r.to} is implied via ${r.via}`, "the direct edge carries a meaning the chain does not")),
      ...this.staleBlockers(dag),
      ...this.canceledBlockers(dag),
      ...this.isolated(dag),
      ...dag.tasks.filter((t) => !t.isDone()).flatMap((t) => this.splitCandidates(dag, t)),
    ];
  }

  private staleBlockers(dag: Dag): Finding[] {
    return dag.tasks
      .filter((t) => !t.isDone())
      .flatMap((t) =>
        dag.blockers(t.id)
          .filter((b) => dag.get(b).satisfiesPrerequisite())
          .map((b) => finding("stale-blocker")(t.id, `blocked by ${b}, which is ${dag.get(b).status}`, "the relation is kept deliberately as history")),
      );
  }

  private canceledBlockers(dag: Dag): Finding[] {
    return dag.tasks.filter((t) => !t.isDone()).flatMap((t) =>
      dag.blockers(t.id).filter((b) => dag.get(b).isCanceled()).map((b) =>
        finding("canceled-blocker")(t.id, `Canceled prerequisite ${b} supplies no completed output; review or replace the dependency before scheduling ${t.id}`, "the source dependency has been explicitly removed or replaced after review")));
  }

  private isolated(dag: Dag): Finding[] {
    return dag.tasks
      .filter((t) => !t.isDone() && dag.blockers(t.id).length === 0 && dag.dependents(t.id).length === 0)
      .map((t) => finding("isolated")(t.id, "no blockers and no dependents", "the task is genuinely independent of everything else in the project"));
  }

  private splitCandidates(dag: Dag, t: Task): Finding[] {
    const out: Finding[] = [];
    if (TWO_VERB_TITLE.test(t.title)) {
      out.push(finding("split-candidate")(t.id, `title joins two things: "${t.title}"`, "the conjunction is inside one deliverable's name"));
    }
    const fanOut = dag.dependents(t.id).filter((d) => !dag.get(d).isDone()).length;
    if (fanOut >= WIDE_FAN_OUT) {
      out.push(finding("split-candidate")(t.id, `${String(fanOut)} open tasks depend on it`, "every dependent needs all of it, not a part"));
    }
    return out;
  }
}
