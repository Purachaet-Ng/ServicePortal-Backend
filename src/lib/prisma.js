import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  max: 5,
});
const prisma = new PrismaClient({ adapter });

export { prisma };
