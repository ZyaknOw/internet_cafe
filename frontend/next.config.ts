import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Include the public PC configuration shared with backend session billing.
  turbopack: { root: path.join(__dirname, "..") },
};

export default nextConfig;
