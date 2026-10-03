import { expect, test } from "bun:test";
import { Task } from "../src/core/domain/Task.ts";
import { AnalysisService } from "../src/core/services/AnalysisService.ts";
import { DependencyImpact } from "../src/core/services/DependencyImpact.ts";
import { ViewerPanels } from "../src/viewer/ViewerPanels.ts";
import { FixedClockAdapter } from "./fakes/FixedClockAdapter.ts";

const service = new AnalysisService(new FixedClockAdapter("2026-10-02"));
const canceled = new Task({ id: "schema", title: "Schema", status: "canceled" });
const consumer = new Task({ id: "consumer", title: "Consumer", blockedBy: ["schema"] });
const downstream = new Task({ id: "downstream", title: "Downstream", blockedBy: ["consumer"] });

test("cancellation leaves the dependent chain outside the executable plan", () => {
  // oracle: canceling a prerequisite supplies no output; neither it nor its unresolved dependents is executable.
  const a = service.analyse([canceled, consumer, downstream], "synthetic");
  expect(a.stateOf("consumer")).toBe("unresolved");
  expect(a.stateOf("downstream")).toBe("unresolved");
  expect(a.frontier).toEqual([]);
  expect(a.waves).toEqual([]);
  expect(a.criticalByDepth.tasks).toEqual([]);
  expect(a.criticalByEffort.tasks).toEqual([]);
  expect(a.findings.filter(f => f.kind === "canceled-blocker").map(f => f.task)).toEqual(["consumer"]);
  expect(a.findings.filter(f => f.kind === "stale-blocker")).toEqual([]);
  const markup = new ViewerPanels(a).render("");
  expect(markup).toContain("Canceled prerequisite");
  expect(markup).toContain("schema");
  expect(markup).toContain("Outside the wave forecast · 2 tasks");
});

test("source correction resolves cancellation without scheduling the canceled task", () => {
  // oracle: only the remaining prerequisite obligation determines release; a closed historical task stays excluded.
  for (const tasks of [[canceled.with({ status: "done" }), consumer, downstream], [canceled, consumer.with({ blockedBy: [] }), downstream]]) {
    const a = service.analyse(tasks, "synthetic");
    expect(a.frontier.map(e => e.task.id)).toEqual(["consumer"]);
    expect(a.waves).toEqual([["consumer"], ["downstream"]]);
  }
  const replacement = new Task({ id: "replacement", title: "Replacement" });
  const a = service.analyse([canceled, replacement, consumer.with({ blockedBy: ["replacement"] })], "synthetic");
  expect(a.stateOf("consumer")).toBe("blocked");
  expect(a.waves).toEqual([["replacement"], ["consumer"]]);
});

test("mixed prerequisites do not promise immediate release while cancellation remains", () => {
  // oracle: completing one live prerequisite cannot supply a different canceled prerequisite's output.
  const live = new Task({ id: "live", title: "Live" });
  const a = service.analyse([canceled, live, consumer.with({ blockedBy: ["schema", "live"] })], "synthetic");
  expect(new DependencyImpact().immediate(a.dag, "live")).toEqual([]);
  expect(a.waves).toEqual([["live"]]);
  expect(a.frontier.map(e => e.immediatelyUnblocks)).toEqual([0]);
});

test("in-progress source status retains a visible canceled-prerequisite obligation", () => {
  // oracle: observed execution is retained, but is not evidence of prerequisite satisfaction.
  const a = service.analyse([canceled, consumer.with({ status: "in-progress" })], "synthetic");
  expect(a.stateOf("consumer")).toBe("in-progress");
  expect(a.waves).toEqual([]);
  expect(a.findings.filter(f => f.kind === "canceled-blocker").map(f => f.task)).toEqual(["consumer"]);
});

test("completed outputs terminate traversal of historical cancellation", () => {
  // oracle: a delivered output satisfies its own consumer even if its historical upstream work was canceled.
  const a = service.analyse([canceled, consumer.with({ status: "done" }), downstream], "synthetic");
  expect(a.stateOf("downstream")).toBe("ready");
  expect(a.waves).toEqual([["downstream"]]);
  expect(a.criticalByDepth.tasks).toEqual(["downstream"]);
});

test("unknown and missing prerequisites remain unresolved through mixed chains", () => {
  // oracle: absent evidence cannot establish readiness, including beyond one hop.
  for (const status of ["canceled", "unknown"] as const) {
    const a = service.analyse([canceled.with({ status }), consumer, downstream], "synthetic");
    expect(a.stateOf("downstream")).toBe("unresolved");
    expect(a.waves).toEqual([]);
  }
  const missing = service.analyse([consumer, downstream], "synthetic");
  expect(missing.stateOf("downstream")).toBe("unresolved");
  expect(missing.waves).toEqual([]);
});
