import type { Analysis } from "../../core/services/Analysis.ts";
import { DependencyReview } from "../../core/domain/DependencyReview.ts";
import { ReviewDecision } from "../../core/domain/ReviewDecision.ts";
import { DependencyReviewService } from "../../core/services/DependencyReviewService.ts";
import { DependencyReviewCodec } from "../../adapters/review/DependencyReviewCodec.ts";
import { ReviewIdentityAdapter } from "../../adapters/review/ReviewIdentityAdapter.ts";
import { SnapshotBudget } from "../../adapters/input/SnapshotBudget.ts";
import { JsonSnapshotAdapter } from "../../adapters/output/JsonSnapshotAdapter.ts";
import { element } from "./Dom.ts";

/** Local review evidence is independent of tracker data; failed persistence is explicitly reported. */
export class DependencyReviewController {
  private review: DependencyReview | undefined;
  private sourceVersion = "";
  private origin = "Imported review claim (self-reported)";
  private readonly codec = new DependencyReviewCodec();
  private readonly key: string;

  constructor(private readonly analysis: Analysis) {
    this.review = analysis.review;
    this.key = `yalikedags:dependency-review:${analysis.account?.workspace.id ?? "local"}:${analysis.account?.project.id ?? analysis.source}`;
  }

  async initialize(): Promise<void> {
    this.sourceVersion = await new ReviewIdentityAdapter().identify(this.analysis);
    try {
      const saved = localStorage.getItem(this.key);
      if (saved !== null) {
        this.review = this.codec.decode(new SnapshotBudget().parse(saved));
        this.origin = "Local review record (self-reported)";
      }
    } catch { this.notice("Saved review could not be read. Captured review evidence, if present, is shown instead."); }
    this.render();
    element("review-dependencies").addEventListener("click", () => {
      element("dependency-review-form").hidden = false;
      this.field("review-basis").value = this.review?.basis ?? "";
      this.field("review-exceptions").value = this.review?.exceptions.join("\n") ?? "";
      this.field("review-basis").focus();
      this.restoreDecisions();
    });
    element("clear-dependency-review").addEventListener("click", () => {
      try {
        localStorage.removeItem(this.key); this.review = this.analysis.review; this.origin = "Imported review claim (self-reported)";
        this.render(); this.notice("Local review cleared. Embedded review claims remain in their source file.");
      } catch { this.notice("Browser storage could not be cleared. The saved review was retained."); }
    });
    element("cancel-review").addEventListener("click", () => { element("dependency-review-form").hidden = true; });
    element("dependency-review-form").addEventListener("submit", event => {
      event.preventDefault();
      try { this.record(); } catch (error) { this.notice(error instanceof Error ? error.message : "Review could not be recorded."); }
    });
  }

  current(): DependencyReview | undefined { return this.review; }

  private record(): void {
    const known = new DependencyReviewService().knownExceptions(this.analysis);
    const exceptions = [...new Set([...this.field("review-exceptions").value.split("\n").map(value => value.trim()).filter(Boolean), ...known])];
    const review = new DependencyReview({ sourceVersion: this.sourceVersion, taskIds: this.analysis.dag.tasks.map(task => task.id),
      basis: this.field("review-basis").value.trim(), exceptions, reviewedAt: new Date().toISOString(), reviewer: this.field("reviewer-name").value.trim(), decisions: this.draftDecisions() });
    const text = JSON.stringify(this.codec.encode(review));
    new SnapshotBudget().parse(text);
    this.review = review; this.origin = "Local review record (self-reported)";
    this.persist(text);
    element("dependency-review-form").hidden = true;
    this.render();
  }

  private persist(text: string): void {
    let persistence = "Review saved on this browser.";
    try { localStorage.setItem(this.key, text); }
    catch { persistence = "Review is available only in this page: browser storage failed."; }
    try {
      new JsonSnapshotAdapter().render(this.analysis, this.review);
      this.notice(`${persistence} Export a full snapshot before leaving to preserve it.`);
    } catch (error) {
      this.notice(`${persistence} Full snapshot export is unavailable: ${error instanceof Error ? error.message : "snapshot could not be exported"}. Keep this page open and copy your review evidence before leaving.`);
    }
  }

  private render(): void {
    const status = new DependencyReviewService().state(this.review, this.sourceVersion, this.analysis);
    const heading = document.createElement("strong");
    heading.textContent = { unreviewed: "Dependency review is incomplete.", reviewed: "Reviewed for this source version", exceptions: "Reviewed with exceptions", stale: "Dependency review is stale" }[status];
    const target = element("dependency-review-status");
    target.replaceChildren(heading);
    this.paragraph("A review records evidence checked for this scope; it does not prove that every real-world dependency was discovered.");
    if (this.review === undefined) { return; }
    const service = new DependencyReviewService();
    const exceptions = [...new Set([...this.review.exceptions, ...service.knownExceptions(this.analysis), ...service.outsideDecisions(this.review, this.analysis), ...service.candidateExceptions(this.review, this.analysis)])];
    const decisions = [...this.review.decisions, ...service.missingDecisions(this.review, this.analysis)];
    const undecided = decisions.filter(decision => decision.outcome !== "accepted").length;
    this.paragraph(`${String(this.review.taskIds.length)} captured tasks · ${String(exceptions.length)} exceptions · ${String(undecided)} rejected or unreviewed relationships.`);
    if (status === "stale") { this.paragraph("Task scope or prerequisite evidence changed. Previous decisions are historical; review this capture again before relying on them."); }
    const details = document.createElement("details");
    const summary = document.createElement("summary"); summary.textContent = "Review evidence, scope and exceptions";
    const scope = document.createElement("p"); scope.textContent = this.review.taskIds.join(", ") || "Empty captured scope";
    const version = document.createElement("p"); version.textContent = `SHA-256: ${this.review.sourceVersion}`;
    details.append(summary, scope, version);
    this.paragraph(`${this.origin}. ${this.review.reviewer} · ${this.review.reviewedAt}.`, details);
    this.paragraph(`Basis: ${this.review.basis}`, details);
    for (const exception of exceptions) { this.paragraph(`Unresolved exception: ${exception}`, details); }
    if (status === "exceptions") { this.paragraph("Resolve listed exceptions and review every recorded relationship and discovered candidate before claiming complete coverage.", details); }
    for (const decision of decisions) {
      const row = document.createElement("p"); row.textContent = `${decision.blocker} → ${decision.dependent}: ${decision.outcome}${status === "stale" ? " (historical)" : ""}. ${decision.note}`; details.append(row);
    }
    target.append(details);
  }

  draftDecisions(): ReviewDecision[] {
    if (element("dependency-review-form").hidden) {
      const current = new DependencyReviewService().state(this.review, this.sourceVersion, this.analysis) !== "stale";
      return current ? [...this.review?.decisions ?? []] : [];
    }
    return [...document.querySelectorAll<HTMLSelectElement>("[data-review-edge]")].map(control => {
      const outcome = control.value;
      if (outcome !== "accepted" && outcome !== "rejected" && outcome !== "unreviewed") { throw new Error("Invalid relationship decision"); }
      const note = control.closest("li")?.querySelector<HTMLInputElement>("[data-review-note]")?.value ?? "";
      this.requireCandidateNote(control, note);
      return new ReviewDecision({ blocker: control.dataset["blocker"] ?? "", dependent: control.dataset["dependent"] ?? "", outcome, note });
    });
  }

  private requireCandidateNote(control: HTMLSelectElement, note: string): void {
    if (control.hasAttribute("data-candidate") && control.value !== "unreviewed" && !note.trim()) { throw new Error("Candidate decisions require an evidence and direction rationale."); }
  }

  private restoreDecisions(): void {
    const current = new DependencyReviewService().state(this.review, this.sourceVersion, this.analysis) !== "stale";
    const decisions = new Map((current ? this.review?.decisions ?? [] : []).map(decision => [ReviewDecision.key(decision.blocker, decision.dependent), decision]));
    document.querySelectorAll<HTMLSelectElement>("[data-review-edge]").forEach(control => {
      const decision = decisions.get(ReviewDecision.key(control.dataset["blocker"] ?? "", control.dataset["dependent"] ?? ""));
      control.value = decision?.outcome ?? "unreviewed";
      const note = control.closest("li")?.querySelector<HTMLInputElement>("[data-review-note]");
      if (note instanceof HTMLInputElement) { note.value = decision?.note ?? ""; }
    });
  }

  private paragraph(text: string, parent: HTMLElement = element("dependency-review-status")): void {
    const paragraph = document.createElement("p"); paragraph.textContent = text;
    parent.append(paragraph);
  }
  private field(id: string): HTMLInputElement | HTMLTextAreaElement {
    const control = element(id);
    if (!(control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement)) { throw new Error("Missing review field"); }
    return control;
  }
  private notice(message: string): void { element("dependency-review-notice").textContent = message; }
}
