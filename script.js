document.getElementById('signupBtn').onclick = function() {
  fetch('/signup', {
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
  fetch('/login', {
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
    }
  });
};

document.getElementById('chatBtn').onclick = function() {
  const prompt = document.getElementById('promptInput').value.trim();
  fetch('/chat', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({prompt}),
    credentials: 'include'
  })
  .then(r => r.json())
  .then(data => {
    document.getElementById('chatResult').textContent = data.response || data.error;
  });
};

document.getElementById('logoutBtn').onclick = function() {
  fetch('/logout', {
    method: 'POST',
    credentials: 'include'
  }).then(r => r.json())
    .then(data => {
      document.getElementById('promptInput').disabled = true;
      document.getElementById('chatBtn').disabled = true;
      document.getElementById('logoutBtn').disabled = true;
      document.getElementById('chatResult').textContent = '';
    });
};
