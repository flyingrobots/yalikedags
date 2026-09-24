#!/usr/bin/env bun
/**
 * Provision, verify, or reset the live test fixture in a Linear workspace.
 *
 * Running it twice does the same thing as running it once: every step looks
 * before it writes, and the reset step drives the fixture back to the declared
 * baseline, so a previous test run's leftovers are removed rather than
 * accumulated. That is what makes the live suite repeatable.
 *
 * TWO GUARDS, BOTH UNCONDITIONAL.
 *
 * 1. The project name must contain `yalikedags-test`. A workspace where no
 *    project is named that cannot be touched by this script at all.
 * 2. Every issue it reads, writes, or deletes a relation on must have a title
 *    starting with `yld-fixture`. Even inside the right project, an issue a
 *    person created is invisible to it.
 *
 * The token comes from YALIKEDAGS_LIVE_KEY, deliberately not LINEAR_API_KEY,
 * so that a production key sitting in the usual variable cannot be picked up
 * by accident.
 *
 * Matching fixture issues by title would be indefensible in the reconciler
 * (see ReconcileService) and is correct here: this script declares those
 * titles, owns the issues carrying them, and refuses when one is ambiguous.
 *
 *   bun scripts/live-fixture.ts provision   ensure it exists, then reset to baseline
 *   bun scripts/live-fixture.ts verify      report differences, write nothing
 *   bun scripts/live-fixture.ts provision --dry-run    same as verify, louder
 */
import { LinearGraphqlClient } from "../src/adapters/linear/LinearGraphqlClient.ts";
import type { Rec } from "../src/adapters/linear/GraphqlJson.ts";
import { nodes, num, rec, str } from "../src/adapters/linear/GraphqlJson.ts";
import { FetchHttpAdapter } from "../src/adapters/http/FetchHttpAdapter.ts";
import type { HttpPort } from "../src/ports/HttpPort.ts";
import { VaultSecretsAdapter } from "../src/adapters/secrets/VaultSecretsAdapter.ts";

export const PROJECT_SENTINEL = "yalikedags-test";
export const TITLE_PREFIX = "yld-fixture";
export const MANIFEST_PATH = ".live-fixture.json";
/** The keychain target and the environment variable share this name, and neither is LINEAR_API_KEY. */
export const KEY_TARGET = "YALIKEDAGS_LIVE_KEY";
export const DEFAULT_PROJECT = PROJECT_SENTINEL;

/** The declared baseline. Anything in the fixture project that differs from this is driven back to it. */
export interface FixtureIssue {
  /** Logical name the live tests use. */
  name: string;
  title: string;
  /** Baseline estimate, or null for none. */
  estimate: number | null;
  /** Baseline milestone by name, or null for none. */
  milestone: string | null;
  /** Logical names of issues that must block this one at baseline. */
  blockedBy: string[];
  why: string;
}

export const MILESTONES = [`${TITLE_PREFIX} Stream One`, `${TITLE_PREFIX} Stream Two`];

export const ISSUES: readonly FixtureIssue[] = [
  { name: "A", title: `${TITLE_PREFIX} A root`, estimate: null, milestone: null, blockedBy: [], why: "a root with no blockers" },
  { name: "B", title: `${TITLE_PREFIX} B blocked by A`, estimate: null, milestone: null, blockedBy: ["A"], why: "an edge that already exists, so adding it again must write nothing" },
  { name: "C", title: `${TITLE_PREFIX} C blocked by B`, estimate: null, milestone: null, blockedBy: ["B"], why: "a two-hop chain, so the critical path has something to find" },
  { name: "D", title: `${TITLE_PREFIX} D isolated`, estimate: null, milestone: null, blockedBy: [], why: "no relations either way, so the audit reports it isolated" },
  { name: "E", title: `${TITLE_PREFIX} E estimated`, estimate: 2, milestone: null, blockedBy: [], why: "an estimate already set, so replacing it is destructive" },
  { name: "F", title: `${TITLE_PREFIX} F milestoned`, estimate: null, milestone: MILESTONES[0] ?? "", blockedBy: [], why: "a milestone already set, so replacing it is destructive" },
  { name: "G", title: `${TITLE_PREFIX} G link target`, estimate: null, milestone: null, blockedBy: [], why: "the live suite adds an edge to this one; reset removes it again" },
  { name: "H", title: `${TITLE_PREFIX} H prune source`, estimate: null, milestone: null, blockedBy: ["G"], why: "an edge no desired graph declares, so --prune has something to remove" },
];

const TEAM_BY_KEY = `query($key: String!) { teams(filter: { key: { eq: $key } }, first: 2) { nodes { id key name issueEstimationType issueEstimationAllowZero } } }`;
const TEAM_UPDATE = `mutation($id: String!, $input: TeamUpdateInput!) { teamUpdate(id: $id, input: $input) { success } }`;
const PROJECTS = `query($teamId: String!) { team(id: $teamId) { projects(first: 100) { nodes { id name } } } }`;
const PROJECT_CREATE = `mutation($input: ProjectCreateInput!) { projectCreate(input: $input) { success project { id name } } }`;
const MILESTONE_LIST = `query($id: String!) { project(id: $id) { projectMilestones(first: 100) { nodes { id name } } } }`;
const MILESTONE_CREATE = `mutation($input: ProjectMilestoneCreateInput!) { projectMilestoneCreate(input: $input) { success projectMilestone { id name } } }`;
/**
 * Linear caps query complexity at 10000. 250 issues with the nested relation
 * connection scored 18126 on 2026-09-23; 100 leaves headroom. A fixture
 * project holding more issues than this is not a fixture project, so the
 * second page is refused rather than paged through: silently reading half
 * the issues would make the script create duplicates of the half it missed.
 */
const ISSUE_PAGE = 100;
const PROJECT_ISSUES = `query($id: String!) { project(id: $id) { issues(first: ${String(ISSUE_PAGE)}, includeArchived: false) {
  pageInfo { hasNextPage }
  nodes {
  id identifier title estimate projectMilestone { name }
  inverseRelations { nodes { id type issue { id } } } } } } }`;
const ISSUE_CREATE = `mutation($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id identifier title } } }`;
const ISSUE_UPDATE = `mutation($id: String!, $input: IssueUpdateInput!) { issueUpdate(id: $id, input: $input) { success } }`;
const RELATION_CREATE = `mutation($issueId: String!, $relatedIssueId: String!) {
  issueRelationCreate(input: { issueId: $issueId, relatedIssueId: $relatedIssueId, type: blocks }) { success } }`;
const RELATION_DELETE = `mutation($id: String!) { issueRelationDelete(id: $id) { success } }`;

export interface FixtureEnv {
  key: string;
  team: string;
  project: string;
}

export interface LiveIssue {
  id: string;
  identifier: string;
  title: string;
  estimate: number | null;
  milestone: string | null;
  /** Relation id, blocker issue id. */
  blockedBy: { relationId: string; blockerId: string }[];
}

export class FixtureRefusal extends Error {}

export interface FixtureOverrides {
  team?: string;
  project?: string;
}

/**
 * The live tier is opt-in and the switch is not a secret, so it is an
 * ordinary environment variable. Everything else resolves from the keychain,
 * a flag, or the manifest, which is why a shell that exported nothing can
 * still run the fixture.
 */
export function liveEnabled(env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  return (env["YALIKEDAGS_LIVE"] ?? "").length > 0;
}

/** The key: the environment first, then the keychain. Never LINEAR_API_KEY, from either. */
export async function resolveKey(env: Readonly<Record<string, string | undefined>> = process.env): Promise<string> {
  const fromEnv = env[KEY_TARGET];
  if (fromEnv !== undefined && fromEnv.length > 0) {
    return fromEnv;
  }
  const fromVault = await new VaultSecretsAdapter().get(KEY_TARGET);
  if (fromVault === undefined) {
    throw new FixtureRefusal(
      `no ${KEY_TARGET} in the environment or the keychain. Store it once, without it reaching argv or history:\n` +
        `  printf 'Paste: '; read -rs K; echo\n` +
        `  printf '%s' "$K" | bun src/cli.ts key --set --target ${KEY_TARGET}\n` +
        `  unset K`,
    );
  }
  return fromVault;
}

/** Team and project are not secrets: a flag, then the environment, then the manifest a previous run wrote. */
export async function resolveFixture(
  overrides: FixtureOverrides = {},
  env: Readonly<Record<string, string | undefined>> = process.env,
): Promise<FixtureEnv> {
  const manifest = await readManifest();
  const team = overrides.team ?? env["YALIKEDAGS_LIVE_TEAM"] ?? str(manifest["team"]);
  const project = overrides.project ?? env["YALIKEDAGS_LIVE_PROJECT"] ?? str(rec(manifest["project"])["name"]) ?? DEFAULT_PROJECT;
  if (team === undefined || team.length === 0) {
    throw new FixtureRefusal("no team: pass --team <KEY>, set YALIKEDAGS_LIVE_TEAM, or provision once so the manifest records it");
  }
  return { key: await resolveKey(env), team, project };
}

async function readManifest(): Promise<Rec> {
  try {
    const parsed: unknown = JSON.parse(await Bun.file(MANIFEST_PATH).text());
    return rec(parsed);
  } catch {
    return {};
  }
}

export function assertFixtureProject(name: string): void {
  if (!name.toLowerCase().includes(PROJECT_SENTINEL)) {
    throw new FixtureRefusal(
      `refusing to touch project "${name}": a fixture project's name must contain "${PROJECT_SENTINEL}". This guard is what keeps this script away from real work.`,
    );
  }
}

export interface FixtureOptions {
  write: boolean;
  createTeam: boolean;
  log: (line: string) => void;
}

export class LiveFixture {
  private readonly client: LinearGraphqlClient;
  private readonly changes: string[] = [];

  constructor(
    private readonly env: FixtureEnv,
    private readonly options: FixtureOptions,
    http: HttpPort = new FetchHttpAdapter(),
  ) {
    assertFixtureProject(env.project);
    this.client = new LinearGraphqlClient(http, env.key);
  }

  /** Everything, in order. Returns the manifest. */
  async run(): Promise<Record<string, unknown>> {
    const team = await this.team();
    await this.ensureEstimates(team);
    const projectId = await this.ensureProject(str(team["id"]) ?? "");
    const milestones = await this.ensureMilestones(projectId);
    const live = await this.ensureIssues(str(team["id"]) ?? "", projectId);
    await this.resetFields(live, milestones);
    await this.resetRelations(live);
    return this.manifest(projectId, live);
  }

  get pending(): readonly string[] {
    return this.changes;
  }

  private note(line: string): void {
    this.changes.push(line);
    this.options.log(`${this.options.write ? "  " : "  would "}${line}`);
  }

  private async team(): Promise<Rec> {
    const found = nodes(rec(await this.client.query(TEAM_BY_KEY, { key: this.env.team }))["teams"]);
    if (found.length === 1) {
      return found[0] ?? {};
    }
    throw new FixtureRefusal(
      `${String(found.length)} teams have key "${this.env.team}". Create the team in the test workspace first; this script does not create teams.`,
    );
  }

  /** The live suite writes estimates, so the team must have an estimate scale that accepts 0 to 3. */
  private async ensureEstimates(team: Rec): Promise<void> {
    const wanted = { issueEstimationType: "linear", issueEstimationAllowZero: true };
    if (team["issueEstimationType"] === wanted.issueEstimationType && team["issueEstimationAllowZero"] === true) {
      return;
    }
    this.note(`enable estimates on team ${str(team["key"]) ?? "?"} (linear scale, zero allowed)`);
    if (this.options.write) {
      await this.mutate(TEAM_UPDATE, { id: str(team["id"]) ?? "", input: wanted }, "teamUpdate");
    }
  }

  private async ensureProject(teamId: string): Promise<string> {
    const existing = nodes(rec(rec(await this.client.query(PROJECTS, { teamId }))["team"])["projects"]).filter(
      (p) => str(p["name"]) === this.env.project,
    );
    if (existing.length > 1) {
      throw new FixtureRefusal(`${String(existing.length)} projects are named "${this.env.project}"; rename or archive the duplicates.`);
    }
    const found = str(existing[0]?.["id"]);
    if (found !== undefined) {
      return found;
    }
    this.note(`create project "${this.env.project}"`);
    if (!this.options.write) {
      return "(not created)";
    }
    const data = await this.mutate(PROJECT_CREATE, { input: { name: this.env.project, teamIds: [teamId] } }, "projectCreate");
    const id = str(rec(rec(data["projectCreate"])["project"])["id"]);
    if (id === undefined) {
      throw new FixtureRefusal("projectCreate reported success but returned no project id");
    }
    return id;
  }

  private async ensureMilestones(projectId: string): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    if (projectId === "(not created)") {
      for (const name of MILESTONES) {
        this.note(`create milestone "${name}"`);
      }
      return out;
    }
    for (const m of nodes(rec(rec(await this.client.query(MILESTONE_LIST, { id: projectId }))["project"])["projectMilestones"])) {
      const id = str(m["id"]);
      const name = str(m["name"]);
      if (id !== undefined && name !== undefined) {
        out.set(name, id);
      }
    }
    for (const name of MILESTONES) {
      if (!out.has(name)) {
        await this.createMilestone(projectId, name, out);
      }
    }
    return out;
  }

  private async createMilestone(projectId: string, name: string, into: Map<string, string>): Promise<void> {
    this.note(`create milestone "${name}"`);
    if (!this.options.write) {
      return;
    }
    const data = await this.mutate(MILESTONE_CREATE, { input: { projectId, name } }, "projectMilestoneCreate");
    const id = str(rec(rec(data["projectMilestoneCreate"])["projectMilestone"])["id"]);
    if (id !== undefined) {
      into.set(name, id);
    }
  }

  /** Reads the project's issues, keeps only the fixture ones, and creates any that are missing. */
  private async ensureIssues(teamId: string, projectId: string): Promise<Map<string, LiveIssue>> {
    const byTitle = projectId === "(not created)" ? new Map<string, LiveIssue>() : await this.readIssues(projectId);
    const out = new Map<string, LiveIssue>();
    for (const spec of ISSUES) {
      const found = byTitle.get(spec.title);
      if (found !== undefined) {
        out.set(spec.name, found);
        continue;
      }
      this.note(`create issue "${spec.title}"`);
      if (this.options.write) {
        const data = await this.mutate(ISSUE_CREATE, { input: { teamId, projectId, title: spec.title, description: spec.why } }, "issueCreate");
        const issue = rec(rec(data["issueCreate"])["issue"]);
        out.set(spec.name, { id: str(issue["id"]) ?? "", identifier: str(issue["identifier"]) ?? "", title: spec.title, estimate: null, milestone: null, blockedBy: [] });
      }
    }
    return out;
  }

  private async readIssues(projectId: string): Promise<Map<string, LiveIssue>> {
    const issues = rec(rec(await this.client.query(PROJECT_ISSUES, { id: projectId }))["project"])["issues"];
    if (rec(rec(issues)["pageInfo"])["hasNextPage"] === true) {
      throw new FixtureRefusal(
        `"${this.env.project}" holds more than ${String(ISSUE_PAGE)} issues, so this is not a fixture project. Refusing rather than reading part of it, which would create duplicates of what it missed.`,
      );
    }
    const raw = nodes(issues);
    const out = new Map<string, LiveIssue>();
    for (const r of raw) {
      const title = str(r["title"]) ?? "";
      if (!title.startsWith(TITLE_PREFIX)) {
        continue;
      }
      if (out.has(title)) {
        throw new FixtureRefusal(`two issues in "${this.env.project}" are titled "${title}"; archive one so the fixture is unambiguous.`);
      }
      out.set(title, {
        id: str(r["id"]) ?? "",
        identifier: str(r["identifier"]) ?? "",
        title,
        estimate: num(r["estimate"]) ?? null,
        milestone: str(rec(r["projectMilestone"])["name"]) ?? null,
        blockedBy: nodes(r["inverseRelations"])
          .filter((x) => x["type"] === "blocks")
          .map((x) => ({ relationId: str(x["id"]) ?? "", blockerId: str(rec(x["issue"])["id"]) ?? "" })),
      });
    }
    return out;
  }

  private async resetFields(live: Map<string, LiveIssue>, milestones: Map<string, string>): Promise<void> {
    for (const spec of ISSUES) {
      const issue = live.get(spec.name);
      if (issue === undefined) {
        continue;
      }
      if (issue.estimate !== spec.estimate) {
        this.note(`set ${issue.identifier} estimate to ${spec.estimate === null ? "(none)" : String(spec.estimate)}`);
        await this.update(issue.id, { estimate: spec.estimate });
      }
      if (issue.milestone !== spec.milestone) {
        this.note(`set ${issue.identifier} milestone to ${spec.milestone ?? "(none)"}`);
        await this.update(issue.id, { projectMilestoneId: spec.milestone === null ? null : (milestones.get(spec.milestone) ?? null) });
      }
    }
  }

  /**
   * Drives the blocks relations among fixture issues to exactly the declared
   * set. Removing the extras is what cleans up after a live test run; only
   * relations whose both endpoints are fixture issues are eligible.
   */
  private async resetRelations(live: Map<string, LiveIssue>): Promise<void> {
    for (const spec of ISSUES) {
      const issue = live.get(spec.name);
      if (issue !== undefined) {
        await this.resetRelationsOf(spec, issue, live);
      }
    }
  }

  private async resetRelationsOf(spec: FixtureIssue, issue: LiveIssue, live: Map<string, LiveIssue>): Promise<void> {
    const fixtureIds = new Set([...live.values()].map((i) => i.id));
    const wanted = new Set(spec.blockedBy.map((n) => live.get(n)?.id).filter((id): id is string => id !== undefined));
    const extra = issue.blockedBy.filter((rel) => fixtureIds.has(rel.blockerId) && !wanted.has(rel.blockerId));
    for (const rel of extra) {
      this.note(`remove the blocks relation on ${issue.identifier} from ${this.identifierOf(live, rel.blockerId)}`);
      if (this.options.write) {
        await this.mutate(RELATION_DELETE, { id: rel.relationId }, "issueRelationDelete");
      }
    }
    const missing = [...wanted].filter((id) => !issue.blockedBy.some((rel) => rel.blockerId === id));
    for (const blockerId of missing) {
      this.note(`add a blocks relation on ${issue.identifier} from ${this.identifierOf(live, blockerId)}`);
      if (this.options.write) {
        await this.mutate(RELATION_CREATE, { issueId: blockerId, relatedIssueId: issue.id }, "issueRelationCreate");
      }
    }
  }

  private identifierOf(live: Map<string, LiveIssue>, id: string): string {
    return [...live.values()].find((i) => i.id === id)?.identifier ?? id;
  }

  private async update(id: string, input: Record<string, unknown>): Promise<void> {
    if (this.options.write) {
      await this.mutate(ISSUE_UPDATE, { id, input }, "issueUpdate");
    }
  }

  private async mutate(document: string, variables: Record<string, unknown>, field: string): Promise<Rec> {
    const data = await this.client.query(document, variables);
    if (rec(data[field])["success"] !== true) {
      throw new FixtureRefusal(`${field} did not report success`);
    }
    return data;
  }

  private manifest(projectId: string, live: Map<string, LiveIssue>): Record<string, unknown> {
    return {
      schema: "yalikedags/live-fixture/1",
      project: { id: projectId, name: this.env.project },
      team: this.env.team,
      milestones: MILESTONES,
      issues: Object.fromEntries([...live].map(([name, i]) => [name, { id: i.id, identifier: i.identifier, title: i.title }])),
      baseline: ISSUES,
    };
  }
}

function flag(argv: readonly string[], name: string): string | undefined {
  const at = argv.indexOf(`--${name}`);
  return at < 0 ? undefined : argv[at + 1];
}

function overridesFrom(argv: readonly string[]): FixtureOverrides {
  const team = flag(argv, "team");
  const project = flag(argv, "project");
  return { ...(team !== undefined && { team }), ...(project !== undefined && { project }) };
}

async function main(argv: readonly string[]): Promise<number> {
  const mode = argv[0] ?? "provision";
  if (mode !== "provision" && mode !== "verify") {
    console.error(`live fixture: unknown mode "${mode}"; use provision or verify`);
    return 2;
  }
  const write = mode === "provision" && !argv.includes("--dry-run");
  const env = await resolveFixture(overridesFrom(argv));
  console.error(`live fixture: ${write ? "provisioning" : "checking"} "${env.project}" in team ${env.team}`);
  const fixture = new LiveFixture(env, { write, createTeam: false, log: (l: string): void => { console.error(l); } });
  const manifest = await fixture.run();
  if (write) {
    await Bun.write(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
    console.error(`live fixture: ${fixture.pending.length === 0 ? "already at baseline" : `${String(fixture.pending.length)} change(s) applied`}; wrote ${MANIFEST_PATH}`);
    return 0;
  }
  console.error(`live fixture: ${fixture.pending.length === 0 ? "matches the baseline" : `${String(fixture.pending.length)} difference(s) from the baseline`}`);
  return fixture.pending.length === 0 ? 0 : 1;
}

if (import.meta.main) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    },
  );
}
