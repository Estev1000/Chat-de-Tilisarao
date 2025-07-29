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

  // --- INICIO: Persistencia de sesión ---

  // Función para verificar sesión existente al cargar la página
  function checkExistingSession() {
    const savedUser = localStorage.getItem('chatUser');
    const sessionToken = localStorage.getItem('sessionToken');
    if (savedUser && sessionToken) {
      showModernAlert('Verificando sesión...', 'info');
      $.post('/verify-session', { nick: savedUser, token: sessionToken }, function (data) {
        if (data.success) {
          connectUserToChat(savedUser);
        } else {
          clearSession();
          showModernAlert('Sesión expirada, por favor inicia sesión nuevamente.', 'warning');
        }
      }).fail(function() {
        clearSession();
        showModernAlert('Error verificando sesión, por favor inicia sesión.', 'danger');
      });
    }
  }

  // Función para mostrar alertas modernas
  function showModernAlert(message, type = 'info') {
    const alertClass = type === 'info' ? 'alert-info' : 
                      type === 'warning' ? 'alert-warning' : 
                      type === 'danger' ? 'alert-danger' : 'alert-success';
    
    $nickError.html(`
      <div class="alert alert-modern ${alertClass} animate__animated animate__fadeInDown">
        <i class="fas fa-${type === 'info' ? 'info-circle' : type === 'warning' ? 'exclamation-triangle' : type === 'danger' ? 'times-circle' : 'check-circle'} me-2"></i>
        ${message}
      </div>
    `);
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
        $("#nickWrap").fadeOut(500, function() {
          $("#contentWrap").fadeIn(500).css('display', 'flex');
          $("#message").focus();
          $nickError.html('');
          
          // Animación de entrada
          $("#contentWrap .col-lg-8").addClass('animate__animated animate__slideInLeft');
          $("#contentWrap .col-lg-4").addClass('animate__animated animate__slideInRight');
        });
      } else {
        showModernAlert('Ese apodo ya está en uso en el chat.', 'danger');
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
      showModernAlert('Completa apodo y contraseña.', 'danger');
      return;
    }
    
    // Mostrar loading
    $loginBtn.html('<div class="loading-spinner me-2"></div>Iniciando sesión...');
    $loginBtn.prop('disabled', true);
    
    $.post('/login', { nick, password: pass }, function (data) {
      if (data.success && data.token) {
        localStorage.setItem('chatUser', nick);
        localStorage.setItem('sessionToken', data.token);
        if (data.avatarUrl) localStorage.setItem('avatarUrl', data.avatarUrl);

        showModernAlert('¡Bienvenido! Conectando...', 'success');
        setTimeout(() => connectUserToChat(nick), 1000);
      } else {
        showModernAlert(data.message || 'Error de login', 'danger');
      }
    }).fail(function() {
      showModernAlert('Error de conexión, intenta nuevamente.', 'danger');
    }).always(function() {
      $loginBtn.html('<i class="fas fa-sign-in-alt me-2"></i>Iniciar Sesión');
      $loginBtn.prop('disabled', false);
    });
  });

  // Evento para registro
  $registerBtn.on('click', function (e) {
    e.preventDefault();
    const nick = $nickname.val().trim();
    const pass = $password.val();
    if (!nick || !pass) {
      showModernAlert('Completa apodo y contraseña.', 'danger');
      return;
    }
    
    $registerBtn.html('<div class="loading-spinner me-2"></div>Creando cuenta...');
    $registerBtn.prop('disabled', true);
    
    $.post('/register', { nick, password: pass }, function (data) {
      if (data.success) {
        showModernAlert('Usuario registrado exitosamente. ¡Ahora puedes iniciar sesión!', 'success');
      } else {
        showModernAlert(data.message, 'danger');
      }
    }).always(function() {
      $registerBtn.html('<i class="fas fa-user-plus me-2"></i>Crear Cuenta');
      $registerBtn.prop('disabled', false);
    });
  });

  // Recibir whisper
  socket.on('whisper', function (data) {
    addModernMessage(`${data.nick} (privado)`, data.msg);
  });

  // events
  $messageForm.submit((e) => {
    e.preventDefault();
    const message = $messageBox.val().trim();
    if (!message) return;
    
    socket.emit("send message", message, (data) => {
      if (data) {
        addModernMessage('Error', data, 'error');
      }
    });
    $messageBox.val("");
  });

  socket.on("new message", (data) => {
    addModernMessage(data.nick, data.msg);
  });

  // Usuarios en vivo
  let liveUsers = new Set();
  let currentUsers = [];

  socket.on("usernames", (data) => {
    currentUsers = data;
    updateModernUsersList(data);
    document.getElementById('userCount').textContent = data.length;
  });

  // Función para actualizar lista de usuarios moderna
  function updateModernUsersList(users) {
    const $usersContainer = $("#usernames");
    $usersContainer.empty();
    
    users.forEach(user => {
      const isLive = liveUsers.has(user);
      const userElement = $(
        `<div class="chat-bubble rounded-3 p-3 mb-2 user-item animate__animated animate__fadeInUp d-flex justify-content-between align-items-center" data-user="${user}">
          <div class="d-flex align-items-center gap-3">
            <div class="user-avatar">${user.charAt(0).toUpperCase()}</div>
            <div>
              <div class="text-white fw-semibold">${user}</div>
              <div class="text-white-50 small"><i class="fas fa-circle text-success me-1" style="font-size: 8px;"></i>En línea</div>
            </div>
          </div>
          <div class="d-flex gap-2">
            <button class="btn btn-sm btn-outline-light btn-private-msg" title="Mensaje privado"><i class="fas fa-envelope"></i></button>
            ${isLive ? '<button class="btn btn-sm btn-danger btn-view-live" title="Ver LIVE"><i class="fas fa-video"></i></button>' : ''}
          </div>
        </div>`
      );
      $usersContainer.append(userElement);
    });
  }

  // Función para agregar mensajes modernos
  function addModernMessage(username, message, type = 'normal') {
    const chatDiv = document.getElementById('chat');
    const messageDiv = document.createElement('div');
    const timestamp = new Date().toLocaleTimeString();
    
    let messageClass = 'message-modern animate__animated animate__fadeInUp';
    let iconClass = 'fas fa-user';
    let usernameColor = 'text-white';
    
    if (type === 'error') {
      messageClass += ' border-danger';
      iconClass = 'fas fa-exclamation-triangle';
      usernameColor = 'text-danger';
    } else if (type === 'system') {
      messageClass += ' border-info';
      iconClass = 'fas fa-info-circle';
      usernameColor = 'text-info';
    }
    
    messageDiv.className = messageClass;
    messageDiv.innerHTML = `
      <div class="d-flex align-items-start">
        <div class="user-avatar me-3">
          <i class="${iconClass}"></i>
        </div>
        <div class="flex-grow-1">
          <div class="d-flex align-items-center justify-content-between mb-1">
            <span class="${usernameColor} fw-bold">${username}</span>
            <span class="text-white-50 small">${timestamp}</span>
          </div>
          <div class="text-white-75">${message}</div>
        </div>
      </div>`;
    chatDiv.appendChild(messageDiv);
    chatDiv.scrollTop = chatDiv.scrollHeight;
    if (type === 'normal') {
      playNotificationSound();
    }
  }

  function playNotificationSound() {
    try {
      if (!window._chatAudioCtx) {
        window._chatAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      const audioContext = window._chatAudioCtx;
      if (audioContext.state === 'suspended') {
        audioContext.resume().catch(() => {});
      }
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (err) {
      console.warn('Notification sound error:', err);
    }
  }

  socket.on('user-live', (data) => {
    liveUsers.add(data.user);
    updateModernUsersList(currentUsers);
  });
  socket.on('user-stopped-live', (data) => {
    liveUsers.delete(data.user);
    updateModernUsersList(currentUsers);
    if ($('#remoteVideo').is(':visible')) {
      $('#remoteVideo')[0].srcObject = null;
      $('#remoteVideo').hide();
    }
  });

  // Handler botón ver LIVE
  $(document).on('click', '.btn-view-live', function(e) {
    e.stopPropagation();
    const user = $(this).closest('.user-item').data('user');
    if ($('#liveStreamSection').hasClass('d-none')) {
      $('#toggleLiveBtn').click();
    }
    startViewingLive(user);
  });

  // Handler botón mensaje privado
  $(document).on('click', '.btn-private-msg', function(e) {
    e.stopPropagation();
    const user = $(this).closest('.user-item').data('user');
    if (user === myNick) return;
    $('#privateMsgUser').text(user);
    $('#privateMsgInput').val("");
    const modalEl = document.getElementById('privateMsgModal');
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
    setTimeout(() => document.getElementById('privateMsgInput').focus(), 300);
  });

  $('#privateMsgInput').on('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      $('#sendPrivateMsgBtn').click();
    }
  });

  $('#sendPrivateMsgBtn').on('click', function() {
    const user = $('#privateMsgUser').text();
    const msg = $('#privateMsgInput').val().trim();
    if (!msg) return;
    socket.emit("send message", `/w ${user} ${msg}`, (err) => {
      if (err) {
        addModernMessage('Error', err, 'error');
      } else {
        addModernMessage(`A ${user} (privado)`, msg, 'system');
      }
    });
    const modal = bootstrap.Modal.getInstance(document.getElementById('privateMsgModal'));
    modal.hide();
    document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
    document.body.classList.remove('modal-open');
    document.body.style = '';
  });

  socket.on("whisper", (data) => {
    addModernMessage(`${data.nick} (privado)`, data.msg, 'system');
  });
  socket.on("load old msgs", (msgs) => {
    for (let i = msgs.length - 1; i >= 0; i--) {
      addModernMessage(msgs[i].nick, msgs[i].msg);
    }
  });

  const emojiBtn = document.querySelector('#emoji-btn');
  const messageInput = document.querySelector('#message');
  if (emojiBtn && messageInput && window.EmojiButton) {
    const picker = new EmojiButton({ theme: 'dark', position: 'top-start' });
    emojiBtn.addEventListener('click', () => { picker.togglePicker(emojiBtn); });
    picker.on('emoji', selection => {
      messageInput.value += selection.emoji;
      messageInput.focus();
    });
  }

  // --- INICIO: Transmisión de video en vivo ---
  let isBroadcasting = false;
  let localStream = null;
  let currentLiveHost = null;
  let peerConnection = null;
  let peerConnections = {};  const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
  const myNick = localStorage.getItem('chatUser');

  function createPeerConnection(isViewer, targetUser) {
  const pc = new RTCPeerConnection(config);
  pc.onicecandidate = (e) => {
    if (e.candidate) {
      socket.emit('new-ice-candidate', { target: targetUser, candidate: e.candidate, from: myNick });
    }
  };
  if (isViewer) {
    let remoteTrackTimeout = setTimeout(() => {
      showModernAlert('No se recibió el video remoto. ¿El usuario está transmitiendo?', 'warning');
      console.warn('No se recibió la pista remota en 5 segundos.');
    }, 5000);
    pc.ontrack = (ev) => {
      clearTimeout(remoteTrackTimeout);
      console.log('📺 Recibida pista remota');
      const [remoteStream] = ev.streams;
      const remoteVideo = document.getElementById('remoteVideo');
      remoteVideo.srcObject = remoteStream;
      // Desmutear el video remoto después de interacción
      setTimeout(() => { remoteVideo.muted = false; }, 500);
      remoteVideo.play().then(() => {
        showModernAlert('¡Video remoto recibido!','success');
        console.log('📺 Video remoto configurado y visible');
      }).catch(e => console.log('Play error:', e));
      $('#remoteVideo').removeClass('d-none').show();
    };
  }
  return pc;
}

$('#toggleLiveBtn').on('click', function() {
  const liveSection = $('#liveStreamSection');
  if (liveSection.hasClass('d-none')) {
    liveSection.removeClass('d-none').addClass('animate__animated animate__fadeInUp');
    $(this).html('<i class="fas fa-times me-2"></i>Cerrar Live');
    $('html, body').animate({ scrollTop: liveSection.offset().top - 100 }, 800);
  } else {
    liveSection.addClass('d-none').removeClass('animate__animated animate__fadeInUp');
    $(this).html('<i class="fas fa-video me-2"></i>Ir en Vivo');
  }
});
  $('#closeLiveBtn').on('click', function() {
    $('#liveStreamSection').addClass('d-none');
    $('#toggleLiveBtn').html('<i class="fas fa-video me-2"></i>Ir en Vivo');
  });
  $('#startLiveBtn').on('click', async function() {
    isBroadcasting = true;
    const btn = $(this); btn.prop('disabled', true).html('<div class="loading-spinner me-2"></div>Iniciando...');
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: true });
      $('#localVideo')[0].srcObject = localStream;
      $('#localVideo').removeClass('d-none').addClass('animate__animated animate__zoomIn');
      $('#liveIndicator').removeClass('d-none').addClass('animate__animated animate__pulse');
      socket.emit('user-started-live', { from: localStorage.getItem('chatUser') });
      btn.addClass('d-none'); $('#stopLiveBtn').removeClass('d-none').addClass('animate__animated animate__fadeIn');
      addLiveMessage('Sistema', '¡Transmisión iniciada! ¡Bienvenidos!', 'system');
    } catch (err) {
      console.error('Error accessing media devices:', err);
      addLiveMessage('Error', 'No se pudo acceder a la cámara/micrófono', 'error');
    } finally {
      btn.prop('disabled', false).html('<i class="fas fa-play me-2"></i>Iniciar Transmisión');
    }
  });
  $('#stopLiveBtn').on('click', function() {
    isBroadcasting = false;
    if (localStream) { localStream.getTracks().forEach(track => track.stop()); localStream = null; }
    $('#localVideo')[0].srcObject = null; $('#localVideo').addClass('d-none'); $('#liveIndicator').addClass('d-none');
    $(this).addClass('d-none'); $('#startLiveBtn').removeClass('d-none');
    socket.emit('user-stopped-live', { from: localStorage.getItem('chatUser') });
    addLiveMessage('Sistema', 'Transmisión finalizada. ¡Gracias por participar!', 'system');
  });
  $('#live-message-form').on('submit', function(e) {
    e.preventDefault();
    const message = $('#liveMessage').val().trim();
    if (!message) return;

    // NO agregar el mensaje localmente aquí
    // Solo enviar al servidor
    showModernAlert('Enviando mensaje al live...', 'info');
    console.log('[LIVE] Enviando mensaje:', { host: isBroadcasting ? myNick : currentLiveHost, from: myNick, message });

    if (isBroadcasting) {
      socket.emit('live-comment', { host: myNick, from: myNick, message }, (ack) => {
        if (ack && ack.error) {
          showModernAlert('Error enviando mensaje al live: ' + ack.error, 'danger');
          console.error('[LIVE] Error enviando mensaje:', ack.error);
        }
      });
    } else if (currentLiveHost) {
      socket.emit('live-comment', { host: currentLiveHost, from: myNick, message }, (ack) => {
        if (ack && ack.error) {
          showModernAlert('Error enviando mensaje al live: ' + ack.error, 'danger');
          console.error('[LIVE] Error enviando mensaje:', ack.error);
        }
      });
    } else {
      showModernAlert('No se ha seleccionado un live para enviar el mensaje.', 'danger');
      console.warn('[LIVE] currentLiveHost no definido al intentar enviar mensaje.');
    }
    $('#liveMessage').val('');
  });
    
  function addLiveMessage(username, message, type = 'normal') {
    if (!username) {
      console.error('addLiveMessage called with null username. Message:', message);
      return; // Evitar el error
    }
    const liveChatDiv = document.getElementById('liveChat');
    const messageDiv = document.createElement('div');
    const timestamp = new Date().toLocaleTimeString();
    let messageClass = 'message-modern animate__animated animate__fadeInRight mb-2'; let bgColor = 'rgba(255, 255, 255, 0.1)';
    if (type === 'system') { bgColor = 'rgba(59, 130, 246, 0.2)'; } else if (type === 'error') { bgColor = 'rgba(239, 68, 68, 0.2)'; }
    messageDiv.className = messageClass; messageDiv.style.background = bgColor; messageDiv.innerHTML = `<div class="d-flex align-items-start"><div class="user-avatar me-2" style="width: 30px; height: 30px; font-size: 12px;">${username.charAt(0).toUpperCase()}</div><div class="flex-grow-1"><div class="d-flex align-items-center justify-content-between"><span class="text-white fw-semibold small">${username}</span><span class="text-white-50" style="font-size: 10px;">${timestamp}</span></div><div class="text-white-75 small">${message}</div></div></div>`;
    liveChatDiv.appendChild(messageDiv); liveChatDiv.scrollTop = liveChatDiv.scrollHeight;
  }
  // ------------------------------
  // Señalización WebRTC
  // ------------------------------
  // Al entrar a un live, aseguro que currentLiveHost se actualiza correctamente
  function startViewingLive(targetUser) {
    console.log(`[VIEWER] 1. Iniciando vista para ${targetUser}`);
    currentLiveHost = targetUser;
    showModernAlert('Entrando al live de ' + targetUser, 'info');
    // Cerrar anterior conexión si existe
    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
    }
    peerConnection = createPeerConnection(true, targetUser);
    socket.emit('request-live', { target: targetUser, from: myNick });
    console.log(`[VIEWER] 2. Solicitud de live enviada a ${targetUser}`);
  }

  // Broadcaster: manejar solicitud de live
  socket.on('request-live', async (data) => {
    console.log(`[BROADCASTER] 3. Solicitud de live recibida de ${data.from}`);
    if (!isBroadcasting || !localStream) {
      showModernAlert('No estás transmitiendo o no hay acceso a la cámara/micrófono.', 'danger');
      console.warn('[BROADCASTER] Ignorando solicitud porque no estoy transmitiendo o no hay localStream.');
      return;
    }

    const target = data.from;
    // Si ya existe una conexión previa para este espectador, ciérrala y elimínala
    if (peerConnections[target]) {
      try { peerConnections[target].close(); } catch (e) {}
      delete peerConnections[target];
    }
    let pc = createPeerConnection(false, target);
    // Aseguramos que todas las pistas se agregan correctamente
    if (localStream) {
      localStream.getTracks().forEach(track => {
        try {
          pc.addTrack(track, localStream);
          console.log(`[BROADCASTER] Pista agregada para ${target}:`, track.kind);
        } catch (err) {
          console.error(`[BROADCASTER] Error agregando pista para ${target}:`, err);
        }
      });
    } else {
      showModernAlert('No hay stream local disponible para enviar.', 'danger');
      console.error('[BROADCASTER] No hay localStream al intentar agregar pistas.');
      return;
    }
    peerConnections[target] = pc;

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('video-offer', { target, sdp: pc.localDescription, from: myNick });
      console.log(`[BROADCASTER] 4. Oferta de video enviada a ${target}`);
    } catch (err) {
      showModernAlert('Error creando la oferta de video.', 'danger');
      console.error('[BROADCASTER] Error creando oferta:', err);
    }
  });

  // Viewer: recibe la oferta del broadcaster
  socket.on('video-offer', async (data) => {
    const { from, sdp } = data;
    console.log(`[VIEWER] 5. Oferta de video recibida de ${from}`);
    showModernAlert('Oferta de video recibida de ' + from, 'info');
    if (!peerConnection) {
      peerConnection = createPeerConnection(true, from);
      console.log('[VIEWER] PeerConnection creado para recibir video.');
    }
    try {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
      console.log('[VIEWER] Descripción remota establecida.');
      showModernAlert('Descripción remota establecida.', 'info');
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      console.log('[VIEWER] Respuesta creada y establecida.');
      showModernAlert('Respuesta de video enviada a ' + from, 'info');
      socket.emit('video-answer', { target: from, sdp: peerConnection.localDescription, from: myNick });
      console.log(`[VIEWER] 6. Respuesta de video enviada a ${from}`);
    } catch (err) {
      showModernAlert('Error manejando la oferta de video: ' + err, 'danger');
      console.error('[VIEWER] Error manejando la oferta:', err);
    }
  });

  // Broadcaster: recibe answer del viewer
  socket.on('video-answer', async (data) => {
    const { from, sdp } = data;
    console.log(`[BROADCASTER] 7. Respuesta de video recibida de ${from}`);
    const pc = peerConnections[from];
    if (pc) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        console.log(`[BROADCASTER] 8. Conexión establecida con ${from}`);
      } catch (err) {
        console.error('[BROADCASTER] Error estableciendo la descripción remota (answer):', err);
      }
    }
  });

  // Ambos lados: nuevo ICE
  socket.on('new-ice-candidate', async (data) => {
    const { from, candidate } = data;
    console.log(`[ICE] Candidato recibido de ${from}`);
    let pc;
    if (isBroadcasting) {
      pc = peerConnections[from];
    } else {
      pc = peerConnection;
    }
    if (pc) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error('Error adding received ICE candidate', err);
      }
    }
  });

  // Al recibir un mensaje en vivo, log visual y de consola
  socket.on('live-comment', (data) => {
    console.log('💬 [LIVE] Comentario recibido:', data); // Log para depurar
    if (!data || !data.from || !data.message) return; // Prevenir errores

    if (isBroadcasting && data.host === myNick) {
      // Soy el host
      addLiveMessage(data.from, data.message);
      showModernAlert('Nuevo mensaje en tu live de ' + data.from, 'info');
    } else if (!isBroadcasting && data.host === currentLiveHost) {
      addLiveMessage(data.from, data.message);
      showModernAlert('Nuevo mensaje en el live de ' + data.host, 'info');
    }
  });

  // --- FIN: Transmisión de video en vivo ---

  function updateShareLinks() {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent("¡Únete a la transmisión en vivo en Chat de Tilisarao! ");
    $('#shareWhatsapp').attr('href', `https://wa.me/?text=${text}${url}`);
    $('#shareFacebook').attr('href', `https://www.facebook.com/sharer/sharer.php?u=${url}`);
    $('#shareTwitter').attr('href', `https://twitter.com/intent/tweet?text=${text}&url=${url}`);
    $('#shareInstagram, #copyLink').on('click', function() {
      navigator.clipboard.writeText(window.location.href).then(() => {
        const notification = $(`<div class="position-fixed top-0 end-0 m-4 alert alert-modern alert-success animate__animated animate__slideInRight" style="z-index: 9999;"><i class="fas fa-check-circle me-2"></i>¡Enlace copiado al portapapeles!</div>`);
        $('body').append(notification);
        setTimeout(() => notification.remove(), 3000);
      });
    });
  }

  function createRandomParticle() {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.style.left = Math.random() * 100 + '%';
    particle.style.animationDelay = '0s';
    particle.style.animationDuration = (Math.random() * 4 + 4) + 's';
    const colors = ['rgba(255, 0, 110, 0.8)', 'rgba(139, 92, 246, 0.8)', 'rgba(6, 182, 212, 0.8)', 'rgba(16, 185, 129, 0.8)'];
    particle.style.background = colors[Math.floor(Math.random() * colors.length)];
    document.getElementById('particles').appendChild(particle);
    setTimeout(() => {
      if (particle.parentNode) {
        particle.parentNode.removeChild(particle);
      }
    }, 8000);
  }

  $(document).ready(function() {
    updateShareLinks();
    setInterval(createRandomParticle, 2000);
  });
});
