const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 10 * 1024 * 1024 // Batas ukuran file gambar max 10MB
});

// Penyimpanan data sementara di memori (Server)
const users = {}; // { socketId: username }
const messages = []; // [{ sender, recipient, message, type, time }]

app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Web Chat</title>
  <script src="/socket.io/socket.io.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    body { background-color: #d1d7db; display: flex; justify-content: center; align-items: center; height: 100vh; }
    
    /* Login Modal */
    #login-screen { position: fixed; inset: 0; background: #111b21; display: flex; justify-content: center; align-items: center; z-index: 100; }
    .login-box { background: #222e35; padding: 25px; border-radius: 8px; width: 90%; max-width: 350px; text-align: center; color: #e9edef; }
    .login-box h2 { margin-bottom: 15px; font-weight: 500; }
    .login-box input { width: 100%; padding: 12px; border-radius: 5px; border: none; background: #2a3942; color: #fff; margin-bottom: 15px; outline: none; }
    .login-box button { width: 100%; padding: 12px; border: none; border-radius: 5px; background: #00a884; color: #fff; font-weight: bold; cursor: pointer; }

    /* Main Layout */
    .app-container { width: 100%; max-width: 1000px; height: 100vh; background: #fff; display: flex; overflow: hidden; }
    @media (min-width: 768px) { .app-container { height: 95vh; border-radius: 5px; box-shadow: 0 1px 3px rgba(0,0,0,0.3); } }

    /* Sidebar (Daftar Kontak) */
    .sidebar { width: 30%; background: #fff; border-right: 1px solid #e9edef; display: flex; flex-direction: column; }
    .sidebar-header { height: 60px; background: #f0f2f5; display: flex; align-items: center; gap: 12px; padding: 0 15px; font-weight: bold; color: #54656f; border-bottom: 1px solid #e9edef; }
    .user-list { flex: 1; overflow-y: auto; }
    .user-item { padding: 12px 15px; border-bottom: 1px solid #f0f2f5; cursor: pointer; display: flex; align-items: center; gap: 12px; }
    .user-item:hover, .user-item.active { background: #f0f2f5; }

    /* Avatar Inisial */
    .avatar { width: 40px; height: 40px; border-radius: 50%; background: #00a884; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 16px; flex-shrink: 0; text-transform: uppercase; }
    
    /* Chat Area */
    .chat-area { width: 70%; display: flex; flex-direction: column; background: #efeae2; }
    .chat-header { height: 60px; background: #f0f2f5; display: flex; align-items: center; gap: 12px; padding: 0 20px; font-weight: 500; color: #111b21; border-bottom: 1px solid #e9edef; }
    .messages-container { flex: 1; padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
    
    /* Bubble Chat */
    .message { max-width: 65%; padding: 8px 12px; border-radius: 7.5px; font-size: 14px; line-height: 19px; position: relative; word-wrap: break-word; }
    .message.sent { background: #d9fdd3; align-self: flex-end; border-top-right-radius: 0; }
    .message.received { background: #ffffff; align-self: flex-start; border-top-left-radius: 0; }
    .message .time { font-size: 10px; color: #667781; float: right; margin: 4px 0 -2px 8px; }
    .message img { max-width: 100%; border-radius: 5px; margin-bottom: 4px; cursor: pointer; display: block; }

    /* Input Area */
    .input-area { height: 62px; background: #f0f2f5; display: flex; align-items: center; padding: 5px 10px; gap: 10px; }
    .input-area input[type="text"] { flex: 1; height: 42px; border: none; border-radius: 8px; padding: 0 15px; font-size: 15px; outline: none; }
    .input-area button.send-btn { background: #00a884; color: white; border: none; padding: 10px 18px; border-radius: 8px; font-weight: bold; cursor: pointer; }
    .file-btn { background: transparent; border: none; font-size: 22px; cursor: pointer; color: #54656f; padding: 0 5px; }
    
    .placeholder-chat { flex: 1; display: flex; justify-content: center; align-items: center; color: #667781; background: #f0f2f5; text-align: center; }
  </style>
</head>
<body>

  <div id="login-screen">
    <div class="login-box">
      <h2>Masuk WhatsApp</h2>
      <input type="text" id="username-input" placeholder="Masukkan Nama / Username..." autofocus />
      <button onclick="login()">MASUK</button>
    </div>
  </div>

  <div class="app-container">
    <div class="sidebar">
      <div class="sidebar-header" id="my-profile">
        <div class="avatar" id="my-avatar">-</div>
        <span id="my-name">Saya: -</span>
      </div>
      <div class="user-list" id="user-list"></div>
    </div>

    <div class="chat-area">
      <div class="chat-header" id="chat-header" style="display:none;">
        <div class="avatar" id="chat-avatar">?</div>
        <span id="chat-recipient-name">Pilih kontak untuk memulai chat</span>
      </div>
      <div id="default-header" class="chat-header">Pilih kontak untuk memulai chat</div>
      
      <div class="messages-container" id="messages-container">
        <div class="placeholder-chat">
          <p>Kirim dan terima pesan teks serta gambar secara real-time.</p>
        </div>
      </div>

      <div class="input-area" id="input-area" style="display: none;">
        <input type="file" id="image-input" accept="image/*" style="display: none;" onchange="sendImage(event)" />
        <button class="file-btn" onclick="document.getElementById('image-input').click()" title="Kirim Gambar">📎</button>
        <input type="text" id="message-input" placeholder="Ketik pesan..." onkeypress="handleKeyPress(event)" />
        <button class="send-btn" onclick="sendMessage()">KIRIM</button>
      </div>
    </div>
  </div>

  <script>
    const socket = io();
    let currentUser = "";
    let activeRecipient = "";

    // Warna background avatar acak agar menarik
    const colors = ['#00a884', '#025144', '#128c7e', '#25d366', '#34b7f1', '#005c4b'];
    function getAvatarColor(name) {
      let hash = 0;
      for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
      return colors[Math.abs(hash) % colors.length];
    }

    function login() {
      const input = document.getElementById('username-input');
      const username = input.value.trim();
      if (username) {
        currentUser = username;
        document.getElementById('my-name').innerText = currentUser;
        
        const myAvatar = document.getElementById('my-avatar');
        myAvatar.innerText = currentUser.charAt(0);
        myAvatar.style.background = getAvatarColor(currentUser);

        document.getElementById('login-screen').style.display = 'none';
        socket.emit('register_user', currentUser);
      }
    }

    socket.on('update_user_list', (usersList) => {
      const userListEl = document.getElementById('user-list');
      userListEl.innerHTML = "";

      usersList.forEach(user => {
        if (user !== currentUser) {
          const div = document.createElement('div');
          div.className = \`user-item \${user === activeRecipient ? 'active' : ''}\`;
          div.onclick = () => selectUser(user);
          
          const initial = user.charAt(0);
          const bgColor = getAvatarColor(user);

          div.innerHTML = \`
            <div class="avatar" style="background: \${bgColor}">\${initial}</div>
            <span>\${user}</span>
          \`;
          userListEl.appendChild(div);
        }
      });
    });

    function selectUser(username) {
      activeRecipient = username;
      
      document.getElementById('default-header').style.display = 'none';
      const chatHeader = document.getElementById('chat-header');
      chatHeader.style.display = 'flex';
      
      document.getElementById('chat-recipient-name').innerText = username;
      const chatAvatar = document.getElementById('chat-avatar');
      chatAvatar.innerText = username.charAt(0);
      chatAvatar.style.background = getAvatarColor(username);

      document.getElementById('input-area').style.display = 'flex';
      
      document.querySelectorAll('.user-item').forEach(el => {
        el.classList.toggle('active', el.innerText.includes(username));
      });

      socket.emit('get_chat_history', { sender: currentUser, recipient: activeRecipient });
    }

    function sendMessage() {
      const input = document.getElementById('message-input');
      const text = input.value.trim();

      if (text && activeRecipient) {
        const msgData = {
          sender: currentUser,
          recipient: activeRecipient,
          message: text,
          type: 'text',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        socket.emit('send_private_message', msgData);
        appendMessage(msgData, 'sent');
        input.value = '';
      }
    }

    function sendImage(event) {
      const file = event.target.files[0];
      if (file && activeRecipient) {
        const reader = new FileReader();
        reader.onload = function(e) {
          const msgData = {
            sender: currentUser,
            recipient: activeRecipient,
            message: e.target.result, // Base64 string gambar
            type: 'image',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };

          socket.emit('send_private_message', msgData);
          appendMessage(msgData, 'sent');
        };
        reader.readAsDataURL(file);
      }
      event.target.value = ''; // Reset input file
    }

    function handleKeyPress(e) {
      if (e.key === 'Enter') sendMessage();
    }

    socket.on('receive_private_message', (data) => {
      if (data.sender === activeRecipient) {
        appendMessage(data, 'received');
      } else {
        alert("Pesan baru dari " + data.sender);
      }
    });

    socket.on('load_chat_history', (chatHistory) => {
      const container = document.getElementById('messages-container');
      container.innerHTML = "";

      chatHistory.forEach(msg => {
        const type = msg.sender === currentUser ? 'sent' : 'received';
        appendMessage(msg, type);
      });
    });

    function appendMessage(data, type) {
      const container = document.getElementById('messages-container');
      
      if (container.querySelector('.placeholder-chat')) {
        container.innerHTML = "";
      }

      const msgDiv = document.createElement('div');
      msgDiv.className = \`message \${type}\`;
      
      let content = "";
      if (data.type === 'image') {
        content = \`<img src="\${data.message}" alt="Gambar" />\`;
      } else {
        content = data.message;
      }

      msgDiv.innerHTML = \`
        \${content}
        <span class="time">\${data.time}</span>
      \`;
      
      container.appendChild(msgDiv);
      container.scrollTop = container.scrollHeight;
    }
  </script>
</body>
</html>
  `);
});

io.on('connection', (socket) => {
  socket.on('register_user', (username) => {
    users[socket.id] = username;
    io.emit('update_user_list', Object.values(users));
  });

  socket.on('get_chat_history', ({ sender, recipient }) => {
    const history = messages.filter(
      m => (m.sender === sender && m.recipient === recipient) || 
           (m.sender === recipient && m.recipient === sender)
    );
    socket.emit('load_chat_history', history);
  });

  socket.on('send_private_message', (data) => {
    messages.push(data);
    const recipientSocketId = Object.keys(users).find(key => users[key] === data.recipient);
    
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('receive_private_message', data);
    }
  });

  socket.on('disconnect', () => {
    delete users[socket.id];
    io.emit('update_user_list', Object.values(users));
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});