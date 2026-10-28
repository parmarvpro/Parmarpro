import http from "node:http";
import type { AddressInfo } from "node:net";

import { loadTestEnv } from "./test-env";

/**
 * supabase-js talks to `${url}/rest/v1`. The local stack runs PostgREST
 * without the Supabase API gateway, so this proxy strips the prefix.
 */
export async function startRestProxy(): Promise<{ url: string; close: () => Promise<void> }> {
  const target = new URL(loadTestEnv().postgrestUrl);
  const server = http.createServer((req, res) => {
    const path = (req.url ?? "/").replace(/^\/rest\/v1/, "") || "/";
    const headers = { ...req.headers, host: target.host };
    const upstream = http.request(
      { hostname: target.hostname, port: target.port, path, method: req.method, headers },
      (upstreamRes) => {
        res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
        upstreamRes.pipe(res);
      },
    );
    upstream.on("error", () => {
      res.writeHead(502);
      res.end();
    });
    req.pipe(upstream);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
