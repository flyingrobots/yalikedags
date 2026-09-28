import { LinearPage } from "./LinearPage.ts";
import { rec, str } from "./GraphqlJson.ts";
import type { Rec } from "./GraphqlJson.ts";

/** A truncated or malformed nested connection cannot establish graph completeness. */
export class LinearConnection {
  check(raw: unknown, field: string): void {
    const page = new LinearPage(raw, null);
    if (page.next !== null) { throw new Error(`linear_incomplete: additional ${field}; refusing a partial graph`); }
    for (const node of page.nodes) {
      if (!this.validNode(node, field)) { throw new Error(`linear_incomplete: malformed ${field} node`); }
    }
  }

  private validNode(node: Rec, field: string): boolean {
    if (field === "children") { return !!str(node["id"]); }
    if (field === "labels") { return !!str(node["name"]); }
    if (!str(node["type"])) { return false; }
    if (node["type"] !== "blocks") { return true; }
    const target = field === "relations" ? "relatedIssue" : "issue";
    return !!str(rec(node[target])["id"]);
  }
}
