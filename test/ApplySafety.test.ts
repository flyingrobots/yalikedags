import { describe, expect, test } from "bun:test";
import { Task } from "../src/core/domain/Task.ts";
import { Dag } from "../src/core/domain/Dag.ts";
import { Plan } from "../src/core/domain/Plan.ts";
import { AddBlockingRelation, RemoveBlockingRelation, SetEstimate } from "../src/core/domain/Mutation.ts";
import { ApplyService } from "../src/core/services/ApplyService.ts";
import { DryRunTaskWriterAdapter } from "../src/adapters/output/DryRunTaskWriterAdapter.ts";
import { rejection } from "./fakes/rejection.ts";

const task = (id: string, blockedBy: string[] = []): Task => new Task({ id, title: id, blockedBy });
const original = (): Dag => new Dag([task("a"), task("b", ["a"])]);
const reversal = (): Plan => new Plan({
  mutations: [new AddBlockingRelation("b", "a"), new RemoveBlockingRelation("a", "b")],
  unmatched: [], labels: {}, desiredSource: "example", currentSource: "example", createdAt: "today",
});

/** A real in-memory graph, including a writer that can acknowledge but ignore removal. */
class GraphWriter extends DryRunTaskWriterAdapter {
  graph = original();
  removal: "apply" | "ignore" | "fail" = "apply";
  loseNextAdditionResponse = false;

  override async addBlockingRelation(blocker: string, blocked: string): Promise<void> {
    await super.addBlockingRelation(blocker, blocked);
    this.graph = new Dag(this.graph.tasks.map((t) => new AddBlockingRelation(blocker, blocked).projectEdges(t)));
    if (this.loseNextAdditionResponse) {
      this.loseNextAdditionResponse = false;
      throw new Error("connection lost after the source accepted the addition");
    }
  }

  override async removeBlockingRelation(blocker: string, blocked: string): Promise<void> {
    await super.removeBlockingRelation(blocker, blocked);
    if (this.removal === "fail") { throw new Error("removal failed"); }
    if (this.removal === "apply") {
      this.graph = new Dag(this.graph.tasks.map((t) => new RemoveBlockingRelation(blocker, blocked).projectEdges(t)));
    }
  }
}

const request = (writer: GraphWriter): Parameters<ApplyService["apply"]>[0] => ({
  plan: reversal(), writer, before: writer.graph, reread: () => Promise.resolve(writer.graph), at: "today",
});

describe("apply graph safety", () => {
  // oracle: specified. A reversal must never leave both directions, including partial execution.
  test("refuses the effective plan before writing if its required removal is not permitted", async () => {
    const writer = new GraphWriter("memory");
    const error = await rejection(new ApplyService().apply(request(writer)));
    expect(error.message).toMatch(/plan_would_cycle/);
    expect(writer.writes).toEqual([]);
  });

  test("removes and verifies before adding, and a retry is a no-op", async () => {
    const writer = new GraphWriter("memory");
    const receipt = await new ApplyService().apply({ ...request(writer), refuseDestructive: false });
    expect(writer.writes.map((w) => w.method)).toEqual(["removeBlockingRelation", "addBlockingRelation"]);
    expect(writer.graph.validate().cycles).toEqual([]);
    expect(receipt.complete).toBe(true);
    const retry = await new ApplyService().apply({ ...request(writer), refuseDestructive: false });
    expect(writer.writes).toHaveLength(2);
    expect(retry.complete).toBe(true);
  });

  for (const mode of ["ignore", "fail"] as const) {
    test(`does not add when removal ${mode}s`, async () => {
      const writer = new GraphWriter("memory");
      writer.removal = mode;
      const receipt = await new ApplyService().apply({ ...request(writer), refuseDestructive: false });
      expect(writer.writes.map((w) => w.method)).toEqual(["removeBlockingRelation"]);
      expect(writer.graph.validate().cycles).toEqual([]);
      expect(receipt.complete).toBe(false);
    });
  }

  test("refuses an addition against a newly conflicting source graph", async () => {
    const writer = new GraphWriter("memory");
    const p = reversal();
    const plan = new Plan({ mutations: [new AddBlockingRelation("b", "a")], unmatched: [], labels: {}, desiredSource: p.desiredSource, currentSource: p.currentSource, createdAt: p.createdAt });
    expect((await rejection(new ApplyService().apply({ ...request(writer), plan }))).message).toMatch(/plan_would_cycle/);
    expect(writer.writes).toEqual([]);
  });

  test("does not add when the removal verification read fails", async () => {
    const writer = new GraphWriter("memory");
    const receipt = await new ApplyService().apply({
      ...request(writer), refuseDestructive: false, reread: () => Promise.reject(new Error("offline")),
    });
    expect(writer.writes.map((w) => w.method)).toEqual(["removeBlockingRelation"]);
    expect(receipt.complete).toBe(false);
  });

  test("a cycle appearing during execution cannot produce a complete receipt", async () => {
    const writer = new GraphWriter("memory");
    const p = reversal();
    const plan = new Plan({ mutations: [new AddBlockingRelation("a", "c")], unmatched: [], labels: {}, desiredSource: p.desiredSource, currentSource: p.currentSource, createdAt: p.createdAt });
    writer.graph = new Dag([task("a"), task("c")]);
    const receipt = await new ApplyService().apply({
      ...request(writer), plan,
      reread: () => Promise.resolve(new Dag([task("a", ["c"]), task("c", ["a"])])),
    });
    expect(receipt.complete).toBe(false);
  });

  test("a field changed during removal verification is stale, not overwritten", async () => {
    const writer = new GraphWriter("memory");
    const plan = new Plan({
      mutations: [...reversal().mutations, new SetEstimate("a", 2, null)], unmatched: [], labels: {},
      desiredSource: "example", currentSource: "example", createdAt: "today",
    });
    const receipt = await new ApplyService().apply({
      ...request(writer), plan, refuseDestructive: false,
      reread: () => {
        writer.graph = new Dag(writer.graph.tasks.map((t) => t.id === "a" ? t.with({ effort: 3 }) : t));
        return Promise.resolve(writer.graph);
      },
    });
    expect(writer.writes.map((w) => w.method)).toEqual(["removeBlockingRelation", "addBlockingRelation"]);
    expect(receipt.count("stale")).toBe(1);
    expect(receipt.complete).toBe(false);
  });

  test("an effect already present at startup must still hold in the final read", async () => {
    const writer = new GraphWriter("memory");
    const plan = new Plan({ mutations: [new AddBlockingRelation("a", "b")], unmatched: [], labels: {},
      desiredSource: "example", currentSource: "example", createdAt: "today" });
    const receipt = await new ApplyService().apply({
      ...request(writer), plan, reread: () => Promise.resolve(new Dag([task("a"), task("b")])),
    });
    expect(writer.writes).toEqual([]);
    expect(receipt.count("unconfirmed")).toBe(1);
    expect(receipt.complete).toBe(false);
  });

  test("a failed addition may have landed: later additions must account for it", async () => {
    const writer = new GraphWriter("memory");
    writer.graph = new Dag([task("a"), task("b", ["a"]), task("c")]);
    writer.removal = "ignore";
    writer.loseNextAdditionResponse = true;
    const plan = new Plan({ mutations: [new RemoveBlockingRelation("a", "b"),
      new AddBlockingRelation("b", "c"), new AddBlockingRelation("c", "a")],
    unmatched: [], labels: {}, desiredSource: "example", currentSource: "example", createdAt: "today" });
    const receipt = await new ApplyService().apply({ ...request(writer), plan, refuseDestructive: false });
    expect(writer.writes.map((w) => w.method)).toEqual(["removeBlockingRelation", "addBlockingRelation"]);
    expect(writer.graph.validate().cycles).toEqual([]);
    expect(receipt.complete).toBe(false);
  });
});
