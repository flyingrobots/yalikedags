import type { Analysis } from "../core/services/Analysis.ts";
import { escapeXml as esc } from "../adapters/output/SvgRendererAdapter.ts";
import { viewerScript, viewerStyles } from "./generated/assets.ts";
import { ViewerPanels } from "./ViewerPanels.ts";

import { viewerMetadata } from "./ViewerMetadata.ts";
import type { ViewerOptions } from "./ViewerMetadata.ts";

/** Both serve and HTML export carry the same bundled, offline workspace. */
export function viewerPage(a: Analysis, assets: { svg: string; snapshotJson: string }, options: ViewerOptions = {}): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(a.source)} · yalikedags</title><style>${viewerStyles.replace(/<\/style/gi, "<\\/style")}</style></head>
<body data-source="${esc(a.source)}"><header class="app-header"><div class="brand">yalikedags<span>DEPENDENCY WORKSPACE</span></div>
<div class="project"><strong>${esc(a.source)}</strong><span>${String(a.dag.size)} tasks · ${String(a.frontier.length)} ready · as of ${esc(a.asOf)}</span></div>
<div class="search"><label class="sr-only" for="search">Find a task</label><input id="search" type="search" placeholder="Find a task by key, title or assignee…" autocomplete="off"><div id="search-results" hidden></div></div><div id="workspace-controls" class="workspace-controls"><button id="workspace-settings" class="workspace-settings" aria-label="Workspace settings" title="Views and layout" aria-expanded="false" aria-controls="workspace-menu"><span aria-hidden="true">⚙</span></button><nav id="workspace-menu" class="workspace-menu" aria-label="Workspace views" hidden>
<button data-panel="graph" aria-label="Show DAG">DAG</button><button data-panel="grid" aria-label="Show wave grid">Wave grid</button>
<button data-panel="table" aria-label="Show task table">Task table</button><button data-panel="changes">Changes</button>
<button data-panel="details">Task details</button><button data-panel="ready">Ready work</button><button data-panel="findings">Findings <span class="count">${String(a.findings.length)}</span></button>
<button id="filter-summary" data-panel="table" hidden></button><hr><button data-action="reset">Reset layout</button></nav></div></header>
${viewerMetadata(a, options)}

<main id="workspace" aria-label="Task workspace"></main><footer><span id="selection-status" role="status">Select a task to trace its dependencies.</span><span>Drag tabs to arrange views · Esc clears selection</span></footer>
${new ViewerPanels(a, options.changes).render(assets.svg)}
<noscript>This viewer needs JavaScript to display its panels. The snapshot data is embedded in this file.</noscript>
<script id="snapshot" type="application/json">${assets.snapshotJson.replace(/</g, "\\u003c")}</script>
<script>${viewerScript.replace(/<\/script/gi, "<\\/script")}</script></body></html>`;
}
