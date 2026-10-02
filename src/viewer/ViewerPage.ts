import { viewerScript, viewerStyles } from "./generated/assets.ts";

/** The browser owns all project markup. Offline files embed the same JSON served by /viewer.json. */
export function viewerPage(data?: string): string {
  const embedded = data === undefined ? "" : `<script id="viewer-data" type="application/json">${data.replace(/</g, "\\u003c")}</script>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>yalikedags</title>
<style>${viewerStyles.replace(/<\/style/gi, "<\\/style")}</style></head><body><div id="app"><p class="loading" role="status">Loading workspace…</p></div>
<noscript>This viewer needs JavaScript. Export JSON for a machine-readable snapshot.</noscript>${embedded}
<script>${viewerScript.replace(/<\/script/gi, "<\\/script")}</script></body></html>`;
}
