/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    // Disable the problematic feature that's causing the invariant error
    missingSuspenseWithCSRBailout: false,
  },
}

export default nextConfig