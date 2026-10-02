import { GraphFilters } from "./GraphFilters.ts";
import { InspectorResize } from "./InspectorResize.ts";
import { paginateGroups } from "./ElementPagination.ts";
import { LayoutControls } from "./LayoutControls.ts";
import { TextSizeController } from "./TextSizeController.ts";
import { ThemeController } from "./ThemeController.ts";
import { OwnerFilter } from "./OwnerFilter.ts";
import { GraphNeighborhood } from "./GraphNeighborhood.ts";
import { InspectorNavigation } from "./InspectorNavigation.ts";
import { ViewerInteractions } from "./ViewerInteractions.ts";
import { ExportController } from "./ExportController.ts";
import "./viewer.css";
import { ViewerBootstrap } from "./ViewerBootstrap.ts";
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
  const textSize = new TextSizeController();
  const theme = new ThemeController();
  const analysis = await new ViewerBootstrap().render();
  theme.bind(); textSize.bind();
  new ExportController(analysis);
  const state = new ViewerState(analysis.dag.tasks, analysis.states);
  const session = new SessionState();
  const workspace = new Workspace(session.layout());
  new LayoutControls().bind(workspace); new InspectorResize();
  new TableController(state);
  new OwnerFilter(analysis, "ready"); new OwnerFilter(analysis, "grid");
  paginateGroups(document);
  new ChangesController(state);
  new RefreshController(state, workspace, session);
  const svg = element("graph").querySelector("svg");
  if (svg === null) { throw new Error("Missing graph SVG"); }
  const graph = new GraphController(svg);
  requestAnimationFrame(() => { graph.reveal(); });
  const neighborhood = new GraphNeighborhood(analysis, state, graph);
  new GraphFilters(analysis, state, neighborhood);
  new SelectionController(state, [...workspace.panels.values()]);
  new InspectorNavigation(state, workspace, graph);
  new SearchController(state, () => { workspace.show("graph"); workspace.show("details"); graph.focus(); });
  new ViewerInteractions(workspace, graph);
  element("findings-panel").addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest("[data-inspect-graph]") !== null) {
      workspace.show("graph"); neighborhood.focus();
    }
  });
  session.restore(state);
  document.body.dataset["ready"] = "true";
}

void start().catch((error: unknown) => {
  element("app").textContent = `The viewer could not start: ${error instanceof Error ? error.message : "invalid snapshot"}. Regenerate the export from a valid snapshot.`;
});
