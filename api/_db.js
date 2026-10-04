import { neon } from '@neondatabase/serverless';

let sqlClient = null;

export function getDb() {
  const dbUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!dbUrl) {
    console.warn('DATABASE_URL is not set.');
    return null;
  }
  if (!sqlClient) {
    sqlClient = neon(dbUrl);
  }
  return sqlClient;
}

export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Shin_18122010';
