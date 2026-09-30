import { expect, test } from "bun:test";
import { Task } from "../src/core/domain/Task.ts";
import { Dag } from "../src/core/domain/Dag.ts";
import { StateService } from "../src/core/services/StateService.ts";
import { WavesService } from "../src/core/services/WavesService.ts";
import { FrontierService } from "../src/core/services/FrontierService.ts";
import { LinearTaskRepositoryAdapter } from "../src/adapters/input/LinearTaskRepositoryAdapter.ts";
import { RecordingHttpAdapter } from "./fakes/RecordingHttpAdapter.ts";
import { FixedClockAdapter } from "./fakes/FixedClockAdapter.ts";
import { rejection } from "./fakes/rejection.ts";

const task = (id: string, blockedBy: string[] = []): Task => new Task({ id, title: id, blockedBy });
const reader = (data: unknown): LinearTaskRepositoryAdapter => new LinearTaskRepositoryAdapter(
  new RecordingHttpAdapter([{ status: 200, body: JSON.stringify({ data }) }]), "fake", "11111111-1111-1111-1111-111111111111",
);

test("missing project data and incomplete pagination are errors, never empty success", async () => {
    expect((await rejection(reader({ project: null }).load())).message).toMatch(/project|source/);
    expect((await rejection(reader({ project: { issues: { nodes: [] } } }).load())).message).toMatch(/page|incomplete/);
    expect((await rejection(reader({ project: { issues: { nodes: [], pageInfo: { hasNextPage: true } } } }).load())).message).toMatch(/cursor|incomplete/);
  });

test("external dependencies are unresolved, and neither they nor their dependents get a wave", () => {
    const dag = new Dag([task("a", ["external"]), task("b", ["a"]), task("independent")]);
    expect(new StateService().stateOf(dag, "a")).toBe("unresolved");
    expect(new WavesService().waves(dag)).toEqual([["independent"]]);
    expect(new FrontierService(new FixedClockAdapter("2026-09-28")).frontier(dag).map((e) => e.task.id)).toEqual(["independent"]);
  });

test("nested incomplete or malformed Linear connections cannot silently drop dependencies", async () => {
  const connection = { nodes: [], pageInfo: { hasNextPage: false } };
  const row = { id: "a", title: "A", state: { type: "unstarted" }, children: connection, labels: connection, relations: connection, inverseRelations: connection };
  const source = (issue: object): LinearTaskRepositoryAdapter => reader({ project: { issues: { nodes: [issue], pageInfo: { hasNextPage: false } } } });
  expect((await rejection(source({ ...row, inverseRelations: { nodes: [], pageInfo: { hasNextPage: true, endCursor: "more" } } }).load())).message).toMatch(/incomplete/);
  expect((await rejection(source({ ...row, relations: null }).load())).message).toMatch(/incomplete/);
  expect((await rejection(source({ ...row, estimate: "8" }).load())).message).toMatch(/estimate/);
  expect((await rejection(source({ ...row, inverseRelations: { nodes: [{ type: "blocks", issue: null }], pageInfo: { hasNextPage: false } } }).load())).message).toMatch(/incomplete/);
  const unknown = source({ ...row, state: { type: "new-state" } });
  const tasks = await unknown.load();
  expect(tasks[0]?.status).toBe("unknown");
  expect(unknown.warnings.join()).toMatch(/unresolved/);
});
