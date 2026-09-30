import { LinearAccount } from "../../core/domain/LinearAccount.ts";
import { rec, str } from "../linear/GraphqlJson.ts";

/** Missing metadata is valid for non-Linear sources and older snapshots. */
export class LinearAccountCodec {
  decode(raw: unknown): LinearAccount | undefined {
    if (raw === undefined || raw === null) { return undefined; }
    const data = rec(raw);
    return new LinearAccount(this.identity(data["user"]), this.identity(data["workspace"]), this.identity(data["project"]));
  }

  private identity(raw: unknown): { id: string; name: string } {
    const data = rec(raw);
    return { id: str(data["id"]) ?? "", name: str(data["name"]) ?? "" };
  }
}
