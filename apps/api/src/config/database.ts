import { prisma } from '@stratoserp/database';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const DEFAULT_ADMIN_NAME = process.env.SEED_ADMIN_NAME || 'Admin User';
const DEFAULT_ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@tcetmumbai.in';
const DEFAULT_ADMIN_PASSWORD_HASH =
  process.env.SEED_ADMIN_PASSWORD_HASH || '$2a$12$MH8yz58CwaYYWPklBq5g4OVfMkpP.jD6XIbZxFnFefj5k.4c6gq7K';

export async function testConnection(): Promise<void> {
  await prisma.$connect();
  console.log('[DB] Prisma connection established successfully.');
}

export async function ensureAuthSchema(): Promise<void> {
  // Migrate legacy seeded email to current default.
  await prisma.adminUser.updateMany({
    where: { emailId: 'admin@stratoserp.edu' },
    data: { name: DEFAULT_ADMIN_NAME, emailId: DEFAULT_ADMIN_EMAIL },
  });

  // Seed one default admin account if none exists.
  const exists = await prisma.adminUser.findUnique({
    where: { emailId: DEFAULT_ADMIN_EMAIL },
  });
  if (!exists) {
    await prisma.adminUser.create({
      data: {
        name: DEFAULT_ADMIN_NAME,
        emailId: DEFAULT_ADMIN_EMAIL,
        passwordHash: DEFAULT_ADMIN_PASSWORD_HASH,
      },
    });
  }
}

export async function disconnect(): Promise<void> {
  await prisma.$disconnect();
}
