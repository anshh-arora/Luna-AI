document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const newChatBtn = document.querySelector('.new-chat-btn');
    const chatList = document.getElementById('chat-list');
    const chatContainer = document.querySelector('.chat-container');

    // State management
    let currentConversationId = null;
    let isProcessing = false;
    let messageQueue = [];

    // Initialize the application
    init();

    async function init() {
        try {
            await loadChatHistory();
            if (!currentConversationId) {
                await initializeConversation();
            }
            setupEventListeners();
            showWelcomeMessage();
        } catch (error) {
            console.error('Initialization error:', error);
            showErrorMessage('Failed to initialize chat. Please refresh the page.');
        }
    }

    function setupEventListeners() {
        // Chat input handlers
        if (chatInput) {
            chatInput.addEventListener('input', autoResizeTextarea);
            chatInput.addEventListener('keydown', handleInputKeypress);
        }

        // Send button handler
        if (sendBtn) {
            sendBtn.addEventListener('click', () => handleSendMessage());
        }

        // New chat button handler
        if (newChatBtn) {
            newChatBtn.addEventListener('click', handleNewChat);
        }

        // Window resize handler for mobile responsiveness
        window.addEventListener('resize', () => {
            if (chatContainer) {
                adjustContainerHeight();
            }
        });
    }

    function autoResizeTextarea() {
        chatInput.style.height = 'auto';
        chatInput.style.height = `${Math.min(chatInput.scrollHeight, 150)}px`;
    }

    function handleInputKeypress(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    }

    async function handleNewChat() {
        try {
            chatMessages.innerHTML = '';
            showWelcomeMessage();
            await initializeConversation();
            chatInput.focus();
        } catch (error) {
            console.error('Error creating new chat:', error);
            showErrorMessage('Failed to create new chat. Please try again.');
        }
    }

    function showWelcomeMessage() {
        chatMessages.innerHTML = `
            <div class="welcome-message">
                <h3>Welcome to Language Learning Chat</h3>
                <p>Start typing to begin your conversation!</p>
                <ul class="suggestion-list">
                    <li>Practice conversation skills</li>
                    <li>Get grammar explanations</li>
                    <li>Learn new vocabulary</li>
                    <li>Improve pronunciation</li>
                </ul>
            </div>
        `;
    }

    async function initializeConversation() {
        try {
            const response = await fetch('/new-conversation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                if (errorData.error && errorData.error.includes('maximum number of conversations')) {
                    showErrorMessage('Maximum conversation limit reached. Please delete some old conversations.');
                    return;
                }
                throw new Error('Failed to create conversation');
            }

            const data = await response.json();
            currentConversationId = data.conversationId;
            addChatToSidebar('New Chat', currentConversationId, true);
            return data;
        } catch (error) {
            console.error('Error initializing conversation:', error);
            throw error;
        }
    }

    async function loadChatHistory() {
        try {
            const response = await fetch('/get-conversations');
            if (!response.ok) throw new Error('Failed to load chat history');

            const data = await response.json();
            chatList.innerHTML = '';

            data.conversations.forEach(conv => {
                addChatToSidebar(conv.title || 'New Chat', conv.id, false);
            });

            // Load most recent conversation if exists
            if (data.conversations.length > 0) {
                await loadConversation(data.conversations[0].id);
            }
        } catch (error) {
            console.error('Error loading chat history:', error);
            throw error;
        }
    }

    function addChatToSidebar(title, conversationId, isActive = false) {
        const listItem = document.createElement('li');
        listItem.classList.add('chat-history-item');
        listItem.dataset.conversationId = conversationId;
        
        listItem.innerHTML = `
            <div class="chat-item-content">
                <i class="fas fa-message"></i>
                <span class="chat-title">${escapeHtml(title)}</span>
            </div>
            <button class="delete-chat-btn" title="Delete chat">
                <i class="fas fa-trash"></i>
            </button>
        `;

        if (isActive) {
            listItem.classList.add('active');
            currentConversationId = conversationId;
        }

        // Add click event for loading conversation
        listItem.querySelector('.chat-item-content').addEventListener('click', () => {
            loadConversation(conversationId);
        });

        // Add click event for delete button
        listItem.querySelector('.delete-chat-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            handleDeleteChat(conversationId);
        });

        chatList.insertBefore(listItem, chatList.firstChild);
    }

    async function loadConversation(conversationId) {
        try {
            const response = await fetch(`/get-conversation/${conversationId}`);
            if (!response.ok) throw new Error('Failed to load conversation');

            const data = await response.json();
            
            // Update UI state
            currentConversationId = conversationId;
            chatMessages.innerHTML = '';
            updateActiveChatInSidebar(conversationId);

            // Render messages
            data.messages.forEach(message => {
                const messageEl = createMessageElement(
                    message.is_bot ? 'ai' : 'user',
                    message.content
                );
                chatMessages.appendChild(messageEl);
            });

            scrollToBottom();
        } catch (error) {
            console.error('Error loading conversation:', error);
            showErrorMessage('Failed to load conversation. Please try again.');
        }
    }

    async function handleSendMessage() {
        const message = chatInput.value.trim();
        if (!message || !currentConversationId || isProcessing) return;

        try {
            isProcessing = true;
            
            // Clear input and reset height
            chatInput.value = '';
            chatInput.style.height = 'auto';
            
            // Remove welcome message if present
            const welcomeMessage = document.querySelector('.welcome-message');
            if (welcomeMessage) welcomeMessage.remove();

            // Add user message to UI
            const userMessageEl = createMessageElement('user', message);
            chatMessages.appendChild(userMessageEl);
            scrollToBottom();

            // Show loading indicator
            const loadingEl = createLoadingIndicator();
            chatMessages.appendChild(loadingEl);
            scrollToBottom();

            // Send message to server
            const response = await fetch('/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: message,
                    conversationId: currentConversationId
                })
            });

            if (!response.ok) throw new Error('Failed to send message');

            const data = await response.json();
            loadingEl.remove();

            // Handle AI response
            if (Array.isArray(data.response)) {
                for (const response of data.response) {
                    const aiMessageEl = createMessageElement('ai', response);
                    chatMessages.appendChild(aiMessageEl);
                    scrollToBottom();
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            } else {
                const aiMessageEl = createMessageElement('ai', data.response);
                chatMessages.appendChild(aiMessageEl);
            }

            // Update chat title if it's the first message
            if (chatMessages.children.length <= 2) {
                await updateChatTitle(currentConversationId, message);
            }

            scrollToBottom();
        } catch (error) {
            console.error('Message send error:', error);
            const loadingEl = document.querySelector('.typing-indicator')?.closest('.message');
            if (loadingEl) loadingEl.remove();
            
            showErrorMessage('Failed to send message. Please try again.');
        } finally {
            isProcessing = false;
            chatInput.focus();
        }
    }

    async function handleDeleteChat(conversationId) {
        if (!confirm('Are you sure you want to delete this chat?')) return;

        try {
            const response = await fetch(`/delete-conversation/${conversationId}`, {
                method: 'DELETE'
            });

            if (!response.ok) throw new Error('Failed to delete chat');

            // Remove from sidebar
            const chatItem = document.querySelector(`.chat-history-item[data-conversation-id="${conversationId}"]`);
            if (chatItem) chatItem.remove();

            // If current chat was deleted, create new chat
            if (currentConversationId === conversationId) {
                handleNewChat();
            }
        } catch (error) {
            console.error('Error deleting chat:', error);
            showErrorMessage('Failed to delete chat. Please try again.');
        }
    }

    async function updateChatTitle(conversationId, message) {
        try {
            const titlePreview = message.substring(0, 30) + (message.length > 30 ? '...' : '');
            
            const response = await fetch('/update-chat-title', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    conversationId: conversationId,
                    title: titlePreview
                })
            });

            if (!response.ok) throw new Error('Failed to update chat title');

            // Update sidebar title
            const chatItem = document.querySelector(`.chat-history-item[data-conversation-id="${conversationId}"]`);
            if (chatItem) {
                chatItem.querySelector('.chat-title').textContent = titlePreview;
            }
        } catch (error) {
            console.error('Error updating chat title:', error);
        }
    }

    function createMessageElement(sender, message) {
        const messageEl = document.createElement('div');
        messageEl.classList.add('message', `message-${sender}`);
        
        const avatarEl = document.createElement('div');
        avatarEl.classList.add('message-avatar');
        avatarEl.innerHTML = sender === 'user' 
            ? '<i class="fas fa-user"></i>' 
            : '<i class="fas fa-robot"></i>';

        const contentEl = document.createElement('div');
        contentEl.classList.add('message-content');
        
        // Parse markdown and handle code blocks
        const formattedMessage = formatMessage(message);
        contentEl.innerHTML = formattedMessage;

        // Add copy button for code blocks
        contentEl.querySelectorAll('pre code').forEach(block => {
            addCopyButton(block);
        });

        messageEl.appendChild(avatarEl);
        messageEl.appendChild(contentEl);

        return messageEl;
    }

    function createLoadingIndicator() {
        const loadingEl = document.createElement('div');
        loadingEl.classList.add('message', 'message-ai');
        loadingEl.innerHTML = `
            <div class="message-avatar">
                <i class="fas fa-robot"></i>
            </div>
            <div class="message-content">
                <div class="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;
        return loadingEl;
    }

    function formatMessage(message) {
        return message
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>')
            .replace(/\*\*([^\*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/\*([^\*]+)\*/g, '<em>$1</em>');
    }

    function addCopyButton(codeBlock) {
        const button = document.createElement('button');
        button.className = 'copy-code-btn';
        button.innerHTML = '<i class="fas fa-copy"></i>';
        
        button.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(codeBlock.textContent);
                button.innerHTML = '<i class="fas fa-check"></i>';
                setTimeout(() => {
                    button.innerHTML = '<i class="fas fa-copy"></i>';
                }, 2000);
            } catch (err) {
                console.error('Failed to copy code:', err);
            }
        });

        codeBlock.parentNode.insertBefore(button, codeBlock);
    }

    function showErrorMessage(message) {
        const errorEl = document.createElement('div');
        errorEl.classList.add('error-message');
        errorEl.textContent = message;
        chatMessages.appendChild(errorEl);
        scrollToBottom();

        setTimeout(() => {
            errorEl.remove();
        }, 5000);
    }

    function updateActiveChatInSidebar(conversationId) {
        document.querySelectorAll('.chat-history-item').forEach(item => {
            item.classList.toggle('active', item.dataset.conversationId === conversationId);
        });
    }

    function scrollToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function adjustContainerHeight() {
        if (window.innerWidth <= 768) {
            chatContainer.style.height = `${window.innerHeight - 60}px`;
        } else {
            chatContainer.style.height = '100vh';
        }
    }

    function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Initial mobile height adjustment
    adjustContainerHeight();
});