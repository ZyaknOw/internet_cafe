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

module.exports = { createRequestHandler };
