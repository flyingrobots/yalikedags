import { ViewerDataCodec } from "../ViewerDataCodec.ts";
import { ViewerMarkup } from "../ViewerMarkup.ts";
import type { Analysis } from "../../core/services/Analysis.ts";
import { element } from "./Dom.ts";

/** Load only same-origin data; exports use the embedded payload and never fetch. */
export class ViewerBootstrap {
  async render(): Promise<Analysis> {
    const embedded = document.getElementById("viewer-data");
    const text = embedded === null ? await this.fetchData() : embedded.textContent;
    const { analysis, options } = await new ViewerDataCodec().decode(text);
    // A copied offline file cannot gain server capabilities from its payload.
    if (embedded !== null) { options.refresh = false; }
    element("app").innerHTML = new ViewerMarkup().render(analysis, options);
    document.title = `${analysis.source} · yalikedags`;
    document.body.dataset["source"] = analysis.source;
    return analysis;
  }

  private async fetchData(): Promise<string> {
    const response = await fetch("/viewer.json", { cache: "no-store", signal: AbortSignal.timeout(30000) });
    if (!response.ok) { throw new Error("Could not load workspace data. Check the local server and reload."); }
    return response.text();
  }
}
