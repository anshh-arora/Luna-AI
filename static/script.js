class ChatBot {
    constructor() {
        this.voiceEnabled = true;
        this.isListening = false;
        this.isSpeaking = false;
        this.synthesis = window.speechSynthesis;
        this.recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        this.silenceTimeout = null;
        this.currentUtterance = null;
        
        this.setupRecognition();
        this.setupEventListeners();
    }

    setupRecognition() {
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.lang = 'en-US';

        this.recognition.onresult = (event) => {
            const message = event.results[0][0].transcript;
            this.clearInput();
            this.sendMessage(message, true);
            this.resetSilenceTimer();
        };

        this.recognition.onend = () => {
            this.isListening = false;
            this.toggleVoiceInputClass(false);
            if (this.autoListening && !this.isSpeaking) {
                this.startListening();
            }
        };
    }

    setupEventListeners() {
        const messageInput = document.getElementById('messageInput');
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                if (e.shiftKey) return;
                e.preventDefault();
                const message = messageInput.value.trim();
                if (message) {
                    this.stopSpeaking();
                    this.stopListening();
                    this.sendMessage(message, false);
                    this.clearInput();
                }
            }
        });

        document.getElementById('sendMessage').addEventListener('click', () => {
            const message = messageInput.value.trim();
            if (message) {
                this.stopSpeaking();
                this.stopListening();
                this.sendMessage(message, false);
                this.clearInput();
            }
        });

        document.getElementById('voiceInput').addEventListener('click', () => {
            this.stopSpeaking();
            if (this.isListening) {
                this.stopListening();
            } else {
                this.startListening();
            }
        });

        document.getElementById('chatMessages').addEventListener('click', () => {
            if (this.isSpeaking) {
                this.stopSpeaking();
            }
        });
    }

    async sendMessage(message, isVoiceInput) {
        this.addMessageToChat(message, 'user');
        this.showTypingIndicator();
    
        try {
            const response = await this.callAPI(message);
            this.removeTypingIndicator();
            this.addMessageToChat(response, 'bot');
            
            if (this.voiceEnabled) {
                this.speak(response);
            }
        } catch (error) {
            console.error('Error:', error);
            this.removeTypingIndicator();
            this.addMessageToChat('Sorry, there was an error processing your request.', 'bot');
            this.isListening = false;
            this.toggleVoiceInputClass(false);
        }
    }

    addMessageToChat(message, sender) {
        const messagesContainer = document.getElementById('chatMessages');
        const templates = document.querySelector('.message-templates');
        
        // Clone the appropriate template
        const messageTemplate = templates.querySelector(sender === 'bot' ? '.bot-message' : '.user-message').cloneNode(true);
        
        // Set the message content
        messageTemplate.querySelector('.message-content').textContent = message;
        
        // Add speaker button for bot messages
        if (sender === 'bot') {
            const speakerButton = document.createElement('button');
            speakerButton.className = 'message-speaker';
            speakerButton.innerHTML = '<i class="fas fa-volume-up"></i>';
            
            speakerButton.onclick = () => {
                if (this.isSpeaking) {
                    this.stopSpeaking();
                    speakerButton.innerHTML = '<i class="fas fa-volume-up"></i>';
                } else {
                    this.stopSpeaking();
                    this.speak(message, () => {
                        speakerButton.innerHTML = '<i class="fas fa-volume-up"></i>';
                    });
                    speakerButton.innerHTML = '<i class="fas fa-volume-mute"></i>';
                }
            };
            
            messageTemplate.querySelector('.message-content').appendChild(speakerButton);
        }
        
        messagesContainer.appendChild(messageTemplate);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    async callAPI(message) {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message })
        });
        if (!response.ok) throw new Error('API request failed');
        const data = await response.json();
        return data.response;
    }

    showTypingIndicator() {
        const indicator = document.createElement('div');
        indicator.className = 'message bot typing-indicator';
        indicator.innerHTML = '<div class="typing-dot"></div>'.repeat(3);
        document.getElementById('chatMessages').appendChild(indicator);
    }

    removeTypingIndicator() {
        const indicator = document.querySelector('.typing-indicator');
        if (indicator) indicator.remove();
    }

    speak(text, onComplete = null) {
        this.stopSpeaking();
        this.stopListening();
        
        const chunks = this.splitTextIntoChunks(text, 200);
        let currentChunkIndex = 0;
        this.isSpeaking = true;
        
        const speakNextChunk = () => {
            if (currentChunkIndex >= chunks.length) {
                this.isSpeaking = false;
                if (this.voiceEnabled) {
                    setTimeout(() => this.startListening(), 500);
                }
                if (onComplete) onComplete();
                return;
            }

            const utterance = new SpeechSynthesisUtterance(chunks[currentChunkIndex]);
            utterance.rate = 1;
            utterance.pitch = 1;

            utterance.onend = () => {
                currentChunkIndex++;
                if (currentChunkIndex < chunks.length) {
                    speakNextChunk();
                } else {
                    this.isSpeaking = false;
                    if (this.voiceEnabled) {
                        setTimeout(() => this.startListening(), 500);
                    }
                    if (onComplete) onComplete();
                }
            };

            utterance.onerror = (event) => {
                console.error('Speech synthesis error:', event.error);
                this.isSpeaking = false;
                if (onComplete) onComplete();
            };

            this.currentUtterance = utterance;
            this.synthesis.speak(utterance);
        };

        speakNextChunk();
    }

    splitTextIntoChunks(text, maxLength) {
        const chunks = [];
        let remainingText = text;

        while (remainingText.length > 0) {
            if (remainingText.length <= maxLength) {
                chunks.push(remainingText);
                break;
            }

            let chunk = remainingText.slice(0, maxLength);
            let lastPeriod = chunk.lastIndexOf('.');
            let lastComma = chunk.lastIndexOf(',');
            let lastSpace = chunk.lastIndexOf(' ');

            let breakPoint = Math.max(
                lastPeriod !== -1 ? lastPeriod + 1 : -1,
                lastComma !== -1 ? lastComma + 1 : -1,
                lastSpace !== -1 ? lastSpace : maxLength
            );

            chunk = remainingText.slice(0, breakPoint);
            chunks.push(chunk);
            remainingText = remainingText.slice(breakPoint).trim();
        }

        return chunks;
    }

    startListening() {
        if (this.isListening || this.isSpeaking) return;
        
        try {
            this.isListening = true;
            this.autoListening = true;
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
        this.autoListening = false;
        this.isListening = false;
        this.toggleVoiceInputClass(false);
        this.recognition.stop();
        this.clearSilenceTimer();
    }

    stopSpeaking() {
        if (this.isSpeaking || this.currentUtterance) {
            this.synthesis.cancel();
            this.currentUtterance = null;
            this.isSpeaking = false;
        }
    }

    clearInput() {
        document.getElementById('messageInput').value = '';
    }

    toggleVoiceInputClass(isListening) {
        const button = document.getElementById('voiceInput');
        button.classList.toggle('listening', isListening);
    }

    startSilenceTimer() {
        this.clearSilenceTimer();
        this.silenceTimeout = setTimeout(() => {
            this.stopListening();
        }, 10000);
    }

    resetSilenceTimer() {
        this.clearSilenceTimer();
        this.startSilenceTimer();
    }

    clearSilenceTimer() {
        if (this.silenceTimeout) {
            clearTimeout(this.silenceTimeout);
            this.silenceTimeout = null;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const chatBot = new ChatBot();
});