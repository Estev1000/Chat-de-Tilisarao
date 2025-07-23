
import Chat from './models/Chat.js'

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

    socket.on('new user', (data, cb) => {
      if (data in users) {
        cb(false);
      } else {
        cb(true);
        socket.nickname = data;
        users[socket.nickname] = socket;
        updateNicknames();
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
