const { createServer } = require("node:http");
const path = require("node:path");
const { createRequire } = require("node:module");

const { createRequestHandler } = require("./lib/request-handler.cjs");

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

// Hosting loaders can require the entry file instead of executing it directly.
// Start in both cases; import the request handler separately in tests.
start().catch((error) => {
  console.error("Application startup failed", error);
  process.exit(1);
});
