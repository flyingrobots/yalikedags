import type { Analysis } from "../../core/services/Analysis.ts";
import { DependencyDiscoveryService } from "../../core/services/DependencyDiscoveryService.ts";
import { DependencyProposalService } from "../../core/services/DependencyProposalService.ts";
import { ReviewIdentityAdapter } from "../../adapters/review/ReviewIdentityAdapter.ts";
import { JsonSnapshotAdapter } from "../../adapters/output/JsonSnapshotAdapter.ts";
import { SnapshotBudget } from "../../adapters/input/SnapshotBudget.ts";
import { PlanJsonCodec } from "../../adapters/plan/PlanJsonCodec.ts";
import { SvgRendererAdapter, escapeXml as esc } from "../../adapters/output/SvgRendererAdapter.ts";
import { PlanningCoverageMarkup } from "../PlanningCoverageMarkup.ts";
import { DependencyProposalMarkup } from "../DependencyProposalMarkup.ts";
import type { DependencyReviewController } from "./DependencyReviewController.ts";
import { element } from "./Dom.ts";

/** Discovery and preview are local; the downloaded plan goes through the existing explicit CLI apply gate. */
export class DependencyProposalController {
  constructor(private readonly analysis: Analysis, private readonly review: DependencyReviewController) {
    const discovery = new DependencyDiscoveryService().scan(analysis.dag);
    const summary = `${String(discovery.candidates.length)} candidates. ${discovery.truncated ? "Additional candidate pairs were omitted; review coverage is incomplete." : "No candidate pairs omitted by the retention limit; unreferenced dependencies may still exist."}`;
    element("dependency-candidates").innerHTML = new DependencyProposalMarkup().candidates(analysis, discovery.candidates);
    element("dependency-discovery-status").textContent = summary;
    element("export-proposal-evidence").addEventListener("click", () => { void this.exportEvidence().catch((error: unknown) => { this.notice(error); }); });
    element("discover-dependencies").addEventListener("click", () => { this.run(() => {
      element("dependency-candidate-details").setAttribute("open", "");
      element("review-dependencies").click();
      element("proposal-notice").textContent = `${summary} Review the cited direction, then record decisions. No tracker writes.`;
    }); });
    element("preview-proposals").addEventListener("click", () => { this.run(() => { this.preview(); }); });
    element("export-proposal-plan").addEventListener("click", () => { void this.exportPlan().catch((error: unknown) => { this.notice(error); }); });
  }

  private preview(): void {
    const select = element("proposal-graph");
    if (!(select instanceof HTMLSelectElement)) { return; }
    const mode = select.value;
    if (mode !== "recorded" && mode !== "proposed" && mode !== "accepted") { throw new Error("Invalid graph selection"); }
    const decisions = this.review.draftDecisions();
    const a = mode === "recorded" ? this.analysis : new DependencyProposalService().preview(this.analysis, decisions, mode);
    const heading = { recorded: "Recorded source graph", proposed: "Unreviewed proposed graph — hypothetical", accepted: "Recorded + locally accepted graph — not yet written" }[mode];
    const label = (id: string): string => esc(a.dag.get(id).key);
    element("proposal-preview-content").innerHTML = `<h3>${heading}</h3><p>The main viewer and task inspector remain on recorded relations. Preview uses the current form choices; save the review to retain them.</p><p>${String(this.analysis.frontier.length)} recorded ready cards → ${String(a.frontier.length)} preview ready cards.</p><p>Ready: ${a.frontier.map(entry => label(entry.task.id)).join(", ") || "None"}.</p><ol>${a.waves.map(wave => `<li>${wave.map(label).join(", ")}</li>`).join("")}</ol><p>Critical path by depth: ${a.criticalByDepth.tasks.map(label).join(" → ") || "None"}. By effort: ${a.criticalByEffort.tasks.map(label).join(" → ") || "None"}.</p>${new PlanningCoverageMarkup().render(a).replace('id="planning-coverage"', 'class="proposal-coverage"')}<div class="proposal-svg">${new SvgRendererAdapter().render(a, a.dag, "proposal-arrow")}</div>`;
    element("proposal-preview").setAttribute("open", "");
  }

  private async exportEvidence(): Promise<void> {
    const decisions = this.review.draftDecisions();
    const accepted = new DependencyProposalService().preview(this.analysis, decisions, "accepted");
    const output = new JsonSnapshotAdapter();
    const text = JSON.stringify({ schema: "yalikedags/proposal-evidence/1",
      sourceVersion: await new ReviewIdentityAdapter().identify(this.analysis), exportedAt: new Date().toISOString(), graphKind: "recorded plus locally accepted candidates; not tracker state",
      candidates: new DependencyDiscoveryService().discover(this.analysis.dag).map(c => ({ blocker: c.blocker, dependent: c.dependent, evidence: c.evidence, confidence: c.confidence })),
      recorded: output.toObject(this.analysis, this.review.current()), accepted: output.toObject(accepted),
      decisions: decisions.map(d => ({ blocker: d.blocker, dependent: d.dependent, outcome: d.outcome, note: d.note })) }, null, 2);
    new SnapshotBudget().parse(text);
    this.download(text, "yalikedags-proposal-evidence.json");
    element("proposal-notice").textContent = "Evidence bundle exported as plaintext with original source, people, account metadata, local decisions, and accepted graph analysis. It does not certify tracker writes. Downloaded files remain on your device until you delete them.";
  }

  private async exportPlan(): Promise<void> {
    const review = this.review.current();
    if (review === undefined) { throw new Error("Record the evidence review before downloading a plan."); }
    const plan = new DependencyProposalService().plan(this.analysis, review, await new ReviewIdentityAdapter().identify(this.analysis));
    if (plan.isEmpty) { throw new Error("No accepted candidate additions are recorded."); }
    this.download(new PlanJsonCodec().encode(plan), "yalikedags-accepted-relations.json");
    element("proposal-notice").textContent = `${String(plan.mutations.length)} additions exported. Nothing written. Inspect this exact plan before CLI apply; changed evidence will refuse the write. Read the receipt and refresh the source after applying.`;
  }

  private download(text: string, filename: string): void {
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = filename; link.click();
    setTimeout(() => { URL.revokeObjectURL(url); }, 1000);
  }

  private run(action: () => void): void { try { action(); } catch (error) { this.notice(error); } }
  private notice(error: unknown): void { element("proposal-notice").textContent = error instanceof Error ? error.message : "Proposal could not be processed."; }
}
