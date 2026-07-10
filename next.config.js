/** @type {import('next').NextConfig} */
const path = require("path");

const nextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  serverExternalPackages: ["pdf-parse"],
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
