// Firebase Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, query, where, getDocs, orderBy, limit } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Marked.js and Highlight.js imports (these remain in script.js as they are JS libraries)
import "https://cdn.jsdelivr.net/npm/marked/marked.min.js";
import "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js";
import "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/javascript.min.js";
import "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/css.min.js";
import "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/xml.min.js";
import "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/python.min.js";


// Global Variables
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

let db;
let auth;
let currentUserId = null;
let currentUsername = null;
let currentChatId = null;
let hasChatted = false;
let isAdmin = false; // Simulated admin status

// Firebase Initialization and Auth State Listener
let isAuthReady = false; // Flag to ensure Firestore operations wait for auth
window.onload = async function() {
    try {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);

        onAuthStateChanged(auth, async (user) => {
            if (user) {
                currentUserId = user.uid;
                document.getElementById('currentUserId').textContent = currentUserId;
                console.log("Firebase Auth State Changed: Logged in as", currentUserId);

                // Fetch user profile to get username and admin status
                const userProfileRef = doc(db, `artifacts/${appId}/users/${currentUserId}/user_profiles`, currentUserId);
                const userProfileSnap = await getDoc(userProfileRef);
                if (userProfileSnap.exists()) {
                    const profileData = userProfileSnap.data();
                    currentUsername = profileData.username;
                    isAdmin = profileData.isAdmin || false; // Default to false if not set
                    console.log("User profile loaded:", profileData);
                } else {
                    // If no profile, it's an anonymous user or new signup.
                    // For anonymous, username will be null. For signup, it's set later.
                    currentUsername = null;
                    isAdmin = false;
                }

                updateChatList();
                showGreeting();
                document.getElementById('logoutBtn').disabled = false;
                document.getElementById('newChatBtn').disabled = false;
                document.getElementById('promptInput').disabled = false;
                document.getElementById('chatBtn').disabled = false;

                if (isAdmin) {
                    showAdminTab();
                } else {
                    document.getElementById('adminTab').style.display = "none";
                }

                // If no chat selected, try to load the first one or create a new one
                if (!currentChatId) {
                    const chatsCollectionRef = collection(db, `artifacts/${appId}/users/${currentUserId}/chats`);
                    const q = query(chatsCollectionRef, limit(1)); // Get the first chat
                    const chatDocs = await getDocs(q);
                    if (!chatDocs.empty) {
                        selectChat(chatDocs.docs[0].id);
                    } else {
                        // If no chats, display empty history and allow new chat creation
                        renderHistory([]);
                    }
                }
            } else {
                // User is signed out
                console.log("Firebase Auth State Changed: Logged out.");
                currentUserId = null;
                currentUsername = null;
                currentChatId = null;
                hasChatted = false;
                isAdmin = false;
                document.getElementById('currentUserId').textContent = 'Not logged in';
                document.getElementById('logoutBtn').disabled = true;
                document.getElementById('newChatBtn').disabled = true;
                document.getElementById('promptInput').disabled = true;
                document.getElementById('chatBtn').disabled = true;
                renderHistory([]);
                renderChats([]);
                document.getElementById('greetingHeader').textContent = "Welcome to AmberMind!";
                document.getElementById('greetingHeader').classList.remove('hidden');
                document.getElementById('adminTab').style.display = "none";
                document.getElementById('signup-username').value = '';
                document.getElementById('signup-password').value = '';
                document.getElementById('login-username').value = '';
                document.getElementById('login-password').value = '';
                document.getElementById('signup-result').textContent = '';
                document.getElementById('login-result').textContent = '';
            }
            isAuthReady = true; // Set flag after initial auth check
        });

        // Sign in with custom token if available, otherwise anonymously
        if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
            console.log("Signed in with custom token.");
        } else {
            await signInAnonymously(auth);
            console.log("Signed in anonymously.");
        }

    } catch (error) {
        console.error("Firebase initialization or authentication error:", error);
        document.getElementById('signup-result').textContent = `Error: ${error.message}`;
        document.getElementById('login-result').textContent = `Error: ${error.message}`;
    }
};

// Highlight.js setup
hljs.highlightAll();

const renderer = new marked.Renderer();

renderer.code = function(code, lang) {
    const validLang = hljs.getLanguage(lang) ? lang : 'plaintext';
    let highlightedCode;
    try {
        highlightedCode = hljs.highlight(code, { language: validLang }).value;
    } catch (e) {
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
        chatDiv.innerHTML = '<em class="text-orange-800 text-center w-full block">Sign up or login to start chatting!</em>';
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

let unsubscribeFromChatHistory = null;

async function selectChat(chat_id) {
    if (!isAuthReady || !currentUserId) {
        console.warn("Auth not ready or user not logged in. Cannot select chat.");
        return;
    }

    currentChatId = chat_id;
    hasChatted = false;

    if (unsubscribeFromChatHistory) {
        unsubscribeFromChatHistory();
        unsubscribeFromChatHistory = null;
    }

    const messagesCollectionRef = collection(db, `artifacts/${appId}/users/${currentUserId}/chats/${currentChatId}/messages`);
    const q = query(messagesCollectionRef, orderBy('timestamp'));

    unsubscribeFromChatHistory = onSnapshot(q, (snapshot) => {
        const history = [];
        snapshot.forEach(doc => {
            history.push(doc.data());
        });
        renderHistory(history);
        updateChatList();
        document.getElementById('promptInput').disabled = false;
        document.getElementById('chatBtn').disabled = false;
        showGreeting();
    }, (error) => {
        console.error('Error fetching chat history with onSnapshot:', error);
        document.getElementById('chatHistory').innerHTML = `<div class="assistant-msg bg-red-100 p-3 rounded-xl mb-3 self-start text-red-800 max-w-[85%] shadow-sm">Error loading chat history.</div>`;
    });
}

async function updateChatList() {
    if (!isAuthReady || !currentUserId) {
        console.warn("Auth not ready or user not logged in. Cannot update chat list.");
        return;
    }
    const chatsCollectionRef = collection(db, `artifacts/${appId}/users/${currentUserId}/chats`);
    const q = query(chatsCollectionRef, orderBy('createdAt', 'desc'));

    onSnapshot(q, (snapshot) => {
        const chats = [];
        snapshot.forEach(doc => {
            chats.push({ chat_id: doc.id, ...doc.data() });
        });
        renderChats(chats);
    }, (error) => {
        console.error('Error fetching chat list with onSnapshot:', error);
    });
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

document.getElementById('signupBtn').onclick = async function() {
    if (!isAuthReady) { console.warn("Auth not ready. Cannot sign up."); return; }
    const signupUsername = document.getElementById('signup-username').value.trim();
    const signupPassword = document.getElementById('signup-password').value.trim();
    const signupResult = document.getElementById('signup-result');
    signupResult.textContent = '';

    if (!signupUsername || !signupPassword) {
        signupResult.textContent = "Username and password cannot be empty.";
        return;
    }

    try {
        const usersCollectionRef = collection(db, `artifacts/${appId}/public/data/users`);
        const userQuery = query(usersCollectionRef, where('username', '==', signupUsername));
        const userSnap = await getDocs(userQuery);

        if (!userSnap.empty) {
            signupResult.textContent = "Username already exists.";
            return;
        }

        const userCredential = await signInAnonymously(auth);
        const uid = userCredential.user.uid;

        await setDoc(doc(db, `artifacts/${appId}/users/${uid}/user_profiles`, uid), {
            username: signupUsername,
            password: signupPassword,
            isAdmin: false,
            createdAt: new Date()
        });

        const newChatRef = await addDoc(collection(db, `artifacts/${appId}/users/${uid}/chats`), {
            title: "First Chat",
            createdAt: new Date(),
            lastUpdated: new Date()
        });

        currentUserId = uid;
        currentUsername = signupUsername;
        currentChatId = newChatRef.id;
        isAdmin = false;

        signupResult.textContent = "Signup successful! You are now logged in.";
        document.getElementById('logoutBtn').disabled = false;
        document.getElementById('newChatBtn').disabled = false;
        document.getElementById('promptInput').disabled = false;
        document.getElementById('chatBtn').disabled = false;
        document.getElementById('login-username').value = '';
        document.getElementById('login-password').value = '';
        document.getElementById('signup-password').value = '';

        selectChat(currentChatId);
        showGreeting();
        updateChatList();

    } catch (error) {
        console.error('Error during signup:', error);
        signupResult.textContent = `Signup failed: ${error.message}`;
    }
};

document.getElementById('loginBtn').onclick = async function() {
    if (!isAuthReady) { console.warn("Auth not ready. Cannot log in."); return; }
    const loginUsername = document.getElementById('login-username').value.trim();
    const loginPassword = document.getElementById('login-password').value.trim();
    const loginResult = document.getElementById('login-result');
    loginResult.textContent = '';

    if (!loginUsername || !loginPassword) {
        loginResult.textContent = "Username and password cannot be empty.";
        return;
    }

    try {
        const usersCollectionRef = collection(db, `artifacts/${appId}/public/data/users`);
        const userQuery = query(usersCollectionRef, where('username', '==', loginUsername));
        const userSnap = await getDocs(userQuery);

        if (userSnap.empty) {
            loginResult.textContent = "User not found.";
            return;
        }

        const userData = userSnap.docs[0].data();
        if (userData.password !== loginPassword) {
            loginResult.textContent = "Incorrect password.";
            return;
        }

        await signOut(auth);
        const userCredential = await signInAnonymously(auth);
        const uid = userCredential.user.uid;

        const userProfileRef = doc(db, `artifacts/${appId}/users/${uid}/user_profiles`, uid);
        await setDoc(userProfileRef, {
            username: loginUsername,
            password: loginPassword,
            isAdmin: userData.isAdmin || false,
            lastLogin: new Date()
        }, { merge: true });

        currentUserId = uid;
        currentUsername = loginUsername;
        isAdmin = userData.isAdmin || false;

        loginResult.textContent = "Login successful!";
        document.getElementById('logoutBtn').disabled = false;
        document.getElementById('newChatBtn').disabled = false;
        document.getElementById('promptInput').disabled = false;
        document.getElementById('chatBtn').disabled = false;
        document.getElementById('signup-username').value = '';
        document.getElementById('signup-password').value = '';
        document.getElementById('login-password').value = '';

        updateChatList();
        showGreeting();

        if (isAdmin) {
            showAdminTab();
        } else {
            document.getElementById('adminTab').style.display = "none";
        }

        const chatsCollectionRef = collection(db, `artifacts/${appId}/users/${currentUserId}/chats`);
        const q = query(chatsCollectionRef, limit(1));
        const chatDocs = await getDocs(q);
        if (!chatDocs.empty) {
            selectChat(chatDocs.docs[0].id);
        } else {
            renderHistory([]);
        }

    } catch (error) {
        console.error('Error during login:', error);
        loginResult.textContent = `Login failed: ${error.message}`;
    }
};

document.getElementById('chatBtn').onclick = function() {
    sendPrompt();
};

const promptInput = document.getElementById('promptInput');
promptInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!promptInput.disabled && !document.getElementById('chatBtn').disabled) {
            sendPrompt();
        }
    }
});

const loadingIndicator = document.getElementById('loadingIndicator');

async function sendPrompt() {
    if (!isAuthReady || !currentUserId || !currentChatId) {
        console.warn("Auth not ready, user not logged in, or no chat selected. Cannot send prompt.");
        return;
    }

    const prompt = promptInput.value.trim();
    if (!prompt) return;

    const chatDiv = document.getElementById('chatHistory');
    const messagesCollectionRef = collection(db, `artifacts/${appId}/users/${currentUserId}/chats/${currentChatId}/messages`);

    await addDoc(messagesCollectionRef, {
        role: "user",
        content: prompt,
        timestamp: new Date()
    });

    promptInput.disabled = true;
    document.getElementById('chatBtn').disabled = true;
    loadingIndicator.classList.remove('hidden');

    try {
        const chatHistorySnapshot = await getDocs(query(messagesCollectionRef, orderBy('timestamp')));
        const chatHistory = chatHistorySnapshot.docs.map(doc => doc.data());

        let geminiChatHistory = [];
        chatHistory.forEach(msg => {
            geminiChatHistory.push({ role: msg.role, parts: [{ text: msg.content }] });
        });

        const payload = { contents: geminiChatHistory };
        const apiKey = "";
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (result.candidates && result.candidates.length > 0 &&
            result.candidates[0].content && result.candidates[0].content.parts &&
            result.candidates[0].content.parts.length > 0) {
            const assistantText = result.candidates[0].content.parts[0].text;

            await addDoc(messagesCollectionRef, {
                role: "assistant",
                content: assistantText,
                timestamp: new Date()
            });

            if (!hasChatted) {
                const chatDocRef = doc(db, `artifacts/${appId}/users/${currentUserId}/chats`, currentChatId);
                const firstUserMessage = chatHistory.find(msg => msg.role === 'user');
                const newTitle = firstUserMessage ? firstUserMessage.content.substring(0, 30) + (firstUserMessage.content.length > 30 ? '...' : '') : "New Chat";
                await updateDoc(chatDocRef, { title: newTitle, lastUpdated: new Date() });
            }

            hasChatted = true;
            hideGreeting();
            promptInput.value = '';
            promptInput.focus();
        } else {
            console.error('Gemini API response structure unexpected:', result);
            chatDiv.innerHTML += `<div class="assistant-msg bg-red-100 p-3 rounded-xl mb-3 self-start text-red-800 max-w-[85%] shadow-sm">Error: Could not get a valid response from AI.</div>`;
        }
    } catch (error) {
        console.error('Error sending prompt or getting AI response:', error);
        chatDiv.innerHTML += `<div class="assistant-msg bg-red-100 p-3 rounded-xl mb-3 self-start text-red-800 max-w-[85%] shadow-sm">Error: Could not get a response. Please try again.</div>`;
    } finally {
        promptInput.disabled = false;
        document.getElementById('chatBtn').disabled = false;
        loadingIndicator.classList.add('hidden');
        chatDiv.scrollTop = chatDiv.scrollHeight;
    }
}

document.getElementById('logoutBtn').onclick = async function() {
    if (!isAuthReady) { console.warn("Auth not ready. Cannot log out."); return; }
    try {
        await signOut(auth);
        console.log("User logged out successfully.");
    } catch (error) {
        console.error('Error during logout:', error);
    }
};

document.getElementById('newChatBtn').onclick = async function() {
    if (!isAuthReady || !currentUserId) {
        console.warn("Auth not ready or user not logged in. Cannot create new chat.");
        return;
    }
    try {
        const chatsCollectionRef = collection(db, `artifacts/${appId}/users/${currentUserId}/chats`);
        const newChatDocRef = await addDoc(chatsCollectionRef, {
            title: "New Chat",
            createdAt: new Date(),
            lastUpdated: new Date()
        });
        currentChatId = newChatDocRef.id;
        hasChatted = false;
        selectChat(currentChatId);
        showGreeting();
    } catch (error) {
        console.error('Error creating new chat:', error);
    }
};

async function showAdminTab() {
    if (!isAuthReady || !currentUserId || !isAdmin) {
        document.getElementById('adminTab').style.display = "none";
        return;
    }

    const adminTab = document.getElementById('adminTab');
    adminTab.style.display = "block";
    const adminContentDiv = document.getElementById('adminContent');
    adminContentDiv.innerHTML = `<div class="text-center text-gray-500">Loading admin data...</div>`;

    try {
        const chatsCollectionRef = collection(db, `artifacts/${appId}/users/${currentUserId}/chats`);
        const chatDocs = await getDocs(chatsCollectionRef);
        const chatCount = chatDocs.size;

        let html = `<b class='text-orange-900'>Your Admin Info:</b><ul class='list-disc pl-5 mt-2'>`;
        html += `<li class='mb-1'>Your User ID: <span class='font-medium'>${currentUserId}</span></li>`;
        html += `<li class='mb-1'>Your Chats: <span class='font-medium'>${chatCount}</span></li>`;
        html += `</ul>`;
        adminContentDiv.innerHTML = html;

    } catch (error) {
        console.error('Error fetching admin data:', error);
        adminContentDiv.textContent = "Error loading admin data.";
    }
}
