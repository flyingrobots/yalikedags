import { describe, expect, test } from "bun:test";
import { Task } from "../src/core/domain/Task.ts";
import type { TaskFields } from "../src/core/domain/Task.ts";
import { AnalysisService } from "../src/core/services/AnalysisService.ts";
import { TaskListParserAdapter } from "../src/adapters/input/TaskListParserAdapter.ts";
import { JsonSnapshotAdapter } from "../src/adapters/output/JsonSnapshotAdapter.ts";
import { JsonSnapshotRepositoryAdapter } from "../src/adapters/input/JsonSnapshotRepositoryAdapter.ts";
import { DotRendererAdapter } from "../src/adapters/output/DotRendererAdapter.ts";
import { SvgRendererAdapter } from "../src/adapters/output/SvgRendererAdapter.ts";
import { LayeredLayoutService } from "../src/core/services/LayeredLayoutService.ts";
import { PlanTextAdapter } from "../src/adapters/output/PlanTextAdapter.ts";
import { Plan } from "../src/core/domain/Plan.ts";
import { SetEstimate } from "../src/core/domain/Mutation.ts";
import { ApplyReceipt, MutationResult } from "../src/core/services/ApplyService.ts";
import type { Outcome } from "../src/core/services/ApplyService.ts";
import { FixedClockAdapter } from "./fakes/FixedClockAdapter.ts";

const clock = new FixedClockAdapter("2026-09-23");
const analyser = new AnalysisService(clock);
const t = (id: string, blockedBy: string[] = [], extra: Partial<TaskFields> = {}): Task =>
  new Task({ id, title: id, blockedBy, ...extra });

const EXAMPLE = `- [x] Setup project repository
- [x] Create basic project structure
- [ ] Implement core DAG builder (depends on: Create basic project structure)
- [ ] Implement state determination logic [WIP] (depends on: Implement core DAG builder)
  - [ ] Nested child task
- [ ] Write documentation
`;

describe("TaskListParserAdapter", () => {
  // oracle: specified by the format the Python prototype accepted; the example file is the fixture.
  test("parses checkboxes, WIP markers, depends-on clauses and indentation into tasks", async () => {
    const tasks = await new TaskListParserAdapter(EXAMPLE, "inline").load();
    const byTitle = new Map(tasks.map((x) => [x.title, x]));
    expect(tasks).toHaveLength(6);
    expect(byTitle.get("Setup project repository")?.status).toBe("done");
    expect(byTitle.get("Implement state determination logic")?.status).toBe("in-progress");
    expect(byTitle.get("Implement core DAG builder")?.blockedBy).toEqual([byTitle.get("Create basic project structure")!.id]);
    expect(byTitle.get("Nested child task")?.parent).toBe(byTitle.get("Implement state determination logic")!.id);
    expect(byTitle.get("Implement state determination logic")?.children).toEqual([byTitle.get("Nested child task")!.id]);
  });
  test("a depends-on clause naming an unknown task is kept as a dangling ref, not dropped", async () => {
    const tasks = await new TaskListParserAdapter("- [ ] A (depends on: Nope)\n", "inline").load();
    expect(tasks[0]!.blockedBy).toEqual(["nope"]);
  });
  test("the bundled example parses to twelve tasks", async () => {
    const text = await Bun.file("examples/example-tasklist.txt").text();
    expect((await new TaskListParserAdapter(text, "examples/example-tasklist.txt").load())).toHaveLength(12);
  });
});

describe("JsonSnapshotAdapter", () => {
  // oracle: round-trip invariant. decode(encode(a)).tasks equals a.tasks field for field.
  test("a snapshot round-trips every task field through JSON", async () => {
    const tasks = [
      t("a", [], { key: "PRO-1", status: "done", priority: 2, effort: 3, assignee: "Sam", labels: ["x", "y"], milestone: "m", due: "2026-10-01", resources: ["db"], url: "https://example.com/a", createdAt: "2026-09-01T00:00:00Z", description: "d" }),
      t("b", ["a"], { parent: "a" }),
    ];
    const encoded = new JsonSnapshotAdapter().render(analyser.analyse(tasks, "inline"));
    const decoded = await new JsonSnapshotRepositoryAdapter(encoded, "inline").load();
    expect(decoded.map((x) => x.toFields())).toEqual(tasks.map((x) => x.toFields()));
  });
  test("the snapshot carries the derived views alongside the tasks", () => {
    const parsed: unknown = JSON.parse(new JsonSnapshotAdapter().render(analyser.analyse([t("a"), t("b", ["a"])], "inline")));
    expect(parsed).toMatchObject({ schema: "yalikedags/snapshot/1", source: "inline", asOf: "2026-09-23" });
    expect(parsed).toHaveProperty("frontier");
    expect(parsed).toHaveProperty("criticalPath.byDepth.tasks", ["a", "b"]);
  });
  test("decoding refuses a snapshot with the wrong schema", async () => {
    const failure = await new JsonSnapshotRepositoryAdapter('{"schema":"nope","tasks":[]}', "x").load().then(() => undefined, (e: unknown) => e);
    expect(failure).toBeInstanceOf(Error);
    expect(String(failure)).toMatch(/schema/);
  });
});

describe("LayeredLayoutService", () => {
  // oracle: invariant. Every blocker is placed in an earlier layer than its dependents; each task placed once.
  test("places every open and done task once, blockers in earlier columns than dependents", () => {
    const a = analyser.analyse([t("a"), t("b", ["a"]), t("c", ["a"]), t("d", ["b", "c"]), t("e")], "inline");
    const layout = new LayeredLayoutService().layout(a.dag);
    const col = new Map(layout.nodes.map((n) => [n.id, n.layer]));
    expect(layout.nodes).toHaveLength(5);
    expect(col.get("a")).toBeLessThan(col.get("b")!);
    expect(col.get("b")).toBeLessThan(col.get("d")!);
    expect(col.get("c")).toBeLessThan(col.get("d")!);
    const distinct = new Set(layout.nodes.map((n) => `${String(n.layer)}:${String(n.row)}`));
    expect(distinct.size).toBe(5);
  });
});

describe("DotRendererAdapter", () => {
  // oracle: specified. One node line per task, one edge line per blockedBy, state carried as a class attribute.
  test("emits a node per task and an edge from blocker to dependent, with the state on the node", () => {
    const dot = new DotRendererAdapter().render(analyser.analyse([t("a", [], { status: "done" }), t("b", ["a"])], "inline"));
    expect(dot).toContain('"a"');
    expect(dot).toContain('"a" -> "b"');
    expect(dot).toMatch(/"a" \[[^\]]*class="[^"]*done/);
    expect(dot).toMatch(/"b" \[[^\]]*class="[^"]*ready/);
    expect(dot.startsWith("digraph")).toBe(true);
  });
  test("escapes quotes in titles", () => {
    const dot = new DotRendererAdapter().render(analyser.analyse([t("a", [], { title: 'say "hi"' })], "inline"));
    expect(dot).toContain('say \\"hi\\"');
  });
});

describe("SvgRendererAdapter", () => {
  // oracle: specified. Standalone SVG, one <g class="node"> per task, one path per edge, no external references.
  test("renders a standalone SVG with a group per task and a path per edge and no external URLs", () => {
    const svg = new SvgRendererAdapter().render(analyser.analyse([t("a"), t("b", ["a"]), t("c", ["a"])], "inline"));
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.match(/<g class="node/g)).toHaveLength(3);
    expect(svg.match(/<path class="edge/g)).toHaveLength(2);
    expect(svg.replace(/xmlns="http:\/\/www.w3.org\/2000\/svg"/, "")).not.toMatch(/https?:\/\//);
  });
  test("escapes markup in titles", () => {
    const svg = new SvgRendererAdapter().render(analyser.analyse([t("a", [], { title: "<b>&" })], "inline"));
    expect(svg).toContain("&lt;b&gt;&amp;");
    expect(svg).not.toContain("<b>&");
  });
});

/**
 * The receipt text is the whole output of a write run, so what it tells a
 * person to do next is part of the contract rather than decoration.
 */
describe("PlanTextAdapter.renderReceipt", () => {
  const plan = new Plan({
    mutations: [new SetEstimate("id-1", 1, 2)],
    unmatched: [],
    desiredSource: "snapshot:want.json",
    currentSource: "linear:Example",
    createdAt: "2026-09-23",
    labels: { "id-1": "PRO-9" },
  });
  const receiptOf = (outcome: Outcome, detail: string, verified = true): ApplyReceipt =>
    new ApplyReceipt({ results: [new MutationResult(new SetEstimate("id-1", 1, 2), outcome, detail)], target: "Linear project Example", at: "2026-09-23", verified });

  // oracle: specified. Counts, one line per mutation with its label, and advice only when incomplete.
  test("names every outcome in the counts line, stale included", () => {
    const text = new PlanTextAdapter().renderReceipt(receiptOf("stale", "moved"), plan);
    expect(text).toContain("confirmed 0, unconfirmed 0, failed 0, skipped 0, stale 1");
    expect(text).toContain("stale       PRO-9 estimate 2 becomes 1  (moved)");
  });

  test("a stale plan is told to plan again, not that re-running is safe", () => {
    const text = new PlanTextAdapter().renderReceipt(receiptOf("stale", "moved"), plan);
    expect(text).toContain("Plan again");
    expect(text).not.toContain("Running it again is safe");
  });

  test("an unconfirmed plan is told that re-running is safe, because it is", () => {
    const text = new PlanTextAdapter().renderReceipt(receiptOf("unconfirmed", ""), plan);
    expect(text).toContain("Running it again is safe");
  });

  test("a complete receipt is given no advice at all", () => {
    const text = new PlanTextAdapter().renderReceipt(receiptOf("confirmed", ""), plan);
    expect(text).not.toContain("Plan again");
    expect(text).not.toContain("Running it again");
  });

  test("an unverified receipt says so before anything it goes on to claim", () => {
    const text = new PlanTextAdapter().renderReceipt(receiptOf("unconfirmed", "", false), plan);
    expect(text.split("\n")[1]).toMatch(/COULD NOT BE READ BACK/);
  });
});
