import pool from '../database.js';

class Follower {
  static async toggle({ target, follower }) {
    console.log(`\n=== NUEVA SOLICITUD DE SEGUIMIENTO ===`);
    console.log(`Target: ${target}, Follower: ${follower}`);
    
    if (target === follower) {
      console.log('Ignorando autoseguimiento');
      return { status: 'ignored' };
    }

    const client = await pool.connect();
    let transactionCompleted = false;
    
    try {
      console.log('1. Iniciando transacción...');
      await client.query('BEGIN');
      
      // 1. Verificar que los usuarios existen
      console.log('2. Verificando existencia de usuarios...');
      const userCheck = await client.query(
        'SELECT id, nick FROM users WHERE nick = $1 OR nick = $2', 
        [target, follower]
      );
      
      console.log('   Usuarios encontrados:', userCheck.rows);
      
      if (userCheck.rows.length !== 2) {
        const errorMsg = 'Error: Uno o ambos usuarios no existen';
        console.error(errorMsg);
        throw new Error(errorMsg);
      }
      
      const targetUser = userCheck.rows.find(u => u.nick === target);
      const followerUser = userCheck.rows.find(u => u.nick === follower);
      
      if (!targetUser || !followerUser) {
        const errorMsg = 'Error: No se pudo encontrar la información de los usuarios';
        console.error(errorMsg);
        throw new Error(errorMsg);
      }
      
      console.log(`   ID de usuario a seguir (${target}):`, targetUser.id);
      console.log(`   ID de seguidor (${follower}):`, followerUser.id);
      
      // 2. Verificar si ya existe la relación
      console.log('3. Verificando si la relación ya existe...');
      const existsQuery = 'SELECT id FROM followers WHERE user_id = $1 AND follower_id = $2';
      const existsParams = [targetUser.id, followerUser.id];
      
      console.log('   Ejecutando query:', existsQuery);
      console.log('   Parámetros:', existsParams);
      
      const existsRes = await client.query(existsQuery, existsParams);
      console.log('   Resultado:', { rowCount: existsRes.rowCount });
      
      if (existsRes.rowCount > 0) {
        // 3a. Si existe, eliminar la relación (dejar de seguir)
        console.log('4. Relación encontrada, procediendo a eliminar...');
        const deleteQuery = 'DELETE FROM followers WHERE id = $1 RETURNING *';
        console.log('   Ejecutando:', deleteQuery, 'con id:', existsRes.rows[0].id);
        
        const deleteRes = await client.query(deleteQuery, [existsRes.rows[0].id]);
        console.log('   Resultado de eliminación:', deleteRes.rowCount > 0 ? 'Éxito' : 'Falló');
        
        console.log('5. Confirmando transacción (COMMIT)...');
        await client.query('COMMIT');
        transactionCompleted = true;
        
        // Verificar que realmente se eliminó
        const verifyDelete = await client.query(existsQuery, existsParams);
        console.log('   Verificación post-eliminación:', verifyDelete.rowCount === 0 ? 'OK' : 'FALLO');
        
        console.log('=== TRANSACCIÓN COMPLETADA: DEJAR DE SEGUIR ===\n');
        return { status: 'unfollowed' };
      } else {
        // 3b. Si no existe, crear la relación (empezar a seguir)
        console.log('4. No existe relación, creando nuevo seguimiento...');
        const insertQuery = 'INSERT INTO followers (user_id, follower_id) VALUES ($1, $2) RETURNING *';
        const insertParams = [targetUser.id, followerUser.id];
        
        console.log('   Ejecutando:', insertQuery);
        console.log('   Parámetros:', insertParams);
        
        const insertRes = await client.query(insertQuery, insertParams);
        console.log('   Resultado de inserción:', insertRes.rows[0]);
        
        console.log('5. Confirmando transacción (COMMIT)...');
        await client.query('COMMIT');
        transactionCompleted = true;
        
        // Verificar que realmente se insertó
        const verifyInsert = await client.query(existsQuery, existsParams);
        console.log('   Verificación post-inserción:', verifyInsert.rowCount > 0 ? 'OK' : 'FALLO');
        
        console.log('=== TRANSACCIÓN COMPLETADA: NUEVO SEGUIMIENTO ===\n');
        return { status: 'followed' };
      }
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Follower.toggle error:', err);
      throw err;
    } finally {
      client.release();
    }
  }

  static async countByUser(nick) {
    const res = await pool.query(
      'SELECT COUNT(*) FROM followers WHERE user_id = (SELECT id FROM users WHERE nick=$1)',
      [nick]
    );
    return parseInt(res.rows[0].count, 10);
  }

  static async countFollowing(nick) {
    try {
      const res = await pool.query(
        'SELECT COUNT(*) FROM followers WHERE follower_id = (SELECT id FROM users WHERE nick = $1)',
        [nick]
      );
      return parseInt(res.rows[0].count, 10);
    } catch (error) {
      console.error('Error counting following users:', error);
      return 0;
    }
  }

  static async getFollowingList(nick) {
    try {
      const res = await pool.query(
        `SELECT u.nick, u.id 
         FROM users u
         JOIN followers f ON u.id = f.user_id
         WHERE f.follower_id = (SELECT id FROM users WHERE nick = $1)`,
        [nick]
      );
      return res.rows.map(row => row.nick);
    } catch (error) {
      console.error('Error getting following list:', error);
      return [];
    }
  }

  static async getFollowersList(nick) {
    try {
      const res = await pool.query(
        `SELECT u.nick 
         FROM users u
         JOIN followers f ON u.id = f.follower_id
         WHERE f.user_id = (SELECT id FROM users WHERE nick = $1)`,
        [nick]
      );
      return res.rows.map(row => row.nick);
    } catch (error) {
      console.error('Error getting followers list:', error);
      return [];
    }
  }

  static async getCountsMap() {
    try {
      const res = await pool.query('SELECT user_id, COUNT(*) AS cnt FROM followers GROUP BY user_id');
      const map = {};
      for (const row of res.rows) {
        map[row.user_id] = parseInt(row.cnt, 10);
      }
      return map;
    } catch (error) {
      console.error('Error getting counts map:', error);
      return {};
    }
  }
}

export default Follower;
