import 'server-only';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@/generated/prisma/client';
import { poolConfig } from '@/lib/db-config';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/** One shared client (reused across hot reloads in development). */
export const prisma: PrismaClient = globalForPrisma.prisma ?? new PrismaClient({ adapter: new PrismaMariaDb(poolConfig()) });
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
