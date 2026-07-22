import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow a second `next dev` for Playwright (see playwright.config.ts).
  distDir: process.env.NEXT_DIST_DIR || ".next",
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
