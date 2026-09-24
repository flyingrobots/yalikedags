import type { HttpPort } from "../../ports/HttpPort.ts";
import type { TaskWriterPort } from "../../ports/TaskWriterPort.ts";
import { LinearGraphqlClient } from "../linear/LinearGraphqlClient.ts";
import { nodes, rec, str } from "../linear/GraphqlJson.ts";

const RELATIONS_OF = `query($id: String!) { issue(id: $id) { inverseRelations { nodes { id type issue { id } } } } }`;
const CREATE = `mutation($issueId: String!, $relatedIssueId: String!) {
  issueRelationCreate(input: { issueId: $issueId, relatedIssueId: $relatedIssueId, type: blocks }) { success } }`;
const DELETE = `mutation($id: String!) { issueRelationDelete(id: $id) { success } }`;
const UPDATE = `mutation($id: String!, $input: IssueUpdateInput!) { issueUpdate(id: $id, input: $input) { success } }`;
const MILESTONES = `query($id: String!) { project(id: $id) { projectMilestones(first: 100) { nodes { id name } } } }`;

/**
 * Writes to Linear. The only class in this repository that does.
 *
 * Both relation methods read before they write, so performing a plan twice is
 * harmless: adding a relation that exists and removing one that does not are
 * both no-ops. That matters because a plan can fail halfway, and the recovery
 * for a half-applied plan has to be "run it again", not "work out by hand
 * which half landed". The extra query per mutation is the price, and at the
 * scale of a project's dependency graph it is not a real cost.
 *
 * Whether Linear itself rejects a duplicate relation is not established here:
 * this adapter was written without calling the API, so it does not rely on
 * the answer either way.
 */
export class LinearTaskWriterAdapter implements TaskWriterPort {
  private readonly client: LinearGraphqlClient;
  private projectId: string | undefined;
  private milestones: Map<string, string> | undefined;

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

  async addBlockingRelation(blockerId: string, blockedId: string): Promise<void> {
    if (await this.relationId(blockerId, blockedId) !== undefined) {
      return;
    }
    const data = await this.client.query(CREATE, { issueId: blockerId, relatedIssueId: blockedId });
    this.assertSuccess(data, "issueRelationCreate", `${blockerId} blocks ${blockedId}`);
  }

  async removeBlockingRelation(blockerId: string, blockedId: string): Promise<void> {
    const id = await this.relationId(blockerId, blockedId);
    if (id === undefined) {
      return;
    }
    const data = await this.client.query(DELETE, { id });
    this.assertSuccess(data, "issueRelationDelete", `${blockerId} blocks ${blockedId}`);
  }

  async setEstimate(taskId: string, effort: number | null): Promise<void> {
    const data = await this.client.query(UPDATE, { id: taskId, input: { estimate: effort } });
    this.assertSuccess(data, "issueUpdate", `estimate of ${taskId}`);
  }

  async setMilestone(taskId: string, milestoneName: string | null): Promise<void> {
    const milestoneId = milestoneName === null ? null : await this.milestoneId(milestoneName);
    const data = await this.client.query(UPDATE, { id: taskId, input: { projectMilestoneId: milestoneId } });
    this.assertSuccess(data, "issueUpdate", `milestone of ${taskId}`);
  }

  /** The id of the `blocks` relation naming `blockerId` on `blockedId`, or undefined. */
  private async relationId(blockerId: string, blockedId: string): Promise<string | undefined> {
    const data = await this.client.query(RELATIONS_OF, { id: blockedId });
    const found = nodes(rec(data["issue"])["inverseRelations"]).find(
      (r) => r["type"] === "blocks" && str(rec(r["issue"])["id"]) === blockerId,
    );
    return found === undefined ? undefined : str(found["id"]);
  }

  private async milestoneId(name: string): Promise<string> {
    this.milestones ??= await this.loadMilestones();
    const id = this.milestones.get(name);
    if (id === undefined) {
      throw new Error(`linear_milestone_not_found: no milestone named "${name}" in ${this.project}; this tool does not create milestones`);
    }
    return id;
  }

  private async loadMilestones(): Promise<Map<string, string>> {
    const projectId = await this.resolvedProjectId();
    const data = await this.client.query(MILESTONES, { id: projectId });
    const out = new Map<string, string>();
    for (const m of nodes(rec(data["project"])["projectMilestones"])) {
      const id = str(m["id"]);
      const name = str(m["name"]);
      if (id !== undefined && name !== undefined) {
        out.set(name, id);
      }
    }
    return out;
  }

  private async resolvedProjectId(): Promise<string> {
    this.projectId ??= await this.client.resolveProjectId(this.project);
    return this.projectId;
  }

  /** A mutation that returns `success: false` is a refusal, not a success with a caveat. */
  private assertSuccess(data: Record<string, unknown>, field: string, subject: string): void {
    if (rec(data[field])["success"] !== true) {
      throw new Error(`linear_write_refused: ${field} did not report success for ${subject}`);
    }
  }
}
