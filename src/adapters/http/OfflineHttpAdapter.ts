import type { HttpPort, HttpResponse } from "../../ports/HttpPort.ts";

/** Fail closed at the outbound boundary even if a future source bypasses resolution checks. */
export class OfflineHttpAdapter implements HttpPort {
  post(_url: string, _headers: Readonly<Record<string, string>>, _body: string): Promise<HttpResponse> {
    return Promise.reject(new Error("offline: outbound HTTP is disabled"));
  }
}
