import { JsonSnapshotRepositoryAdapter } from "../../adapters/input/JsonSnapshotRepositoryAdapter.ts";
import { Dag } from "../../core/domain/Dag.ts";
import { SnapshotChangesService } from "../../core/services/SnapshotChangesService.ts";
import { rec, str } from "../../adapters/linear/GraphqlJson.ts";

/** Dedicated local worker; no network, DOM, or tracker credentials. */
async function compare(raw: unknown): Promise<void> {
  try {
    const data = rec(raw); const file = data["file"]; const current = str(data["current"]);
    if (!(file instanceof Blob) || current === undefined) { throw new Error("Invalid comparison request"); }
    const before = new JsonSnapshotRepositoryAdapter(await file.text(), "comparison");
    const after = new JsonSnapshotRepositoryAdapter(current, "current snapshot");
    const changes = new SnapshotChangesService().compare(new Dag(await before.load()), new Dag(await after.load()));
    globalThis.postMessage({ changes, capturedAt: before.capturedAt });
  } catch (error) {
    const message = error instanceof Error && error.message.startsWith("snapshot_limit:") ? error.message : "Choose a valid yalikedags snapshot JSON file.";
    globalThis.postMessage({ error: message });
  }
}
globalThis.addEventListener("message", (event: MessageEvent<unknown>) => { void compare(event.data); });
