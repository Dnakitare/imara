import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3'],
  outputFileTracingIncludes: {
    '/api/events': ['./node_modules/better-sqlite3/**/*'],
  },
};

export default nextConfig;
