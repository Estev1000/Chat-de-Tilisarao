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
      loadMessages();
    } else {
      // Mostrar formulario de inicio de sesión
      showLoginForm();
    }
  }
  
  // Función para cargar mensajes iniciales
  async function loadMessages() {
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(50);
    
    if (error) {
      console.error('Error al cargar mensajes:', error);
      return;
    }
    
    // Mostrar mensajes en el chat
    messages.forEach(message => addMessageToChat(message));
  }
  
  // Función para configurar actualizaciones en tiempo real
  function setupRealtimeUpdates() {
    // Suscribirse a nuevos mensajes
    const messagesSubscription = supabase
      .channel('public:messages')
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages',
          filter: 'channel=eq.public' // Solo mensajes del canal público
        },
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
        if (status === 'SUBSCRIBED' && currentUser) {
          await usersSubscription.track({ 
            user_id: currentUser.id, 
            username: currentUser.user_metadata?.username || 'Anónimo',
            online_at: new Date().toISOString(),
            avatar: currentUser.user_metadata?.avatar_url || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'
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
    
    // Validaciones
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
            username: nickname,
            avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(nickname)}&background=random`
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
      loadMessages();
      
    } catch (error) {
      console.error('Error al iniciar sesión:', error);
      showError('Usuario o contraseña incorrectos');
    }
  }
  
  // Manejador para el botón de inicio de sesión
  $loginBtn.on('click', handleLogin);
  
  // Función para mostrar mensajes en el chat
  function addMessageToChat(message) {
    const isCurrentUser = message.user_id === currentUser?.id;
    const messageElement = `
      <div class="message ${isCurrentUser ? 'message-sent' : 'message-received'}">
        <div class="message-header">
          <span class="message-sender">${message.username || 'Anónimo'}</span>
          <span class="message-time">${formatTime(message.created_at)}</span>
        </div>
        <div class="message-content">${message.content}</div>
      </div>
    `;
    $chatMessages.append(messageElement);
    $chatMessages.scrollTop($chatMessages[0].scrollHeight);
  }
  
  // Función para actualizar la lista de usuarios
  function updateUserList(usersState) {
    $userList.empty();
    const users = Object.values(usersState).flat();
    
    // Agregar el usuario actual primero
    if (currentUser) {
      const currentUserElement = `
        <div class="user-item current-user">
          <span class="user-status online"></span>
          <span class="username">${currentUser.user_metadata?.username || 'Tú'}</span>
        </div>
      `;
      $userList.append(currentUserElement);
    }
    
    // Agregar otros usuarios
    users.forEach(user => {
      if (user.user_id !== currentUser?.id) {
        const userElement = `
          <div class="user-item">
            <span class="user-status online"></span>
            <span class="username">${user.username || 'Usuario'}</span>
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
          username: currentUser.user_metadata?.username || 'Anónimo',
          channel: 'public', // Canal público por defecto
          created_at: new Date().toISOString()
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
    $messageInput.focus();
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
  
  // Función para copiar texto al portapapeles
  function copyTextToClipboard(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    
    // Mostrar notificación
    const notification = document.createElement('div');
    notification.className = 'copy-notification';
    notification.textContent = '¡Enlace copiado al portapapeles!';
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 2000);
  }
  
  // Inicializar tooltips de Bootstrap
  $('[data-bs-toggle="tooltip"]').tooltip();
});
