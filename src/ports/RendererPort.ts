import type { Analysis } from "../core/services/Analysis.ts";

/** Output port: turn an analysis into text of some kind (DOT, SVG, JSON, a terminal report). */
export interface RendererPort {
  /** Media type of what `render` returns, for the viewer server and for `--format` help. */
  readonly contentType: string;
  render(analysis: Analysis): string;
}
