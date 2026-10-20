// Minimal static file server for the browser tests (no dependencies).
// Serves the repository root on PORT (default 4321): `node e2e/server.cjs`.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const port = Number(process.env.PORT ?? 4321);
const types = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".csv": "text/csv; charset=utf-8",
  ".xml": "application/xml; charset=utf-8", ".svg": "image/svg+xml"
};

http.createServer((request, response) => {
  const urlPath = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  const file = path.join(root, urlPath.endsWith("/") ? `${urlPath}index.html` : urlPath);
  // Refuse anything outside the repository, such as /../ paths.
  if (!file.startsWith(root + path.sep)) {
    response.writeHead(403).end();
    return;
  }
  fs.readFile(file, (error, body) => {
    if (error) {
      response.writeHead(404).end("Not found");
      return;
    }
    response.writeHead(200, { "Content-Type": types[path.extname(file)] ?? "application/octet-stream" });
    response.end(body);
  });
}).listen(port, "127.0.0.1", () => console.log(`Serving ${root} at http://127.0.0.1:${port}/`));
