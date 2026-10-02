import { expect, test } from "bun:test";
import { AnalysisService } from "../src/core/services/AnalysisService.ts";
import { Task } from "../src/core/domain/Task.ts";
import { ViewerRequestHandler } from "../src/viewer/ViewerRequestHandler.ts";

test("the hosted shell contains no project records; viewer JSON carries server analysis", () => {
  const analysis = new AnalysisService({ today: (): string => "2026-09-30" }).analyse([
    new Task({ id: "a", title: "Unique fixture task", assignee: "Sam Example" }),
  ], "Example workspace");
  const handler = new ViewerRequestHandler(() => analysis);
  expect(handler.handle("/").body).not.toContain("Unique fixture task");
  const response = handler.handle("/viewer.json");
  expect(response.status).toBe(200);
  expect(JSON.parse(response.body)).toMatchObject({ schema: "yalikedags/viewer/1", snapshot: {
    tasks: [{ id: "a", assignee: "Sam Example", state: "ready" }], frontier: [{ task: "a" }],
  } });
});

test("viewer data preserves server ranking, resource conflicts, account and assignments", async () => {
  const { LinearAccount } = await import("../src/core/domain/LinearAccount.ts");
  const { ViewerData } = await import("../src/viewer/ViewerData.ts");
  const { ViewerDataCodec } = await import("../src/viewer/ViewerDataCodec.ts");
  const { JsonSnapshotRepositoryAdapter } = await import("../src/adapters/input/JsonSnapshotRepositoryAdapter.ts");
  const { JsonSnapshotAdapter } = await import("../src/adapters/output/JsonSnapshotAdapter.ts");
  const { ResourcePolicy } = await import("../src/core/domain/ResourcePolicy.ts");
  const account = new LinearAccount({ id: "u1", name: "Sam Example" }, { id: "w1", name: "Example workspace" }, { id: "p1", name: "Example project" });
  const analysis = new AnalysisService({ today: (): string => "2026-09-30" }, new ResourcePolicy([{ id: "fixture-resource", mode: "exclusive" }])).analyse([
    new Task({ id: "a", title: "Assigned work", assignee: "Alex Example", priority: 1, resources: ["fixture-resource"] }),
    new Task({ id: "b", title: "Unassigned work", blockedBy: ["a"] }),
    new Task({ id: "c", title: "Resource contender", resources: ["fixture-resource"] }),
  ], "Linear example", { account });
  const payload = new ViewerData().render(analysis, { refresh: true, changes: [] });
  const decoded = await new ViewerDataCodec().decode(payload);
  expect(new JsonSnapshotAdapter().toObject(decoded.analysis)).toEqual(new JsonSnapshotAdapter().toObject(analysis));
  expect(decoded.analysis.conflicts.get("a")).toHaveLength(1);
  expect(decoded.options).toEqual({ refresh: true, changes: [] });
  const repo = new JsonSnapshotRepositoryAdapter(new JsonSnapshotAdapter().render(analysis), "saved");
  await repo.load();
  expect(repo.account).toEqual(account);
  expect(decoded.analysis.dag.get("a").assignee).toBe("Alex Example");
});

test("malformed derived viewer data is rejected instead of inventing scheduling results", async () => {
  const { ViewerData } = await import("../src/viewer/ViewerData.ts");
  const { ViewerDataCodec } = await import("../src/viewer/ViewerDataCodec.ts");
  const analysis = new AnalysisService({ today: (): string => "2026-09-30" }).analyse([new Task({ id: "a", title: "Task" })], "Example");
  const data = new ViewerData().render(analysis);
  expect(new ViewerDataCodec().decode(data.replace('"state":"ready"', '"state":"bogus"'))).rejects.toThrow("Invalid derived task state");
  expect(new ViewerDataCodec().decode(data.replace('"frontier":[', '"frontier":null,"discarded":['))).rejects.toThrow("Expected a list");
});
