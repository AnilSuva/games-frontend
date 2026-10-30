import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.31.84"],
  async redirects() {
    return [
      {
        source: "/games/doge-arena",
        destination: "/games/dodge-arena",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
