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
  connectionTimeoutMillis: 3000, // Faster timeout
  idleTimeoutMillis: 10000, // Close idle connections
  max: 10, // Maximum connections
  allowExitOnIdle: true, // Allow process to exit
});

export const db = drizzle(pool, { schema });