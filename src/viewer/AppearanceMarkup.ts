import { THEMES } from "./ThemeCatalog.ts";
/** Native popover supplies Escape dismissal and keyboard focus return. */
export class AppearanceMarkup {
  render(): string {
    return `<button id="appearance-toggle" popovertarget="appearance-menu" aria-label="Theme and display mode">Theme · <span id="appearance-label">System</span></button>
<div id="appearance-menu" popover><h2>Appearance</h2>
<label for="theme-palette">Theme</label><select id="theme-palette">${THEMES.map((theme) => `<option value="${theme.id}">${theme.name}</option>`).join("")}</select>
<label for="theme-mode">Display mode</label><select id="theme-mode"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select>
<label for="text-size">Base text size</label><select id="text-size"><option value="14">14 px</option><option value="16">16 px</option><option value="18">18 px</option><option value="20">20 px</option></select>
<p id="appearance-status" role="status"></p></div>`;
  }
}
