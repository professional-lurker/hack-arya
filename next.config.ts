/** @type {import('next').NextConfig} */
const nextConfig = {
  // Mark native packages as server-only so they don't get bundled into Edge Runtime
  serverExternalPackages: [
    "@prisma/client",
    "prisma",
    "better-sqlite3",
    "@prisma/adapter-better-sqlite3",
    "bcryptjs",
  ],
};

export default nextConfig;
