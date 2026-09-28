import { isRec, str } from "./GraphqlJson.ts";
import type { Rec } from "./GraphqlJson.ts";

/** A connection must prove it is complete or supply a new cursor. */
export class LinearPage {
  readonly nodes: Rec[];
  readonly next: string | null;

  constructor(raw: unknown, previous: string | null) {
    if (!isRec(raw) || !Array.isArray(raw["nodes"]) || !raw["nodes"].every(isRec)) {
      throw new Error("linear_incomplete: missing connection nodes");
    }
    const info = raw["pageInfo"];
    if (!isRec(info) || typeof info["hasNextPage"] !== "boolean") { throw new Error("linear_incomplete: missing page information"); }
    const cursor = str(info["endCursor"]);
    if (info["hasNextPage"] && !this.newCursor(cursor, previous)) { throw new Error("linear_incomplete: missing or repeated pagination cursor"); }
    this.nodes = raw["nodes"];
    this.next = info["hasNextPage"] ? (cursor ?? null) : null;
  }
  private newCursor(cursor: string | undefined, previous: string | null): boolean { return !!cursor && cursor !== previous; }
}
