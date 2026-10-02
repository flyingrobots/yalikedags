import { gsap } from "gsap";
import { DebugOverlayMarkup } from "./DebugOverlayMarkup.ts";
import { DebugDiagnostics } from "./DebugDiagnostics.ts";
import { DebugPanelDrag } from "./DebugPanelDrag.ts";
import { PuppyDebugControls } from "./PuppyDebugControls.ts";
import { motionDuration, motionPreference } from "./MotionPolicy.ts";

/** One opt-in developer surface, composed from tool widgets and a bounded output log. */
export class DebugOverlay {
  constructor() {
    document.body.insertAdjacentHTML("beforeend", new DebugOverlayMarkup().render());
    const panel = document.getElementById("debug-overlay"); const output = document.getElementById("debug-output");
    const grip = panel?.querySelector<HTMLElement>(".debug-grip");
    if (panel === null || !(output instanceof HTMLTextAreaElement) || grip === null || grip === undefined) { return; }
    const log = new DebugDiagnostics(output);
    new DebugPanelDrag(panel, grip); new PuppyDebugControls();
    panel.querySelectorAll<HTMLButtonElement>("[data-debug-tool]").forEach(button => {
      button.addEventListener("click", () => { this.tool(panel, button); log.write(`Tool: ${button.dataset["debugTool"] ?? ""}`); });
    });
    panel.querySelector("#debug-clear")?.addEventListener("click", () => { log.clear(); });
    panel.querySelector("#debug-collapse")?.addEventListener("click", () => { this.collapse(panel); });
    const runtime = (): void => { this.runtime(panel); };
    window.addEventListener("resize", runtime); motionPreference.addEventListener("change", runtime);
    this.runtime(panel); log.write("Developer tools ready");
  }
  private tool(panel: HTMLElement, selected: HTMLButtonElement): void {
    panel.querySelectorAll<HTMLButtonElement>("[data-debug-tool]").forEach(button => { button.setAttribute("aria-pressed", String(button === selected)); });
    panel.querySelectorAll<HTMLElement>("[data-debug-widget]").forEach(widget => { widget.hidden = widget.dataset["debugWidget"] !== selected.dataset["debugTool"]; });
  }
  private collapse(panel: HTMLElement): void {
    const body = panel.querySelector<HTMLElement>("#debug-body"); const button = panel.querySelector("#debug-collapse");
    if (body === null || button === null) { return; }
    body.hidden = !body.hidden;
    const label = body.hidden ? "Expand debug panel" : "Collapse debug panel";
    button.setAttribute("aria-label", label); button.setAttribute("title", label); button.setAttribute("aria-expanded", String(!body.hidden));
    button.textContent = body.hidden ? "+" : "−";
    if (!body.hidden) { gsap.fromTo(body, { opacity: 0 }, { opacity: 1, duration: motionDuration("--debug-move-duration"), clearProps: "opacity" }); }
  }
  private runtime(panel: HTMLElement): void {
    const status = panel.querySelector("#debug-runtime"); if (status === null) { return; }
    status.textContent = `Viewport ${String(innerWidth)} × ${String(innerHeight)} · Pixel ratio ${String(devicePixelRatio)} · Motion ${motionPreference.matches ? "reduced" : "enabled"} · Puppy nodes ${String(document.querySelectorAll(".puppy-dag .node").length)}`;
  }
}
