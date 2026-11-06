/**
 * Seeds the database:
 *   • three login accounts (Managing Director, Admin Manager, Operations Staff) — only if there are no users yet
 *   • the DEMO workspace with fictional sample data (re-created every run; the LIVE workspace is never touched)
 * Run:  npm run db:seed        (optionally SEED_PASSWORD=... to choose the password for the new accounts)
 */
import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client';
import { poolConfig } from '../src/lib/db-config';
import { seedDemoWorkspace } from '../src/lib/repo/seed';

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(poolConfig(3)) });

async function seedUsers() {
  if ((await prisma.user.count()) > 0) { console.log('Users already exist — leaving accounts unchanged.'); return; }
  const password = process.env.SEED_PASSWORD || randomBytes(9).toString('base64url');
  const passwordHash = await bcrypt.hash(password, 10);
  for (const [email, name, role] of [['md@lgm.local', 'Managing Director', 'md'], ['nitija@lgm.local', 'Nitija (Admin Manager)', 'nitija'], ['staff@lgm.local', 'Operations Staff', 'staff']] as const)
    await prisma.user.create({ data: { email, name, role, passwordHash } });
  console.log('\nCreated accounts md@lgm.local, nitija@lgm.local, staff@lgm.local');
  console.log('Password for all three (shown once — change it): ' + password + '\n');
}

async function seedDemo() {
  const n = await seedDemoWorkspace(prisma);
  console.log(`Demo workspace seeded: ${n.clients} clients, ${n.orders} orders, ${n.candidates} candidates.`);
}

async function main() { await seedUsers(); await seedDemo(); }
main().then(() => prisma.$disconnect()).catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1); });
