import type { NextConfig } from 'next';

// Cache Components / partial prefetching are OFF on purpose: this is a fully logged-in, per-user ERP where every page
// reads the session and the database at request time, so ordinary dynamic rendering is the right model.
const nextConfig: NextConfig = {
  serverExternalPackages: ['exceljs', 'mariadb', '@prisma/adapter-mariadb'],
  // the static (no-server) apps live in public/offline; give their folders clean addresses
  // (redirects, not rewrites: the apps use relative script paths, so the address must end in index.html)
  async redirects() {
    return [
      { source: '/offline/final', destination: '/offline/final/index.html', permanent: false },
      { source: '/offline/final/', destination: '/offline/final/index.html', permanent: false },
      { source: '/offline/template', destination: '/offline/template/index.html', permanent: false },
      { source: '/offline/template/', destination: '/offline/template/index.html', permanent: false },
    ];
  },
};

export default nextConfig;
