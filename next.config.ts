import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Turbopack configuration (Next.js 16+)
  turbopack: {},
  
  // Webpack fallback for compatibility (if not using Turbopack)
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        fs: false,
      };
    }
    return config;
  },
};

export default nextConfig;
