import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  console.error("Error: DATABASE_URL environment variable is missing");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

export const db = drizzle(sql, { schema });
