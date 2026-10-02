import { expect, test } from "bun:test";
import { JsonSnapshotRepositoryAdapter } from "../src/adapters/input/JsonSnapshotRepositoryAdapter.ts";

const task = { id: "a", title: "Example", status: "open", blockedBy: [] };
const snapshot = (tasks: readonly object[]): string => JSON.stringify({ schema: "yalikedags/snapshot/2", tasks });

// oracle: explicitly supported input budgets protect codec consumers before domain graph work begins.
test("snapshot imports refuse files over eight MiB", () => {
  const text = snapshot([task]) + " ".repeat(8 * 1024 * 1024);
  expect(() => new JsonSnapshotRepositoryAdapter(text, "large.json").load()).toThrow("snapshot_limit");
});
test("snapshot imports refuse excessive task, edge, description, and nesting counts", () => {
  for (const text of [
    snapshot(Array.from({ length: 5001 }, (_, i) => ({ ...task, id: String(i) }))),
    snapshot([{ ...task, blockedBy: Array.from({ length: 20001 }, (_, i) => String(i)) }]),
    snapshot([{ ...task, description: "x".repeat(65537) }]),
    `{"schema":"yalikedags/snapshot/2","tasks":[],"extra":${"[".repeat(33)}0${"]".repeat(33)}}`,
  ]) { expect(() => new JsonSnapshotRepositoryAdapter(text, "large.json").load()).toThrow("snapshot_limit"); }
});
test("snapshot imports accept ordinary local data", async () => {
  expect((await new JsonSnapshotRepositoryAdapter(snapshot([task]), "small.json").load())[0]?.title).toBe("Example");
});
