import { SvgTaskTitle } from "./SvgTaskTitle.ts";
import type { Analysis } from "../../core/services/Analysis.ts";
import type { RendererPort } from "../../ports/RendererPort.ts";
import { LayeredLayoutService } from "../../core/services/LayeredLayoutService.ts";
import type { Layout } from "../../core/services/LayeredLayoutService.ts";

export const escapeXml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const NODE_W = 320;
const NODE_H = 100;
const GAP_X = 80;
const GAP_Y = 24;
const PAD = 24;

const STYLE = `
.node rect{stroke:#333;stroke-width:1.5;rx:8}
.node text{font:12px Helvetica,Arial,sans-serif;fill:#111}
.node.done rect{fill:#d4edda}.node.in-progress rect{fill:#fff3cd}.node.blocked rect{fill:#f8d7da}.node.ready rect{fill:#d1ecf1}
.node.unresolved rect{fill:#fff0c9}
.node.critical rect{stroke-width:3}.node.gatekeeper rect{stroke-dasharray:6 3}
.edge{fill:none;stroke:#555;stroke-width:1.5;marker-end:url(#arrow)}.edge.critical{stroke:#b00;stroke-width:2.5}
`;

function coords(layout: Layout, id: string): { x: number; y: number } {
  const p = layout.position(id);
  const layer = p?.layer ?? 0;
  const row = p?.row ?? 0;
  return { x: PAD + layer * (NODE_W + GAP_X), y: PAD + row * (NODE_H + GAP_Y) };
}

/**
 * Standalone SVG from the layered layout. No scripts, no fonts fetched,
 * no external references: it is a file you can open anywhere. The viewer
 * embeds the same markup and adds interaction on top.
 */
export class SvgRendererAdapter implements RendererPort {
  readonly contentType = "image/svg+xml";
  private readonly layouter = new LayeredLayoutService();

  render(a: Analysis): string {
    const layout = this.layouter.layout(a.dag);
    const width = PAD * 2 + layout.layerCount * NODE_W + Math.max(0, layout.layerCount - 1) * GAP_X;
    const height = PAD * 2 + layout.maxRows * NODE_H + Math.max(0, layout.maxRows - 1) * GAP_Y;
    const parts = [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${String(width)}" height="${String(height)}" viewBox="0 0 ${String(width)} ${String(height)}">`,
      `<style>${STYLE}</style>`,
      '<defs><marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#555"/></marker></defs>',
      this.isolatedLabel(a, layout),
      ...this.edges(a, layout),
      ...this.nodes(a, layout),
      "</svg>",
    ];
    return `${parts.join("\n")}\n`;
  }

  private isolatedLabel(a: Analysis, layout: Layout): string {
    const isolated = a.dag.tasks.filter(task => a.dag.blockers(task.id).length + a.dag.dependents(task.id).length === 0);
    if (isolated.length === 0) { return ""; }
    const y = Math.min(...isolated.map(task => coords(layout, task.id).y)) - 20;
    return `<text class="graph-region-label" x="24" y="${String(y)}">No connections in this view · ${String(isolated.length)} cards · dependency review needed</text>`;
  }

  private edges(a: Analysis, layout: Layout): string[] {
    const out: string[] = [];
    for (const t of a.dag.tasks) {
      for (const b of a.dag.blockers(t.id)) {
        const from = coords(layout, b);
        const to = coords(layout, t.id);
        const x1 = from.x + NODE_W;
        const y1 = from.y + NODE_H / 2;
        const x2 = to.x;
        const y2 = to.y + NODE_H / 2;
        const mid = x1 + Math.min((x2 - x1) / 2, 30 + (Math.abs(to.y - from.y) / (NODE_H + GAP_Y)) * 8);
        const critical = a.isCritical(b) && a.isCritical(t.id) ? " critical" : "";
        out.push(`<path class="edge${critical}" data-from="${escapeXml(b)}" data-to="${escapeXml(t.id)}" d="M${String(x1)},${String(y1)} C${String(mid)},${String(y1)} ${String(mid)},${String(y2)} ${String(x2)},${String(y2)}"/>`);
      }
    }
    return out;
  }

  private nodes(a: Analysis, layout: Layout): string[] {
    return a.dag.tasks.map((t) => {
      const { x, y } = coords(layout, t.id);
      const classes = ["node", a.stateOf(t.id), a.isCritical(t.id) ? "critical" : "", a.gatekeepers.includes(t.id) ? "gatekeeper" : ""].filter((c) => c.length > 0).join(" ");
      const lines = new SvgTaskTitle().lines(t.title);
      return [
        `<g class="${classes}" data-id="${escapeXml(t.id)}" data-isolated="${String(a.dag.blockers(t.id).length + a.dag.dependents(t.id).length === 0)}" transform="translate(${String(x)},${String(y)})">`,
        `<title>${escapeXml(t.key)} · ${escapeXml(t.title)} · ${escapeXml(a.stateOf(t.id))} · ${escapeXml(t.assignee ?? "Unassigned")}</title>`,
        `<rect width="${String(NODE_W)}" height="${String(NODE_H)}"/>`,
        `<text x="8" y="18" font-weight="bold">${escapeXml(t.key.length > 36 ? `${t.key.slice(0, 35)}…` : t.key)}</text>`,
        ...lines.map((line, i) => `<text x="10" y="${String(38 + i * 17)}">${escapeXml(line)}</text>`),
        `<text x="10" y="83" font-size="10">${escapeXml(a.stateOf(t.id))} · ${escapeXml((t.assignee ?? "Unassigned").slice(0, 28))}</text>`,
        "</g>",
      ].join("");
    });
  }
}
