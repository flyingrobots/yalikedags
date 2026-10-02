import { SnapshotSummary } from "./SnapshotSummary.ts";
import { puppyMarkup } from "./generated/puppy.ts";
import { AppearanceMarkup } from "./AppearanceMarkup.ts";
import type { Analysis } from "../core/services/Analysis.ts";
import { escapeXml as esc, SvgRendererAdapter } from "../adapters/output/SvgRendererAdapter.ts";
import { ViewerPanels } from "./ViewerPanels.ts";
import type { ViewerOptions } from "./ViewerMetadata.ts";

/** Browser-only composition: all source strings are escaped before insertion. */
export class ViewerMarkup {
  render(a: Analysis, options: ViewerOptions): string {
    const views = [["ready", "01", "Start here"], ["graph", "02", "Dependencies"], ["grid", "03", "Waves"], ["table", "04", "Tasks"], ["findings", "05", "Findings"], ["changes", "06", "Import/Export"]];
    return `<aside id="navigation" class="navigation"><a class="brand" href="#" aria-label="yalikedags home">${puppyMarkup}<span class="brand-name">yalikedags<span>?</span></span></a>
<div class="project"><strong title="${esc(a.source)}">${esc(a.account?.project.name ?? a.source)}</strong><small>Snapshot · ${esc(a.asOf)}</small></div>
<nav class="primary-nav" aria-label="Workspace views">${views.map(([id, , title]) => `<button data-panel="${id ?? ""}" aria-label="${title ?? ""}">${title ?? ""}${id === "findings" ? `<span class="count">${String(a.findings.length)}</span>` : ""}</button>`).join("")}</nav>
<div class="nav-bottom">${new AppearanceMarkup().render()}${this.account(a)}<span class="local-indicator">${options.refresh ? "Local workspace" : "Offline snapshot"}</span></div></aside>
<main id="workspace">${new SnapshotSummary().render(a, options)}<h1 id="view-title">Start here</h1>
<div class="workspace-body"><button id="toggle-details" class="details-edge" aria-label="Task details" aria-controls="inspector" aria-expanded="false" hidden>◧</button><div id="view-content"></div><aside id="inspector" aria-label="Task details" hidden><div id="inspector-resize" role="separator" tabindex="0" aria-label="Resize task details" aria-orientation="vertical" aria-controls="inspector"></div><div class="inspector-heading"><span>Task details</span><button id="close-details" aria-label="Close task details">×</button></div></aside></div>
<footer><span id="selection-status" role="status"></span><span id="viewer-notice" role="status" hidden></span></footer></main>
${new ViewerPanels(a, options).render(new SvgRendererAdapter().render(a))}`;
  }

  private account(a: Analysis): string {
    if (a.account === undefined) { return '<div class="account-info"><span>No Linear account metadata</span></div>'; }
    return `<div class="account-info"><span class="eyebrow">LINEAR WORKSPACE</span><strong>${esc(a.account.workspace.name)}</strong><span>Captured by ${esc(a.account.user.name)}</span></div>`;
  }
}
