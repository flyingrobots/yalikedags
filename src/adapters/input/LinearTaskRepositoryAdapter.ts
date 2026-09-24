import { Task } from "../../core/domain/Task.ts";
import type { Priority, TaskFields, TaskStatus } from "../../core/domain/Task.ts";
import { MAX_EFFORT } from "../../core/domain/Task.ts";
import type { HttpPort } from "../../ports/HttpPort.ts";
import type { TaskRepositoryPort } from "../../ports/TaskRepositoryPort.ts";
import { LinearGraphqlClient } from "../linear/LinearGraphqlClient.ts";
import type { Rec } from "../linear/GraphqlJson.ts";
import { nodes, num, rec, str } from "../linear/GraphqlJson.ts";

/** Linear caps query complexity at 10000; 100 issues with these nested connections scored 14091 on 2026-09-23, 50 fits. */
const PAGE_SIZE = 50;

const ISSUES = `query($id: String!, $after: String) {
  project(id: $id) { id name issues(first: ${String(PAGE_SIZE)}, after: $after, includeArchived: false) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id identifier title description url createdAt priority estimate dueDate
      state { name type } assignee { name } labels { nodes { name } } projectMilestone { name }
      parent { id } children { nodes { id } }
      relations { nodes { type relatedIssue { id } } }
      inverseRelations { nodes { type issue { id } } }
    } } } }`;

const STATE_TYPES: Record<string, TaskStatus> = { backlog: "open", unstarted: "open", triage: "open", started: "in-progress", completed: "done", canceled: "canceled", duplicate: "canceled" };
const PRIORITIES: readonly Priority[] = [1, 2, 3, 4];

/** Linear is the source of truth. This adapter reads a project's issues and their blocking relations, read-only. */
export class LinearTaskRepositoryAdapter implements TaskRepositoryPort {
  /** Coercions the codec had to make (an estimate above the scale, an unknown state type). Never secrets. */
  readonly warnings: string[] = [];
  private readonly client: LinearGraphqlClient;

  constructor(
    http: HttpPort,
    apiKey: string,
    private readonly project: string,
  ) {
    this.client = new LinearGraphqlClient(http, apiKey);
  }

  describe(): string {
    return `Linear project ${this.project}`;
  }

  async load(): Promise<readonly Task[]> {
    const projectId = await this.client.resolveProjectId(this.project);
    const out: Task[] = [];
    const forward = new Map<string, string[]>();
    let after: string | null = null;
    do {
      const data = await this.client.query(ISSUES, { id: projectId, after });
      const issues = rec(rec(data["project"])["issues"]);
      for (const raw of nodes(issues)) {
        out.push(this.toTask(raw));
        this.collectForwardBlocks(raw, forward);
      }
      const info = rec(issues["pageInfo"]);
      after = info["hasNextPage"] === true ? (str(info["endCursor"]) ?? null) : null;
    } while (after !== null);
    return out.map((t) => {
      const extra = forward.get(t.id) ?? [];
      return extra.length === 0 ? t : t.with({ blockedBy: [...t.blockedBy, ...extra] });
    });
  }

  /** `relations` of type blocks say "this issue blocks relatedIssue"; record it on the other side. */
  private collectForwardBlocks(raw: Rec, forward: Map<string, string[]>): void {
    const from = str(raw["id"]) ?? "";
    for (const r of nodes(raw["relations"])) {
      const to = str(rec(r["relatedIssue"])["id"]);
      if (r["type"] === "blocks" && to !== undefined) {
        forward.set(to, [...(forward.get(to) ?? []), from]);
      }
    }
  }

  private toTask(raw: Rec): Task {
    const id = str(raw["id"]) ?? "";
    const key = str(raw["identifier"]) ?? id;
    const f: TaskFields = {
      id,
      key,
      title: str(raw["title"]) ?? key,
      status: this.statusOf(key, rec(raw["state"])),
      blockedBy: this.blockersOf(raw),
      children: nodes(raw["children"]).map((c) => str(c["id"]) ?? "").filter((x) => x.length > 0),
      labels: nodes(raw["labels"]).map((l) => str(l["name"]) ?? "").filter((x) => x.length > 0),
    };
    const optional: [keyof TaskFields, string | undefined][] = [
      ["description", str(raw["description"])],
      ["url", str(raw["url"])],
      ["createdAt", str(raw["createdAt"])],
      ["due", str(raw["dueDate"])],
      ["assignee", str(rec(raw["assignee"])["name"])],
      ["milestone", str(rec(raw["projectMilestone"])["name"])],
      ["parent", str(rec(raw["parent"])["id"])],
    ];
    for (const [k, v] of optional) {
      if (v !== undefined) {
        Object.assign(f, { [k]: v });
      }
    }
    const priority = PRIORITIES.find((p) => p === num(raw["priority"]));
    const effort = this.effortOf(key, num(raw["estimate"]));
    return new Task({ ...f, ...(priority && { priority }), ...(effort !== undefined && { effort }) });
  }

  private statusOf(key: string, state: Rec): TaskStatus {
    const type = str(state["type"]) ?? "";
    const mapped = STATE_TYPES[type];
    if (mapped === undefined) {
      this.warnings.push(`${key}: unknown state type "${type}"; recorded as open`);
      return "open";
    }
    return mapped;
  }

  private effortOf(key: string, estimate: number | undefined): number | undefined {
    if (estimate === undefined) {
      return undefined;
    }
    if (estimate > MAX_EFFORT) {
      this.warnings.push(`${key}: estimate ${String(estimate)} is above the 0 to ${String(MAX_EFFORT)} scale; recorded as ${String(MAX_EFFORT)}`);
      return MAX_EFFORT;
    }
    return Math.max(0, Math.round(estimate));
  }

  /** inverseRelations of type blocks name what blocks this issue. The forward direction is merged in load(). */
  private blockersOf(raw: Rec): string[] {
    return nodes(raw["inverseRelations"])
      .filter((r) => r["type"] === "blocks")
      .map((r) => str(rec(r["issue"])["id"]) ?? "")
      .filter((x) => x.length > 0);
  }
}
