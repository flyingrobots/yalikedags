import type { Analysis } from "../../core/services/Analysis.ts";
import type { RendererPort } from "../../ports/RendererPort.ts";
import { ViewerData } from "../../viewer/ViewerData.ts";
import { viewerPage } from "../../viewer/ViewerPage.ts";

/** One offline file: the same client renderer and data contract as the local server. */
export class HtmlRendererAdapter implements RendererPort {
  readonly contentType = "text/html; charset=utf-8";
  render(a: Analysis): string { return viewerPage(new ViewerData().render(a)); }
}
