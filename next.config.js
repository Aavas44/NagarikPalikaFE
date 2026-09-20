/** @type {import('next').NextConfig} */
const path = require("path");

const nextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  serverExternalPackages: ["pdf-parse"],
  // High/supreme portal peši pulls several court pages; default rewrite proxy is ~30s.
  experimental: {
    proxyTimeout: 180_000,
  },
  async rewrites() {
    return {
      afterFiles: [
        {
          source: "/api/:path*",
          destination: `${process.env.API_URL ?? "http://127.0.0.1:4000"}/api/:path*`,
        },
      ],
    };
  },
};

module.exports = nextConfig;
