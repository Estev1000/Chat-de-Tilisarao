// Versión integrada con streaming + chat
$(function () {
  // socket.io client side connection
  let reconnectAttempts = 0;

function connectSocket() {
  const socket = io.connect({ reconnectionAttempts: 5 });
  
  socket.on('reconnect_failed', () => {
    if(reconnectAttempts < 5) {
      setTimeout(connectSocket, 2000);
      reconnectAttempts++;
    }
  });
  return socket;
}

const socket = connectSocket();

// --- UTILIDADES COMPARTIR ---
function generateLiveLink(host) {
  const url = new URL(window.location.href);
  url.searchParams.set('watch', host);
  return url.toString();
}

async function copyTextToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    alert('Enlace copiado al portapapeles');
  } catch (err) {
    console.error(err);
    prompt('Copia este enlace:', text);
  }
}

async function captureVideoFrame(videoElem) {
  const canvas = document.createElement('canvas');
  canvas.width = videoElem.videoWidth;
  canvas.height = videoElem.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(videoElem, 0, 0, canvas.width, canvas.height);
  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

function setupShareButtons(hostNick) {
  const link = generateLiveLink(hostNick);
  $('#shareWhatsapp').attr('href', `https://wa.me/?text=${encodeURIComponent('Mira mi directo: ' + link)}`);
  $('#shareFacebook').attr('href', `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`);
  $('#shareTwitter').attr('href', `https://twitter.com/intent/tweet?text=${encodeURIComponent('Mira mi directo')}&url=${encodeURIComponent(link)}`);
  $('#copyLink').off('click').on('click', () => copyTextToClipboard(link));
  // Instagram: captura y share via Web Share API si disponible
  $('#shareInstagram').off('click').on('click', async () => {
    const videoElem = ($('#localVideo').is(':visible') ? document.getElementById('localVideo') : document.getElementById('remoteVideo'));
    if (videoElem && videoElem.readyState >= 2) {
      const blob = await captureVideoFrame(videoElem);
      const filesArray = [new File([blob], 'live.png', { type: 'image/png' })];
      if (navigator.canShare && navigator.canShare({ files: filesArray })) {
        await navigator.share({ files: filesArray, text: 'Mira mi directo', url: link });
      } else {
        // fallback: copy link and open blob in new tab
        copyTextToClipboard(link);
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      }
    } else {
      copyTextToClipboard(link);
    }
  });
}

// --- Seguidores ---
// Estructura { usuario: [seguidores] }
let followersData = {};

socket.on('connect', () => {
  const loggedUser = localStorage.getItem('chatUser');
  if (loggedUser) {
    socket.emit('get-followers-map');
  }
});

socket.on('followers-map', (data) => {
  followersData = data || {};
});

socket.on('followers-count', ({ user, count }) => {
  $(`.followers-count[data-user='${user}']`).text(`${count} seg.`);
});

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

  // Almacenar datos del usuario actual
  let currentUser = {
    nickname: null,
    followersCount: 0,
    followingCount: 0,
    followingList: [],
    followersList: []
  };

  // Función para actualizar la interfaz con los datos del usuario
  function updateUserInterface() {
    if (!currentUser.nickname) return;
    
    console.log('Actualizando interfaz para usuario:', currentUser.nickname);
    
    // Actualizar el contador de seguidores
    $(`.followers-count[data-user="${currentUser.nickname}"]`)
      .text(`${currentUser.followersCount || 0} seg.`);
      
    // Actualizar el estado de los botones de seguir
    $('.follow-btn').each(function() {
      const user = $(this).data('user');
      const isFollowing = currentUser.followingList && currentUser.followingList.includes(user);
      
      if (user !== currentUser.nickname) {  // No mostrar botón para el propio usuario
        $(this)
          .toggleClass('btn-outline-light', !isFollowing)
          .toggleClass('btn-success', isFollowing)
          .text(isFollowing ? 'Siguiendo' : 'Seguir')
          .prop('disabled', false);
      }
    });
    
    // Actualizar la lista de usuarios en línea
    updateOnlineUsers();
  }

  // Manejar los datos del usuario cuando se conecta
  socket.on('user-data', (data) => {
    console.log('Datos del usuario recibidos:', data);
    
    // Actualizar datos del usuario actual
    currentUser = {
      ...currentUser,
      ...data,
      followersCount: data.followersCount || 0,
      followingCount: data.followingCount || 0,
      followingList: Array.isArray(data.followingList) ? data.followingList : [],
      followersList: Array.isArray(data.followersList) ? data.followersList : []
    };
    
    // Actualizar la interfaz
    updateUserInterface();
    
    // Mostrar mensaje de conexión exitosa
    const welcomeMsg = `Bienvenido/a, ${currentUser.nickname}!`;
    console.log(welcomeMsg);
    displayMsg({ user: 'Sistema', message: welcomeMsg });
  });
  
  // Actualizar el mapa de seguidores cuando haya cambios
  socket.on('followers-map-updated', (data) => {
    console.log('Mapa de seguidores actualizado:', data);
    
    // Actualizar contadores en la interfaz
    if (data.map && currentUser.nickname) {
      const followersCount = data.map[currentUser.nickname] || 0;
      if (followersCount !== undefined) {
        currentUser.followersCount = followersCount;
        $(`.followers-count[data-user="${currentUser.nickname}"]`)
          .text(`${followersCount} seg.`);
      }
    }
  });
  
  // Función para actualizar la lista de usuarios en línea
  function updateOnlineUsers() {
    const onlineUsers = [];
    
    // Recorrer todos los usuarios en la sala
    for (const user in users) {
      if (user !== currentUser.nickname) {  // No incluir al usuario actual
        const isFollowing = currentUser.followingList && currentUser.followingList.includes(user);
        onlineUsers.push({
          nick: user,
          isFollowing: isFollowing
        });
      }
    }
    
    // Actualizar la interfaz de usuarios en línea
    const $usersList = $('.users-list');
    $usersList.empty();
    
    if (onlineUsers.length === 0) {
      $usersList.append('<div class="list-group-item">No hay otros usuarios en línea</div>');
    } else {
      onlineUsers.forEach(user => {
        const userElement = `
          <div class="list-group-item d-flex justify-content-between align-items-center">
            <span>${user.nick}</span>
            <button class="btn btn-sm follow-btn ${user.isFollowing ? 'btn-success' : 'btn-outline-light'}" 
                    data-user="${user.nick}">
              ${user.isFollowing ? 'Siguiendo' : 'Seguir'}
            </button>
          </div>
        `;
        $usersList.append(userElement);
      });
    }
  }

  // Función para conectar usuario al chat
  function connectUserToChat(nick) {
    console.log('Conectando usuario:', nick);
    
    // Resetear datos del usuario actual
    currentUser = {
      nickname: null,
      followersCount: 0,
      followingCount: 0,
      followingList: [],
      followersList: []
    };
    
    // Configurar el usuario en el socket
    socket.emit('new user', nick, function(valid) {
      if (!valid) {
        alert('¡El nombre de usuario ya está en uso!');
        return;
      }
      
      console.log('Usuario válido, guardando en localStorage...');
      // Guardar en localStorage
      localStorage.setItem('chatUser', nick);
      currentUser.nickname = nick;
      
      // Mostrar la interfaz del chat
      $("#nickWrap").hide();
      document.querySelector("#contentWrap").style.display = "flex";
      $("#message").focus();
      $("#logoutBtn").show();
      $nickError.html('');
      
      console.log('Solicitando datos de seguidores para:', nick);
      // Solicitar datos de seguidores
      socket.emit('get-followers-data', { user: nick });
    });
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
    // Usar datos de seguidores provenientes del servidor
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
    $('#userCount').text(data.length);
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

  // --- Manejo de Seguidores ---
  
  // Actualizar la interfaz cuando hay cambios en los seguidores
  function updateFollowUI(targetNick, isFollowing) {
    // Actualizar el botón de seguir
    $(`.follow-btn[data-user="${targetNick}"]`)
      .toggleClass('btn-outline-light', !isFollowing)
      .toggleClass('btn-success', isFollowing)
      .text(isFollowing ? 'Siguiendo' : 'Seguir');
    
    // Actualizar contador local
    const countElement = $(`.followers-count[data-user="${targetNick}"]`);
    if (countElement.length) {
      const currentCount = parseInt(countElement.text()) || 0;
      const newCount = isFollowing ? currentCount + 1 : Math.max(0, currentCount - 1);
      countElement.text(`${newCount} seg.`);
    }
  }
  
  // Escuchar actualizaciones de seguidores
  socket.on('followers-updated', (data) => {
    console.log('Evento followers-updated recibido:', data);
    
    // Actualizar la interfaz para el usuario seguido (target)
    if (data.target) {
      $(`.followers-count[data-user="${data.target.nick}"]`)
        .text(`${data.target.count} seg.`);
    }
    
    // Actualizar la interfaz para el seguidor (follower)
    if (data.follower) {
      $(`.followers-count[data-user="${data.follower.nick}"]`)
        .text(`${data.follower.count} seg.`);
    }
    
    // Actualizar el estado de los botones
    if (data.type === 'followed') {
      $(`.follow-btn[data-user="${data.target.nick}"]`)
        .removeClass('btn-outline-light')
        .addClass('btn-success')
        .text('Siguiendo');
    } else if (data.type === 'unfollowed') {
      $(`.follow-btn[data-user="${data.target.nick}"]`)
        .removeClass('btn-success')
        .addClass('btn-outline-light')
        .text('Seguir');
    }
  });
  
  // Manejar errores de seguimiento
  socket.on('follow-error', (data) => {
    console.error('Error en seguimiento:', data);
    // Mostrar notificación de error
    $chat.append(`<p class="error">Error: ${data.message} - ${data.target}</p>`);
  });
  
  // Evento click en botón seguir/dejar de seguir
  $(document).on('click', '.follow-btn', function(e) {
    e.stopPropagation();
    const user = $(this).data('user');
    const myNick = localStorage.getItem('chatUser');
    
    if (!myNick) {
      $chat.append('<p class="error">Debes iniciar sesión para seguir usuarios</p>');
      return;
    }
    
    if (user === myNick) {
      $chat.append('<p class="error">No puedes seguirte a ti mismo</p>');
      return;
    }
    
    // Feedback visual inmediato
    const $button = $(this);
    const wasFollowing = $button.hasClass('btn-success');
    
    // Invertir el estado actual para el feedback inmediato
    updateFollowUI(user, !wasFollowing);
    
    // Avisar al servidor
    console.log(`Enviando toggle-follow: target=${user}, follower=${myNick}`);
    socket.emit('toggle-follow', {
      target: user,
      follower: myNick
    });
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
    // Evitar mostrar mensajes duplicados
    if (document.getElementById(msgId)) return;
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


  // Mostrar solo una ventana de video a la vez
  function showLocal() {
    $('#localVideoCol').removeClass('d-none');
    $('#remoteVideoCol').addClass('d-none');
  }
  function showRemote() {
    $('#remoteVideoCol').removeClass('d-none');
    $('#localVideoCol').addClass('d-none');
  }
  function hideVideos() {
    $('#localVideoCol').addClass('d-none');
    $('#remoteVideoCol').addClass('d-none');
  }

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
        showLocal();
        const myNickLive = localStorage.getItem('chatUser');
        socket.emit('user-started-live', { from: myNickLive });
        setupShareButtons(myNickLive);
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
    hideVideos();
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
    setupShareButtons(targetUser);
    $('#liveChat').empty();
    $remoteVideo.removeClass('d-none').show();
    showRemote();
    peerConnection = new RTCPeerConnection(config);
    let remoteTrackReceived = false;
    // Si no se recibe la pista remota en 5 segundos, mostrar advertencia
    const remoteTimeout = setTimeout(() => {
      if (!remoteTrackReceived) {
        $('#liveChat').append('<div class="text-danger">No se pudo conectar con la transmisión de este usuario. Es posible que no haya iniciado correctamente su cámara o la transmisión se haya detenido.</div>');
        // $remoteVideo.hide();  // eliminado para mantener visible el video
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
  // Función para mostrar mensajes en el chat de la transmisión con mismo estilo que el chat global
  function displayLiveMsg(data) {
    const isOwn = data.from === localStorage.getItem('chatUser');
    const $liveChat = $('#liveChat');
    $liveChat.append(
      `<div class="chat-msg p-2 bg-dark bg-opacity-75 w-100 text-white rounded-3 mb-1 animate__animated animate__fadeInUp d-flex justify-content-start">
         <span><b>${data.from}</b>: ${data.message}</span>
       </div>`
    );
    const liveChatElem = $liveChat[0];
    liveChatElem.scrollTop = liveChatElem.scrollHeight;
  }

  socket.on('live-comment', function(data) {
    // Mostrar si estamos viendo la transmisión de ese host o si el usuario es el host
    const myNick = localStorage.getItem('chatUser');
    if ((window.currentLiveHost && data.host === window.currentLiveHost) || (data.host === myNick)) {
      displayLiveMsg(data);
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
    hideVideos();
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
