import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // `next dev` otherwise writes an AGENTS.md into the project; this repo does not want one.
  agentRules: false,
};

export default nextConfig;
