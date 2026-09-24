import type { Analysis } from "../../core/services/Analysis.ts";
import type { RendererPort } from "../../ports/RendererPort.ts";
import { JsonSnapshotAdapter } from "./JsonSnapshotAdapter.ts";
import { SvgRendererAdapter } from "./SvgRendererAdapter.ts";
import { viewerPage } from "../../viewer/ViewerPage.ts";

/**
 * The viewer as one file you can keep.
 *
 * `serve` and this render the same page from the same function; the only
 * difference is that this one ends up somewhere. That matters because the
 * server is a process: it holds one reading of one project for as long as it
 * is up, and when it stops, so does the page. A file is a snapshot you can
 * mail to somebody, open on a laptop with no key on it, or keep beside last
 * week's to see what moved.
 *
 * Self-contained, and that is a requirement rather than a convenience: the
 * CSS, the SVG, the snapshot JSON and the script are all inline, so the page
 * fetches nothing when opened. Its only outbound links are the per-card
 * "Open in Linear" ones, which are in the source data and go nowhere until
 * somebody clicks them. No key reaches the page, here or in the server.
 */
export class HtmlRendererAdapter implements RendererPort {
  readonly contentType = "text/html; charset=utf-8";

  private readonly json = new JsonSnapshotAdapter();
  private readonly svg = new SvgRendererAdapter();

  render(a: Analysis): string {
    return viewerPage(a, this.svg.render(a), this.json.render(a));
  }
}
