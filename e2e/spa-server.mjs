import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".eot": "application/vnd.ms-fontobject",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".wasm": "application/wasm",
};

const STATIC_ASSET_EXTS = new Set([
  ".js",
  ".mjs",
  ".css",
  ".map",
  ".json",
  ".svg",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".ico",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".eot",
  ".txt",
  ".xml",
  ".wasm",
]);

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || "application/octet-stream";
}

function sendFile(req, res, filePath, cacheControl) {
  const stat = fs.statSync(filePath);
  const headers = {
    "Content-Type": getMimeType(filePath),
    "Content-Length": stat.size,
    "Cache-Control": cacheControl,
    "X-Content-Type-Options": "nosniff",
  };
  res.writeHead(200, headers);
  if ((req.method || "GET").toUpperCase() === "HEAD") {
    res.end();
    return;
  }
  const stream = fs.createReadStream(filePath);
  stream.on("error", () => {
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    }
    res.end("Internal Server Error");
  });
  stream.pipe(res);
}

export async function startSpaServer({
  rootDir = path.resolve("dist/public"),
  host = "127.0.0.1",
  port = 0,
} = {}) {
  const resolvedRoot = path.resolve(rootDir);
  const indexHtmlPath = path.join(resolvedRoot, "index.html");

  if (!fs.existsSync(resolvedRoot) || !fs.existsSync(indexHtmlPath)) {
    throw new Error(
      `SPA build missing: "${indexHtmlPath}" not found. Run Vite build first.`
    );
  }

  const server = http.createServer((req, res) => {
    const method = (req.method || "GET").toUpperCase();
    if (method !== "GET" && method !== "HEAD") {
      res.writeHead(405, {
        "Content-Type": "text/plain; charset=utf-8",
        Allow: "GET, HEAD",
      });
      res.end("Method Not Allowed");
      return;
    }

    const rawUrl = req.url || "/";
    const rawPathOnly = rawUrl.split("?")[0].split("#")[0];

    let decodedRawPath;
    try {
      decodedRawPath = decodeURIComponent(rawPathOnly);
    } catch {
      res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Bad Request");
      return;
    }

    if (
      decodedRawPath.includes("\0") ||
      decodedRawPath.includes("\\") ||
      /(^|\/)\.\.(\/|$)/.test(decodedRawPath)
    ) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Forbidden");
      return;
    }

    let pathname;
    try {
      pathname = decodeURIComponent(
        new URL(rawUrl, `http://${host}`).pathname
      );
    } catch {
      res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Bad Request");
      return;
    }

    const relativePath = pathname.replace(/^\/+/, "");
    const candidatePath = path.resolve(resolvedRoot, relativePath);

    if (
      candidatePath !== resolvedRoot &&
      !candidatePath.startsWith(resolvedRoot + path.sep)
    ) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Forbidden");
      return;
    }

    if (fs.existsSync(candidatePath)) {
      const stat = fs.statSync(candidatePath);
      if (stat.isFile()) {
        const isHtml = path.extname(candidatePath).toLowerCase() === ".html";
        const isAsset = pathname.startsWith("/assets/");
        const cacheControl = isHtml
          ? "no-cache"
          : isAsset
            ? "public, max-age=31536000, immutable"
            : "no-cache";
        sendFile(req, res, candidatePath, cacheControl);
        return;
      }
    }

    if (pathname === "/favicon.ico") {
      res.writeHead(204);
      res.end();
      return;
    }

    const ext = path.posix.extname(pathname).toLowerCase();
    if (STATIC_ASSET_EXTS.has(ext)) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not Found");
      return;
    }

    // Vercel catch-all SPA fallback: /(.*) -> /index.html
    sendFile(req, res, indexHtmlPath, "no-cache");
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.removeListener("error", reject);
      resolve();
    });
  });

  const addr = server.address();
  const actualPort = typeof addr === "object" && addr ? addr.port : port;
  const baseUrl = `http://${host}:${actualPort}`;

  return {
    server,
    host,
    port: actualPort,
    baseUrl,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}
