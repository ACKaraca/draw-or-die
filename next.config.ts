import path from 'path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname),
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'fra.cloud.appwrite.io',
        port: '',
        pathname: '/**',
      },
    ],
  },
  output: 'standalone',
  async rewrites() {
    return [{ source: '/favicon.ico', destination: '/icon' }];
  },
  async headers() {
    return [
      {
        source: '/',
        headers: [
          {
            key: 'Content-Signal',
            value: 'search=yes, ai-train=no, ai-input=no',
          },
          {
            key: 'Link',
            value: '</api>; rel="alternate"; type="application/json"',
          },
        ],
      },
    ];
  },
  transpilePackages: ['motion'],
  webpack: (config, { dev }) => {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Keep file watching disabled to prevent flickering during agent edits.
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }
    return config;
  },
};

export default nextConfig;
