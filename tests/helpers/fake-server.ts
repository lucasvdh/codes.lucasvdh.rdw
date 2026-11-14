import http from "node:http";
import type { AddressInfo } from "node:net";

export interface FakeResponse {
  status: number;
  body?: string;
  headers?: Record<string, string>;
}

export type Handler = (req: http.IncomingMessage) => FakeResponse | "hang" | "stall";

export interface FakeServer {
  url: string;
  requests: string[];
  close(): Promise<void>;
}

/** A local HTTP server on a free port. "hang" never answers; "stall" stops halfway through the body. */
export async function fakeServer(handler: Handler): Promise<FakeServer> {
  const requests: string[] = [];
  const server = http.createServer((req, res) => {
    requests.push(req.url ?? "");
    const result = handler(req);
    if (result === "hang") return;
    if (result === "stall") {
      res.writeHead(200, { "content-type": "application/json" });
      res.write("[{");
      return;
    }
    res.writeHead(result.status, { "content-type": "application/json", ...result.headers });
    res.end(result.body ?? "");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

export function json(body: unknown, status = 200): FakeResponse {
  return { status, body: JSON.stringify(body) };
}
