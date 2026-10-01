import { element } from "./Dom.ts";

/** Scale relative to browser text preferences; migrate the previous pixel-size setting. */
export class TextSizeController {
  private scale = 1;
  constructor() {
    try {
      const saved = localStorage.getItem("yalikedags.text-scale.v1");
      const legacy = Number(localStorage.getItem("yalikedags.text-size"));
      this.scale = saved === null ? ([14, 16, 18, 20].includes(legacy) ? legacy / 16 : 1) : this.valid(Number(saved));
    } catch { /* Optional storage. */ }
    this.apply();
  }
  bind(): void {
    const slider = element("text-size");
    if (!(slider instanceof HTMLInputElement)) { return; }
    const update = (): void => {
      slider.value = String(this.scale);
      slider.setAttribute("aria-valuetext", `${this.percent()} of browser text size`);
      element("text-size-value").textContent = this.percent();
    };
    slider.addEventListener("input", () => {
      this.scale = this.valid(Number(slider.value)); this.apply(); this.save(); update();
    });
    element("text-size-reset").addEventListener("click", () => {
      this.scale = 1; this.apply(); this.save(); update();
    });
    update();
  }
  private valid(scale: number): number {
    return Number.isFinite(scale) && scale >= 0.875 && scale <= 1.5 ? Math.round(scale * 40) / 40 : 1;
  }
  private percent(): string { return `${String(Number((this.scale * 100).toFixed(1)))}%`; }
  private apply(): void { document.documentElement.style.setProperty("--base-font-size", this.percent()); }
  private save(): void {
    try { localStorage.setItem("yalikedags.text-scale.v1", String(this.scale)); } catch { /* Optional storage. */ }
  }
}
