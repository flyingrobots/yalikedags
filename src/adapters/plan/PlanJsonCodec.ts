/**
 * The plan wire format, both directions.
 *
 * A plan is written by one command and read by another, possibly after a
 * human has looked at it, so the decoder treats the file as untrusted input:
 * an unknown mutation kind is a refusal, not a skipped line. Silently
 * dropping a mutation would make `apply` do less than the plan a person
 * reviewed said it would, which is the one failure this format exists to
 * prevent.
 */
import { AddBlockingRelation, RemoveBlockingRelation, SetEstimate, SetMilestone } from "../../core/domain/Mutation.ts";
import type { Mutation } from "../../core/domain/Mutation.ts";
import { Plan, Unmatched } from "../../core/domain/Plan.ts";

export const PLAN_SCHEMA = "yalikedags/plan/1";
export const GUARDED_PLAN_SCHEMA = "yalikedags/plan/2";

type Rec = Record<string, unknown>;
const isRec = (x: unknown): x is Rec => typeof x === "object" && x !== null && !Array.isArray(x);

function requireString(o: Rec, key: string): string {
  const v = o[key];
  if (typeof v !== "string") {
    throw new Error(`plan: ${key} must be a string`);
  }
  return v;
}

function nullableNumber(o: Rec, key: string): number | null {
  const v = o[key];
  if (v === null || v === undefined) {
    return null;
  }
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) {
    throw new Error(`plan: ${key} must be a finite nonnegative number or null`);
  }
  return v;
}

function nullableString(o: Rec, key: string): string | null {
  const v = o[key];
  if (v === null || v === undefined) {
    return null;
  }
  if (typeof v !== "string") {
    throw new Error(`plan: ${key} must be a string or null`);
  }
  return v;
}

function decodeMutation(raw: unknown): Mutation {
  if (!isRec(raw)) {
    throw new Error("plan: every mutation must be an object");
  }
  const kind = requireString(raw, "kind");
  switch (kind) {
    case "add-blocking-relation":
      return new AddBlockingRelation(requireString(raw, "blockerId"), requireString(raw, "blockedId"));
    case "remove-blocking-relation":
      return new RemoveBlockingRelation(requireString(raw, "blockerId"), requireString(raw, "blockedId"));
    case "set-estimate":
      return new SetEstimate(requireString(raw, "taskId"), nullableNumber(raw, "to"), nullableNumber(raw, "from"));
    case "set-milestone":
      return new SetMilestone(requireString(raw, "taskId"), nullableString(raw, "to"), nullableString(raw, "from"));
    default:
      throw new Error(`plan: unknown mutation kind "${kind}"`);
  }
}

function decodeLabels(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!isRec(raw)) {
    return out;
  }
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "string") {
      out[k] = v;
    }
  }
  return out;
}

function prerequisiteVersion(parsed: Rec): string | undefined {
  if (parsed["schema"] === GUARDED_PLAN_SCHEMA) { return requireString(parsed, "prerequisiteVersion"); }
  if (parsed["prerequisiteVersion"] !== undefined) { throw new Error(`plan: a prerequisite guard requires schema ${GUARDED_PLAN_SCHEMA}`); }
  return undefined;
}

export class PlanJsonCodec {
  encode(plan: Plan): string {
    const schema = plan.prerequisiteVersion === undefined ? PLAN_SCHEMA : GUARDED_PLAN_SCHEMA;
    return `${JSON.stringify({ schema, ...plan.toJSON() }, null, 2)}\n`;
  }

  decode(text: string): Plan {
    const parsed: unknown = JSON.parse(text);
    if (!isRec(parsed) || (parsed["schema"] !== PLAN_SCHEMA && parsed["schema"] !== GUARDED_PLAN_SCHEMA)) {
      throw new Error(`plan: expected schema ${PLAN_SCHEMA} or ${GUARDED_PLAN_SCHEMA}`);
    }
    const mutations = Array.isArray(parsed["mutations"]) ? parsed["mutations"].map((m: unknown) => decodeMutation(m)) : [];
    const unmatched = Array.isArray(parsed["unmatched"]) ? parsed["unmatched"].filter(isRec) : [];
    return new Plan({
      prerequisiteVersion: prerequisiteVersion(parsed),
      mutations,
      unmatched: unmatched.map((u) => new Unmatched(requireString(u, "desiredId"), requireString(u, "desiredKey"), requireString(u, "reason"))),
      desiredSource: requireString(parsed, "desiredSource"),
      currentSource: requireString(parsed, "currentSource"),
      createdAt: requireString(parsed, "createdAt"),
      labels: decodeLabels(parsed["labels"]),
    });
  }
}
