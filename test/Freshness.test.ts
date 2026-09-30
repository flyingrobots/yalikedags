import { Dag } from "../src/core/domain/Dag.ts";
import { SnapshotChangesService } from "../src/core/services/SnapshotChangesService.ts";
import { ViewerRequestHandler } from "../src/viewer/ViewerRequestHandler.ts";
import { ViewerServerAdapter } from "../src/viewer/ViewerServerAdapter.ts";
import { expect, test } from "bun:test";
import { Task } from "../src/core/domain/Task.ts";
import { AnalysisService } from "../src/core/services/AnalysisService.ts";
import { FixedClockAdapter } from "./fakes/FixedClockAdapter.ts";
import { RefreshingAnalysis } from "../src/viewer/RefreshingAnalysis.ts";
import { rejection } from "./fakes/rejection.ts";

const service = new AnalysisService(new FixedClockAdapter("2026-09-28"));

test("refresh failure keeps the last good graph and successful refresh computes changes", async () => {
  const before = service.analyse([new Task({ id: "a", title: "A" })], "example");
  const failing = new RefreshingAnalysis(before, () => Promise.reject(new Error("unavailable")));
  expect((await rejection(failing.refresh())).message).toBe("unavailable");
  expect(failing.current).toBe(before);
  const next = service.analyse([new Task({ id: "a", title: "A", status: "done" }), new Task({ id: "b", title: "B" })], "example");
  let reads = 0;
  const live = new RefreshingAnalysis(before, () => { reads += 1; return Promise.resolve(next); });
  await Promise.all([live.refresh(), live.refresh()]);
  expect(reads).toBe(1);
  expect(live.current).toBe(next);
  expect(live.changes?.map((change) => change.kind)).toContain("completed");
  expect(live.changes?.map((change) => change.kind)).toContain("added");
});

test("snapshot comparison reports changed blockers, completion, removal and critical chains", () => {
  const before = new Dag([new Task({ id: "a", title: "A" }), new Task({ id: "b", title: "B", blockedBy: ["a"] }), new Task({ id: "gone", title: "Removed" })]);
  const after = new Dag([new Task({ id: "a", title: "A", status: "done" }), new Task({ id: "b", title: "B", blockedBy: ["external"] })]);
  const changes = new SnapshotChangesService().compare(before, after);
  expect(changes.map((change) => change.kind)).toEqual(["completed", "blocker added", "blocker removed", "removed", "critical chain by depth", "critical chain by effort"]);
  expect(changes.find((change) => change.kind === "blocker added")?.detail).toBe("external");
});

test("refresh endpoint requires an explicit same-origin POST and retains data on failure", async () => {
  const analysis = service.analyse([], "example");
  let calls = 0;
  const server = new ViewerServerAdapter(new ViewerRequestHandler(() => analysis), () => {
    calls += 1; return Promise.reject(new Error("private source detail"));
  }).start(0);
  try {
    expect((await fetch(`${server.url}refresh`)).status).toBe(405);
    expect((await fetch(`${server.url}refresh`, { method: "POST" })).status).toBe(403);
    expect((await fetch(`${server.url}refresh`, { method: "POST", headers: { "X-Yalikedags-Refresh": "1", Origin: "https://example.com" } })).status).toBe(403);
    const response = await fetch(`${server.url}refresh`, { method: "POST", headers: { "X-Yalikedags-Refresh": "1" } });
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("private source detail");
    expect(calls).toBe(1);
    expect((await fetch(`${server.url}snapshot.json`)).status).toBe(200);
  } finally { server.stop(); }
});

// oracle: only entering done is completion; cancellation is a distinct status transition.
for (const [before, after, kind] of [
  ["open", "canceled", "status"], ["done", "canceled", "status"],
  ["canceled", "done", "completed"], ["canceled", "open", "status"],
] as const) {
  test(`snapshot comparison reports ${before} to ${after} as ${kind}`, () => {
    const changes = new SnapshotChangesService().compare(
      new Dag([new Task({ id: "a", title: "A", status: before })]),
      new Dag([new Task({ id: "a", title: "A", status: after })]),
    );
    expect(changes.filter((change) => change.task === "a")).toEqual([
      { kind, task: "a", key: "a", detail: `${before} → ${after}` },
    ]);
  });
}

test("successful unchanged refresh confirms zero changes while failed reads retain the comparison", async () => {
  // oracle: no comparison and a completed empty comparison have distinct user-visible meanings.
  const analysis = service.analyse([], "example");
  let fail = false;
  const live = new RefreshingAnalysis(analysis, () => fail ? Promise.reject(new Error("unavailable")) : Promise.resolve(analysis));
  const handler = new ViewerRequestHandler(() => live.current, () => ({ refresh: true, ...(live.changes !== undefined && { changes: live.changes }) }));
  expect((/<p id="changes-status"[^>]*>([^<]*)<\/p>/.exec(handler.handle("/").body))?.[1]).toContain("Choose an earlier snapshot");
  await live.refresh();
  expect((/<p id="changes-status"[^>]*>([^<]*)<\/p>/.exec(handler.handle("/").body))?.[1]).toContain("No changes since the previous successful refresh.");
  fail = true;
  await rejection(live.refresh());
  expect((/<p id="changes-status"[^>]*>([^<]*)<\/p>/.exec(handler.handle("/").body))?.[1]).toContain("No changes since the previous successful refresh.");
});
