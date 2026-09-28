import type { Plan } from "../../core/domain/Plan.ts";
import type { ApplyReceipt } from "../../core/services/ApplyService.ts";

const plural = (n: number, word: string): string => `${String(n)} ${word}${n === 1 ? "" : "s"}`;

/**
 * A plan and a receipt as text a person can read before deciding.
 *
 * Destructive mutations are listed in their own block rather than mixed in,
 * because the question a reviewer is actually answering is "does anything
 * here delete something", and an answer buried in a list of forty additions
 * is not an answer.
 */
export class PlanTextAdapter {
  renderPlan(plan: Plan): string {
    const label = plan.label();
    const counts = [...plan.counts()].map(([k, n]) => `${String(n)} ${k}`).join(", ");
    const safe = plan.mutations.filter((m) => !m.destructive);
    const lines = [
      `plan from ${plan.desiredSource}`,
      `       to ${plan.currentSource}`,
      `  made on ${plan.createdAt}`,
      "",
      plan.isEmpty ? "no changes: the source already matches the desired graph" : `${plural(plan.mutations.length, "change")} (${counts})`,
    ];
    if (safe.length > 0) {
      lines.push("", "changes:", ...safe.map((m) => `  ${m.describe(label)}`));
    }
    if (plan.destructive.length > 0) {
      lines.push("", `DESTRUCTIVE (${plural(plan.destructive.length, "change")}; apply refuses these unless --allow-destructive):`);
      lines.push(...plan.destructive.map((m) => `  ${m.describe(label)}`));
    }
    if (plan.unmatched.length > 0) {
      lines.push("", `unmatched (${plural(plan.unmatched.length, "task")} in the desired graph with no counterpart; nothing is written for these):`);
      lines.push(...plan.unmatched.map((u) => `  ${u.desiredKey}: ${u.reason}`));
    }
    return `${lines.join("\n")}\n`;
  }

  renderReceipt(receipt: ApplyReceipt, plan: Plan): string {
    const label = plan.label();
    const lines = [`applied to ${receipt.target} at ${receipt.at}`];
    if (!receipt.verified) {
      lines.push("THE SOURCE COULD NOT BE READ BACK: nothing below is confirmed, whatever it says");
    }
    lines.push(
      `confirmed ${String(receipt.count("confirmed"))}, unconfirmed ${String(receipt.count("unconfirmed"))}, failed ${String(receipt.count("failed"))}, skipped ${String(receipt.count("skipped"))}, stale ${String(receipt.count("stale"))}`,
      "",
    );
    for (const r of receipt.results) {
      const suffix = r.detail.length > 0 ? `  (${r.detail})` : "";
      lines.push(`  ${r.outcome.padEnd(11)} ${r.mutation.describe(label)}${suffix}`);
    }
    lines.push(...this.advice(receipt));
    return `${lines.join("\n")}\n`;
  }

  /**
   * What to do next, which is not the same advice in both cases. Telling
   * somebody a stale plan is safe to re-run is true and useless: it will
   * report the same thing forever, because the tracker has moved past what
   * the plan describes.
   */
  private advice(receipt: ApplyReceipt): string[] {
    if (receipt.complete) {
      return [];
    }
    if (receipt.verified && !receipt.graphSafe) {
      return ["", "The fresh graph contains new cyclic edges. Audit the source and re-plan before applying more changes."];
    }
    if (receipt.count("skipped") > 0) {
      return ["", "Reviewed destructive changes were skipped. Review the receipt and re-plan, or use --allow-destructive if those changes are still intended."];
    }
    if (receipt.count("stale") > 0) {
      return ["", "This plan no longer describes the source: something changed after it was made. Plan again; re-running this one will report the same."];
    }
    return ["", "This plan is not fully landed. Running it again is safe: every mutation reads before it writes."];
  }
}
