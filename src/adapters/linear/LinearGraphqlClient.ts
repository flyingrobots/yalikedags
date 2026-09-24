/**
 * One place that talks to Linear's GraphQL endpoint, shared by the reader and
 * the writer so they cannot drift in how they authenticate, how they name a
 * refusal, or how they resolve a project.
 *
 * Refusals are named with a leading token (`linear_unauthorized:`) because the
 * CLI maps that token to an exit code. The API key travels in a header and is
 * never interpolated into a message, a query, or a thrown error.
 */
import type { HttpPort } from "../../ports/HttpPort.ts";
import type { Rec } from "./GraphqlJson.ts";
import { list, nodes, rec, str } from "./GraphqlJson.ts";

export const LINEAR_GRAPHQL_URL = "https://api.linear.app/graphql";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PROJECT_BY_NAME = `query($name: String!) { projects(filter: { name: { eqIgnoreCase: $name } }, first: 5) { nodes { id name } } }`;

export class LinearGraphqlClient {
  constructor(
    private readonly http: HttpPort,
    private readonly apiKey: string,
  ) {}

  async query(document: string, variables: Record<string, unknown>): Promise<Rec> {
    const res = await this.http.post(
      LINEAR_GRAPHQL_URL,
      { "Content-Type": "application/json", Authorization: this.apiKey },
      JSON.stringify({ query: document, variables }),
    );
    if (res.status === 401 || res.status === 403) {
      throw new Error(`linear_unauthorized: Linear rejected the API key (HTTP ${String(res.status)})`);
    }
    if (res.status !== 200) {
      throw new Error(`linear_http_error: HTTP ${String(res.status)}: ${res.body.slice(0, 300)}`);
    }
    const parsed: unknown = JSON.parse(res.body);
    const body = rec(parsed);
    const errors = list(body["errors"]);
    if (errors.length > 0) {
      throw new Error(`linear_graphql_error: ${errors.map((e) => str(rec(e)["message"]) ?? "unknown").join("; ")}`);
    }
    return rec(body["data"]);
  }

  /** A UUID is used as given; anything else must name exactly one project. */
  async resolveProjectId(nameOrId: string): Promise<string> {
    if (UUID.test(nameOrId)) {
      return nameOrId;
    }
    const data = await this.query(PROJECT_BY_NAME, { name: nameOrId });
    const found = nodes(data["projects"]);
    const id = str(found[0]?.["id"]);
    if (found.length !== 1 || id === undefined) {
      throw new Error(`linear_project_not_found: ${String(found.length)} projects match "${nameOrId}"`);
    }
    return id;
  }
}
