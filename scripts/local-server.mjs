import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { resolve, extname, dirname, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Readable } from "node:stream";
import { networkInterfaces } from "node:os";
import { LocalStore } from "../core/local-store.mjs";
import { handlePartyRequest } from "../core/room-engine.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".json": "application/json",
  ".md": "text/plain; charset=utf-8",
  ".pdf": "application/pdf",
};

export function createLocalServer({
  store = new LocalStore(resolve(process.env.DATA_DIR || resolve(root, ".afterhours"), "rooms.sqlite")),
  publicRoot = resolve(root, "local-dist"),
  pollMs = 1000,
} = {}) {
  const server = createServer(async (req, res) => {
    try {
      const forwarded = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
      const protocol = process.env.TRUST_PROXY === "1" && forwarded === "https" ? "https" : "http";
      const url = new URL(
        req.url || "/",
        `${protocol}://${req.headers.host || "localhost"}`,
      );
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Referrer-Policy", "same-origin");
      if (url.pathname === "/api/identity" && req.method === "GET") {
        // Local guest mode must never trust identity headers from HTTP clients.
        res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "private, no-store" });
        res.end(JSON.stringify({ available: false, user: null }));
        return;
      }
      if (url.pathname === "/healthz" && ["GET", "HEAD"].includes(req.method)) {
        res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
        res.end(req.method === "HEAD" ? undefined : JSON.stringify({ status: "ok" }));
        return;
      }
      if (url.pathname === "/api/party") {
        let body = "";
        for await (const chunk of req) {
          body += chunk;
          if (body.length > 8192) {
            res.writeHead(413, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "That request is too large." }));
            return;
          }
        }
        const headers = new Headers();
        for (const [key, value] of Object.entries(req.headers))
          if (value)
            headers.set(key, Array.isArray(value) ? value.join(", ") : value);
        const request = new Request(url, {
          method: req.method,
          headers,
          ...(!["GET", "HEAD"].includes(req.method) ? { body } : {}),
        });
        const result = await handlePartyRequest(request, store, { pollMs });
        res.writeHead(result.status, Object.fromEntries(result.headers));
        if (result.body) {
          const stream = Readable.fromWeb(result.body);
          stream.on("error", () => {
            if (!res.destroyed) res.destroy();
          });
          res.on("close", () => stream.destroy());
          stream.pipe(res);
        } else res.end();
        return;
      }
      if (!["GET", "HEAD"].includes(req.method)) {
        res.writeHead(405);
        res.end("Method not allowed");
        return;
      }
      const file = resolve(
        publicRoot,
        `.${decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname)}`,
      );
      if (
        !file.startsWith(publicRoot + sep) ||
        !existsSync(file) ||
        !statSync(file).isFile()
      ) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const size = statSync(file).size;
      const headers = {
        "Content-Type": mime[extname(file)] || "application/octet-stream",
        "Accept-Ranges": "bytes",
        "Cache-Control":
          extname(file) === ".html" ? "no-cache" : "public, max-age=3600",
      };
      const range = req.headers.range?.match(/^bytes=(\d*)-(\d*)$/);
      if (range) {
        const start = range[1]
          ? Number(range[1])
          : Math.max(0, size - Number(range[2]));
        const end =
          range[1] && range[2]
            ? Math.min(Number(range[2]), size - 1)
            : size - 1;
        if (start >= size || start > end || start < 0) {
          res.writeHead(416, { "Content-Range": `bytes */${size}` });
          res.end();
          return;
        }
        res.writeHead(206, {
          ...headers,
          "Content-Range": `bytes ${start}-${end}/${size}`,
          "Content-Length": end - start + 1,
        });
        if (req.method === "HEAD") res.end();
        else createReadStream(file, { start, end }).pipe(res);
      } else {
        res.writeHead(200, { ...headers, "Content-Length": size });
        if (req.method === "HEAD") res.end();
        else createReadStream(file).pipe(res);
      }
    } catch (error) {
      console.error("Local server:", error.message);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "The local server could not complete this request.",
          }),
        );
      } else res.end();
    }
  });
  return { server, store };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  if (!existsSync(resolve(root, "local-dist/index.html"))) {
    console.error("Build the local client first: npm run build:local");
    process.exit(1);
  }
  const port = Number(process.env.PORT || 3000),
    host = process.env.HOST || "0.0.0.0";
  const { server, store } = createLocalServer();
  server.listen(port, host, () => {
    console.log(
      `\n  NEOSTANCE · One screen. A little closer.\n\n  Open: http://localhost:${port}\n`,
    );
    for (const addresses of Object.values(networkInterfaces()))
      for (const address of addresses || [])
        if (address.family === "IPv4" && !address.internal)
          console.log(`  On the same Wi-Fi: http://${address.address}:${port}`);
    console.log(
      "\n  Keep this window open. Ctrl+C stops the server.\n  Room data is saved in .afterhours/rooms.sqlite\n",
    );
  });
  const shutdown = () => {
    server.closeAllConnections();
    server.close();
    store.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
