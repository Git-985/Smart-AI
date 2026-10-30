import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  output: "standalone",
  // Pin the tracing root to this project. Without it, Next may infer a parent
  // directory that contains another lockfile and nest the standalone output.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
