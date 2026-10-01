import { expect, test } from "bun:test";
import { ViewerRequestHandler } from "../src/viewer/ViewerRequestHandler.ts";

test("credential setup serves a shell and instructions without exposing project exports", () => {
  const handler = new ViewerRequestHandler(() => ({ kind: "setup", reason: "missing", keyTarget: "LINEAR_API_KEY" }));
  expect(handler.handle("/").status).toBe(200);
  expect(JSON.parse(handler.handle("/viewer.json").body)).toEqual({ schema: "yalikedags/setup/1", reason: "missing", keyTarget: "LINEAR_API_KEY" });
  for (const path of ["/snapshot.json", "/graph.svg", "/graph.dot"]) {
    expect(handler.handle(path).status).toBe(503);
    expect(handler.handle(path).body).not.toContain("tasks");
  }
  expect(handler.handle("/missing").status).toBe(404);
});

import { ViewerSession } from "../src/viewer/ViewerSession.ts";
import { AnalysisService } from "../src/core/services/AnalysisService.ts";
import { Task } from "../src/core/domain/Task.ts";
import { FixedClockAdapter } from "./fakes/FixedClockAdapter.ts";
import { rejection } from "./fakes/rejection.ts";

const analysis = new AnalysisService(new FixedClockAdapter("2026-09-30")).analyse([new Task({ id: "a", title: "Example" })], "fixture");

test("missing or rejected credentials enter setup; a working source bypasses it and survives later auth failures", async () => {
  for (const [message, reason] of [["no_key: test", "missing"], ["linear_unauthorized: test", "rejected"]] as const) {
    let fails = true;
    const session = new ViewerSession(() => fails ? Promise.reject(new Error(message)) : Promise.resolve(analysis), "EXAMPLE_KEY");
    await session.refresh();
    expect(session.current()).toEqual({ kind: "setup", reason, keyTarget: "EXAMPLE_KEY" });
    fails = false; await session.refresh(); expect(session.current()).toBe(analysis);
    fails = true; expect((await rejection(session.refresh())).message).toBe(message);
    expect(session.current()).toBe(analysis);
  }
});

test("unrelated startup failures remain errors; a successful source requires no setup", async () => {
  const bad = new ViewerSession(() => Promise.reject(new Error("source_error: unreadable file")), "LINEAR_API_KEY");
  expect((await rejection(bad.refresh())).message).toBe("source_error: unreadable file");
  const good = new ViewerSession(() => Promise.resolve(analysis), "LINEAR_API_KEY");
  await good.refresh(); expect(good.current()).toBe(analysis);
});

test("development shell is an explicit server option, including the setup screen", () => {
  const setup = (): { kind: "setup"; reason: "missing"; keyTarget: string } => ({ kind: "setup", reason: "missing", keyTarget: "EXAMPLE_KEY" });
  for (const current of [setup, (): typeof analysis => analysis]) {
    expect(new ViewerRequestHandler(current).handle("/").body).not.toContain('data-development="true"');
    expect(new ViewerRequestHandler(current, () => ({}), true).handle("/").body).toContain('data-development="true"');
  }
});
