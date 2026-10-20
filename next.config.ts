import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Cache Components adoption: all segments currently opt out via `instant = false`
  // (added by the upgrade codemod); remove those opt-outs route by route.
  cacheComponents: true,
};

export default nextConfig;
