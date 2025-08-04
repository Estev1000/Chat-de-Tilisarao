// Configuración de Supabase
const SUPABASE_URL = 'https://xzqlatpbhcqiortutwkt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6cWxhdHBiaGNxaW9ydHV0d2t0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxNTY5OTcsImV4cCI6MjA2OTczMjk5N30.ojEtVoM-tBZ5MdXTmAOJKR9Rx6A2ZoX6h-6dgNPAAHc';

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Estado de la aplicación
let currentUser = null;

// Inicialización de la aplicación
$(function () {
  // Referencias a elementos del formulario
  const $nickname = $('#nickname');
  const $password = $('#password');
  const $loginBtn = $('#loginBtn');
  const $registerBtn = $('#registerBtn');
  const $nickError = $('#nickError');
  const $confirmPassword = $('#confirmPassword');
  const $confirmPasswordGroup = $('#confirmPasswordGroup');
  const $toggleAuthBtn = $('#toggleAuthBtn');
  const $messageInput = $('#messageInput');
  const $sendMessageBtn = $('#sendMessageBtn');
  const $chatMessages = $('#chatMessages');
  const $userList = $('#userList');
  const $contentWrap = $('#contentWrap');
  const $nickWrap = $('#nickWrap');
  
  // Estado del formulario (login/registro)
  let isLoginMode = true;
  
  // Inicializar la aplicación
  initApp();
  
  // Función para inicializar la aplicación
  async function initApp() {
    // Verificar si el usuario ya está autenticado
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (session) {
      // Usuario ya autenticado
      currentUser = session.user;
      showChatInterface();
      setupRealtimeUpdates();
    } else {
      // Mostrar formulario de inicio de sesión
      showLoginForm();
    }
  }
  
  // Función para configurar actualizaciones en tiempo real
  function setupRealtimeUpdates() {
    // Suscribirse a nuevos mensajes
    const messagesSubscription = supabase
      .channel('public:messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          addMessageToChat(payload.new);
        }
      )
      .subscribe();
      
    // Suscribirse a cambios en usuarios conectados
    const usersSubscription = supabase
      .channel('online_users')
      .on('presence', { event: 'sync' }, () => {
        const state = usersSubscription.presenceState();
        updateUserList(state);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('Nuevo usuario conectado:', newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('Usuario desconectado:', leftPresences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await usersSubscription.track({ 
            user_id: currentUser.id, 
            username: currentUser.user_metadata?.username || 'Anónimo',
            online_at: new Date().toISOString()
          });
        }
      });
  }
  
  // Función para alternar entre login y registro
  function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    if (isLoginMode) {
      $loginBtn.show();
      $registerBtn.hide();
      $confirmPasswordGroup.hide();
      $toggleAuthBtn.text('¿No tienes una cuenta? Regístrate');
    } else {
      $loginBtn.hide();
      $registerBtn.show();
      $confirmPasswordGroup.show();
      $toggleAuthBtn.text('¿Ya tienes una cuenta? Inicia sesión');
    }
    $nickError.empty();
  }
  
  // Manejador para alternar entre login/registro
  $toggleAuthBtn.on('click', toggleAuthMode);
  
  // Manejador para el botón de registro
  async function handleRegister() {
    const nickname = $nickname.val()?.trim() || '';
    const password = $password.val() || '';
    const confirmPassword = $confirmPassword.val() || '';
    
    if (!nickname || !password) {
      showError('Por favor ingresa un nombre de usuario y contraseña.');
      return;
    }
    
    if (password.length < 6) {
      showError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    
    if (password !== confirmPassword) {
      showError('Las contraseñas no coinciden');
      return;
    }
    
    try {
      // Registrar usuario en Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email: `${nickname}@tilisarao.com`,
        password: password,
        options: {
          data: {
            username: nickname
          }
        }
      });
      
      if (error) throw error;
      
      // Iniciar sesión automáticamente después del registro
      await handleLogin();
      
    } catch (error) {
      console.error('Error al registrar:', error);
      showError(error.message || 'Error al registrar el usuario');
    }
  }
  
  // Manejador para el botón de registro
  $registerBtn.on('click', handleRegister);
  
  // Manejador para el botón de inicio de sesión
  async function handleLogin() {
    const nickname = $nickname.val()?.trim() || '';
    const password = $password.val() || '';
    
    if (!nickname || !password) {
      showError('Por favor ingresa un nombre de usuario y contraseña.');
      return;
    }
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: `${nickname}@tilisarao.com`,
        password: password
      });
      
      if (error) throw error;
      
      currentUser = data.user;
      showChatInterface();
      setupRealtimeUpdates();
      
    } catch (error) {
      console.error('Error al iniciar sesión:', error);
      showError('Usuario o contraseña incorrectos');
    }
  }
  
  // Manejador para el botón de inicio de sesión
  $loginBtn.on('click', handleLogin);
  
  // Función para mostrar mensajes en el chat
  function addMessageToChat(message) {
    const messageElement = `
      <div class="message ${message.user_id === currentUser?.id ? 'message-sent' : 'message-received'}">
        <div class="message-sender">${message.username}</div>
        <div class="message-content">${message.content}</div>
        <div class="message-time">${formatTime(message.created_at)}</div>
      </div>
    `;
    $chatMessages.append(messageElement);
    $chatMessages.scrollTop($chatMessages[0].scrollHeight);
  }
  
  // Función para actualizar la lista de usuarios
  function updateUserList(usersState) {
    $userList.empty();
    const users = Object.values(usersState).flat();
    
    users.forEach(user => {
      if (user.user_id !== currentUser?.id) {
        const userElement = `
          <div class="user-item">
            <span class="user-status online"></span>
            <span class="username">${user.username}</span>
          </div>
        `;
        $userList.append(userElement);
      }
    });
  }
  
  // Función para enviar mensajes
  async function sendMessage() {
    const content = $messageInput.val().trim();
    if (!content || !currentUser) return;
    
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert([{
          content: content,
          user_id: currentUser.id,
          username: currentUser.user_metadata?.username || 'Anónimo'
        }]);
        
      if (error) throw error;
      
      $messageInput.val('');
      
    } catch (error) {
      console.error('Error al enviar mensaje:', error);
      showError('Error al enviar el mensaje');
    }
  }
  
  // Función para mostrar el formulario de inicio de sesión
  function showLoginForm() {
    $contentWrap.hide();
    $nickWrap.show();
    $loginBtn.show();
    $registerBtn.hide();
    $confirmPasswordGroup.hide();
    $toggleAuthBtn.text('¿No tienes una cuenta? Regístrate');
  }
  
  // Función para mostrar la interfaz del chat
  function showChatInterface() {
    $nickWrap.hide();
    $contentWrap.show();
  }
  
  // Función para formatear la hora
  function formatTime(timestamp) {
    return moment(timestamp).format('HH:mm');
  }
  
  // Función para mostrar errores
  function showError(message) {
    $nickError.html(`<div class="alert alert-danger">${message}</div>`);
  }
  
  // Manejador para el botón de enviar mensaje
  $sendMessageBtn.on('click', sendMessage);
  
  // Enviar mensaje al presionar Enter
  $messageInput.on('keypress', function(e) {
    if (e.which === 13) { // Enter key
      sendMessage();
    }
  });
  
  // Cerrar sesión
  $('#logoutBtn').on('click', async function() {
    await supabase.auth.signOut();
    currentUser = null;
    showLoginForm();
  });

  // --- FUNCIONES DE CONEXIÓN ---
  function connectSocket() {
    // Ya no necesitamos Socket.IO, pero mantenemos la función para compatibilidad
    return {
      emit: () => {},
      on: () => {},
      disconnect: () => {}
    };
  }

  const socket = connectSocket();

  // --- UTILIDADES COMPARTIR ---
  function generateLiveLink(host) {
    return `${window.location.origin}?host=${encodeURIComponent(host)}`;
  }

  function copyTextToClipboard(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    const filesArray = [new File([blob], 'live.png', { type: 'image/png' })];
    if (navigator.canShare && navigator.canShare({ files: filesArray })) {
      await navigator.share({ files: filesArray, text: 'Mira mi directo', url: link });
    } else {
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    }
    copyTextToClipboard(link);
  });
  // ...el resto de setupShareButtons permanece igual...
    
  $loginBtn.on('click', async function() {
    const nickname = $nickname.val().trim();
    if (!nickname || !password) {
      $nickError.html('<div class="alert alert-danger">Completa usuario y contraseña</div>');
      return;
    }
    try {
      const fakeEmail = `${nickname}@tilisarao.local`;
      const { data, error } = await supabase.auth.signInWithPassword({
        email: fakeEmail,
        password
      });
      if (error) throw error;
      connectUserToChat(nickname);
    } catch (error) {
      console.error('Error en el inicio de sesión:', error);
      $nickError.html(`<div class="alert alert-danger">${error.message || 'Error en el inicio de sesión'}</div>`);
    }
  });
    // ...

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
  async function connectUserToChat(nick) {
    console.log('Conectando usuario:', nick);
    
    // Resetear datos del usuario actual
    currentUser = {
      nickname: null,
      followersCount: 0,
      followingCount: 0,
      followingList: [],
      followersList: []
    };
    
    try {
      // Verificar si el usuario ya está en uso
      const { data: existingUser, error: userError } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', nick)
        .single();
      
      if (userError && userError.code !== 'PGRST116') { // PGRST116 = no se encontraron resultados
        throw userError;
      }
      
      if (existingUser) {
        // Verificar si el usuario actual es el mismo que está intentando conectarse
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || existingUser.id !== user.id) {
          alert('¡El nombre de usuario ya está en uso!');
          return;
        }
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
      
      // Configurar el usuario en el socket
      socket.emit('new user', nick, function(valid) {
        if (!valid) {
          alert('¡Error al conectar con el servidor de chat!');
          return;
        }
        
        console.log('Solicitando datos de seguidores para:', nick);
        // Solicitar datos de seguidores
        socket.emit('get-followers-data', { user: nick });
      });
      
    } catch (error) {
      console.error('Error al conectar al chat:', error);
      alert('Error al conectar al chat. Por favor, inténtalo de nuevo.');
      clearSession();
    }
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


