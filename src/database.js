import pkg from "pg";
const { Pool } = pkg;
import { DATABASE_URL } from "./config.js";

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  // Desactivar SSL para conexión local y evitar error
  ssl: false
});

// Initialize database
(async () => {
  try {
    const client = await pool.connect();
    client.release();
    console.log("Connected to PostgreSQL database");
  } catch (error) {
    console.error("Database connection error:", error);
  }
})();

export default pool;