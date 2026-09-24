import { describe, expect, test } from "bun:test";
import { Task } from "../src/core/domain/Task.ts";
import type { TaskFields } from "../src/core/domain/Task.ts";
import { Dag } from "../src/core/domain/Dag.ts";
import { WavesService } from "../src/core/services/WavesService.ts";
import { GridService } from "../src/core/services/GridService.ts";
import type { Grid } from "../src/core/services/GridService.ts";

const t = (id: string, blockedBy: string[] = [], extra: Partial<TaskFields> = {}): Task => new Task({ id, title: id, blockedBy, ...extra });
const waves = new WavesService();
const gridOf = (dag: Dag): Grid => new GridService().grid(waves.waves(dag), waves.gatekeepers(dag), waves.workstreams(dag));

/**
 * Waves are the time axis, workstreams the topology axis. The grid is their
 * product: one row per workstream plus one shared row for the gatekeepers,
 * one column per wave, and every open task in exactly one cell.
 *
 *   d0 (done) -> g -> a1 -> a2       g has two open dependents: a gatekeeper
 *                 g -> b1            {a1, a2} and {b1} are two workstreams
 *   s                                 s is a workstream of its own
 *
 *   waves: [g, s] -> [a1, b1] -> [a2]
 */
describe("GridService", () => {
  const dag = new Dag([t("d0", [], { status: "done" }), t("g", ["d0"]), t("a1", ["g"]), t("a2", ["a1"]), t("b1", ["g"]), t("s")]);
  const grid = gridOf(dag);

  // oracle: invariant. The rows partition the open tasks and the columns are the waves, so the cells cover each open task once.
  test("every open task is in exactly one cell, and no done task is in any", () => {
    const placed = grid.rows.flatMap((r) => r.cells.flat());
    expect([...placed].sort()).toEqual(["a1", "a2", "b1", "g", "s"]);
  });

  test("there is one column per wave, and a cell holds the row's members of that wave", () => {
    expect(grid.waves).toBe(3);
    expect(grid.rows.every((r) => r.cells.length === 3)).toBe(true);
    const a = grid.rows.find((r) => r.workstream === "a1");
    expect(a?.cells).toEqual([[], ["a1"], ["a2"]]);
    const b = grid.rows.find((r) => r.workstream === "b1");
    expect(b?.cells).toEqual([[], ["b1"], []]);
  });

  test("the gatekeepers form one shared row, listed first and belonging to no workstream", () => {
    const first = grid.rows[0];
    expect(first?.workstream).toBeUndefined();
    expect(first?.cells).toEqual([["g"], [], []]);
    expect(grid.rows.slice(1).every((r) => r.workstream !== undefined)).toBe(true);
  });

  test("a graph without gatekeepers has no shared row", () => {
    const simple = gridOf(new Dag([t("x"), t("y", ["x"])]));
    expect(simple.rows.map((r) => r.workstream)).toEqual(["x"]);
  });

  test("a graph with nothing open has no columns and no rows", () => {
    const empty = gridOf(new Dag([t("x", [], { status: "done" })]));
    expect(empty.waves).toBe(0);
    expect(empty.rows).toEqual([]);
  });
});
