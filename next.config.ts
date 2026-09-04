import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: { root: process.cwd() },
  outputFileTracingRoot: path.join(process.cwd()),
  outputFileTracingIncludes: {
    "/api/search": ["./data/corpus.json"],
  },
};

export default nextConfig;
