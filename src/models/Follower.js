import { supabase } from '../supabaseClient.js';

class Follower {
  static async toggle({ target, follower }) {
    if (target === follower) {
      return { status: 'ignored' };
    }
    // Buscar IDs de los usuarios
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, nick')
      .in('nick', [target, follower]);
    if (userError || !users || users.length !== 2) {
      throw new Error('Uno o ambos usuarios no existen');
    }
    const targetUser = users.find(u => u.nick === target);
    const followerUser = users.find(u => u.nick === follower);
    if (!targetUser || !followerUser) {
      throw new Error('No se pudo encontrar la información de los usuarios');
    }
    // Verificar si ya existe la relación
    const { data: exists, error: existsError } = await supabase
      .from('followers')
      .select('id')
      .eq('user_id', targetUser.id)
      .eq('follower_id', followerUser.id);
    if (existsError) throw existsError;
    if (exists && exists.length > 0) {
      // Si existe, eliminar la relación
      const { error: deleteError } = await supabase
        .from('followers')
        .delete()
        .eq('id', exists[0].id);
      if (deleteError) throw deleteError;
      return { status: 'unfollowed' };
    } else {
      // Si no existe, crear la relación
      const { error: insertError } = await supabase
        .from('followers')
        .insert([{ user_id: targetUser.id, follower_id: followerUser.id }]);
      if (insertError) throw insertError;
      return { status: 'followed' };
    }
  }

  static async countByUser(nick) {
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('nick', nick)
      .single();
    if (userError || !users) return 0;
    const { data, error } = await supabase
      .from('followers')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', users.id);
    if (error) return 0;
    return data ? data.length : 0;
  }

  static async countFollowing(nick) {
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('nick', nick)
      .single();
    if (userError || !users) return 0;
    const { data, error } = await supabase
      .from('followers')
      .select('id', { count: 'exact', head: true })
      .eq('follower_id', users.id);
    if (error) return 0;
    return data ? data.length : 0;
  }

  static async getFollowingList(nick) {
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('nick', nick)
      .single();
    if (userError || !users) return [];
    const { data, error } = await supabase
      .from('followers')
      .select('user_id')
      .eq('follower_id', users.id);
    if (error || !data) return [];
    const userIds = data.map(row => row.user_id);
    if (userIds.length === 0) return [];
    const { data: followingUsers } = await supabase
      .from('users')
      .select('nick')
      .in('id', userIds);
    return followingUsers ? followingUsers.map(u => u.nick) : [];
  }

  static async getFollowersList(nick) {
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('nick', nick)
      .single();
    if (userError || !users) return [];
    const { data, error } = await supabase
      .from('followers')
      .select('follower_id')
      .eq('user_id', users.id);
    if (error || !data) return [];
    const followerIds = data.map(row => row.follower_id);
    if (followerIds.length === 0) return [];
    const { data: followerUsers } = await supabase
      .from('users')
      .select('nick')
      .in('id', followerIds);
    return followerUsers ? followerUsers.map(u => u.nick) : [];
  }

  static async getCountsMap() {
    const { data, error } = await supabase
      .from('followers')
      .select('user_id');
    if (error || !data) return {};
    const map = {};
    for (const row of data) {
      map[row.user_id] = (map[row.user_id] || 0) + 1;
    }
    return map;
  }
}

export default Follower;