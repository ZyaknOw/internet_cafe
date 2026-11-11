const { createServer } = require("node:http");
const { createRequestHandler } = require("./request-handler.cjs");

function startRuntime({ port, hostname = "0.0.0.0", loadApi, loadWebsite,
  startupTimeoutMs = 60_000, log = console.log }) {
  let stage = "binding";
  let status = "starting";
  let handleRequest;
  let resolveReady;
  let rejectReady;
  let settled = false;
  const ready = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  const server = createServer((req, res) => {
    const pathname = new URL(req.url, "http://localhost").pathname;
    if (pathname === "/health/live" || pathname === "/health/ready") {
      const ok = pathname === "/health/live" || status === "ready";
      res.writeHead(ok ? 200 : 503, {
        "Content-Type": "application/json", "Cache-Control": "no-store",
      });
      res.end(JSON.stringify({ ok, status }));
    } else if (handleRequest) {
      handleRequest(req, res);
    } else {
      res.writeHead(503, {
        "Content-Type": "application/json", "Cache-Control": "no-store", "Retry-After": "5",
      });
      res.end(JSON.stringify({ error: status === "failed" ? "Application startup failed" : "Application is starting" }));
    }
  });

  const advance = (nextStage) => {
    stage = nextStage;
    log(`[startup] ${stage}`);
  };
  const fail = (cause) => {
    if (settled) return;
    settled = true;
    status = "failed";
    clearTimeout(deadline);
    const error = new Error(`Startup failed at ${stage}`, { cause });
    rejectReady(error);
  };
  const deadline = setTimeout(() => fail(new Error("Startup exceeded its deadline")), startupTimeoutMs);
  server.on("error", fail);
  server.once("close", () => {
    clearTimeout(deadline);
    fail(new Error("Server closed before startup completed"));
  });

  // The hosting loader sees listen() immediately, before framework initialization.
  server.listen(port, hostname, async () => {
    advance("listening");
    try {
      advance("loading-api");
      const api = await loadApi();
      if (settled) return;
      advance("preparing-next");
      const website = await loadWebsite(server);
      if (settled) return;
      handleRequest = createRequestHandler(api, website);
      status = "ready";
      settled = true;
      clearTimeout(deadline);
      advance("ready");
      resolveReady();
    } catch (error) {
      fail(error);
    }
  });

  return { server, ready };
}

module.exports = { startRuntime };
