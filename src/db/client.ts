import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import * as schema from "./schema";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const DB_PATH = process.env.DATABASE_PATH || "./data/instascraper.db";

// Ensure the data directory exists
await mkdir(dirname(DB_PATH), { recursive: true });

// Create SQLite database connection
const sqlite = new Database(DB_PATH);

// Enable WAL mode for better performance
sqlite.exec("PRAGMA journal_mode = WAL;");

// Create drizzle instance with schema
export const db = drizzle(sqlite, { schema });

// Export sqlite for direct access if needed
export { sqlite };

// Health check function
export function checkConnection(): boolean {
  try {
    sqlite.exec("SELECT 1");
    return true;
  } catch (error) {
    console.error("Database connection failed:", error);
    return false;
  }
}

// Graceful shutdown
export function closeConnection(): void {
  sqlite.close();
}
