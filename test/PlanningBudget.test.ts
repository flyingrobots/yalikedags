import { expect, test } from "bun:test";
import { Task } from "../src/core/domain/Task.ts";
import { AnalysisService } from "../src/core/services/AnalysisService.ts";
import { JsonSnapshotAdapter } from "../src/adapters/output/JsonSnapshotAdapter.ts";
import { JsonSnapshotRepositoryAdapter } from "../src/adapters/input/JsonSnapshotRepositoryAdapter.ts";
import { SnapshotBudget } from "../src/adapters/input/SnapshotBudget.ts";
import { ViewerData } from "../src/viewer/ViewerData.ts";
import { ViewerDataCodec } from "../src/viewer/ViewerDataCodec.ts";

test("planning evidence preserves export of an otherwise admissible large capture", async () => {
  // oracle: additive planning evidence must not consume the existing captured-data structure allowance.
  const tasks = Array.from({ length: 2400 }, (_, i) => new Task({ id: String(i), title: "Example" }));
  const analysis = new AnalysisService({ today: (): string => "2026-10-02" }).analyse(tasks, "synthetic");
  const renderer = new JsonSnapshotAdapter();
  const previous = renderer.toObject(analysis); delete previous["planning"];
  expect(() => { new SnapshotBudget().parse(JSON.stringify(previous)); }).not.toThrow();
  const reopened = new JsonSnapshotRepositoryAdapter(renderer.render(analysis), "export");
  expect(await reopened.load()).toHaveLength(2400);
  const decoded = await new ViewerDataCodec().decode(new ViewerData().render(analysis));
  expect(decoded.analysis.planning.included).toHaveLength(2400);
});

test("planning allowance is bounded separately without weakening captured-data or depth limits", () => {
  // oracle: only schema-tagged planning metadata gets its own bounded allowance; no untrusted subtree is ignored.
  const budget = new SnapshotBudget();
  const small = { schema: "yalikedags/snapshot/2", tasks: [] };
  const evidence = { schema: "yalikedags/planning/1", values: Array.from({ length: 99000 }, () => 0) };
  const captured = { ...small, values: Array.from({ length: 99000 }, () => 0) };
  expect(() => { budget.parse(JSON.stringify({ ...captured, planning: evidence })); }).not.toThrow();
  expect(() => { budget.parse(JSON.stringify({ ...captured, planning: { ...evidence, schema: "unknown" } })); }).toThrow("maximum structure");
  expect(() => { budget.parse(JSON.stringify({ ...captured, extra: Array.from({ length: 1000 }, () => 0), planning: evidence })); }).toThrow("maximum structure");
  expect(() => { budget.parse(JSON.stringify({ ...small, planning: { ...evidence, extra: Array.from({ length: 1000 }, () => 0) } })); }).toThrow("maximum structure");
  expect(() => { budget.parse(`{"schema":"yalikedags/snapshot/2","tasks":[],"planning":{"schema":"yalikedags/planning/1","extra":${"[".repeat(31)}0${"]".repeat(31)}}}`); }).toThrow("nesting levels");
});

test("recomputable candidate quotes do not crowd out a valid source snapshot", async () => {
  // Oracle: captured text is sufficient to reproduce the same candidates after reopening.
  const { DependencyDiscoveryService } = await import("../src/core/services/DependencyDiscoveryService.ts");
  const tasks = Array.from({ length: 120 }, (_, i) => new Task({ id: String(i), key: `DEMO-${String(i)}`, title: "Example",
    description: Array.from({ length: 20 }, (_entry, j) => `Requires DEMO-${String((i + j + 1) % 120)} `).join("").padEnd(60000, "x") }));
  const analysis = new AnalysisService({ today: (): string => "2026-10-02" }).analyse(tasks, "synthetic");
  const renderer = new JsonSnapshotAdapter();
  const sourceOnly = renderer.toObject(analysis);
  expect(sourceOnly).not.toHaveProperty("dependencyProposals");
  expect(() => { new SnapshotBudget().parse(JSON.stringify(sourceOnly, null, 2)); }).not.toThrow();
  const text = renderer.render(analysis);
  const reopened = await new JsonSnapshotRepositoryAdapter(text, "export").load();
  const discover = new DependencyDiscoveryService();
  const restored = new AnalysisService({ today: (): string => "2026-10-02" }).analyse(reopened, "export");
  expect(discover.discover(restored.dag)).toEqual(discover.discover(analysis.dag));
  expect(discover.discover(restored.dag)).toHaveLength(2000);
});
