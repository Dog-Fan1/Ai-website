const API_BASE = '';
let currentChatId = null;
let currentUsername = null;
let hasChatted = false;
let isAdmin = false;

const renderer = new marked.Renderer();

renderer.code = (code, lang) => {
    const language = hljs.getLanguage(lang) ? lang : 'plaintext';
    const highlightedCode = hljs.highlight(code, { language }).value;
    return `<pre><code class="hljs language-${language}">${highlightedCode}</code></pre>`;
};

marked.setOptions({
    renderer: renderer,
    gfm: true,
    breaks: true,
    sanitize: true,
    silent: true
});

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function safeMarkdownParse(text) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1000);
        const result = marked.parse(text, { signal: controller.signal });
        clearTimeout(timeout);
        return result;
    } catch (e) {
        return escapeHtml(text);
    }
}

function renderHistory(history) {
    const chatDiv = document.getElementById('chatHistory');
    chatDiv.innerHTML = '';
    if (!history || history.length === 0) {
        chatDiv.innerHTML = '<em>Start the conversation!</em>';
        return;
    }
    history.forEach(msg => {
        if (msg.role === "user") {
            chatDiv.innerHTML += `<div class="user-msg">You: ${safeMarkdownParse(msg.content)}</div>`;
        } else if (msg.role === "assistant") {
            chatDiv.innerHTML += `<div class="assistant-msg">AmberMind: ${safeMarkdownParse(msg.content)}</div>`;
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
    hasChatted = false;
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
        showGreeting();
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

function showGreeting() {
    const header = document.getElementById('greetingHeader');
    if (currentUsername && !hasChatted) {
        header.textContent = `Hi ${currentUsername}!`;
        header.style.display = "block";
    }
}

function hideGreeting() {
    document.getElementById('greetingHeader').style.display = "none";
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
            currentUsername = document.getElementById('signup-username').value;
            updateChatList();
            selectChat(currentChatId);
            document.getElementById('logoutBtn').disabled = false;
            document.getElementById('newChatBtn').disabled = false;
            showGreeting();
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
            currentUsername = document.getElementById('login-username').value;
            isAdmin = data.is_admin;
            renderChats(data.chats);
            selectChat(currentChatId);
            document.getElementById('logoutBtn').disabled = false;
            document.getElementById('newChatBtn').disabled = false;
            showGreeting();
            if (isAdmin) {
                showAdminTab();
            }
        }
    });
};

document.getElementById('chatBtn').onclick = function() {
    sendPrompt();
};

const promptInput = document.getElementById('promptInput');
promptInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        if (!promptInput.disabled && !document.getElementById('chatBtn').disabled) {
            sendPrompt();
        }
    }
});

function sendPrompt() {
    const prompt = promptInput.value.trim();
    if (!currentChatId || !prompt) return;
    fetch(`${API_BASE}/chat/${currentChatId}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({prompt}),
        credentials: 'include'
    })
    .then(r => r.json())
    .then(data => {
        hasChatted = true;
        hideGreeting();
        renderHistory(data.history);
        updateChatList();
        promptInput.value = '';
    });
}

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
        currentUsername = null;
        hasChatted = false;
        isAdmin = false;
        document.getElementById('greetingHeader').textContent = "Welcome to AmberMind!";
        document.getElementById('greetingHeader').style.display = "block";
        document.getElementById('adminTab').style.display = "none";
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
            hasChatted = false;
            updateChatList();
            selectChat(currentChatId);
            showGreeting();
        }
    });
};

function showAdminTab() {
    const adminTab = document.getElementById('adminTab');
    adminTab.style.display = "block";
    fetch(`${API_BASE}/admin`, {
        method: 'GET',
        credentials: 'include'
    })
    .then(r => r.json())
    .then(data => {
        if (data.users) {
            let html = "<b>Users:</b><ul>";
            data.users.forEach(u => {
                html += `<li>${u} (${data.chat_stats[u]} chats)</li>`;
            });
            html += "</ul>";
            document.getElementById('adminContent').innerHTML = html;
        } else {
            document.getElementById('adminContent').textContent = data.error || "No data";
        }
    });
}
