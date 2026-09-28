import { expect, test } from "bun:test";
import { Task } from "../src/core/domain/Task.ts";
import { AnalysisService } from "../src/core/services/AnalysisService.ts";
import { FixedClockAdapter } from "./fakes/FixedClockAdapter.ts";
import { JsonSnapshotAdapter } from "../src/adapters/output/JsonSnapshotAdapter.ts";
import { JsonSnapshotRepositoryAdapter } from "../src/adapters/input/JsonSnapshotRepositoryAdapter.ts";

const service = new AnalysisService(new FixedClockAdapter("2026-09-28"));

test("snapshot timestamps survive reading; legacy snapshots have unknown acquisition time", async () => {
  const original = service.analyse([new Task({ id: "a", title: "A", effort: 8.5 })], "example");
  const repo = new JsonSnapshotRepositoryAdapter(new JsonSnapshotAdapter().render(original), "old.json");
  expect((await repo.load())[0]?.effort).toBe(8.5);
  expect(repo.capturedAt).toBe("2026-09-28T12:00:00.000Z");
  const old = new JsonSnapshotRepositoryAdapter('{"schema":"yalikedags/snapshot/1","tasks":[]}', "legacy");
  await old.load();
  expect(old.capturedAt).toBeNull();
});
