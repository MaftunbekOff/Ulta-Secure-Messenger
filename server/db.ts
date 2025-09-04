import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "@shared/schema";
import WebSocket from "ws";

// Set up WebSocket for Neon serverless
if (!globalThis.WebSocket) {
  globalThis.WebSocket = WebSocket as any;
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Please provision the database.");
}

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
});

export const db = drizzle(pool, { schema });