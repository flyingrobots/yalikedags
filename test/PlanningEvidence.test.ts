import { test, expect } from "bun:test";
import { PlanningEvidence } from "../src/core/services/PlanningEvidence.ts";
import { Task } from "../src/core/domain/Task.ts";
test("classification needs source evidence and containers are not executable work", () => {
  const planning = new PlanningEvidence();
  const task = (labels: string[], description = ""): Task => new Task({ id: "example", title: "Example", labels, description });
  expect(planning.kind(task([]))).toBe("Needs disposition");
  expect(planning.kind(task(["type:research"]))).toBe("Research");
  expect(planning.kind(task(["type:decision"]))).toBe("Decision");
  expect(planning.kind(task(["type:investigation"]))).toBe("Investigation");
  expect(planning.kind(task(["type:feature"]))).toBe("Implementation");
  expect(planning.executable(task(["type:feature"], "**Planning role: tracking container; not an additional executable PR.**"))).toBe(false);
  expect(planning.kind(task([], "Related to a tracking container"))).toBe("Needs disposition");
});
