document.addEventListener('DOMContentLoaded', () => {
    // Get references to the important DOM elements
    const chatSection = document.getElementById('chatSection'); // This will always be visible
    const userInfo = document.getElementById('userInfo'); // For a simple welcome message
    const chatHistory = document.getElementById('chatHistory');
    const chatInput = document.getElementById('chatInput');
    const sendMessageButton = document.getElementById('sendMessageButton');
    const chatTitle = document.getElementById('chatTitle');

    let currentChatId = null; // Will store the anonymous chat ID from the session

    // --- Utility Functions ---

    /**
     * Renders a Markdown string into HTML.
     * This is a simplified Markdown parser for common elements expected from AmberMind.
     * For full Markdown support, consider a dedicated library like 'marked.js'.
     */
    function renderMarkdown(markdown) {
        let html = markdown
            // Headings (H3, H2, H1 in that order for correct replacement)
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            // Bold
            .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
            // Italic
            .replace(/\*(.*?)\*/gim, '<em>$1</em>')
            // Inline Code
            .replace(/`(.*?)`/gim, '<code>$1</code>')
            // Code Blocks (multiline)
            .replace(/```([\s\S]*?)```/gim, '<pre><code>$1</code></pre>')
            // Blockquotes
            .replace(/^> (.*$)/gim, '<blockquote><p>$1</p></blockquote>'); // Wrap content in <p> for blockquote

        const lines = html.split('\n');
        let processedLines = [];
        let inCodeBlock = false;
        let inBlockquote = false;
        let inList = false;

        lines.forEach(line => {
            if (line.includes('<pre><code>')) {
                inCodeBlock = true;
                processedLines.push(line);
            } else if (line.includes('</code></pre>')) {
                inCodeBlock = false;
                processedLines.push(line);
            } else if (inCodeBlock) {
                processedLines.push(line);
            } else if (line.startsWith('<blockquote>')) {
                inBlockquote = true;
                processedLines.push(line);
            } else if (inBlockquote && line.trim() !== '') {
                processedLines.push(`<p>${line}</p>`);
            } else if (inBlockquote && line.trim() === '') {
                inBlockquote = false;
                processedLines.push(line);
            }
            else if (line.startsWith('<li>')) {
                if (!inList) {
                    processedLines.push('<ul>');
                    inList = true;
                }
                processedLines.push(line);
            } else if (inList && line.trim() === '') {
                processedLines.push('</ul>');
                inList = false;
                processedLines.push(line);
            }
            else if (inList) {
                processedLines.push(line);
            }
            else if (line.trim() !== '' && !line.match(/<\/?h[1-6]>|<\/?pre>|<\/?blockquote>|<\/?ul>|<\/?ol>|<\/?li>/i)) {
                processedLines.push(`<p>${line}</p>`);
            } else {
                processedLines.push(line);
            }
        });

        if (inList) {
            processedLines.push('</ul>');
        }

        return processedLines.join('\n');
    }

    /**
     * Appends a new message to the chat history display.
     * @param {string} role - 'user' or 'ai' to style the message.
     * @param {string} content - The text content of the message (Markdown supported).
     */
    function displayMessage(role, content) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('chat-message', role);
        messageDiv.innerHTML = renderMarkdown(content); // Render Markdown before setting innerHTML
        chatHistory.appendChild(messageDiv);
        chatHistory.scrollTop = chatHistory.scrollHeight; // Auto-scroll to the latest message
    }

    /**
     * Fetches and displays the chat history for the anonymous session.
     */
    async function loadAnonymousChatHistory() {
        try {
            // Requesting history for a dummy 'anonymous' ID. Server will resolve this to the actual session ID.
            const response = await fetch('/history/anonymous', {credentials: 'include'});
            if (!response.ok) {
                const errorData = await response.json();
                console.error("Failed to load chat history:", errorData.error);
                alert('Error loading chat history: ' + errorData.error);
                chatHistory.innerHTML = '<div class="chat-message ai"><p>Failed to load past messages. Please try refreshing.</p></div>';
                return;
            }
            const data = await response.json();
            chatHistory.innerHTML = ''; // Clear initial message

            // If a chat history is returned, render it
            if (data.history && data.history.length > 0) {
                data.history.forEach(msg => displayMessage(msg.role, msg.content));
            } else {
                // If no history, display the initial welcome message again
                displayMessage('ai', "Hello! I'm AmberMind, your AI assistant. How can I help you today?");
            }
            // The server sets anon_chat_id in session and will return it in chat responses
            // We don't need it for history loading since there's only one.
            chatTitle.textContent = "Your Anonymous Chat"; // Ensure consistent title
            chatHistory.scrollTop = chatHistory.scrollHeight; // Scroll to bottom
        } catch (error) {
            console.error('Error loading anonymous chat history:', error);
            alert('A network error occurred while loading chat history.');
            chatHistory.innerHTML = '<div class="chat-message ai"><p>A network error occurred. Please check your connection and try refreshing.</p></div>';
        }
    }

    // --- Event Listeners ---

    // Send Message button click handler
    sendMessageButton.addEventListener('click', async () => {
        const prompt = chatInput.value.trim();
        if (!prompt) return; // Don't send empty messages

        displayMessage('user', prompt); // Display user's message immediately
        chatInput.value = ''; // Clear input field
        chatInput.style.height = 'auto'; // Reset textarea height

        // If currentChatId is not set, we need to make an initial call to get it
        // The /chat/<chat_id> endpoint will create it if it doesn't exist in session
        if (!currentChatId) {
            // First message will implicitly create the anonymous session on backend
            // We pass a dummy 'anonymous' ID, the backend will use the session's UUID
            currentChatId = 'anonymous';
        }

        try {
            // Send message to the backend API
            const response = await fetch(`/chat/${currentChatId}`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({prompt}),
                credentials: 'include'
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("AI response failed:", errorData.error);
                alert(`Error: ${errorData.error}`);
                // Re-add user's message if AI failed to respond
                if (chatHistory.lastChild && chatHistory.lastChild.classList.contains('user')) {
                    chatHistory.lastChild.remove();
                }
                return;
            }

            const data = await response.json();
            displayMessage('ai', data.response); // Display AI's response

            // Update currentChatId with the actual UUID from the backend if it was initially null/dummy
            if (data.chat_id && currentChatId === 'anonymous') {
                currentChatId = data.chat_id;
            }
        } catch (error) {
            console.error('Error sending message:', error);
            alert(`A network error occurred: ${error.message}`);
            // Optionally, remove the last user message if the AI response failed
            if (chatHistory.lastChild && chatHistory.lastChild.classList.contains('user')) {
                chatHistory.lastChild.remove();
            }
        }
    });

    // Allow sending message with Enter key (Shift+Enter for new line)
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); // Prevent new line in textarea
            sendMessageButton.click(); // Trigger send button click
        }
    });

    // Dynamically adjust textarea height based on content
    chatInput.addEventListener('input', () => {
        chatInput.style.height = 'auto'; // Reset height
        chatInput.style.height = chatInput.scrollHeight + 'px'; // Set to scroll height
    });


    // --- Initialization on Page Load ---

    // Load the anonymous chat history immediately when the page loads
    loadAnonymousChatHistory();
});
