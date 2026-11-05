/**
 * Set a new password for an existing account.
 *   npm run user:password -- md@lgm.local "MyNewPassword123"
 * (A "change password" screen will be part of the Settings stage.)
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client';

const [email, password] = process.argv.slice(2);
if (!email || !password) { console.error('Usage: npm run user:password -- <email> "<new password>"'); process.exit(1); }
if (password.length < 10) { console.error('Use at least 10 characters.'); process.exit(1); }

const url = new URL(process.env.DATABASE_URL ?? '');
const prisma = new PrismaClient({ adapter: new PrismaMariaDb({ host: url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), database: url.pathname.slice(1), connectionLimit: 2 }) });

(async () => {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) { console.error('No account with that e-mail.'); process.exit(1); }
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(password, 10) } });
  console.log(`Password updated for ${user.email}.`);
  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
