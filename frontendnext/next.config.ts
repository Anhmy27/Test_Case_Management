import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    externalDir: true,
  },
  allowedDevOrigins: ["localhost", "127.0.0.1"],
};

export default nextConfig;
