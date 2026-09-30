import { expect, test } from "bun:test";
import { Dag } from "../src/core/domain/Dag.ts";
import { SetEstimate } from "../src/core/domain/Mutation.ts";
import { LinearTaskRepositoryAdapter } from "../src/adapters/input/LinearTaskRepositoryAdapter.ts";
import { RecordingHttpAdapter } from "./fakes/RecordingHttpAdapter.ts";

const reader = (data: unknown): LinearTaskRepositoryAdapter => new LinearTaskRepositoryAdapter(
  new RecordingHttpAdapter([{ status: 200, body: JSON.stringify({ data }) }]), "fake", "11111111-1111-1111-1111-111111111111",
);

test("estimates remain exact and verification cannot confuse 8 with 3", async () => {
    const connection = { nodes: [], pageInfo: { hasNextPage: false } };
    const rows = [8, 0.5].map((estimate, i) => ({ children: connection, relations: connection, inverseRelations: connection, labels: connection, id: String(i), title: "Task", estimate, state: { type: "unstarted" } }));
    const tasks = await reader({ project: { issues: { nodes: rows, pageInfo: { hasNextPage: false } } } }).load();
    expect(tasks.map((t) => t.effort)).toEqual([8, 0.5]);
    expect(new SetEstimate("0", 3, 8).satisfiedBy(new Dag(tasks))).toBe(false);
    expect(new SetEstimate("0", 3, 8).preconditionHolds(new Dag(tasks))).toBe(true);
  });
