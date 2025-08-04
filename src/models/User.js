import pool from '../database.js';
import bcrypt from 'bcryptjs';

class User {
  static async create({ nick, password }) {
    const hash = await bcrypt.hash(password, 10);
    const query = 'INSERT INTO users (nick, password) VALUES ($1, $2) RETURNING id, nick';
    const result = await pool.query(query, [nick, hash]);
    return result.rows[0];
  }

  static async findByNick(nick) {
    const query = 'SELECT * FROM users WHERE nick = $1';
    const result = await pool.query(query, [nick]);
    return result.rows[0];
  }

  static async validatePassword(nick, password) {
    const user = await this.findByNick(nick);
    if (!user) return false;
    const match = await bcrypt.compare(password, user.password);
    return match ? user : false;
  }
}

export default User;
