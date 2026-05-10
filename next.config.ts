import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: [
    ".space-z.ai",
  ],
  // Force webpack build to bypass Turbopack cache
  webpack: (config, { dev }) => {
    return config;
  },
};

export default nextConfig;
