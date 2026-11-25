import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const apiUrl = process.env.FLOW_API_URL ?? "http://127.0.0.1:17100";

const nextConfig = {
  outputFileTracingRoot: path.resolve(projectRoot, ".."),
  async rewrites() {
    return [{ source: "/graphql", destination: `${apiUrl}/graphql` }];
  },
  async headers() {
    return [{ source: "/", headers: [{ key: "Cache-Control", value: "no-store" }] }];
  },
};

export default nextConfig;
