import { ViewerData } from "./ViewerData.ts";
import type { Analysis } from "../core/services/Analysis.ts";
import { JsonSnapshotAdapter } from "../adapters/output/JsonSnapshotAdapter.ts";
import { SvgRendererAdapter } from "../adapters/output/SvgRendererAdapter.ts";
import { DotRendererAdapter } from "../adapters/output/DotRendererAdapter.ts";
import { viewerPage } from "./ViewerPage.ts";

import type { ViewerOptions } from "./ViewerMetadata.ts";

export interface ViewerResponse {
  status: number;
  contentType: string;
  body: string;
}

/**
 * Pure: (path, current analysis) to a response. The server adapter around
 * it is a few lines, so this is where the viewer's behaviour is tested.
 */
export class ViewerRequestHandler {
  private readonly json = new JsonSnapshotAdapter();
  private readonly svg = new SvgRendererAdapter();
  private readonly dot = new DotRendererAdapter();

  constructor(private readonly current: () => Analysis, private readonly options: () => ViewerOptions = () => ({})) {}

  handle(path: string): ViewerResponse {
    const a = this.current();
    switch (path) {
      case "/":
      case "/index.html":
        return { status: 200, contentType: "text/html; charset=utf-8", body: viewerPage() };
      case "/popout.html":
        return { status: 200, contentType: "text/html; charset=utf-8", body: '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>yalikedags · View</title></head><body></body></html>' };
      case "/viewer.json":
        return { status: 200, contentType: "application/json", body: new ViewerData().render(a, this.options()) };
      case "/snapshot.json":
        return { status: 200, contentType: this.json.contentType, body: this.json.render(a) };
      case "/graph.svg":
        return { status: 200, contentType: this.svg.contentType, body: this.svg.render(a) };
      case "/graph.dot":
        return { status: 200, contentType: this.dot.contentType, body: this.dot.render(a) };
      default:
        return { status: 404, contentType: "text/plain", body: "not found\n" };
    }
  }
}
