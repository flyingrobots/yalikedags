import { describe, expect, test } from "bun:test";
import { LinearTaskWriterAdapter } from "../src/adapters/output/LinearTaskWriterAdapter.ts";
import { RecordingHttpAdapter } from "./fakes/RecordingHttpAdapter.ts";
import { rejection } from "./fakes/rejection.ts";

const PROJECT_UUID = "586dd051-7310-4694-8e48-29af23288338";
const ok = (body: unknown): { status: number; body: string } => ({ status: 200, body: JSON.stringify(body) });
const noRelations = ok({ data: { issue: { inverseRelations: { nodes: [] } } } });
const blocksRelation = (id: string, blockerId: string): { status: number; body: string } =>
  ok({ data: { issue: { inverseRelations: { nodes: [{ id, type: "blocks", issue: { id: blockerId } }] } } } });

describe("LinearTaskWriterAdapter relations", () => {
  // oracle: specified by Linear's documented mutations; the fixture is the shape the GraphQL API returns.
  test("adding a relation checks for it first, then creates it with the blocker as issueId", async () => {
    const http = new RecordingHttpAdapter([noRelations, ok({ data: { issueRelationCreate: { success: true } } })]);
    await new LinearTaskWriterAdapter(http, "k", PROJECT_UUID).addBlockingRelation("blocker", "blocked");
    expect(http.requests).toHaveLength(2);
    expect(http.requests[0]!.body).toContain("inverseRelations");
    expect(http.requests[1]!.body).toContain("issueRelationCreate");
    const sent: unknown = JSON.parse(http.requests[1]!.body);
    expect(sent).toMatchObject({ variables: { issueId: "blocker", relatedIssueId: "blocked" } });
  });

  test("adding a relation that already exists writes nothing", async () => {
    const http = new RecordingHttpAdapter([blocksRelation("rel-1", "blocker")]);
    await new LinearTaskWriterAdapter(http, "k", PROJECT_UUID).addBlockingRelation("blocker", "blocked");
    expect(http.requests).toHaveLength(1);
  });

  test("removing a relation resolves its id first and deletes by that id", async () => {
    const http = new RecordingHttpAdapter([blocksRelation("rel-1", "blocker"), ok({ data: { issueRelationDelete: { success: true } } })]);
    await new LinearTaskWriterAdapter(http, "k", PROJECT_UUID).removeBlockingRelation("blocker", "blocked");
    expect(http.requests).toHaveLength(2);
    expect(JSON.parse(http.requests[1]!.body)).toMatchObject({ variables: { id: "rel-1" } });
  });

  test("removing a relation that is already gone writes nothing", async () => {
    const http = new RecordingHttpAdapter([noRelations]);
    await new LinearTaskWriterAdapter(http, "k", PROJECT_UUID).removeBlockingRelation("blocker", "blocked");
    expect(http.requests).toHaveLength(1);
  });

  test("a relation of another type on the same pair is not mistaken for a blocks relation", async () => {
    const related = ok({ data: { issue: { inverseRelations: { nodes: [{ id: "rel-9", type: "related", issue: { id: "blocker" } }] } } } });
    const http = new RecordingHttpAdapter([related, ok({ data: { issueRelationCreate: { success: true } } })]);
    await new LinearTaskWriterAdapter(http, "k", PROJECT_UUID).addBlockingRelation("blocker", "blocked");
    expect(http.requests).toHaveLength(2);
  });

  test("a mutation that reports success false is a refusal", async () => {
    const http = new RecordingHttpAdapter([noRelations, ok({ data: { issueRelationCreate: { success: false } } })]);
    const failure = await rejection(new LinearTaskWriterAdapter(http, "k", PROJECT_UUID).addBlockingRelation("blocker", "blocked"));
    expect(failure.message).toMatch(/^linear_write_refused/);
  });
});

describe("LinearTaskWriterAdapter fields", () => {
  test("setting an estimate sends one issueUpdate and no lookup", async () => {
    const http = new RecordingHttpAdapter([ok({ data: { issueUpdate: { success: true } } })]);
    await new LinearTaskWriterAdapter(http, "k", PROJECT_UUID).setEstimate("task", 2);
    expect(http.requests).toHaveLength(1);
    expect(JSON.parse(http.requests[0]!.body)).toMatchObject({ variables: { id: "task", input: { estimate: 2 } } });
  });

  test("clearing an estimate sends null rather than omitting the field", async () => {
    const http = new RecordingHttpAdapter([ok({ data: { issueUpdate: { success: true } } })]);
    await new LinearTaskWriterAdapter(http, "k", PROJECT_UUID).setEstimate("task", null);
    expect(JSON.parse(http.requests[0]!.body)).toMatchObject({ variables: { input: { estimate: null } } });
  });

  test("setting a milestone resolves the name to an id once and reuses it", async () => {
    const milestones = ok({ data: { project: { projectMilestones: { nodes: [{ id: "ms-1", name: "Stream One" }] } } } });
    const updated = ok({ data: { issueUpdate: { success: true } } });
    const http = new RecordingHttpAdapter([milestones, updated, updated]);
    const writer = new LinearTaskWriterAdapter(http, "k", PROJECT_UUID);
    await writer.setMilestone("task-1", "Stream One");
    await writer.setMilestone("task-2", "Stream One");
    expect(http.requests).toHaveLength(3);
    expect(JSON.parse(http.requests[1]!.body)).toMatchObject({ variables: { id: "task-1", input: { projectMilestoneId: "ms-1" } } });
  });

  test("a milestone name that does not exist is refused, and no milestone is created", async () => {
    const http = new RecordingHttpAdapter([ok({ data: { project: { projectMilestones: { nodes: [] } } } })]);
    const failure = await rejection(new LinearTaskWriterAdapter(http, "k", PROJECT_UUID).setMilestone("task", "Nope"));
    expect(failure.message).toMatch(/^linear_milestone_not_found/);
    expect(http.requests).toHaveLength(1);
  });

  test("a project given by name is resolved before milestones are read", async () => {
    const lookup = ok({ data: { projects: { nodes: [{ id: PROJECT_UUID, name: "Example" }] } } });
    const milestones = ok({ data: { project: { projectMilestones: { nodes: [{ id: "ms-1", name: "M" }] } } } });
    const http = new RecordingHttpAdapter([lookup, milestones, ok({ data: { issueUpdate: { success: true } } })]);
    await new LinearTaskWriterAdapter(http, "k", "Example").setMilestone("task", "M");
    expect(http.requests).toHaveLength(3);
    expect(http.requests[0]!.body).toContain("projects(filter");
  });

  test("the key travels in the Authorization header on every request and in no body", async () => {
    const http = new RecordingHttpAdapter([ok({ data: { issueUpdate: { success: true } } })]);
    await new LinearTaskWriterAdapter(http, "lin_api_test_token_example", PROJECT_UUID).setEstimate("task", 1);
    expect(http.requests[0]!.headers["Authorization"]).toBe("lin_api_test_token_example");
    expect(http.requests[0]!.body).not.toContain("lin_api_test_token_example");
  });

  test("a rejected key is refused with the same named reason the reader uses", async () => {
    const http = new RecordingHttpAdapter([{ status: 401, body: '{"errors":[{"message":"Authentication required"}]}' }]);
    const failure = await rejection(new LinearTaskWriterAdapter(http, "bad", PROJECT_UUID).setEstimate("task", 1));
    expect(failure.message).toMatch(/^linear_unauthorized/);
  });
});
