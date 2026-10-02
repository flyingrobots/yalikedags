import { createHash } from "node:crypto";
import { viewerScript } from "./generated/assets.ts";

/** Scripts are hash-authorized; style-only inline allowance supports theme tokens and SVG geometry. */
export class ViewerSecurityPolicy {
  script(): string { return viewerScript.replace(/<\/script/gi, "<\\/script"); }

  policy(offline: boolean): string {
    const digest = createHash("sha256").update(this.script()).digest("base64");
    return `default-src 'none'; script-src 'sha256-${digest}'; style-src 'unsafe-inline'; connect-src ${offline ? "'none'" : "'self'"}; img-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; worker-src blob:`;
  }

  protect(response: Response): Response {
    response.headers.set("Content-Security-Policy", `${this.policy(false)}; frame-ancestors 'none'`);
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  }
}
