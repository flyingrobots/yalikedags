import { element } from "./Dom.ts";

/** Scale shared rem typography tokens; invalid or unavailable storage uses 16px. */
export class TextSizeController {
  private size = 16;
  constructor() {
    try { this.size = this.valid(Number(localStorage.getItem("yalikedags.text-size"))); } catch { /* Optional storage. */ }
    this.apply();
  }
  bind(): void {
    const select = element("text-size");
    if (!(select instanceof HTMLSelectElement)) { return; }
    select.value = String(this.size);
    select.addEventListener("change", () => {
      this.size = this.valid(Number(select.value)); this.apply();
      try { localStorage.setItem("yalikedags.text-size", String(this.size)); } catch { /* Optional storage. */ }
    });
  }
  private valid(size: number): number { return [14, 16, 18, 20].includes(size) ? size : 16; }
  private apply(): void { document.documentElement.style.setProperty("--base-font-size", `${String(this.size)}px`); }
}
