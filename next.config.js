/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "bcryptjs"],
  },
  // Required for Netlify deployment
  output: "standalone",
};

module.exports = nextConfig;
