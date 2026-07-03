import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    externalDir: true,
  },
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "192.168.111.41",
    "anhmy.online",
    "www.anhmy.online",
  ],
};

export default nextConfig;
