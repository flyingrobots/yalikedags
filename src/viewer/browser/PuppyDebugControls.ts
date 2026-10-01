import { motionPreference } from "./MotionPolicy.ts";
/** Local debug preference is independent of account data and ordinary theme settings. */
export class PuppyDebugControls {
  constructor() {
    const select = document.getElementById("puppy-debug");
    if (!(select instanceof HTMLSelectElement)) { return; }
    try { select.value = localStorage.getItem("yalikedags.puppy-debug.v1") ?? "off"; } catch { /* Optional storage. */ }
    this.apply(select.value);
    motionPreference.addEventListener("change", () => { this.resetPose(); });
    document.addEventListener("visibilitychange", () => { if (document.hidden) { this.resetPose(); } });
    document.querySelectorAll(".puppy-dag").forEach(svg => { svg.addEventListener("click", () => { this.resetPose(); }); });
    select.addEventListener("change", () => {
      this.apply(select.value);
      try { localStorage.setItem("yalikedags.puppy-debug.v1", select.value); } catch { /* Optional storage. */ }
    });
    document.getElementById("puppy-pose")?.addEventListener("change", event => {
      if (event.target instanceof HTMLSelectElement) { this.action(event.target.value); }
    });
    document.querySelectorAll<HTMLButtonElement>("[data-puppy-action]").forEach(button => {
      button.addEventListener("click", () => { this.action(button.dataset["puppyAction"] ?? ""); });
    });
  }
  private resetPose(): void {
    const pose = document.getElementById("puppy-pose");
    if (pose instanceof HTMLSelectElement) { pose.value = "stand"; }
  }
  private apply(value: string): void {
    const mode = value === "regions" || value === "bones" ? value : "off";
    document.documentElement.dataset["puppyDebug"] = mode;
    const select = document.getElementById("puppy-debug");
    if (select instanceof HTMLSelectElement) { select.value = mode; }
    const controls = document.querySelector<HTMLElement>(".puppy-rig-legend");
    if (controls !== null) { controls.hidden = mode === "off"; }
  }
  private action(action: string): void {
    document.documentElement.dataset["puppyAction"] = action;
    document.dispatchEvent(new Event("yalikedags:puppy-action"));
  }
}
