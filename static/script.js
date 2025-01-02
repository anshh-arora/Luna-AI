class ChatBot {
    constructor() {
        this.voiceEnabled = false;
        this.isListening = false;
        this.synthesis = window.speechSynthesis;
        this.recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        this.silenceTimeout = null;
        this.currentUtterance = null;
        this.isPaused = false;
        this.audioQueue = [];
        
        this.setupRecognition();
        this.setupEventListeners();
    }

    setupRecognition() {
        this.recognition.continuous = true; // Changed to true for continuous listening
        this.recognition.interimResults = true; // Enable interim results
        this.recognition.lang = 'en-US';

        let finalTranscript = '';
        let silenceTimer = null;

        this.recognition.onresult = (event) => {
            let interimTranscript = '';
            
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript + ' ';
                } else {
                    interimTranscript += transcript;
                }
            }

            // Update input field with current transcription
            const input = document.getElementById('messageInput');
            input.value = finalTranscript + interimTranscript;

            // Reset silence detection
            if (silenceTimer) clearTimeout(silenceTimer);
            silenceTimer = setTimeout(() => {
                if (finalTranscript.trim()) {
                    this.sendMessage(finalTranscript.trim(), true);
                    finalTranscript = '';
                    input.value = '';
                    this.stopListening();
                }
            }, 1500); // 1.5 seconds of silence to detect end of speech
        };

        this.recognition.onend = () => {
            if (this.isListening) {
                this.recognition.start(); // Restart if still supposed to be listening
            } else {
                this.toggleVoiceInputClass(false);
            }
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.isListening = false;
            this.toggleVoiceInputClass(false);
        };
    }

    setupEventListeners() {
        // Send button click event
        document.getElementById('sendMessage').addEventListener('click', () => this.handleSendMessage());

        // Voice input button
        document.getElementById('voiceInput').addEventListener('click', () => {
            this.stopSpeaking();
            this.isListening ? this.stopListening() : this.startListening();
        });

        // Input field key events
        document.getElementById('messageInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSendMessage();
            }
        });

        // Message speaker button click event
        document.addEventListener('click', (e) => {
            if (e.target.closest('.message-speaker')) {
                const messageContent = e.target.closest('.message-content');
                const text = messageContent.textContent;
                if (this.isPaused) {
                    this.resumeSpeaking();
                } else {
                    this.stopSpeaking();
                    this.speak(text);
                }
            }
        });
    }

    handleSendMessage() {
        const input = document.getElementById('messageInput');
        const message = input.value.trim();
        if (message) {
            this.stopSpeaking();
            this.sendMessage(message, false);
            input.value = '';
        }
    }

    speak(text) {
        if (this.currentUtterance) {
            this.synthesis.cancel();
        }

        const utterance = new SpeechSynthesisUtterance(text);
        this.currentUtterance = utterance;

        utterance.onend = () => {
            this.currentUtterance = null;
            this.isPaused = false;
            if (this.audioQueue.length > 0) {
                const nextText = this.audioQueue.shift();
                this.speak(nextText);
            }
        };

        utterance.onpause = () => {
            this.isPaused = true;
        };

        utterance.onresume = () => {
            this.isPaused = false;
        };

        this.synthesis.speak(utterance);
    }

    stopSpeaking() {
        if (this.synthesis.speaking) {
            this.synthesis.cancel();
            this.currentUtterance = null;
            this.isPaused = false;
            this.audioQueue = [];
        }
    }

    pauseSpeaking() {
        if (this.synthesis.speaking && !this.isPaused) {
            this.synthesis.pause();
            this.isPaused = true;
        }
    }

    resumeSpeaking() {
        if (this.synthesis.speaking && this.isPaused) {
            this.synthesis.resume();
            this.isPaused = false;
        }
    }

    // Update message UI to show speaking state
    updateMessageSpeakerIcon(messageElement, isSpeaking) {
        const speakerButton = messageElement.querySelector('.message-speaker i');
        if (speakerButton) {
            speakerButton.className = isSpeaking ? 'fas fa-pause' : 'fas fa-volume-up';
        }
    }

    addMessage(message, sender) {
        const messagesContainer = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;

        const content = document.createElement('div');
        content.className = 'message-content';
        content.textContent = message;

        if (sender === 'bot') {
            const speakerButton = document.createElement('button');
            speakerButton.className = 'message-speaker';
            speakerButton.innerHTML = '<i class="fas fa-volume-up"></i>';
            content.appendChild(speakerButton);
        }

        messageDiv.appendChild(content);
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }


    clearInput() {
        document.getElementById('messageInput').value = ''; // Clear the input field.
    }

    toggleVoiceInputClass(isListening) {
        const button = document.getElementById('voiceInput');
        button.classList.toggle('listening', isListening); // Add/remove the "listening" class based on the state.
    }

    updateVoiceIcon() {
        const icon = document.querySelector('#toggleVoice i');
        icon.className = this.voiceEnabled ? 'fas fa-volume-up' : 'fas fa-volume-mute'; // Toggle between volume icons.
    }

    startListening() {
        if (this.isListening) return; // Prevent multiple starts
        
        try {
            this.isListening = true;
            this.toggleVoiceInputClass(true);
            this.recognition.start();
            this.startSilenceTimer();
        } catch (error) {
            console.error('Error starting recognition:', error);
            this.isListening = false;
            this.toggleVoiceInputClass(false);
        }
    }

    stopListening() {
        this.isListening = false;
        this.toggleVoiceInputClass(false); // Update UI for non-listening state.
        this.recognition.stop(); // Stop voice recognition.
        this.clearSilenceTimer(); // Clear the silence timer.
    }

    stopSpeaking() {
        if (this.synthesis.speaking) {
            this.synthesis.cancel(); // Stop any ongoing speech synthesis.
        }
    }

    async sendMessage(message, isVoiceInput) {
        this.addMessage(message, 'user'); // Add user's message to the chat
        this.showTypingIndicator(); // Show typing indicator
    
        try {
            // Call API to get bot's response
            const response = await this.callAPI(message);
            
            this.removeTypingIndicator(); // Remove typing indicator
            this.addMessage(response, 'bot'); // Add bot's response to the chat
            
            // Ensure voice is enabled for both manual and voice inputs
            if (this.voiceEnabled || isVoiceInput) {
                this.speak(response); // Only speak the response
            }
        } catch (error) {
            console.error('Error:', error);
            this.removeTypingIndicator();
            this.addMessage('Sorry, there was an error processing your request.', 'bot');
            
            // Ensure listening can restart after an error
            this.isListening = false;
            this.toggleVoiceInputClass(false);
        }
    }

    async callAPI(message) {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message })
        });
        if (!response.ok) throw new Error('API request failed');
        const data = await response.json();
        return data.response; // Return the bot's response.
    }

    addMessage(message, sender) {
        const messagesContainer = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`; // Add the appropriate class based on the sender.

        const content = document.createElement('div');
        content.className = 'message-content';
        content.textContent = message;

        if (sender === 'bot') {
            const speakerButton = document.createElement('button');
            speakerButton.className = 'message-speaker';
            speakerButton.innerHTML = '<i class="fas fa-volume-up"></i>';
            speakerButton.onclick = () => {
                this.stopSpeaking(); // Stop any ongoing speech.
                this.speak(message); // Start speaking the message.
            };
            content.appendChild(speakerButton);
        }

        messageDiv.appendChild(content);
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight; // Scroll to the bottom.
    }

    showTypingIndicator() {
        const indicator = document.createElement('div');
        indicator.className = 'message bot typing-indicator';
        indicator.innerHTML = '<div class="typing-dot"></div>'.repeat(3); // Create typing dots.
        document.getElementById('chatMessages').appendChild(indicator);
    }

    removeTypingIndicator() {
        const indicator = document.querySelector('.typing-indicator');
        if (indicator) indicator.remove(); // Remove the typing indicator.
    }

    speak(text) {
        this.stopSpeaking(); // Ensure no overlapping speech
    
        // Split longer texts into chunks to prevent interruption
        const chunks = this.splitTextIntoChunks(text, 200); // Split every 100 characters
        
        const speakChunks = (index = 0) => {
            if (index >= chunks.length) {
                this.startListening(); // Start listening after all chunks are spoken
                return;
            }
    
            const utterance = new SpeechSynthesisUtterance(chunks[index]);
            utterance.rate = 1;
            utterance.pitch = 1;
    
            utterance.onend = () => {
                speakChunks(index + 1); // Speak next chunk
            };
    
            utterance.onerror = (event) => {
                console.error('Speech synthesis error:', event.error);
                speakChunks(index + 1); // Continue to next chunk even if one fails
            };
    
            this.synthesis.speak(utterance);
        };
    
        speakChunks(); // Start speaking chunks
    }
    
    // Helper method to split text into manageable chunks
    splitTextIntoChunks(text, maxLength) {
        const chunks = [];
        while (text.length > 0) {
            if (text.length <= maxLength) {
                chunks.push(text);
                break;
            }
            
            // Try to split at sentence or word boundaries
            let chunk = text.slice(0, maxLength);
            const lastSpaceIndex = chunk.lastIndexOf(' ');
            
            if (lastSpaceIndex !== -1) {
                chunk = chunk.slice(0, lastSpaceIndex);
                chunks.push(chunk);
                text = text.slice(lastSpaceIndex + 1);
            } else {
                chunks.push(chunk);
                text = text.slice(maxLength);
            }
        }
        return chunks;
    }

    startSilenceTimer() {
        this.clearSilenceTimer(); // Clear any existing timer.
        this.silenceTimeout = setTimeout(() => {
            this.stopListening(); // Stop listening after 10 seconds of silence.
        }, 10000);
    }

    resetSilenceTimer() {
        this.clearSilenceTimer(); // Clear any existing timer.
        this.startSilenceTimer(); // Restart the timer.
    }

    clearSilenceTimer() {
        if (this.silenceTimeout) {
            clearTimeout(this.silenceTimeout);
            this.silenceTimeout = null; // Reset the timer.
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const chatBot = new ChatBot(); // Initialize the chatbot.
});
