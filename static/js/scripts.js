document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const micBtn = document.getElementById('mic-btn');
    const newChatBtn = document.querySelector('.new-chat-btn');
    const chatList = document.getElementById('chat-list');
    const chatContainer = document.querySelector('.chat-container');
    const speakerBtn = document.getElementById('speaker-btn');

    let isListening = false;
    let speechSynthesis = window.speechSynthesis;
    let isSpeakerEnabled = true;
    let currentConversationId = null;
    let isProcessing = false;

    // Voice recognition setup
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.continuous = false;
    recognition.interimResults = false;

    // Initialize application
    init();

    async function init() {
        try {
            await loadChatHistory();
            if (!currentConversationId) await initializeConversation();
            setupEventListeners();
            showWelcomeMessage();
        } catch (error) {
            console.error('Initialization error:', error);
            showErrorMessage('Failed to initialize chat. Please refresh the page.');
        }
    }

    function setupEventListeners() {
        chatInput?.addEventListener('input', autoResizeTextarea);
        chatInput?.addEventListener('keydown', handleInputKeypress);
        sendBtn?.addEventListener('click', handleSendMessage);
        newChatBtn?.addEventListener('click', handleNewChat);
        window.addEventListener('resize', adjustContainerHeight);

        micBtn?.addEventListener('click', toggleMic);
        speakerBtn?.addEventListener('click', toggleSpeaker);

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            chatInput.value = transcript;
            handleSendMessage();
        };

        recognition.onend = () => stopListening();
    }

    function autoResizeTextarea() {
        chatInput.style.height = 'auto';
        chatInput.style.height = `${Math.min(chatInput.scrollHeight, 150)}px`;
    }

    function adjustContainerHeight() {
        chatContainer.style.height = `${window.innerHeight - chatContainer.offsetTop}px`;
    }

    function handleInputKeypress(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    }

    async function handleNewChat() {
        chatMessages.innerHTML = '';
        showWelcomeMessage();
        await initializeConversation();
        chatInput.focus();
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

    function showErrorMessage(message) {
        alert(message); // Replace with a custom UI error message if needed
    }

    async function initializeConversation() {
        try {
            const response = await fetch('/new-conversation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            if (!response.ok) throw new Error('Failed to initialize conversation.');

            const data = await response.json();
            currentConversationId = data.conversationId;
            addChatToSidebar('New Chat', currentConversationId, true);
        } catch (error) {
            console.error('Conversation initialization error:', error);
        }
    }

    async function loadChatHistory() {
        try {
            const response = await fetch('/get-conversations');
            if (!response.ok) throw new Error('Failed to load chat history.');

            const data = await response.json();
            chatList.innerHTML = '';
            data.forEach(({ title, id }) => addChatToSidebar(title || 'New Chat', id));
            if (data.length) await loadConversation(data[0].id);
        } catch (error) {
            console.error('Error loading chat history:', error);
        }
    }

    async function handleSendMessage() {
        const message = chatInput.value.trim();
        if (!message || !currentConversationId || isProcessing) return;

        isProcessing = true;
        chatInput.value = '';
        chatInput.style.height = 'auto';

        const userMessageEl = createMessageElement('user', message);
        chatMessages.appendChild(userMessageEl);
        scrollToBottom();

        const loadingEl = createLoadingIndicator();
        chatMessages.appendChild(loadingEl);

        try {
            const response = await fetch('/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: message, conversationId: currentConversationId })
            });
            if (!response.ok) throw new Error('Failed to send message.');

            const data = await response.json();
            loadingEl.remove();

            const aiMessageEl = createMessageElement('ai', data.response);
            chatMessages.appendChild(aiMessageEl);

            speak(data.response);
            scrollToBottom();
        } catch (error) {
            console.error('Error sending message:', error);
            loadingEl.remove();
        } finally {
            isProcessing = false;
            chatInput.focus();
        }
    }

    function toggleMic() {
        if (isListening) {
            stopListening();
        } else {
            startListening();
        }
    }

    function startListening() {
        try {
            recognition.start();
            isListening = true;
            micBtn.classList.add('active');
        } catch (error) {
            console.error('Error starting voice recognition:', error);
        }
    }

    function stopListening() {
        try {
            recognition.stop();
            isListening = false;
            micBtn.classList.remove('active');
        } catch (error) {
            console.error('Error stopping voice recognition:', error);
        }
    }

    function toggleSpeaker() {
        isSpeakerEnabled = !isSpeakerEnabled;
        speakerBtn.classList.toggle('active', isSpeakerEnabled);
        if (!isSpeakerEnabled) speechSynthesis.cancel();
    }

    function speak(text) {
        if (!isSpeakerEnabled) return;

        speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        speechSynthesis.speak(utterance);
    }

    function scrollToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function createMessageElement(sender, message) {
        const div = document.createElement('div');
        div.className = `message ${sender}`;
        div.textContent = message;
        return div;
    }

    function createLoadingIndicator() {
        const div = document.createElement('div');
        div.className = 'loading';
        div.textContent = 'Typing...';
        return div;
    }

    function addChatToSidebar(title, id, select = false) {
        const li = document.createElement('li');
        li.textContent = title;
        li.dataset.id = id;
        li.className = 'chat-history-item';
        chatList.appendChild(li);

        if (select) li.classList.add('active');
    }
});
