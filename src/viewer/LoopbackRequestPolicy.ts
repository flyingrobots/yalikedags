/** Bind authority checks to the actual listening port, not a client-supplied URL. */
export class LoopbackRequestPolicy {
  constructor(private readonly port: number) {}

  refusal(req: Request): Response | undefined {
    const allowed = new Set([`127.0.0.1:${String(this.port)}`, `localhost:${String(this.port)}`]);
    const url = new URL(req.url);
    if (url.protocol !== "http:" || !allowed.has(url.host) || !allowed.has((req.headers.get("host") ?? "").toLowerCase())) {
      return new Response("Local authority required", { status: 403 });
    }
    const methods = url.pathname === "/refresh" ? ["POST"] : ["GET", "HEAD"];
    if (!methods.includes(req.method)) {
      return new Response("Method not allowed", { status: 405, headers: { Allow: methods.join(", ") } });
    }
    return undefined;
  }
}
