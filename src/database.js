import pkg from "pg";
const { Pool } = pkg;
import { DATABASE_URL } from "./config.js";



// Configuración de la conexión
const poolConfig = {
  connectionString: DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000, // Aumentado para dar más tiempo a la conexión
  ssl: isProduction ? {
    require: true,
    rejectUnauthorized: false
  } : false
};

console.log('Configuración de la base de datos:', {
  ...poolConfig,
  connectionString: '***' // No mostramos la URL completa por seguridad
});

const pool = new Pool(poolConfig);

// Verificación de la conexión y estructura de la base de datos
async function initializeDatabase() {
  const client = await pool.connect();
  try {
    // Verificar si la tabla followers existe
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'followers'
      );
    `);
    
    console.log('Tabla followers existe:', tableCheck.rows[0].exists);
    
    // Verificar si hay datos en la tabla followers
    const dataCheck = await client.query('SELECT COUNT(*) FROM followers');
    console.log('Número de seguidores en la base de datos:', dataCheck.rows[0].count);
    
    // Verificar algunos usuarios de ejemplo
    const usersCheck = await client.query('SELECT id, nick FROM users LIMIT 5');
    console.log('Usuarios de ejemplo:', usersCheck.rows);
    
    console.log("Conexión a PostgreSQL verificada exitosamente");
  } catch (error) {
    console.error("Error al verificar la base de datos:", error);
    throw error; // Relanzar el error para que se maneje en el nivel superior
  } finally {
    client.release();
  }
}

// Inicializar la base de datos
initializeDatabase().catch(error => {
  console.error("Error al inicializar la base de datos:", error);
  process.exit(1); // Salir si hay un error crítico
});

export default pool;