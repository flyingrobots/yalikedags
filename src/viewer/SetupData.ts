import { rec, str } from "../adapters/linear/GraphqlJson.ts";

export interface ViewerSetup {
  kind: "setup";
  reason: "missing" | "rejected";
  keyTarget: string;
}

/** Only credential metadata crosses this boundary; never a key or upstream error text. */
export class SetupData {
  render(setup: ViewerSetup): string {
    return JSON.stringify({ schema: "yalikedags/setup/1", reason: setup.reason, keyTarget: setup.keyTarget });
  }
  decode(text: string): ViewerSetup | undefined {
    const value: unknown = JSON.parse(text);
    const data = rec(value);
    if (data["schema"] !== "yalikedags/setup/1") { return undefined; }
    const keyTarget = str(data["keyTarget"]);
    const reason = data["reason"];
    if (!keyTarget || (reason !== "missing" && reason !== "rejected")) { throw new Error("Invalid credential setup data"); }
    return { kind: "setup", keyTarget, reason };
  }
}
