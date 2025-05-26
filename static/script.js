const API_BASE = '';

let currentChatId = null;
let currentUsername = null;
let hasChatted = false;
let isAdmin = false;

document.addEventListener('DOMContentLoaded', function() {
    hljs.highlightAll();
});

const renderer = new marked.Renderer();

renderer.code = function(code, lang) {
    const validLang = hljs.getLanguage(lang) ? lang : 'plaintext';
    let highlightedCode;
    try {
        highlightedCode = hljs.highlight(code, { language: validLang }).value;
    } catch (e) {
        // Ensure 'code' is treated as a string before using string methods
        highlightedCode = String(code).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    return `
        <div class="relative my-4 rounded-lg bg-gray-800 group">
            <button class="copy-btn absolute right-2 top-2 px-2 py-1 bg-gray-700 text-white rounded-md text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50">Copy</button>
            <pre class="overflow-x-auto p-4 rounded-lg"><code class="hljs language-${validLang} font-mono text-gray-300 text-sm leading-relaxed">${highlightedCode}</code></pre>
        </div>
    `;
};

marked.setOptions({
    renderer: renderer,
    gfm: true,
    breaks: true,
    sanitize: false,
    silent: true
});

function renderHistory(history) {
    const chatDiv = document.getElementById('chatHistory');
    chatDiv.innerHTML = '';

    if (!history || history.length === 0) {
        chatDiv.innerHTML = '<em class="text-orange-800 text-center w-full block">Start the conversation!</em>';
        return;
    }

    history.forEach(msg => {
        const contentHtml = marked.parse(msg.content);
        let messageHtml = '';

        if (msg.role === "user") {
            messageHtml = `<div class="user-msg bg-orange-200 p-3 rounded-xl mb-3 self-end text-orange-900 max-w-[85%] shadow-sm">${contentHtml}</div>`;
        } else if (msg.role === "assistant") {
            messageHtml = `<div class="assistant-msg bg-orange-100 p-3 rounded-xl mb-3 self-start text-orange-900 max-w-[85%] shadow-sm">${contentHtml}</div>`;
        }
        chatDiv.innerHTML += messageHtml;
    });

    chatDiv.querySelectorAll('.copy-btn').forEach(button => {
        const codeContainer = button.closest('.group');
        const codeBlock = codeContainer.querySelector('code');

        button.onclick = function() {
            const textArea = document.createElement('textarea');
            textArea.value = codeBlock.textContent;
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                button.textContent = 'Copied!';
                setTimeout(() => button.textContent = 'Copy', 2000);
            } catch (err) {
                console.error('Failed to copy text: ', err);
                button.textContent = 'Error!';
            } finally {
                document.body.removeChild(textArea);
            }
        };
    });

    chatDiv.scrollTop = chatDiv.scrollHeight;
}

function renderChats(chats) {
    const chatList = document.getElementById('chatList');
    chatList.innerHTML = '';

    chats.forEach(chat => {
        const li = document.createElement('li');
        li.textContent = chat.title || "New Chat";
        li.className = `bg-orange-50 mb-1 p-2 rounded-lg cursor-pointer text-orange-800 transition-colors border-2 border-transparent ${chat.chat_id === currentChatId ? "bg-orange-200 border-orange-500" : "hover:bg-orange-100"}`;
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
    })
    .catch(error => console.error('Error fetching chat history:', error));
}

function updateChatList() {
    fetch(`${API_BASE}/chats`, {
        method: 'GET',
        credentials: 'include'
    })
    .then(r => r.json())
    .then(data => {
        if (data.chats) renderChats(data.chats);
    })
    .catch(error => console.error('Error fetching chat list:', error));
}

function showGreeting() {
    const header = document.getElementById('greetingHeader');
    if (currentUsername && !hasChatted) {
        header.textContent = `Hi ${currentUsername}!`;
        header.classList.remove('hidden');
    } else {
        header.classList.add('hidden');
    }
}

function hideGreeting() {
    document.getElementById('greetingHeader').classList.add('hidden');
}

document.getElementById('signupBtn').onclick = function() {
    const signupUsername = document.getElementById('signup-username').value;
    const signupPassword = document.getElementById('signup-password').value;

    fetch(`${API_BASE}/signup`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            username: signupUsername,
            password: signupPassword
        }),
        credentials: 'include'
    })
    .then(r => r.json())
    .then(data => {
        document.getElementById('signup-result').textContent = data.message || data.error;
        if (data.chat_id) {
            currentChatId = data.chat_id;
            currentUsername = signupUsername;
            updateChatList();
            selectChat(currentChatId);
            document.getElementById('logoutBtn').disabled = false;
            document.getElementById('newChatBtn').disabled = false;
            showGreeting();
            document.getElementById('login-username').value = '';
            document.getElementById('login-password').value = '';
            document.getElementById('signup-password').value = '';
        }
    })
    .catch(error => console.error('Error during signup:', error));
};

document.getElementById('loginBtn').onclick = function() {
    const loginUsername = document.getElementById('login-username').value;
    const loginPassword = document.getElementById('login-password').value;

    fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            username: loginUsername,
            password: loginPassword
        }),
        credentials: 'include'
    })
    .then(r => r.json())
    .then(data => {
        document.getElementById('login-result').textContent = data.message || data.error;
        if (data.chats && data.chats.length > 0) {
            currentChatId = data.chats[0].chat_id;
            currentUsername = loginUsername;
            isAdmin = data.is_admin;
            renderChats(data.chats);
            selectChat(currentChatId);
            document.getElementById('logoutBtn').disabled = false;
            document.getElementById('newChatBtn').disabled = false;
            showGreeting();
            document.getElementById('signup-username').value = '';
            document.getElementById('signup-password').value = '';
            document.getElementById('login-password').value = '';
            if (isAdmin) {
                showAdminTab();
            }
        } else if (data.message === "Login successful, but no chats found.") {
            currentUsername = loginUsername;
            isAdmin = data.is_admin;
            document.getElementById('logoutBtn').disabled = false;
            document.getElementById('newChatBtn').disabled = false;
            showGreeting();
            renderHistory([]);
            renderChats([]);
            document.getElementById('signup-username').value = '';
            document.getElementById('signup-password').value = '';
            document.getElementById('login-password').value = '';
            if (isAdmin) {
                showAdminTab();
            }
        }
    })
    .catch(error => console.error('Error during login:', error));
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
    } else if (e.key === 'Enter' && !e.shiftKey) {

    }
});

function sendPrompt() {
    const prompt = promptInput.value.trim();
    if (!currentChatId || !prompt) return;

    const chatDiv = document.getElementById('chatHistory');
    chatDiv.innerHTML += `<div class="user-msg bg-orange-200 p-3 rounded-xl mb-3 self-end text-orange-900 max-w-[85%] shadow-sm">${marked.parse(prompt)}</div>`;
    chatDiv.scrollTop = chatDiv.scrollHeight;

    promptInput.disabled = true;
    document.getElementById('chatBtn').disabled = true;

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
        promptInput.disabled = false;
        document.getElementById('chatBtn').disabled = false;
        promptInput.focus();
    })
    .catch(error => {
        console.error('Error sending prompt:', error);
        promptInput.disabled = false;
        document.getElementById('chatBtn').disabled = false;
        chatDiv.innerHTML += `<div class="assistant-msg bg-red-100 p-3 rounded-xl mb-3 self-start text-red-800 max-w-[85%] shadow-sm">Error: Could not get a response. Please try again.</div>`;
        chatDiv.scrollTop = chatDiv.scrollHeight;
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
        document.getElementById('greetingHeader').classList.remove('hidden');
        document.getElementById('adminTab').style.display = "none";

        document.getElementById('signup-username').value = '';
        document.getElementById('signup-password').value = '';
        document.getElementById('login-username').value = '';
        document.getElementById('login-password').value = '';
        document.getElementById('signup-result').textContent = '';
        document.getElementById('login-result').textContent = '';
    })
    .catch(error => console.error('Error during logout:', error));
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
    })
    .catch(error => console.error('Error creating new chat:', error));
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
        const adminContentDiv = document.getElementById('adminContent');
        if (data.users) {
            let html = "<b class='text-orange-900'>Users:</b><ul class='list-disc pl-5 mt-2'>";
            data.users.forEach(u => {
                html += `<li class='mb-1'>${u} (<span class='font-medium'>${data.chat_stats[u] || 0}</span> chats)</li>`;
            });
            html += "</ul>";
            adminContentDiv.innerHTML = html;
        } else {
            adminContentDiv.textContent = data.error || "No data available for admin panel.";
        }
    })
    .catch(error => {
        console.error('Error fetching admin data:', error);
        document.getElementById('adminContent').textContent = "Error loading admin data.";
    });
}
