import path from "node:path";
import { fileURLToPath } from "node:url";

const configDirectory = path.dirname(fileURLToPath(import.meta.url));

const nextConfig = {
  // Include the public PC configuration shared with backend session billing.
  turbopack: { root: path.join(configDirectory, "..") },
};

export default nextConfig;
