import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: [
    '@sovereign/ui',
    '@sovereign/core',
    '@sovereign/config',
  ],
};

export default nextConfig;
