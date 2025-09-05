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
  connectionTimeoutMillis: 15000, // Increased timeout to 15 seconds
  idleTimeoutMillis: 30000, // Increased idle timeout
  max: 5, // Reduced connection pool size
  allowExitOnIdle: true, // Allow process to exit
  keepAlive: true, // Keep connections alive
  maxUses: 1000, // Reuse connections more
});

export const db = drizzle(pool, { schema });