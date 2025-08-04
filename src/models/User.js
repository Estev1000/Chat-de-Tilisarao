import { supabase } from '../supabaseClient.js';
import bcrypt from 'bcryptjs';

class User {
  static async create({ nick, password }) {
    const hash = await bcrypt.hash(password, 10);
    const { data, error } = await supabase
      .from('users')
      .insert([{ nick, password: hash }])
      .select('id, nick')
      .single();
    if (error) throw error;
    return data;
  }

  static async findByNick(nick) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('nick', nick)
      .single();
    if (error) return null;
    return data;
  }

  static async validatePassword(nick, password) {
    const user = await this.findByNick(nick);
    if (!user) return false;
    const match = await bcrypt.compare(password, user.password);
    return match ? user : false;
  }
}

export default User;
