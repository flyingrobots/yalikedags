/**
 * The live suite. Skipped unless the fixture environment is configured, so
 * `bun test` stays hermetic and offline by default.
 *
 * Two deviations from docs/standards/testing.md are deliberate and declared
 * here rather than hidden. These tests are not hermetic (rule 8): they talk to
 * a real workspace. And they are order-dependent within the file (rule 9's
 * spirit): each one leaves state the next reads. Both are the point. The
 * property under test is what happens when this code meets the real Linear
 * API, and that cannot be established by a fake, however careful. The fixture
 * is reset to its declared baseline before and after the file runs, so the
 * file as a whole is repeatable even though its tests are not independent.
 *
 *   bun run test:live            once the fixture has been provisioned
 *   YALIKEDAGS_LIVE=1 bun test test/live/
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Dag } from "../../src/core/domain/Dag.ts";
import { Task } from "../../src/core/domain/Task.ts";
import { ReconcileService } from "../../src/core/services/ReconcileService.ts";
import { ApplyService } from "../../src/core/services/ApplyService.ts";
import { LinearTaskRepositoryAdapter } from "../../src/adapters/input/LinearTaskRepositoryAdapter.ts";
import { LinearTaskWriterAdapter } from "../../src/adapters/output/LinearTaskWriterAdapter.ts";
import { DryRunTaskWriterAdapter } from "../../src/adapters/output/DryRunTaskWriterAdapter.ts";
import { FetchHttpAdapter } from "../../src/adapters/http/FetchHttpAdapter.ts";
import { liveEnabled, resolveFixture, LiveFixture, TITLE_PREFIX, assertFixtureProject } from "../../scripts/live-fixture.ts";
import type { FixtureEnv } from "../../scripts/live-fixture.ts";
import { FixedClockAdapter } from "../fakes/FixedClockAdapter.ts";

/**
 * Opt in with YALIKEDAGS_LIVE=1. The switch is an environment variable and
 * nothing else is: the key comes from the keychain and the team and project
 * from the manifest a previous provision wrote, so a shell that exported
 * only the switch can still run this.
 */
const suite = liveEnabled() ? describe : describe.skip;
const MINUTE = 60_000;
const clock = new FixedClockAdapter("2026-09-23");

/** Every test reads through this, so nothing is asserted against a stale view. */
const readCurrent = async (e: FixtureEnv): Promise<Dag> => {
  const tasks = await new LinearTaskRepositoryAdapter(new FetchHttpAdapter(), e.key, e.project).load();
  return new Dag(tasks.filter((t) => t.title.startsWith(TITLE_PREFIX)));
};

const byTitle = (dag: Dag, suffix: string): Task => {
  const found = dag.tasks.find((t) => t.title === `${TITLE_PREFIX} ${suffix}`);
  if (found === undefined) {
    throw new Error(`fixture issue "${TITLE_PREFIX} ${suffix}" is missing; run bun run fixture:provision`);
  }
  return found;
};

/** A desired graph over the real ids, so matching is by id and the test is about writing, not matching. */
const desiredOf = (current: Dag, edges: [string, string][], fields: Partial<Record<string, number>> = {}): Dag =>
  new Dag(
    current.tasks.map((t) => {
      const blockedBy = edges.filter(([, to]) => byTitle(current, to).id === t.id).map(([from]) => byTitle(current, from).id);
      const effort = fields[t.title];
      return new Task({ id: t.id, key: t.key, title: t.title, blockedBy, ...(effort !== undefined && { effort }) });
    }),
  );

const reset = async (e: FixtureEnv): Promise<void> => {
  await new LiveFixture(e, { write: true, createTeam: false, log: (): void => undefined }).run();
};

suite("live Linear round trip", () => {
  let e: FixtureEnv;
  let configured = false;

  beforeAll(async () => {
    const found = await resolveFixture();
    assertFixtureProject(found.project);
    e = found;
    configured = true;
    await reset(e);
  }, 5 * MINUTE);

  afterAll(async () => {
    if (configured) { await reset(e); }
  }, 5 * MINUTE);

  // oracle: specified by the fixture baseline in scripts/live-fixture.ts.
  test("the reader sees the declared baseline", async () => {
    const dag = await readCurrent(e);
    expect(dag.size).toBe(8);
    expect(dag.blockers(byTitle(dag, "B blocked by A").id)).toEqual([byTitle(dag, "A root").id]);
    expect(dag.blockers(byTitle(dag, "H prune source").id)).toEqual([byTitle(dag, "G link target").id]);
    expect(dag.blockers(byTitle(dag, "D isolated").id)).toEqual([]);
    expect(byTitle(dag, "E estimated").effort).toBe(2);
    expect(byTitle(dag, "F milestoned").milestone).toBe(`${TITLE_PREFIX} Stream One`);
  }, MINUTE);

  test("a plan proposes only the edge that is missing", async () => {
    const current = await readCurrent(e);
    const desired = desiredOf(current, [["A root", "B blocked by A"], ["A root", "D isolated"]]);
    const plan = new ReconcileService(clock).plan({ desired, current, desiredSource: "memory", currentSource: `linear:${e.project}` });
    expect(plan.mutations).toHaveLength(1);
    expect(plan.mutations[0]!.toJSON()).toMatchObject({
      kind: "add-blocking-relation",
      blockerId: byTitle(current, "A root").id,
      blockedId: byTitle(current, "D isolated").id,
    });
  }, MINUTE);

  test("a dry run writes nothing to the workspace", async () => {
    const current = await readCurrent(e);
    const desired = desiredOf(current, [["A root", "D isolated"]]);
    const plan = new ReconcileService(clock).plan({ desired, current, desiredSource: "memory", currentSource: `linear:${e.project}` });
    const writer = new DryRunTaskWriterAdapter("dry");
    await new ApplyService().apply({ plan, writer, before: current, reread: () => Promise.resolve(current), at: "x" });
    expect(writer.writes).toHaveLength(1);
    const after = await readCurrent(e);
    expect(after.blockers(byTitle(after, "D isolated").id)).toEqual([]);
  }, 2 * MINUTE);

  test("apply adds the relation and the receipt confirms it from a fresh read", async () => {
    const current = await readCurrent(e);
    const desired = desiredOf(current, [["A root", "D isolated"]]);
    const plan = new ReconcileService(clock).plan({ desired, current, desiredSource: "memory", currentSource: `linear:${e.project}` });
    const receipt = await new ApplyService().apply({
      plan,
      writer: new LinearTaskWriterAdapter(new FetchHttpAdapter(), e.key, e.project),
      before: current,
      reread: () => readCurrent(e),
      at: "live",
    });
    expect(receipt.count("failed")).toBe(0);
    expect(receipt.complete).toBe(true);
    const after = await readCurrent(e);
    expect(after.blockers(byTitle(after, "D isolated").id)).toEqual([byTitle(after, "A root").id]);
  }, 3 * MINUTE);

  // oracle: invariant. Applying the same plan twice must leave the workspace where the first run left it.
  test("applying the same plan again is a no-op that still confirms", async () => {
    const current = await readCurrent(e);
    const desired = desiredOf(current, [["A root", "D isolated"]]);
    const plan = new ReconcileService(clock).plan({ desired, current, desiredSource: "memory", currentSource: `linear:${e.project}` });
    expect(plan.isEmpty).toBe(true);

    const forced = new ReconcileService(clock).plan(
      { desired: desiredOf(current, [["A root", "D isolated"]]), current: new Dag(current.tasks.map((t) => new Task({ id: t.id, key: t.key, title: t.title }))), desiredSource: "memory", currentSource: `linear:${e.project}` },
    );
    const receipt = await new ApplyService().apply({
      plan: forced,
      writer: new LinearTaskWriterAdapter(new FetchHttpAdapter(), e.key, e.project),
      before: current,
      reread: () => readCurrent(e),
      at: "live",
    });
    expect(receipt.complete).toBe(true);
    const after = await readCurrent(e);
    expect(after.blockers(byTitle(after, "D isolated").id)).toEqual([byTitle(after, "A root").id]);
  }, 3 * MINUTE);

  test("an estimate is written and reads back exactly on the fixture team scale", async () => {
    const current = await readCurrent(e);
    const desired = desiredOf(current, [], { [`${TITLE_PREFIX} A root`]: 3 });
    const plan = new ReconcileService(clock).plan({ desired, current, desiredSource: "memory", currentSource: `linear:${e.project}` });
    expect(plan.mutations.map((m) => m.kind)).toContain("set-estimate");
    const receipt = await new ApplyService().apply({
      plan,
      writer: new LinearTaskWriterAdapter(new FetchHttpAdapter(), e.key, e.project),
      before: current,
      reread: () => readCurrent(e),
      at: "live",
      refuseDestructive: false,
    });
    expect(receipt.count("failed")).toBe(0);
    expect(byTitle(await readCurrent(e), "A root").effort).toBe(3);
  }, 3 * MINUTE);

  test("prune removes an edge the desired graph does not declare, and only with permission", async () => {
    const current = await readCurrent(e);
    const desired = desiredOf(current, [["A root", "B blocked by A"], ["B blocked by A", "C blocked by B"], ["A root", "D isolated"]]);
    const plan = new ReconcileService(clock).plan(
      { desired, current, desiredSource: "memory", currentSource: `linear:${e.project}` },
      { prune: true, estimates: false },
    );
    expect(plan.destructive.map((m) => m.toJSON())).toContainEqual({
      kind: "remove-blocking-relation",
      blockerId: byTitle(current, "G link target").id,
      blockedId: byTitle(current, "H prune source").id,
    });

    const guarded = await new ApplyService().apply({
      plan,
      writer: new LinearTaskWriterAdapter(new FetchHttpAdapter(), e.key, e.project),
      before: current,
      reread: () => readCurrent(e),
      at: "live",
    });
    expect(guarded.count("skipped")).toBe(plan.destructive.length);
    expect((await readCurrent(e)).blockers(byTitle(current, "H prune source").id)).toHaveLength(1);

    const allowed = await new ApplyService().apply({
      plan,
      writer: new LinearTaskWriterAdapter(new FetchHttpAdapter(), e.key, e.project),
      before: current,
      reread: () => readCurrent(e),
      at: "live",
      refuseDestructive: false,
    });
    expect(allowed.complete).toBe(true);
    expect((await readCurrent(e)).blockers(byTitle(current, "H prune source").id)).toEqual([]);
  }, 5 * MINUTE);

  test("a milestone that does not exist is refused by name rather than created", async () => {
    const writer = new LinearTaskWriterAdapter(new FetchHttpAdapter(), e.key, e.project);
    const current = await readCurrent(e);
    const outcome = await writer.setMilestone(byTitle(current, "A root").id, "no such milestone").then(
      () => undefined,
      (err: unknown) => (err instanceof Error ? err.message : String(err)),
    );
    expect(outcome).toMatch(/^linear_milestone_not_found/);
  }, 2 * MINUTE);
});
