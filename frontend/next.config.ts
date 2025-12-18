import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable any automatic redirects
  trailingSlash: false,
  // Ensure no rewrites interfere with the homepage
  async rewrites() {
    return [];
  },
  async redirects() {
    return [];
  },
};

export default nextConfig;
