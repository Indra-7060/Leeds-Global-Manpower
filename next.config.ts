import type { NextConfig } from 'next';

// Cache Components / partial prefetching are OFF on purpose: this is a fully logged-in, per-user ERP where every page
// reads the session and the database at request time, so ordinary dynamic rendering is the right model.
const nextConfig: NextConfig = {
  serverExternalPackages: ['exceljs', 'mariadb', '@prisma/adapter-mariadb'],
};

export default nextConfig;
