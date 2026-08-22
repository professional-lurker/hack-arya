/** @type {import('next').NextConfig} */
const nextConfig = {
  // Mark native packages as server-only so they don't get bundled into Edge Runtime.
  // `.prisma/client` must be listed explicitly: Prisma v7 generates the client there
  // under a hashed internal package name, and Turbopack would otherwise try to bundle
  // it and fail with "Cannot find module '@prisma/client-<hash>'".
  serverExternalPackages: [
    "@prisma/client",
    ".prisma/client",
    "prisma",
    "better-sqlite3",
    "@prisma/adapter-better-sqlite3",
    "@prisma/adapter-pg",
    "bcryptjs",
  ],
};

export default nextConfig;
