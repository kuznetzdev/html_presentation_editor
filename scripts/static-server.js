const http = require("http");
const fs = require("fs");
const path = require("path");

const rootDir = process.argv[2]
  ? path.resolve(process.argv[2])
  : process.cwd();
const port = Number(process.argv[3] || 4173);
const host = process.argv[4] || "127.0.0.1";

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webm": "video/webm",
  ".mp4": "video/mp4",
  ".ico": "image/x-icon",
};

function send(response, statusCode, body, contentType) {
  response.writeHead(statusCode, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
  });
  response.end(body);
}

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url, `http://${host}:${port}`);
  let pathname = decodeURIComponent(requestUrl.pathname);
  if (pathname === "/") pathname = "/index.html";
  const normalizedPath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  let filePath = path.join(rootDir, normalizedPath);
  if (
    !filePath.startsWith(rootDir) &&
    filePath.toLowerCase() !== rootDir.toLowerCase()
  ) {
    send(response, 403, "Forbidden", "text/plain; charset=utf-8");
    return;
  }
  try {
    const stat = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
    if (stat?.isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }
    const body = fs.readFileSync(filePath);
    const contentType =
      mimeTypes[path.extname(filePath).toLowerCase()] ||
      "application/octet-stream";
    send(response, 200, body, contentType);
  } catch (error) {
    send(response, 404, "Not Found", "text/plain; charset=utf-8");
  }
});

server.listen(port, host, () => {
  console.log(`static-server listening on http://${host}:${port} root=${rootDir}`);
});
