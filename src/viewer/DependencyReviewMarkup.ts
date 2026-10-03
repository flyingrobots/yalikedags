import { DependencyProposalMarkup } from "./DependencyProposalMarkup.ts";

/** Explicit manual review of the captured project; local candidates require explicit human dispositions. */
export class DependencyReviewMarkup {
  render(a: Analysis): string {
    return `<section class="dependency-review" aria-label="Dependency review"><div id="dependency-review-status" role="status"><strong>Dependency review is incomplete.</strong><p>No review is recorded for this capture. No recorded blocker does not establish independence.</p></div>
    ${new DependencyProposalMarkup().controls()}<button id="review-dependencies">Review dependencies</button>
    <form id="dependency-review-form" hidden><p>Review all tasks, recorded prerequisite relationships, and locally discovered candidates in this capture. Local discovery finds cited issue references; recording decisions does not write to Linear. Record questionable relationships and missing evidence as exceptions.</p>
    <label>Reviewer name <input id="reviewer-name" maxlength="256" value="Local reviewer" required></label>
    <label>Review basis <textarea id="review-basis" maxlength="65536" required placeholder="What evidence did you inspect? Why are the recorded relationships appropriate?"></textarea></label>
    <label>Unresolved exceptions <textarea id="review-exceptions" maxlength="65536" placeholder="One unresolved obligation or evidence gap per line; leave empty only after review."></textarea></label>
    <details id="dependency-candidate-details"><summary>Candidate dependency decisions</summary>${new DependencyProposalMarkup().introduction()}<ul id="dependency-candidates"></ul></details><details><summary>Recorded relationship decisions</summary><p>Choose a disposition for each recorded relationship. Unreviewed and rejected relationships remain explicit exceptions. These decisions do not modify Linear or remove edges from the current graph.</p><ul id="review-relationships">${a.dag.tasks.flatMap(task => task.blockedBy.map(blocker => `<li><label>${esc(blocker)} → ${esc(task.id)} <select data-review-edge data-blocker="${esc(blocker)}" data-dependent="${esc(task.id)}" aria-label="Decision for ${esc(blocker)} to ${esc(task.id)}"><option value="unreviewed">Unreviewed</option><option value="accepted">Accept prerequisite</option><option value="rejected">Reject relationship</option></select></label><label>Relationship note <input data-review-note maxlength="65536" placeholder="Required when rejecting"></label></li>`)).join("") || "<li>No recorded relationships. Missing edges may still exist.</li>"}</ul></details>
    <button type="submit">Record review</button><button type="button" id="cancel-review">Cancel</button></form>
    <button id="clear-dependency-review">Clear local review</button>
    <p id="dependency-review-notice" role="status"></p></section>`;
  }
}
import type { Analysis } from "../core/services/Analysis.ts";
import { escapeXml as esc } from "../adapters/output/SvgRendererAdapter.ts";
