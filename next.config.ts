import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: [
    ".space-z.ai",
  ],
  serverExternalPackages: ["xlsx", "mammoth"],
};

export default nextConfig;
