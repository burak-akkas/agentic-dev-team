// Minimal static file server for the Next.js export (no dependencies).
// Usage: node e2e/serve.mjs <dir> <port>
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const [root = "out", port = "3100"] = process.argv.slice(2);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

async function resolveFile(urlPath) {
  const safe = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, "");
  // Try the path itself, then "<path>.html", then "<path>/index.html" (Next.js export layout).
  for (const candidate of [safe, `${safe}.html`, join(safe, "index.html")]) {
    const file = join(root, candidate);
    try {
      if ((await stat(file)).isFile()) return file;
    } catch {
      // try the next candidate
    }
  }
  return join(root, "404.html");
}

createServer(async (req, res) => {
  const file = await resolveFile(new URL(req.url, "http://localhost").pathname);
  try {
    const body = await readFile(file);
    const status = file.endsWith("404.html") && !req.url.endsWith("404.html") ? 404 : 200;
    res.writeHead(status, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end("Not found");
  }
}).listen(Number(port), () => console.log(`Serving ${root} on http://localhost:${port}/`));
