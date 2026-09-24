import { describe, expect, test } from "bun:test";
import { AddBlockingRelation, RemoveBlockingRelation, SetEstimate, SetMilestone } from "../src/core/domain/Mutation.ts";
import { Plan, Unmatched } from "../src/core/domain/Plan.ts";
import { PlanJsonCodec, PLAN_SCHEMA } from "../src/adapters/plan/PlanJsonCodec.ts";
import { PlanTextAdapter } from "../src/adapters/output/PlanTextAdapter.ts";

const codec = new PlanJsonCodec();

const fullPlan = (): Plan =>
  new Plan({
    mutations: [
      new AddBlockingRelation("a", "b"),
      new RemoveBlockingRelation("c", "d"),
      new SetEstimate("e", 2, 3),
      new SetEstimate("f", null, 1),
      new SetMilestone("g", "Stream One", null),
      new SetMilestone("h", null, "Old"),
    ],
    unmatched: [new Unmatched("ghost", "GHOST-1", "no task at the source has this id or key")],
    desiredSource: "dag:plan.json",
    currentSource: "linear:Example",
    createdAt: "2026-09-23",
    labels: { a: "PRO-1", b: "PRO-2" },
  });

describe("PlanJsonCodec", () => {
  // oracle: round-trip invariant. decode(encode(p)) equals p field for field, for every mutation kind.
  test("every mutation kind round-trips through JSON", () => {
    const before = fullPlan();
    const after = codec.decode(codec.encode(before));
    expect(after.toJSON()).toEqual(before.toJSON());
  });

  test("the encoded plan carries its schema id", () => {
    expect(JSON.parse(codec.encode(fullPlan()))).toMatchObject({ schema: PLAN_SCHEMA });
  });

  test("decoding refuses a document with the wrong schema", () => {
    expect(() => codec.decode('{"schema":"nope"}')).toThrow(/expected schema/);
  });

  test("decoding refuses an unknown mutation kind rather than skipping it", () => {
    const doc = JSON.stringify({ schema: PLAN_SCHEMA, desiredSource: "a", currentSource: "b", createdAt: "c", labels: {}, mutations: [{ kind: "delete-everything" }], unmatched: [] });
    expect(() => codec.decode(doc)).toThrow(/unknown mutation kind/);
  });

  test("decoding refuses a mutation missing a required field", () => {
    const doc = JSON.stringify({ schema: PLAN_SCHEMA, desiredSource: "a", currentSource: "b", createdAt: "c", labels: {}, mutations: [{ kind: "add-blocking-relation", blockerId: "x" }], unmatched: [] });
    expect(() => codec.decode(doc)).toThrow(/blockedId must be a string/);
  });

  test("a null estimate survives the round trip as null, not as absent", () => {
    const plan = new Plan({ mutations: [new SetEstimate("a", null, 2)], unmatched: [], desiredSource: "d", currentSource: "c", createdAt: "x", labels: {} });
    const decoded = codec.decode(codec.encode(plan));
    expect(decoded.mutations[0]!.toJSON()).toEqual({ kind: "set-estimate", taskId: "a", from: 2, to: null });
  });
});

describe("Plan", () => {
  test("destructive is exactly the removals and the overwrites", () => {
    const kinds = fullPlan().destructive.map((m) => m.toJSON());
    expect(kinds).toEqual([
      { kind: "remove-blocking-relation", blockerId: "c", blockedId: "d" },
      { kind: "set-estimate", taskId: "e", from: 3, to: 2 },
      { kind: "set-estimate", taskId: "f", from: 1, to: null },
      { kind: "set-milestone", taskId: "h", from: "Old", to: null },
    ]);
  });

  test("labels fall back to the id when the plan has no label for it", () => {
    const label = fullPlan().label();
    expect(label("a")).toBe("PRO-1");
    expect(label("zzz")).toBe("zzz");
  });

  test("an empty plan reports itself empty", () => {
    const empty = new Plan({ mutations: [], unmatched: [], desiredSource: "d", currentSource: "c", createdAt: "x", labels: {} });
    expect(empty.isEmpty).toBe(true);
    expect(empty.counts().size).toBe(0);
  });
});

describe("PlanTextAdapter", () => {
  // oracle: specified. A reader must be able to answer "does this delete anything" without reading every line.
  test("destructive changes are listed under their own heading, not mixed into the others", () => {
    const text = new PlanTextAdapter().renderPlan(fullPlan());
    const destructiveAt = text.indexOf("DESTRUCTIVE");
    expect(destructiveAt).toBeGreaterThan(-1);
    expect(text.indexOf("PRO-2 is blocked by PRO-1")).toBeLessThan(destructiveAt);
    expect(text).toContain("--allow-destructive");
  });

  test("unmatched tasks are named with their reason and the promise that nothing is written for them", () => {
    const text = new PlanTextAdapter().renderPlan(fullPlan());
    expect(text).toContain("GHOST-1: no task at the source has this id or key");
    expect(text).toContain("nothing is written for these");
  });

  test("an empty plan says so rather than printing an empty list", () => {
    const empty = new Plan({ mutations: [], unmatched: [], desiredSource: "d", currentSource: "c", createdAt: "x", labels: {} });
    expect(new PlanTextAdapter().renderPlan(empty)).toContain("no changes");
  });
});
