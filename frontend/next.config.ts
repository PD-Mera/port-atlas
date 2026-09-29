import type { NextConfig } from "next";

const config: NextConfig = {
  // Development access through any IPv4 address on the internal network.
  allowedDevOrigins: ["*.*.*.*"],
  poweredByHeader: false,
  reactStrictMode: true,
  async rewrites() {
    const backendOrigin = (process.env.BACKEND_ORIGIN ?? "http://localhost:8000").replace(/\/$/, "");
    return [{ source: "/api/:path*", destination: `${backendOrigin}/api/:path*` }];
  },
};

export default config;
