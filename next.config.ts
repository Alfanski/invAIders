import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ['recharts', 'date-fns'],
  },
};

export default nextConfig;
