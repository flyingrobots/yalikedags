import { rec } from "../../adapters/linear/GraphqlJson.ts";
import { element } from "./Dom.ts";

/** Keep the Views control reachable in the footer when the page banner is hidden. */
export class BannerController {
  private readonly key = "yalikedags.banner-hidden";
  private readonly banner = element("page-banner");
  private readonly control = element("toggle-banner");

  constructor() {
    this.render(this.saved());
    this.control.addEventListener("click", () => {
      this.render(!this.banner.hidden);
      try { localStorage.setItem(this.key, String(this.banner.hidden)); } catch { /* storage is optional */ }
    });
  }

  private saved(): boolean {
    try {
      const value = localStorage.getItem(this.key);
      if (value !== null) { return value === "true"; }
    } catch { /* refresh session remains available when local storage is denied */ }
    return rec(history.state)["bannerHidden"] === true;
  }

  private render(hidden: boolean): void {
    const host = hidden ? element("compact-controls") : this.banner;
    host.append(element("workspace-controls"));
    this.banner.hidden = hidden;
    this.control.textContent = hidden ? "Show banner" : "Hide banner";
  }
}
