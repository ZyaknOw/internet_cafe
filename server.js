const { createServer } = require("node:http");
const path = require("node:path");
const { createRequire } = require("node:module");

function createRequestHandler(api, website) {
  return async (req, res) => {
    try {
      const pathname = new URL(req.url, "http://localhost").pathname;
      if (pathname === "/api" || pathname.startsWith("/api/") ||
          pathname === "/health" || pathname.startsWith("/health/")) {
        api(req, res, () => {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "API endpoint not found" }));
        });
      } else {
        // Let Next.js read its own request bodies (including Server Actions).
        await website(req, res);
      }
    } catch (error) {
      console.error("Request failed", error);
      if (!res.headersSent) res.writeHead(500);
      res.end();
    }
  };
}

async function start() {
  process.env.NODE_ENV = "production";
  const frontendRequire = createRequire(path.join(__dirname, "frontend/package.json"));
  const next = frontendRequire("next");
  const { app: api } = require("./backend/dist/server.js");
  const port = Number(process.env.PORT || 3000);
  const website = next({ dev: false, dir: path.join(__dirname, "frontend"), port });
  await website.prepare();
  const server = createServer(createRequestHandler(api, website.getRequestHandler()));
  server.on("error", (error) => {
    console.error("Server failed", error);
    process.exit(1);
  });
  server.listen(port, "0.0.0.0", () => {
    console.log(`Internet Cafe website and API listening on port ${port}`);
  });
}

if (require.main === module) {
  start().catch((error) => {
    console.error("Application startup failed", error);
    process.exit(1);
  });
}

module.exports = { createRequestHandler };
