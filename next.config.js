/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.vercel.app' },
      { protocol: 'https', hostname: '*.figure8results.com.au' },
    ],
  },
};

module.exports = nextConfig;
