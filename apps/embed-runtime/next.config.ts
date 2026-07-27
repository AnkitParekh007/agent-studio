import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@agent-studio/ui', '@agent-studio/embed-sdk'],
};

export default nextConfig;
