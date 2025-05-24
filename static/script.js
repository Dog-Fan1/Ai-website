const API_BASE = '';

let currentChatId = null;

function renderHistory(history) {
  const chatDiv = document.getElementById('chatHistory');
  chatDiv.innerHTML = '';
  if (!history || history.length === 0) {
    chatDiv.innerHTML = '<em>Start the conversation!</em>';
    return;
  }
  history.forEach(msg => {
    if (msg.role === "user") {
      chatDiv.innerHTML += `<div class="user-msg">You: ${msg.content}</div>`;
    } else if (msg.role === "assistant") {
      chatDiv.innerHTML += `<div class="assistant-msg">AI: ${msg.content}</div>`;
    }
  });
  chatDiv.scrollTop = chatDiv.scrollHeight;
}

function renderChats(chats) {
  const chatList = document.getElementById('chatList');
  chatList.innerHTML = '';
  chats.forEach(chat => {
    const li = document.createElement('li');
    li.textContent = chat.title || "New Chat";
    li.className = chat.chat_id === currentChatId ? "selected" : "";
    li.onclick = () => selectChat(chat.chat_id);
    chatList.appendChild(li);
  });
}

function selectChat(chat_id) {
  currentChatId = chat_id;
  fetch(`${API_BASE}/history/${chat_id}`, {
    method: 'GET',
    credentials: 'include'
  })
  .then(r => r.json())
  .then(data => {
    renderHistory(data.history);
    updateChatList();
    document.getElementById('promptInput').disabled = false;
    document.getElementById('chatBtn').disabled = false;
  });
}

function updateChatList() {
  fetch(`${API_BASE}/chats`, {
    method: 'GET',
    credentials: 'include'
  })
  .then(r => r.json())
  .then(data => {
    if (data.chats) renderChats(data.chats);
  });
}

document.getElementById('signupBtn').onclick = function() {
  fetch(`${API_BASE}/signup`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      username: document.getElementById('signup-username').value,
      password: document.getElementById('signup-password').value
    }),
    credentials: 'include'
  })
  .then(r => r.json())
  .then(data => {
    document.getElementById('signup-result').textContent = data.message || data.error;
    if (data.chat_id) {
      currentChatId = data.chat_id;
      updateChatList();
      selectChat(currentChatId);
    }
  });
};

document.getElementById('loginBtn').onclick = function() {
  fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      username: document.getElementById('login-username').value,
      password: document.getElementById('login-password').value
    }),
    credentials: 'include'
  })
  .then(r => r.json())
  .then(data => {
    document.getElementById('login-result').textContent = data.message || data.error;
    if (data.chats && data.chats.length > 0) {
      currentChatId = data.chats[0].chat_id;
      renderChats(data.chats);
      selectChat(currentChatId);
      document.getElementById('logoutBtn').disabled = false;
      document.getElementById('newChatBtn').disabled = false;
    }
  });
};

document.getElementById('chatBtn').onclick = function() {
  const prompt = document.getElementById('promptInput').value.trim();
  if (!currentChatId) return;
  fetch(`${API_BASE}/chat/${currentChatId}`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({prompt}),
    credentials: 'include'
  })
  .then(r => r.json())
  .then(data => {
    renderHistory(data.history);
    updateChatList();
    document.getElementById('promptInput').value = '';
  });
};

document.getElementById('logoutBtn').onclick = function() {
  fetch(`${API_BASE}/logout`, {
    method: 'POST',
    credentials: 'include'
  }).then(r => r.json())
  .then(data => {
    document.getElementById('promptInput').disabled = true;
    document.getElementById('chatBtn').disabled = true;
    document.getElementById('logoutBtn').disabled = true;
    document.getElementById('newChatBtn').disabled = true;
    renderHistory([]);
    renderChats([]);
    currentChatId = null;
  });
};

document.getElementById('newChatBtn').onclick = function() {
  fetch(`${API_BASE}/new_chat`, {
    method: 'POST',
    credentials: 'include'
  })
  .then(r => r.json())
  .then(data => {
    if (data.chat_id) {
      currentChatId = data.chat_id;
      updateChatList();
      selectChat(currentChatId);
    }
  });
};
