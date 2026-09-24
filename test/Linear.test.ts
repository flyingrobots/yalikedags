import { describe, expect, test } from "bun:test";
import { LinearTaskRepositoryAdapter } from "../src/adapters/input/LinearTaskRepositoryAdapter.ts";
import { RecordingHttpAdapter } from "./fakes/RecordingHttpAdapter.ts";

const issue = (over: Record<string, unknown>): Record<string, unknown> => ({
  id: "i1", identifier: "PRO-1", title: "One", description: null, url: "https://linear.app/x/issue/PRO-1", createdAt: "2026-09-01T00:00:00.000Z",
  priority: 0, estimate: null, dueDate: null, state: { name: "Todo", type: "unstarted" }, assignee: null,
  labels: { nodes: [] }, projectMilestone: null, parent: null, children: { nodes: [] },
  relations: { nodes: [] }, inverseRelations: { nodes: [] },
  ...over,
});
const page = (nodes: unknown[], endCursor: string | null): string =>
  JSON.stringify({ data: { project: { id: "p1", name: "Growth", issues: { nodes, pageInfo: { hasNextPage: endCursor !== null, endCursor } } } } });
const projectLookup = JSON.stringify({ data: { projects: { nodes: [{ id: "p1", name: "Growth" }] } } });
const ok = (body: string): { status: number; body: string } => ({ status: 200, body });

describe("LinearTaskRepositoryAdapter", () => {
  // oracle: specified by Linear's documented field semantics; the fixture is the shape the GraphQL API returns.
  test("resolves the project by name, then maps issues, states, priority, estimate, and blocking relations", async () => {
    const http = new RecordingHttpAdapter([
      ok(projectLookup),
      ok(page([
        issue({ id: "a", identifier: "PRO-1", title: "A", state: { name: "Done", type: "completed" }, estimate: 2, priority: 1 }),
        issue({ id: "b", identifier: "PRO-2", title: "B", state: { name: "In Progress", type: "started" }, assignee: { name: "Sam" }, labels: { nodes: [{ name: "Backend" }] }, projectMilestone: { name: "Stream 1" }, dueDate: "2026-10-01", inverseRelations: { nodes: [{ type: "blocks", issue: { id: "a" } }] } }),
        issue({ id: "c", identifier: "PRO-3", title: "C", state: { name: "Canceled", type: "canceled" }, relations: { nodes: [{ type: "blocks", relatedIssue: { id: "b" } }, { type: "related", relatedIssue: { id: "a" } }] }, parent: { id: "a" } }),
      ], null)),
    ]);
    const tasks = await new LinearTaskRepositoryAdapter(http, "lin_api_test_token_example", "Growth").load();
    const by = new Map(tasks.map((t) => [t.id, t]));
    expect(tasks).toHaveLength(3);
    expect(by.get("a")).toMatchObject({ key: "PRO-1", status: "done", effort: 2, priority: 1 });
    expect(by.get("b")).toMatchObject({ status: "in-progress", assignee: "Sam", labels: ["Backend"], milestone: "Stream 1", due: "2026-10-01" });
    expect([...by.get("b")!.blockedBy].sort()).toEqual(["a", "c"]);
    expect(by.get("c")).toMatchObject({ status: "canceled", parent: "a" });
    expect(by.get("c")!.blockedBy).toEqual([]);
  });
  test("a duplicate state is done for scheduling and produces no warning", async () => {
    // oracle: a live read on 2026-09-23 returned an issue whose state type was "duplicate", which this adapter did not map; Linear docs call Duplicate a reserved status.
    const http = new RecordingHttpAdapter([ok(projectLookup), ok(page([issue({ id: "a", identifier: "PRO-1", state: { name: "Duplicate", type: "duplicate" } })], null))]);
    const adapter = new LinearTaskRepositoryAdapter(http, "k", "Growth");
    const tasks = await adapter.load();
    expect(tasks[0]!.isDone()).toBe(true);
    expect(tasks[0]!.status).toBe("canceled");
    expect(adapter.warnings).toEqual([]);
  });
  test("sends the key raw in the Authorization header and never logs it", async () => {
    const http = new RecordingHttpAdapter([ok(projectLookup), ok(page([], null))]);
    await new LinearTaskRepositoryAdapter(http, "lin_api_test_token_example", "Growth").load();
    expect(http.requests[0]!.headers["Authorization"]).toBe("lin_api_test_token_example");
    expect(http.requests[0]!.url).toBe("https://api.linear.app/graphql");
  });
  test("asks for at most 50 issues per page, under Linear's query-complexity cap", async () => {
    // oracle: derived from Linear's refusal on 2026-09-23: 100 per page scored 14091 against a cap of 10000.
    const http = new RecordingHttpAdapter([ok(projectLookup), ok(page([], null))]);
    await new LinearTaskRepositoryAdapter(http, "k", "Growth").load();
    expect(http.requests[1]!.body).toContain("first: 50");
    expect(http.requests[1]!.body).not.toContain("first: 100");
  });
  test("follows pagination until hasNextPage is false", async () => {
    const http = new RecordingHttpAdapter([
      ok(projectLookup),
      ok(page([issue({ id: "a", identifier: "PRO-1" })], "cur1")),
      ok(page([issue({ id: "b", identifier: "PRO-2" })], null)),
    ]);
    const tasks = await new LinearTaskRepositoryAdapter(http, "k", "Growth").load();
    expect(tasks.map((t) => t.id)).toEqual(["a", "b"]);
    expect(http.requests).toHaveLength(3);
    expect(http.requests[2]!.body).toContain("cur1");
  });
  test("an estimate above 3 is clamped to 3 and reported as a warning, not silently", async () => {
    const http = new RecordingHttpAdapter([ok(projectLookup), ok(page([issue({ id: "a", identifier: "PRO-1", estimate: 5 })], null))]);
    const adapter = new LinearTaskRepositoryAdapter(http, "k", "Growth");
    const tasks = await adapter.load();
    expect(tasks[0]!.effort).toBe(3);
    expect(adapter.warnings).toEqual(["PRO-1: estimate 5 is above the 0 to 3 scale; recorded as 3"]);
  });
  test("a rejected key is refused with a named reason", async () => {
    const http = new RecordingHttpAdapter([{ status: 401, body: '{"errors":[{"message":"Authentication required"}]}' }]);
    const failure = await new LinearTaskRepositoryAdapter(http, "bad", "Growth").load().then(() => undefined, (e: unknown) => e);
    expect(String(failure)).toMatch(/linear_unauthorized/);
  });
  test("an unknown project is refused with a named reason", async () => {
    const http = new RecordingHttpAdapter([ok(JSON.stringify({ data: { projects: { nodes: [] } } }))]);
    const failure = await new LinearTaskRepositoryAdapter(http, "k", "Nope").load().then(() => undefined, (e: unknown) => e);
    expect(String(failure)).toMatch(/linear_project_not_found/);
  });
});
