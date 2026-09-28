import { describe, expect, test } from "bun:test";
import { LiveFixture, assertFixtureProject, liveEnabled, PROJECT_SENTINEL, TITLE_PREFIX } from "../scripts/live-fixture.ts";
import { RecordingHttpAdapter } from "./fakes/RecordingHttpAdapter.ts";
import { rejection } from "./fakes/rejection.ts";

const ok = (body: unknown): { status: number; body: string } => ({ status: 200, body: JSON.stringify(body) });
const env = { key: "k", team: "TST", project: PROJECT_SENTINEL };
const silent = { write: false, createTeam: false, log: (): void => undefined };

const team = ok({ data: { teams: { nodes: [{ id: "team-1", key: "TST", name: "Test", issueEstimationType: "linear", issueEstimationAllowZero: true }] } } });
const project = ok({ data: { team: { projects: { nodes: [{ id: "proj-1", name: env.project }] } } } });
const milestones = ok({ data: { project: { projectMilestones: { nodes: [{ id: "m1", name: `${TITLE_PREFIX} Stream One` }, { id: "m2", name: `${TITLE_PREFIX} Stream Two` }] } } } });
const issuePage = (hasNextPage: boolean): { status: number; body: string } =>
  ok({ data: { project: { issues: { pageInfo: { hasNextPage }, nodes: [] } } } });

describe("LiveFixture guards", () => {
  // oracle: specified. Only the documented explicit opt-in enables real writes.
  test("live tests require exactly 1, never a false-looking value", () => {
    expect(liveEnabled({})).toBe(false);
    for (const value of ["", "0", "false", "true", "yes", " 1 "]) {
      expect(liveEnabled({ YALIKEDAGS_LIVE: value })).toBe(false);
    }
    expect(liveEnabled({ YALIKEDAGS_LIVE: "1" })).toBe(true);
  });
  // oracle: specified. The sentinel is checked before any query is sent.
  test("a project name without the sentinel is refused before anything is queried", () => {
    const http = new RecordingHttpAdapter([]);
    expect(() => new LiveFixture({ ...env, project: "real work" }, silent, http)).toThrow(/refusing to touch project/);
    expect(http.requests).toEqual([]);
  });

  test("the sentinel check is case-insensitive and accepts a longer name", () => {
    expect(() => { assertFixtureProject(`Acme ${PROJECT_SENTINEL.toUpperCase()} scratch`); }).not.toThrow();
  });

  // oracle: derived from Linear's refusal on 2026-09-23, where 250 issues with the nested
  // relation connection scored 18126 against a cap of 10000.
  test("a project with a second page of issues is refused rather than partly read", async () => {
    const http = new RecordingHttpAdapter([team, project, milestones, issuePage(true)]);
    const failure = await rejection(new LiveFixture(env, silent, http).run());
    expect(failure.message).toMatch(/holds more than 100 issues/);
    expect(failure.message).toMatch(/would create duplicates/);
  });

  test("a single page is read and, in verify mode, nothing is written", async () => {
    const http = new RecordingHttpAdapter([team, project, milestones, issuePage(false)]);
    const fixture = new LiveFixture(env, silent, http);
    await fixture.run();
    expect(http.requests.every((r) => !r.body.includes("mutation"))).toBe(true);
    expect(fixture.pending.length).toBeGreaterThan(0);
  });
});
