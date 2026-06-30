import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@shipflow/db"],
  images: {
    remotePatterns: [
      { hostname: "avatars.githubusercontent.com" },
      { hostname: "lh3.googleusercontent.com" },
    ],
  },
  serverExternalPackages: ["@prisma/client"],
};

export default nextConfig;
