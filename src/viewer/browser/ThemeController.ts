import { themeById } from "../ThemeCatalog.ts";
import { element } from "./Dom.ts";

type Mode = "light" | "dark" | "system";

/** Preferences stay client-side; System follows OS changes without reloading data. */
export class ThemeController {
  private mode: Mode = "system";
  private palette = "graphite";
  private readonly media = matchMedia("(prefers-color-scheme: dark)");

  constructor() {
    try {
      const raw: unknown = JSON.parse(localStorage.getItem("yalikedags.appearance.v1") ?? "null");
      if (typeof raw === "object" && raw !== null) {
        if ("mode" in raw) { this.mode = this.validMode(raw.mode); }
        if ("palette" in raw) { this.palette = themeById(raw.palette).id; }
      }
    } catch { /* Storage may be disabled for offline exports. */ }
    this.apply();
    this.media.addEventListener("change", () => { this.apply(); });
  }

  bind(): void {
    const palette = element("theme-palette"); const mode = element("theme-mode");
    if (!(palette instanceof HTMLSelectElement) || !(mode instanceof HTMLSelectElement)) { return; }
    palette.value = this.palette; mode.value = this.mode;
    palette.addEventListener("change", () => { this.palette = themeById(palette.value).id; this.save(); });
    mode.addEventListener("change", () => { this.mode = this.validMode(mode.value); this.save(); });
    this.apply();
  }

  private validMode(value: unknown): Mode { return value === "light" || value === "dark" ? value : "system"; }

  private save(): void {
    try { localStorage.setItem("yalikedags.appearance.v1", JSON.stringify({ mode: this.mode, palette: this.palette })); }
    catch { /* In-memory theme selection still works. */ }
    this.apply();
  }

  private apply(): void {
    const resolved = this.mode === "system" ? (this.media.matches ? "dark" : "light") : this.mode;
    document.documentElement.dataset["theme"] = resolved;
    document.documentElement.dataset["palette"] = this.palette;
    document.documentElement.dataset["mode"] = this.mode;
    const label = document.getElementById("appearance-label");
    if (label !== null) { label.textContent = this.mode === "system" ? `System (${resolved})` : this.mode; }
    const status = document.getElementById("appearance-status");
    if (status !== null) { status.textContent = `${themeById(this.palette).name} · ${resolved} mode${this.mode === "system" ? " · follows your system" : ""}`; }
  }
}
