import { supabase } from '../supabaseClient.js';

class Chat {
  static async find(options = {}) {
    const { limit = 8, sort = '-created' } = options;
    const orderBy = sort.startsWith('-') ? 'desc' : 'asc';
    const field = sort.startsWith('-') ? sort.substring(1) : sort;
    const res = await supabase
      .from('chats')
      .select('*')
      .order(field, { ascending: orderBy === 'asc' })
      .limit(limit);
    if (res.error) throw res.error;
    return res.data;
  }

  static async save(data) {
    const { nick, msg, _id } = data;
    const res = await supabase
      .from('chats')
      .insert([{ nick, msg }])
      .select('*')
      .single();
    if (res.error) throw res.error;
    return { ...res.data, _id: _id || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` };
  }

  static async updateMsg(id, newMsg, nick) {
    // Solo permite editar si el nick coincide
    const res = await supabase
      .from('chats')
      .update({ msg: newMsg })
      .eq('id', id)
      .eq('nick', nick)
      .select('*');
    if (res.error) throw res.error;
    return res.data && res.data.length > 0;
  }

  static async deleteMsg(id, nick) {
    // Solo permite borrar si el nick coincide
    const res = await supabase
      .from('chats')
      .delete()
      .eq('id', id)
      .eq('nick', nick);
    if (res.error) throw res.error;
    return true;
  }
}

export default Chat;