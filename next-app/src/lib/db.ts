import 'server-only';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@/generated/prisma/client';

/** Parse DATABASE_URL (mysql://user:pass@host:port/database) into a pool config for the MariaDB driver. */
function poolConfig() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL is not set. Copy .env.example to .env and set the XAMPP database name.');
  const u = new URL(raw);
  return {
    host: u.hostname, port: Number(u.port || 3306), user: decodeURIComponent(u.username), password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ''), connectionLimit: 5,
  };
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/** One shared client (reused across hot reloads in development). */
export const prisma: PrismaClient = globalForPrisma.prisma ?? new PrismaClient({ adapter: new PrismaMariaDb(poolConfig()) });
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
