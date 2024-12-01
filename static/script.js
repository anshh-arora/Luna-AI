class ChatBot {
    constructor() {
        this.voiceEnabled = false; // Determines if voice responses are enabled.
        this.isListening = false;  // Tracks if the bot is currently listening for voice input.
        this.synthesis = window.speechSynthesis; // Handles text-to-speech.
        this.recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)(); // Handles speech recognition (voice input).
        this.silenceTimeout = null; // Timer for detecting user silence.
        
        this.setupRecognition(); // Initialize speech recognition settings.
        this.setupEventListeners(); // Add event listeners for user interactions.
    }

    setupRecognition() {
        this.recognition.continuous = false; // Stops listening after one phrase.
        this.recognition.interimResults = false; // Does not return intermediate results.
        this.recognition.lang = 'en-US'; // Language set to English (US).

        // Event fired when speech recognition returns a result.
        this.recognition.onresult = (event) => {
            const message = event.results[0][0].transcript; // Get the recognized text.
            this.clearInput(); // Clear the input field.
            this.sendMessage(message, true); // Send the message (voice input).
            this.resetSilenceTimer(); // Reset silence timer after user speaks.
        };

        // Event fired when recognition ends or times out.
        this.recognition.onend = () => {
            this.isListening = false;
            this.toggleVoiceInputClass(false); // Update UI to reflect the state.
        };
    }

    setupEventListeners() {
        // Click event for the "Send" button.
        document.getElementById('sendMessage').addEventListener('click', () => {
            const input = document.getElementById('messageInput');
            const message = input.value.trim(); // Get the trimmed input text.
            if (message) {
                this.stopSpeaking(); // Stop any ongoing speech.
                this.sendMessage(message, false); // Send the message (text input).
                this.clearInput(); // Clear the input field.
            }
        });

        // Click event for the microphone button (voice input toggle).
        document.getElementById('voiceInput').addEventListener('click', () => {
            this.stopSpeaking(); // Stop any ongoing speech.
            this.isListening ? this.stopListening() : this.startListening(); // Toggle listening state.
        });

        // Click event for enabling/disabling voice responses.
        document.getElementById('toggleVoice').addEventListener('click', () => {
            this.voiceEnabled = !this.voiceEnabled; // Toggle voice response state.
            this.updateVoiceIcon(); // Update the UI icon to reflect the state.
        });

        // Enter key event for sending a message without a line break.
        document.getElementById('messageInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault(); // Prevent default behavior (new line).
                document.getElementById('sendMessage').click(); // Trigger click event.
            }
        });
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
