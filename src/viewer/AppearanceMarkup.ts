import { THEMES } from "./ThemeCatalog.ts";
/** Native popover supplies Escape dismissal and keyboard focus return. */
export class AppearanceMarkup {
  render(): string {
    return `<button id="appearance-toggle" popovertarget="appearance-menu" aria-label="Theme and display mode">Theme · <span id="appearance-label">System</span></button>
<div id="appearance-menu" popover><h2>Appearance</h2>
<label for="theme-palette">Theme</label><select id="theme-palette">${THEMES.map((theme) => `<option value="${theme.id}">${theme.name}</option>`).join("")}</select>
<label for="theme-mode">Display mode</label><select id="theme-mode"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select>
<div class="text-scale-heading"><label for="text-size">Text size</label><output id="text-size-value" for="text-size">100%</output></div><input id="text-size" type="range" min="0.875" max="1.5" step="0.025" value="1" aria-describedby="text-size-help"><p id="text-size-help" class="muted">Relative to your browser’s default text size.</p><button id="text-size-reset" type="button">Reset text size</button>
<p id="appearance-status" role="status"></p></div>`;
  }
}
