import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString && process.env.NODE_ENV !== 'test') {
  throw new Error('DATABASE_URL is missing from environment variables.');
}

const pool = new Pool({ connectionString });
pool.on('error', (err) => {
  // eslint-disable-next-line no-console
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

export default prisma;
