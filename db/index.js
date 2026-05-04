/**
 * PostgreSQL connection pool for Immense Estate.
 *
 * Uses DATABASE_URL from .env or falls back to local JSON mode.
 * Import: `import { pool, query, isDbConnected } from './db/index.js';`
 */
import pg from "pg";
const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL;

let pool = null;
let connected = false;

if (DATABASE_URL) {
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes("localhost") || DATABASE_URL.includes("127.0.0.1")
      ? false
      : { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  // Test connection on startup
  pool
    .query("SELECT 1")
    .then(() => {
      connected = true;
      console.log("✅ PostgreSQL connected");
    })
    .catch((err) => {
      connected = false;
      console.warn("⚠️  PostgreSQL not available, using JSON fallback:", err.message);
    });
}

/**
 * Run a parameterized query.
 * Returns { rows, rowCount } or throws.
 */
async function query(text, params = []) {
  if (!pool) throw new Error("Database not configured (no DATABASE_URL)");
  return pool.query(text, params);
}

function isDbConnected() {
  return connected;
}

function getPool() {
  return pool;
}

export { pool, query, isDbConnected, getPool };
export default { pool, query, isDbConnected, getPool };
