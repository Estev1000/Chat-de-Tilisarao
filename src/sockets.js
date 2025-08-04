import Chat from './models/Chat.js'
import Follower from './models/Follower.js'

export default io => {
  let users = {};

  io.on('connection', async socket => {

    // Notificar a todos cuando un usuario inicia transmisión en vivo
    socket.on('user-started-live', (data) => {
      // data: { from }
      io.sockets.emit('user-live', { user: data.from });
    });

    // Notificar a todos cuando un usuario termina la transmisión en vivo
    socket.on('user-stopped-live', (data) => {
      // data: { from }
      io.sockets.emit('user-stopped-live', { user: data.from });
    });

    // Comentarios de live
    socket.on('live-comment', (data) => {
      // data: { host, from, message }
      if (users[data.host]) {
        // enviar comentario solo al host y a todos los que estén viendo su live (broadcast a todos)
        io.sockets.emit('live-comment', data);
      }
    });

    // Cuando un usuario solicita ver la transmisión de otro
    socket.on('request-live', (data) => {
      // data: { target, from }
      if (users[data.target]) {
        users[data.target].emit('request-live', { from: data.from });
      }
    });

    let messages = await Chat.find({ limit: 8, sort: '-created' });
    socket.emit('load old msgs', messages);

    socket.on('new user', async (data, cb) => {
      if (data in users) {
        cb(false);
      } else {
        try {
          // 1. Set the nickname and add to users
          socket.nickname = data;
          users[socket.nickname] = socket;
          
          // 2. Get the user's followers and following counts
          const [followersCount, followingCount, followingList, followersList] = await Promise.all([
            Follower.countByUser(data),
            Follower.countFollowing(data),
            Follower.getFollowingList(data),
            Follower.getFollowersList(data)
          ]);
          
          console.log(`Usuario ${data} conectado con ${followersCount} seguidores y sigue a ${followingCount} usuarios`);
          
          // 3. Enviar datos al usuario que se acaba de conectar
          socket.emit('user-data', {
            nickname: data,
            followersCount,
            followingCount,
            followingList,
            followersList
          });
          
          // 4. Actualizar nicknames para todos los usuarios
          updateNicknames();
          
          // 5. Enviar confirmación de conexión exitosa
          cb(true);
          
          // 6. Emitir evento global de actualización de seguidores
          const followersMap = await Follower.getCountsMap();
          io.sockets.emit('followers-map-updated', { 
            map: followersMap,
            timestamp: new Date().toISOString() 
          });
          
        } catch (error) {
          console.error('Error en el manejador de nuevo usuario:', error);
          cb(false);
        }
      }
    });

    // receive a message a broadcasting
    socket.on('send message', async (data, cb) => {
      let msg;
      if (typeof data === 'string') {
        msg = data.trim();
      } else {
        msg = (data.msg || '').trim();
      }

      if (msg.substr(0, 3) === '/w ') {
        let privMsg = msg.substr(3);
        let index = privMsg.indexOf(' ');
        if(index !== -1) {
          let name = privMsg.substring(0, index);
          let realMsg = privMsg.substring(index + 1);
          if (name in users) {
            users[name].emit('whisper', {
              msg: realMsg,
              nick: socket.nickname 
            });
          } else {
            cb('Error! Enter a valid User');
          }
        } else {
          cb('Error! Please enter your message');
        }
      } else {
        const saved = await Chat.save({
          msg,
          nick: socket.nickname
        });
        io.sockets.emit('new message', {
          msg: saved.msg,
          nick: saved.nick,
          id: saved.id // Usar el id real de la base de datos
        });
      }
    });

    // Editar mensaje
    socket.on('edit-message', async (data) => {
      // data: { id, dbId, newMsg }
      // Solo puede editar su propio mensaje
      const dbId = parseInt(data.dbId);
      if (!dbId) return;
      const ok = await Chat.updateMsg(dbId, data.newMsg, socket.nickname);
      if (ok) {
        io.sockets.emit('message-edited', { id: data.id, newMsg: data.newMsg });
      }
    });

    // Eliminar mensaje
    socket.on('delete-message', async (data) => {
      // data: { id, dbId }
      const dbId = parseInt(data.dbId);
      if (!dbId) return;
      const ok = await Chat.deleteMsg(dbId, socket.nickname);
      if (ok) {
        io.sockets.emit('message-deleted', { id: data.id });
      }
    });

    // --- Follow system ---
    socket.on('toggle-follow', async ({ target, follower }) => {
      console.log('toggle-follow recibido:', { target, follower });
      try {
        // 1. Realizar la operación de seguir/dejar de seguir
        const result = await Follower.toggle({ target, follower });
        console.log('Resultado de Follower.toggle:', result);
        
        // 2. Obtener los nuevos contadores para ambos usuarios
        const targetCount = await Follower.countByUser(target);
        const followerCount = await Follower.countByUser(follower);
        
        console.log('Actualizando contadores:', {
          target: { nick: target, count: targetCount },
          follower: { nick: follower, count: followerCount }
        });
        
        // 3. Notificar a TODOS los clientes sobre la actualización
        io.sockets.emit('followers-updated', {
          type: result.status, // 'followed' o 'unfollowed'
          target: {
            nick: target,
            count: targetCount
          },
          follower: {
            nick: follower,
            count: followerCount
          }
        });
        
        console.log('Evento followers-updated emitido a todos los clientes');
        
      } catch (err) {
        console.error('Error en toggle-follow:', {
          message: err.message,
          stack: err.stack,
          target,
          follower
        });
        // Notificar al usuario que ocurrió un error
        socket.emit('follow-error', {
          message: 'Error al actualizar el seguimiento',
          target
        });
      }
    });

    socket.on('get-followers-map', async () => {
      try {
        const map = await Follower.getCountsMap();
        socket.emit('followers-map', map);
      } catch (err) {
        console.error('get-followers-map error:', err);
      }
    });

    socket.on('disconnect', data => {
      if(!socket.nickname) return;
      delete users[socket.nickname];
      updateNicknames();
    });

    function updateNicknames() {
      io.sockets.emit('usernames', Object.keys(users));
    }

    // --- Señalización WebRTC para transmisión de video en vivo ---
    socket.on('video-offer', (data) => {
      // data: { target, sdp, from }
      if (users[data.target]) {
        users[data.target].emit('video-offer', {
          sdp: data.sdp,
          from: socket.nickname
        });
      }
    });

    socket.on('video-answer', (data) => {
      // data: { target, sdp, from }
      if (users[data.target]) {
        users[data.target].emit('video-answer', {
          sdp: data.sdp,
          from: socket.nickname
        });
      }
    });

    socket.on('new-ice-candidate', (data) => {
      // data: { target, candidate, from }
      if (users[data.target]) {
        users[data.target].emit('new-ice-candidate', {
          candidate: data.candidate,
          from: socket.nickname
        });
      }
    });
  });
}
