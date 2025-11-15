import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.warn("DATABASE_URL not set - database features will not be available");
}

export const pool = DATABASE_URL ? new Pool({ connectionString: DATABASE_URL }) : null;
export const db = pool ? drizzle({ client: pool, schema }) : null as any;
