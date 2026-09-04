import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/search": ["./data/corpus.json"],
  },
};

export default nextConfig;
