/**
 * The bundled examples are documentation: the tutorial quotes their output,
 * and examples/README.md states what each produces. A file that quietly stops
 * producing that is a lie in the docs, and nothing else would catch it, so
 * these assertions exist to make an example impossible to rot silently.
 *
 * Five prototype-era examples were deleted rather than pinned, because they
 * loaded zero tasks or zero edges: they needed a CSV adapter and an inference
 * engine that the rewrite does not have.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { AnalysisService } from "../src/core/services/AnalysisService.ts";
import { TaskListParserAdapter } from "../src/adapters/input/TaskListParserAdapter.ts";
import { FixedClockAdapter } from "./fakes/FixedClockAdapter.ts";

const analyser = new AnalysisService(new FixedClockAdapter("2026-09-23"));

const analyse = async (name: string): Promise<ReturnType<AnalysisService["analyse"]>> => {
  const path = `examples/${name}`;
  const repo = new TaskListParserAdapter(await Bun.file(path).text(), path);
  return analyser.analyse(await repo.load(), repo.describe());
};

describe("bundled examples", () => {
  // oracle: specified by examples/README.md and quoted in docs/tutorials/first-dag.md.
  test("example-tasklist.txt is the tutorial's graph: 12 tasks, 12 edges, one gatekeeper, a six-task critical path", async () => {
    const a = await analyse("example-tasklist.txt");
    expect(a.dag.size).toBe(12);
    expect(a.dag.tasks.flatMap((t) => a.dag.blockers(t.id))).toHaveLength(12);
    expect(a.gatekeepers).toHaveLength(1);
    expect(a.criticalByDepth.tasks).toHaveLength(6);
    expect(a.frontier.map((e) => e.task.id)).toEqual(["implement-core-dag-builder", "write-documentation"]);
  });

  test("test-parent-child.txt shows hierarchy without edges, because a sub-issue is not a blocker", async () => {
    const a = await analyse("test-parent-child.txt");
    expect(a.dag.size).toBe(10);
    expect(a.dag.tasks.flatMap((t) => a.dag.blockers(t.id))).toEqual([]);
    expect(a.dag.tasks.filter((t) => t.children.length > 0).length).toBeGreaterThan(0);
    expect(a.dag.tasks.filter((t) => t.parent !== undefined).length).toBeGreaterThan(0);
  });

  // oracle: invariant. Every file shipped in examples/ must load and produce tasks.
  test("every bundled example loads and produces at least one task", async () => {
    const files = readdirSync("examples").filter((f) => f !== "README.md");
    expect(files.length).toBeGreaterThan(0);
    for (const name of files) {
      const a = await analyse(name);
      expect(a.dag.size, `${name} produced no tasks`).toBeGreaterThan(0);
    }
  });
});
