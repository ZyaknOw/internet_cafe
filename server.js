// Apply before filesystem/native modules initialize their shared thread pool.
process.env.UV_THREADPOOL_SIZE ||= "2";
process.env.NEXT_TELEMETRY_DISABLED ||= "1";
process.env.NODE_ENV = "production";

const path = require("node:path");
const { existsSync } = require("node:fs");
const { createRequire } = require("node:module");
const { startRuntime } = require("./lib/runtime-server.cjs");

console.log("[startup] entry-loaded");
process.on("uncaughtExceptionMonitor", (error) => console.error("[startup] uncaught exception", error));
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}

// Hosting loaders can require the entry file instead of executing it directly.
const { ready } = startRuntime({
  port,
  loadApi() {
    const backendRequire = createRequire(path.join(__dirname, "backend/package.json"));
    // Hosting loaders need not use the repository root as their working directory.
    // Existing platform variables take precedence; values are never logged.
    backendRequire("dotenv").config({ path: path.join(__dirname, ".env") });
    if (!existsSync(path.join(__dirname, "backend/dist/server.js"))) {
      throw new Error("Missing backend/dist/server.js; build artifacts were not deployed");
    }
    return require("./backend/dist/server.js").app;
  },
  async loadWebsite(httpServer) {
    if (!existsSync(path.join(__dirname, "frontend/.next/BUILD_ID"))) {
      throw new Error("Missing frontend/.next/BUILD_ID; production build was not deployed");
    }
    const frontendRequire = createRequire(path.join(__dirname, "frontend/package.json"));
    const next = frontendRequire("next");
    const website = next({ dev: false, dir: path.join(__dirname, "frontend"), port, httpServer });
    await website.prepare();
    return website.getRequestHandler();
  },
});

ready.catch((error) => {
  console.error("[startup] fatal", error);
  process.exit(1);
});
