import { PuppyDebugMarkup } from "./PuppyDebugMarkup.ts";

/** Icons keep the toolbar compact; names and tooltips remain available to keyboard/AT users. */
export class DebugOverlayMarkup {
  private icon(path: string): string {
    return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${path}"/></svg>`;
  }
  render(): string {
    const diagnostics = this.icon("M3 12h4l3-8 4 16 3-8h4");
    const rig = this.icon("M6 4a2 2 0 1 0-2 2l14 14a2 2 0 1 0 2-2L6 4Z");
    const clear = this.icon("M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 10v8M14 10v8");
    return `<section id="debug-overlay" role="region" aria-label="Developer tools">
<header class="debug-toolbar" role="toolbar" aria-label="Debug tools">
<button type="button" class="debug-grip" aria-label="Move debug panel" title="Drag to move · Arrow keys to move · Shift for larger steps">⠿ <span>DEV</span></button>
<button type="button" data-debug-tool="diagnostics" aria-label="Diagnostics tool" title="Diagnostics" aria-pressed="true">${diagnostics}</button>
<button type="button" data-debug-tool="rig" aria-label="Puppy rig tool" title="Puppy rig" aria-pressed="false">${rig}</button>
<button type="button" id="debug-clear" aria-label="Clear diagnostics" title="Clear diagnostics">${clear}</button>
<button type="button" id="debug-collapse" aria-label="Collapse debug panel" title="Collapse debug panel" aria-expanded="true" aria-controls="debug-body">−</button>
</header>
<div id="debug-body"><div id="debug-widgets">
<section data-debug-widget="diagnostics"><h2>Runtime</h2><p id="debug-runtime"></p></section>
<section data-debug-widget="rig" hidden><h2>Puppy rig</h2>${new PuppyDebugMarkup().render()}</section>
</div><label for="debug-output">Diagnostics</label><textarea id="debug-output" aria-label="Diagnostics output" readonly spellcheck="false" rows="6"></textarea></div></section>`;
  }
}
