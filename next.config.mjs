/** @type {import('next').NextConfig} */
const nextConfig = {
  // We rely on TypeScript for safety; don't fail the build on lint warnings.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
