/** Outbound HTTP, narrowed to what the Linear adapter needs. Tests inject a recording fake. */
export interface HttpResponse {
  status: number;
  body: string;
}

export interface HttpPort {
  post(url: string, headers: Readonly<Record<string, string>>, body: string): Promise<HttpResponse>;
}
