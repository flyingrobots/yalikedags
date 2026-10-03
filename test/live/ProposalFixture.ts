import { LinearGraphqlClient } from "../../src/adapters/linear/LinearGraphqlClient.ts";
import { nodes, rec, str } from "../../src/adapters/linear/GraphqlJson.ts";
import { FetchHttpAdapter } from "../../src/adapters/http/FetchHttpAdapter.ts";
import { LinearTaskRepositoryAdapter } from "../../src/adapters/input/LinearTaskRepositoryAdapter.ts";
import { LinearTaskWriterAdapter } from "../../src/adapters/output/LinearTaskWriterAdapter.ts";
import type { Task } from "../../src/core/domain/Task.ts";
import { assertFixtureProject, resolveFixture, TITLE_PREFIX } from "../../scripts/live-fixture.ts";

/** Dedicated relation-only fixture: no estimate/team settings, and no existing project tasks are modified. */
export class ProposalFixture {
  readonly projectName = "yalikedags-test-proposals";
  private key = "";
  private project = "";
  private readonly ids = new Map<string, string>();

  async provision(): Promise<void> {
    assertFixtureProject(this.projectName);
    const env = await resolveFixture({ project: this.projectName });
    this.key = env.key;
    const client = this.client();
    const teams = nodes((await client.query("query($key:String!){teams(first:2,filter:{key:{eq:$key}}){nodes{id}}}", { key: env.team }))["teams"]);
    const team = teams.length === 1 ? str(teams[0]?.["id"]) : undefined;
    if (team === undefined) { throw new Error("Proposal fixture needs exactly one existing team"); }
    await this.ensureProject(team);
    await this.ensureIssues(team);
    await this.reset();
  }

  private async ensureProject(team: string): Promise<void> {
    const client = this.client();
    const projects = nodes((await client.query("query($name:String!){projects(first:2,filter:{name:{eq:$name}}){nodes{id teams(first:100){nodes{id}}}}}", { name: this.projectName }))["projects"]);
    if (projects.length > 1) { throw new Error("Ambiguous proposal fixture project"); }
    if (projects[0] !== undefined) { ProposalFixture.assertTeam(projects[0], team); }
    this.project = str(projects[0]?.["id"]) ?? "";
    if (!this.project) {
      const created = await client.query("mutation($input:ProjectCreateInput!){projectCreate(input:$input){success project{id}}}", { input: { name: this.projectName, teamIds: [team] } });
      this.project = str(rec(rec(created["projectCreate"])["project"])["id"]) ?? "";
    }
    if (!this.project) { throw new Error("Proposal fixture project creation failed"); }
  }

  static assertTeam(project: Record<string, unknown>, team: string): void {
    if (!nodes(project["teams"]).some(entry => str(entry["id"]) === team)) {
      throw new Error("Proposal fixture project does not belong to the configured team; refusing writes");
    }
  }

  private async ensureIssues(team: string): Promise<void> {
    const tasks = await this.read();
    for (const name of ["schema", "consumer"]) {
      const title = `${TITLE_PREFIX} proposal ${name}`;
      const matches = tasks.filter(task => task.title === title);
      if (matches.length > 1) { throw new Error("Ambiguous proposal fixture issue"); }
      let id = matches[0]?.id;
      if (id === undefined) {
        const created = await this.client().query("mutation($input:IssueCreateInput!){issueCreate(input:$input){success issue{id}}}", { input: { teamId: team, projectId: this.project, title } });
        id = str(rec(rec(created["issueCreate"])["issue"])["id"]);
      }
      if (id === undefined) { throw new Error("Proposal fixture issue creation failed"); }
      this.ids.set(name, id);
    }
  }

  async read(): Promise<readonly Task[]> {
    const tasks = await this.repository().load();
    if (tasks.some(task => !task.title.startsWith(`${TITLE_PREFIX} proposal `))) { throw new Error("Unexpected issue in dedicated proposal fixture; refusing writes"); }
    return tasks;
  }

  repository(): LinearTaskRepositoryAdapter { return new LinearTaskRepositoryAdapter(new FetchHttpAdapter(), this.key, this.project); }
  credentials(): string { return this.key; }
  id(name: string): string { const id = this.ids.get(name); if (!id) { throw new Error("Missing fixture endpoint"); } return id; }

  async reset(): Promise<boolean> {
    if (this.ids.size !== 2) { return false; }
    await this.read();
    await new LinearTaskWriterAdapter(new FetchHttpAdapter(), this.key, this.project).removeBlockingRelation(this.id("schema"), this.id("consumer"));
    await this.describe("");
    return true;
  }

  async describe(description: string): Promise<void> {
    await this.read();
    const response = await this.client().query("mutation($id:String!,$input:IssueUpdateInput!){issueUpdate(id:$id,input:$input){success}}", { id: this.id("consumer"), input: { description } });
    if (rec(response["issueUpdate"])["success"] !== true) { throw new Error("Fixture description update refused"); }
  }

  private client(): LinearGraphqlClient { return new LinearGraphqlClient(new FetchHttpAdapter(), this.key); }
}
