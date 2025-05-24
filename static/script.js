const API_BASE = '';

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
  .then(data => document.getElementById('signup-result').textContent = data.message || data.error);
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
    if (data.message) {
      document.getElementById('promptInput').disabled = false;
      document.getElementById('chatBtn').disabled = false;
      document.getElementById('logoutBtn').disabled = false;
      // Load history after login
      renderHistory([]);
    }
  });
};

document.getElementById('chatBtn').onclick = function() {
  const prompt = document.getElementById('promptInput').value.trim();
  fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({prompt}),
    credentials: 'include'
  })
  .then(r => r.json())
  .then(data => {
    renderHistory(data.history);
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
    renderHistory([]);
  });
};
