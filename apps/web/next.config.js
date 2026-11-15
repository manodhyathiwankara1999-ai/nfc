/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  output: 'standalone',
  transpilePackages: ['@nfc/shared'],
  images: {
    remotePatterns: getR2RemotePatterns(),
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.API_INTERNAL_URL || 'http://localhost:4000'}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;

function getR2RemotePatterns() {
  const publicBase = process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL;
  if (!publicBase) return [];
  try {
    const url = new URL(publicBase);
    if (url.protocol !== 'https:') return [];
    return [
      {
        protocol: 'https',
        hostname: url.hostname,
        port: url.port,
        pathname: `${url.pathname.replace(/\/+$/, '')}/**`,
      },
    ];
  } catch {
    return [];
  }
}
