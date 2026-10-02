import { Marked } from "marked";
import DOMPurify from "dompurify";
import { escapeXml } from "../../adapters/output/SvgRendererAdapter.ts";

/** GFM rendered locally. Raw HTML is sanitized; images become explicit links, never auto-fetches. */
export class MarkdownDescription {
  render(source: string, target: HTMLElement): void {
    const parser = new Marked({ renderer: {
      image: ({ href, text }): string => `<a href="${escapeXml(href)}">${escapeXml(text || "Image")}</a>`,
    } });
    const html = parser.parse(source, { async: false, gfm: true });
    const fragment = DOMPurify.sanitize(html, { RETURN_DOM_FRAGMENT: true,
      ALLOWED_TAGS: ["p", "br", "hr", "h1", "h2", "h3", "h4", "h5", "h6", "strong", "em", "del", "blockquote", "ul", "ol", "li", "pre", "code", "a", "table", "thead", "tbody", "tr", "th", "td", "input"],
      ALLOWED_ATTR: ["href", "title", "type", "checked", "disabled", "start", "align"],
      ALLOW_DATA_ATTR: false,
    });
    for (const link of fragment.querySelectorAll("a")) { link.target = "_blank"; link.rel = "noopener noreferrer"; }
    for (const input of fragment.querySelectorAll("input")) { input.type = "checkbox"; input.disabled = true; }
    target.replaceChildren(fragment);
  }
}
