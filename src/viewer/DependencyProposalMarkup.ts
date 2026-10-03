import type { Analysis } from "../core/services/Analysis.ts";
import type { DependencyCandidate } from "../core/domain/DependencyCandidate.ts";
import { escapeXml as esc } from "../adapters/output/SvgRendererAdapter.ts";

/** Cited candidates share the manual review's decision controls and persistence. */
export class DependencyProposalMarkup {
  candidates(a: Analysis, candidates: readonly DependencyCandidate[]): string {
    return candidates.map(c => `<li><strong>${esc(a.dag.get(c.blocker).key)} → ${esc(a.dag.get(c.dependent).key)}</strong> · ${c.confidence === "explicit" ? "Explicit prerequisite wording" : "Uncertain reference; direction needs evidence"}<blockquote>${esc(c.evidence)}</blockquote><p>Proposed interpretation: this card requires output from ${esc(a.dag.get(c.blocker).key)}. Confirm that its PR must merge first; similarity, hierarchy, and shared people do not establish that.</p><label>Candidate decision <select data-review-edge data-candidate data-blocker="${esc(c.blocker)}" data-dependent="${esc(c.dependent)}"><option value="unreviewed">Unreviewed</option><option value="accepted">Accept prerequisite</option><option value="rejected">Reject candidate</option></select></label><label>Evidence and direction rationale <input data-review-note maxlength="65536" placeholder="Required for acceptance or rejection"></label></li>`).join("") || "<li>No candidate references found. This does not establish independence.</li>";
  }

  introduction(): string {
    return `<p>Local rule-based discovery reads titles and descriptions. It finds issue-key references, not every real dependency. No task context leaves this browser. Discovery stops at 2,000 candidates; reaching that limit leaves review coverage incomplete. Explicit wording still needs your review; uncertain references may have the wrong direction or no prerequisite at all.</p>`;
  }

  controls(): string {
    return `<section class="dependency-proposals" aria-label="Dependency proposals"><button id="discover-dependencies">Discover candidate dependencies</button><p id="proposal-notice" role="status">The main viewer analyzes recorded relations. Proposals are local until a fresh tracker read confirms them.</p><details id="dependency-proposal-tools"><summary>Preview and export proposals</summary><label>Preview graph <select id="proposal-graph" aria-label="Preview graph"><option value="recorded">Recorded</option><option value="proposed">Proposed, including unreviewed candidates</option><option value="accepted">Recorded + accepted candidates</option></select></label><button id="preview-proposals">Preview selected graph</button><button id="export-proposal-evidence">Download proposal evidence</button><button id="export-proposal-plan">Download accepted relation plan</button><details id="proposal-preview"><summary>Selected graph preview</summary><div id="proposal-preview-content"></div></details><p>Save decisions with Record review before exporting a plan. Accepting does not write to Linear. Inspect the downloaded plan, then apply it explicitly with the CLI; refresh this viewer to see confirmed source relations.</p><code>bun src/cli.ts apply --plan &lt;downloaded-plan.json&gt; --confirm --receipt receipt.json</code></details></section>`;
  }
}
