import pool from '../database.js';


class Chat {
  static async find(options = {}) {
    const { limit = 8, sort = '-created' } = options;
    const orderBy = sort.startsWith('-') ? 'DESC' : 'ASC';
    const field = sort.startsWith('-') ? sort.substring(1) : sort;
    const query = `
      SELECT * FROM chats 
      ORDER BY ${field} ${orderBy} 
      LIMIT $1
    `;
    const result = await pool.query(query, [limit]);
    return result.rows;
  }

  static async save(data) {
    const { nick, msg, _id } = data;
    const query = `
      INSERT INTO chats (nick, msg) 
      VALUES ($1, $2) 
      RETURNING *
    `;
    const result = await pool.query(query, [nick, msg]);
    // Devuelve el id generado por la base de datos y el id del frontend si existe
    return { ...result.rows[0], _id: _id || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` };
  }

  static async updateMsg(id, newMsg, nick) {
    // Solo permite editar si el nick coincide
    const query = `UPDATE chats SET msg = $1 WHERE id = $2 AND nick = $3 RETURNING *`;
    const result = await pool.query(query, [newMsg, id, nick]);
    return result.rowCount > 0;
  }

  static async deleteMsg(id, nick) {
    // Solo permite borrar si el nick coincide
    const query = `DELETE FROM chats WHERE id = $1 AND nick = $2`;
    const result = await pool.query(query, [id, nick]);
    return result.rowCount > 0;
  }
}

export default Chat;
