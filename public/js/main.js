// Versión integrada con streaming + chat
$(function () {
  // socket.io client side connection
  const socket = io.connect();

  // obtaining DOM elements from the Chat Interface
  const $messageForm = $("#message-form");
  const $messageBox = $("#message");
  const $chat = $("#chat");


  // obteniendo elementos del formulario de autenticación
  const $authForm = $("#authForm");
  const $nickError = $("#nickError");
  const $nickname = $("#nickname");
  const $password = $("#password");
  const $loginBtn = $("#loginBtn");
  const $registerBtn = $("#registerBtn");

  // obtaining the usernames container DOM
  const $users = $("#usernames");
  const $liveUsersList = $("#liveUsersList");

  // --- INICIO: Persistencia de sesión ---

  // Función para verificar sesión existente al cargar la página
  function checkExistingSession() {
    const savedUser = localStorage.getItem('chatUser');
    const sessionToken = localStorage.getItem('sessionToken');
    if (savedUser && sessionToken) {
      $nickError.html('<div class="alert alert-info">Verificando sesión...</div>');
      $.post('/verify-session', { nick: savedUser, token: sessionToken }, function (data) {
        if (data.success) {
          connectUserToChat(savedUser);
        } else {
          clearSession();
          $nickError.html('<div class="alert alert-warning">Sesión expirada, por favor inicia sesión nuevamente.</div>');
        }
      }).fail(function() {
        clearSession();
        $nickError.html('<div class="alert alert-danger">Error verificando sesión, por favor inicia sesión.</div>');
      });
    }
  }

  // Función para limpiar datos de sesión
  function clearSession() {
    localStorage.removeItem('chatUser');
    localStorage.removeItem('sessionToken');
  }

  // Función para conectar usuario al chat
  function connectUserToChat(nick) {
    socket.emit("new user", nick, function (ok) {
      if (ok) {
        $("#nickWrap").hide();
        document.querySelector("#contentWrap").style.display = "flex";
        $("#message").focus();
        $("#logoutBtn").show();
        $nickError.html('');
      } else {
        $nickError.html('<div class="alert alert-danger">Ese apodo ya está en uso en el chat.</div>');
        clearSession();
      }
    });
  }

  // Función para cerrar sesión
  function logout() {
    const token = localStorage.getItem('sessionToken');
    if (token) {
      $.post('/logout', { token: token });
    }
    clearSession();
    socket.disconnect();
    location.reload();
  }

  // Verificar sesión al cargar la página
  checkExistingSession();

  // Evento para logout
  $(document).on('click', '#logoutBtn', function (e) {
    e.preventDefault();
    if (confirm('¿Estás seguro que quieres cerrar sesión?')) {
      logout();
    }
  });

  // Atajo de teclado para logout (Ctrl + L)
  $(document).on('keydown', function(e) {
    if (e.ctrlKey && e.key === 'l') {
      e.preventDefault();
      if (confirm('¿Cerrar sesión?')) {
        logout();
      }
    }
  });

  // --- FIN: Persistencia de sesión ---

  // Evento para login
  $loginBtn.on('click', function (e) {
    e.preventDefault();
    const nick = $nickname.val().trim();
    const pass = $password.val();
    if (!nick || !pass) {
      $nickError.html('<div class="alert alert-danger">Completa apodo y contraseña.</div>');
      return;
    }
    $nickError.html('<div class="alert alert-info">Iniciando sesión...</div>');
    $.post('/login', { nick, password: pass }, function (data) {
      if (data.success && data.token) {
        localStorage.setItem('chatUser', nick);
        localStorage.setItem('sessionToken', data.token);
        connectUserToChat(nick);
      } else {
        $nickError.html('<div class="alert alert-danger">' + (data.message || 'Error de login') + '</div>');
      }
    }).fail(function() {
      $nickError.html('<div class="alert alert-danger">Error de conexión, intenta nuevamente.</div>');
    });
  });

  // Evento para registro
  $registerBtn.on('click', function (e) {
    e.preventDefault();
    const nick = $nickname.val().trim();
    const pass = $password.val();
    if (!nick || !pass) {
      $nickError.html('<div class="alert alert-danger">Completa apodo y contraseña.</div>');
      return;
    }
    $.post('/register', { nick, password: pass }, function (data) {
      if (data.success) {
        $nickError.html('<div class="alert alert-success">Usuario registrado, ahora puedes iniciar sesión.</div>');
      } else {
        $nickError.html('<div class="alert alert-danger">' + data.message + '</div>');
      }
    });
  });

  // events
  $messageForm.submit((e) => {
    e.preventDefault();
    const msg = $messageBox.val();
    if (!msg.trim()) return;
    // Generar un id único para el mensaje
    const msgId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    // Enviar el id junto con el mensaje
    socket.emit("send message", { msg, _id: msgId }, (data) => {
      if (data) $chat.append(`<p class="error">${data}</p>`);
    });
    $messageBox.val("");
  });

socket.on("new message", (data) => {
    // Si no viene id, generar uno para que los botones funcionen
    if (!data._id) {
      data._id = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    displayMsg(data);
});

  // Usuarios en vivo
  let liveUsers = new Set();

  socket.on("usernames", (data) => {
    let html = "";
    let liveHtml = "";
    const myNick = localStorage.getItem('chatUser');
    // Obtener seguidores de localStorage (simulación frontend)
    let followersData = {};
    try {
      followersData = JSON.parse(localStorage.getItem('followersData') || '{}');
    } catch (e) { followersData = {}; }
    // MODIFICACIÓN: Mostrar SIEMPRE el badge de seguidores, incluso para el usuario actual
    for (let i = 0; i < data.length; i++) {
      const isLive = liveUsers.has(data[i]);
      const isMe = myNick === data[i];
      const followersCount = followersData[data[i]] ? followersData[data[i]].length : 0;
      const isFollowing = followersData[data[i]] && followersData[data[i]].includes(myNick);
      html += `<p class="user-item d-flex align-items-center gap-2" data-user="${data[i]}">
        <i class="fas fa-user"></i>
        <span class="fw-semibold text-white">${data[i]}</span>
        ${isLive ? '<span class="pulse-ring bg-danger rounded-circle ms-2" style="display:inline-block;width:12px;height:12px;"></span>' : ''}
        ${!isMe ? `<button class='btn btn-sm ${isFollowing ? 'btn-success' : 'btn-outline-light'} ms-2 follow-btn' data-user='${data[i]}'>${isFollowing ? 'Siguiendo' : 'Seguir'}</button>` : ''}
        <span class='badge bg-secondary ms-2 followers-count' data-user='${data[i]}'>${followersCount} seg.</span>
      </p>`;
    }
    $users.html(html);
    $users.html(html);
    // Eliminar la lista secundaria de usuarios en vivo
    if (typeof $liveUsersList !== 'undefined') $liveUsersList.html("");
  });

  // Recibe notificación de usuario en vivo
  socket.on('user-live', (data) => {
    liveUsers.add(data.user);
    // Refresca la lista de usuarios para mostrar el badge EN VIVO
    socket.emit('new user', localStorage.getItem('chatUser'), function(){});
  });

  // Recibe notificación de que un usuario terminó la transmisión en vivo
  socket.on('user-stopped-live', (data) => {
    liveUsers.delete(data.user);
    // Refresca la lista de usuarios para quitar el badge EN VIVO
    socket.emit('new user', localStorage.getItem('chatUser'), function(){});
    // Si el video remoto es de ese usuario, ocultarlo
    if ($('#remoteVideo').is(':visible')) {
      $('#remoteVideo')[0].srcObject = null;
      $('#remoteVideo').addClass('d-none').hide();
    }
    // Si el video local es de ese usuario, ocultarlo
    if ($('#localVideo').is(':visible') && data.user === localStorage.getItem('chatUser')) {
      $('#localVideo')[0].srcObject = null;
      $('#localVideo').hide();
      $('#startLiveBtn').prop('disabled', false);
      $('#stopLiveBtn').addClass('d-none');
      $('#startLiveBtn').removeClass('d-none').text('Iniciar transmisión en vivo');
      // Ocultar indicador EN VIVO si se detiene desde otro lugar
      $('#liveIndicator').addClass('d-none').hide();
    }
  });


  // Evento click en usuario: si está en vivo, ver transmisión; si no, abrir privado
  $(document).on('click', '.user-item', function(e) {
    // Si el click fue en el botón seguir, no hacer nada aquí
    if ($(e.target).hasClass('follow-btn')) return;
    const user = $(this).data('user');
    const myNick = localStorage.getItem('chatUser');
    if (user === myNick) return; // No hacer nada si es uno mismo
    if (liveUsers.has(user)) {
      // Si está en vivo, ver transmisión
      startWatchingLive(user);
    } else {
      // Si no está en vivo, abrir modal privado
      $('#privateMsgUser').text(user);
      $('#privateMsgInput').val("");
      const modal = new bootstrap.Modal(document.getElementById('privateMsgModal'));
      modal.show();
    }
  });

  // Evento click en botón seguir/dejar de seguir
  $(document).on('click', '.follow-btn', function(e) {
    e.stopPropagation();
    const user = $(this).data('user');
    let followersData = {};
    try {
      followersData = JSON.parse(localStorage.getItem('followersData') || '{}');
    } catch (e) { followersData = {}; }
    const myNick = localStorage.getItem('chatUser');
    if (!followersData[user]) followersData[user] = [];
    const idx = followersData[user].indexOf(myNick);
    if (idx === -1) {
      followersData[user].push(myNick);
      $(this).removeClass('btn-outline-light').addClass('btn-success').text('Siguiendo');
    } else {
      followersData[user].splice(idx, 1);
      $(this).removeClass('btn-success').addClass('btn-outline-light').text('Seguir');
    }
    localStorage.setItem('followersData', JSON.stringify(followersData));
    // Actualizar contador visual
    $(`.followers-count[data-user='${user}']`).text(`${followersData[user].length} seg.`);
    // Si el usuario actual es el mismo, actualizar su propio contador
    if ($(`.followers-count[data-user='${myNick}']`).length) {
      const myFollowers = followersData[myNick] ? followersData[myNick].length : 0;
      $(`.followers-count[data-user='${myNick}']`).text(`${myFollowers} seg.`);
    }
    // TODO: Emitir evento al backend para guardar relación de seguidores
  });

  // Evento para enviar mensaje privado desde el modal
  $('#sendPrivateMsgBtn').on('click', function() {
    const user = $('#privateMsgUser').text();
    const msg = $('#privateMsgInput').val().trim();
    if (!msg) return;
    socket.emit("send message", `/w ${user} ${msg}`, (data) => {
      $chat.append(`<p class="error">${data}</p>`);
    });
    const modal = bootstrap.Modal.getInstance(document.getElementById('privateMsgModal'));
    modal.hide();
  });

  socket.on("whisper", (data) => {
    $chat.append(`<p class="whisper"><b>${data.nick}</b>: ${data.msg}</p>`);
  });

  socket.on("load old msgs", (msgs) => {
    for (let i = msgs.length - 1; i >= 0; i--) {
      displayMsg(msgs[i]);
    }
  });

function displayMsg(data) {
    // Usar el id real de la base de datos si existe
    const msgId = (data.id !== undefined && data.id !== null) ? `msgdb-${data.id}` : (data._id || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    const isOwn = data.nick === localStorage.getItem('chatUser');
    let actions = '';
    if (isOwn) {
      actions = `
        <span style="float:right">
          <button class="btn btn-sm btn-warning edit-msg-btn ms-1" data-id="${msgId}" data-db-id="${data.id || ''}" data-msg="${encodeURIComponent(data.msg)}">✏️</button>
          <button class="btn btn-sm btn-danger delete-msg-btn ms-1" data-id="${msgId}" data-db-id="${data.id || ''}">🗑️</button>
        </span>
      `;
    }
    $chat.append(
      `<div class="chat-msg p-2 bg-secondary w-75 animate__animated animate__backInUp mb-1 d-flex align-items-center justify-content-between" id="${msgId}">
        <span><b>${data.nick}</b>: <span class="msg-text">${data.msg}</span></span> ${actions}
      </div>`
    );
    const chat = document.querySelector("#chat");
    chat.scrollTop = chat.scrollHeight;
}

// Evento para editar mensaje
$(document).on('click', '.edit-msg-btn', function() {
  const msgId = $(this).data('id');
  const dbId = $(this).data('db-id');
  const oldMsg = decodeURIComponent($(this).data('msg'));
  const newMsg = prompt('Editar mensaje:', oldMsg);
  if (newMsg !== null && newMsg.trim() !== '' && newMsg !== oldMsg) {
    // Emitir evento para editar mensaje usando el id real de la base de datos
    socket.emit('edit-message', { id: msgId, dbId, newMsg });
  }
});

// Evento para eliminar mensaje
$(document).on('click', '.delete-msg-btn', function() {
  const msgId = $(this).data('id');
  const dbId = $(this).data('db-id');
  if (confirm('¿Eliminar este mensaje?')) {
    socket.emit('delete-message', { id: msgId, dbId });
  }
});

// Recibir mensaje editado
socket.on('message-edited', function(data) {
  const { id, newMsg } = data;
  $(`#${id} .msg-text`).text(newMsg);
});

// Recibir mensaje eliminado
socket.on('message-deleted', function(data) {
  const { id } = data;
  $(`#${id}`).remove();
});

  // Emoji picker
  const emojiBtn = document.querySelector('#emoji-btn');
  const messageInput = document.querySelector('#message');
  if (emojiBtn && messageInput && window.EmojiButton) {
    const picker = new EmojiButton();
    emojiBtn.addEventListener('click', () => {
      picker.togglePicker(emojiBtn);
    });
    picker.on('emoji', emoji => {
      messageInput.value += emoji;
      messageInput.focus();
    });
  }

  // --- INICIO: Transmisión de video en vivo (WebRTC + Socket.io) ---
  let localStream = null;
  let peerConnection = null;
  const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
  const $startLiveBtn = $('#startLiveBtn');
  const $stopLiveBtn = $('#stopLiveBtn');
  const $localVideo = $('#localVideo');
  const $remoteVideo = $('#remoteVideo');

  $startLiveBtn.on('click', async function() {
    if ($startLiveBtn.text().trim() === 'Iniciar Transmisión' || $startLiveBtn.text().trim() === 'Iniciar transmisión en vivo') {
      $startLiveBtn.prop('disabled', true);
      $('#liveStreamSection').removeClass('d-none').show();
      $('#contentWrap').hide();
      $localVideo.removeClass('d-none').show();
      $('#localVideoOverlay').removeClass('d-none').show();
      try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        $localVideo[0].srcObject = localStream;
        $('#localVideoOverlay').addClass('d-none').hide();
        socket.emit('user-started-live', { from: localStorage.getItem('chatUser') });
        $startLiveBtn.addClass('d-none');
        $stopLiveBtn.removeClass('d-none');
        $startLiveBtn.prop('disabled', false);
        // Mostrar indicador EN VIVO
        $('#liveIndicator').removeClass('d-none').show();
      } catch (err) {
        alert('No se pudo acceder a la cámara/micrófono');
        $startLiveBtn.prop('disabled', false);
        $localVideo.hide();
        $('#localVideoOverlay').removeClass('d-none').show();
        // Ocultar indicador EN VIVO si falla
        $('#liveIndicator').addClass('d-none').hide();
      }
    }
  });

  $stopLiveBtn.on('click', function() {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      localStream = null;
    }
    $localVideo[0].srcObject = null;
    $localVideo.hide();
    $('#localVideoOverlay').removeClass('d-none').show();
    $startLiveBtn.text('Iniciar transmisión en vivo');
    socket.emit('user-stopped-live', { from: localStorage.getItem('chatUser') });
    $('#liveStreamSection').hide();
    $('#contentWrap').show();
    $stopLiveBtn.addClass('d-none');
    $startLiveBtn.removeClass('d-none');
    // Ocultar indicador EN VIVO
    $('#liveIndicator').addClass('d-none').hide();
  });

  // Cuando un usuario quiere ver la transmisión de otro
  $(document).on('click', '.user-item', function() {
    const user = $(this).data('user');
    const myNick = localStorage.getItem('chatUser');
    if (user === myNick) return;
    // Solo permitir ver si el usuario está en vivo
    if (!liveUsers.has(user)) {
      alert('El usuario no está transmitiendo en este momento.');
      return;
    }
    // Solicitar ver la transmisión de ese usuario
    startWatchingLive(user);
  });

function startWatchingLive(targetUser) {
    // Validar usuario logueado antes de emitir cualquier evento
    const myNick = localStorage.getItem('chatUser');
    if (!myNick) {
      alert('Debes iniciar sesión para ver transmisiones en vivo.');
      return;
    }
    // Mostrar la sección de transmisión y ocultar el chat global
    $('#liveStreamSection').removeClass('d-none').show();
    $('#contentWrap').hide();
    window.currentLiveHost = targetUser;
    $('#liveChat').empty();
    $remoteVideo.removeClass('d-none').show();
    peerConnection = new RTCPeerConnection(config);
    let remoteTrackReceived = false;
    // Si no se recibe la pista remota en 5 segundos, mostrar advertencia
    const remoteTimeout = setTimeout(() => {
      if (!remoteTrackReceived) {
        $('#liveChat').append('<div class="text-danger">No se pudo conectar con la transmisión de este usuario. Es posible que no haya iniciado correctamente su cámara o la transmisión se haya detenido.</div>');
        $remoteVideo.hide();
      }
    }, 5000);
    peerConnection.ontrack = (event) => {
      remoteTrackReceived = true;
      clearTimeout(remoteTimeout);
      $remoteVideo[0].srcObject = event.streams[0];
    };
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        // Validar que el campo from nunca sea null
        if (!myNick) {
          alert('Error: usuario no identificado.');
          return;
        }
        socket.emit('new-ice-candidate', {
          target: targetUser,
          candidate: event.candidate,
          from: myNick
        });
      }
    };
    // Iniciar señalización solo si el usuario está logueado
    socket.emit('request-live', { target: targetUser, from: myNick });
}

  // Enviar mensaje al chat de la transmisión
  $('#live-message-form').on('submit', function(e) {
    e.preventDefault();
    const msg = $('#liveMessage').val();
    const myNick = localStorage.getItem('chatUser');
    // Permitir que el host también escriba en su propio chat en vivo
    let liveHost = window.currentLiveHost;
    if (!liveHost) {
      // Si el usuario es el host, usar su propio nick
      liveHost = myNick;
      window.currentLiveHost = myNick;
    }
    if (!msg.trim() || !liveHost) return;
    socket.emit('live-comment', {
      host: liveHost,
      from: myNick,
      message: msg
    });
    $('#liveMessage').val("");
  });

  // Recibir mensaje en el chat de la transmisión
  socket.on('live-comment', function(data) {
    // Mostrar si estamos viendo la transmisión de ese host o si el usuario es el host
    const myNick = localStorage.getItem('chatUser');
    if ((window.currentLiveHost && data.host === window.currentLiveHost) || (data.host === myNick)) {
      $('#liveChat').append(`<div><b>${data.from}:</b> ${data.message}</div>`);
      const liveChat = document.getElementById('liveChat');
      liveChat.scrollTop = liveChat.scrollHeight;
    }
  });

  // Botón para cerrar la ventana de transmisión y volver al chat global
  $('#closeLiveBtn').on('click', function() {
    $('#liveStreamSection').hide();
    $('#contentWrap').show();
    window.currentLiveHost = null;
    $remoteVideo[0].srcObject = null;
    $remoteVideo.hide();
    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
    }
  });

  // Señalización WebRTC
  socket.on('video-offer', async (data) => {
    const myNick = localStorage.getItem('chatUser');
    if (!myNick) {
      alert('Debes iniciar sesión para ver transmisiones en vivo.');
      return;
    }
    peerConnection = new RTCPeerConnection(config);
    peerConnection.ontrack = (event) => {
      $remoteVideo[0].srcObject = event.streams[0];
    };
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('new-ice-candidate', {
          target: data.from,
          candidate: event.candidate,
          from: myNick
        });
      }
    };
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('video-answer', {
      target: data.from,
      sdp: peerConnection.localDescription,
      from: myNick
    });
  });

  socket.on('video-answer', async (data) => {
    if (peerConnection) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
    }
  });

  socket.on('new-ice-candidate', async (data) => {
    if (peerConnection) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (e) { console.error(e); }
    }
  });

  // Cuando otro usuario solicita ver tu transmisión
  socket.on('request-live', async (data) => {
    const myNick = localStorage.getItem('chatUser');
    if (!localStream || !myNick) return;
    peerConnection = new RTCPeerConnection(config);
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('new-ice-candidate', {
          target: data.from,
          candidate: event.candidate,
          from: myNick
        });
      }
    };
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('video-offer', {
      target: data.from,
      sdp: peerConnection.localDescription,
      from: myNick
    });
  });
  // --- FIN: Transmisión de video en vivo ---

  // Evento para el botón "Ir en Vivo" (toggleLiveBtn)
  $('#toggleLiveBtn').on('click', function() {
    $('#liveStreamSection').removeClass('d-none').show();
    $('#contentWrap').hide();
  });
});
