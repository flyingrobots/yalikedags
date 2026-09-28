import "dockview/dist/styles/dockview.css";
import "./viewer.css";
import { JsonSnapshotRepositoryAdapter } from "../../adapters/input/JsonSnapshotRepositoryAdapter.ts";
import { element } from "./Dom.ts";
import { ViewerState } from "./ViewerState.ts";
import { Workspace } from "./Workspace.ts";
import { SelectionController } from "./SelectionController.ts";
import { GraphController } from "./GraphController.ts";
import { SearchController } from "./SearchController.ts";

import { TableController } from "./TableController.ts";
import { SessionState } from "./SessionState.ts";
import { RefreshController } from "./RefreshController.ts";
import { ChangesController } from "./ChangesController.ts";

async function start(): Promise<void> {
  const state = new ViewerState(await new JsonSnapshotRepositoryAdapter(element("snapshot").textContent, "embedded").load());
  const session = new SessionState();
  const workspace = new Workspace(session.layout());
  new TableController(state);
  new ChangesController(state);
  new RefreshController(state, workspace, session);
  const svg = element("graph").querySelector("svg");
  if (svg === null) { throw new Error("Missing graph SVG"); }
  const graph = new GraphController(svg);
  requestAnimationFrame(() => { graph.readable(); });
  new SelectionController(state, [...workspace.panels.values()]);
  state.subscribe(() => { if (state.selected !== undefined) { workspace.show("details"); } });
  new SearchController(state, () => { workspace.show("graph"); workspace.show("details"); graph.focus(); });
  const actions = new Map<string, () => void>([
    ["fit", (): void => { graph.fit(); }], ["focus", (): void => { graph.focus(); }],
    ["zoom-in", (): void => { graph.zoom(1 / 1.25); }], ["zoom-out", (): void => { graph.zoom(1.25); }],
    ["split", (): void => { workspace.split(); }], ["reset", (): void => { workspace.reset(); graph.readable(); }],
  ]);
  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) { return; }
    const control = event.target.closest("button");
    const panel = control?.dataset["panel"];
    if (panel !== undefined) { workspace.show(panel); }
    actions.get(control?.dataset["action"] ?? "")?.();
  });
  session.restore(state);
  document.body.dataset["ready"] = "true";
}

void start().catch((error: unknown) => {
  element("workspace").textContent = `The viewer could not start: ${error instanceof Error ? error.message : "invalid snapshot"}. Regenerate the export from a valid snapshot.`;
});
