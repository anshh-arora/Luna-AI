class ChatBot {
    constructor() {
        this.voiceEnabled = false;
        this.isListening = false;
        this.synthesis = window.speechSynthesis;
        this.recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        this.currentUtterance = null;
        this.isPaused = false;
        this.audioQueue = [];
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        
        this.setupRecognition();
        this.setupEventListeners();
    }

    setupRecognition() {
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';

        this.recognition.onstart = () => {
            this.isListening = true;
            this.toggleVoiceInputClass(true);
        };

        this.recognition.onend = () => {
            this.isListening = false;
            this.toggleVoiceInputClass(false);
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.isListening = false;
            this.toggleVoiceInputClass(false);
        };

        this.recognition.onresult = (event) => {
            let finalTranscript = '';
            let interimTranscript = '';
            
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript + ' ';
                } else {
                    interimTranscript += transcript;
                }
            }

            const input = document.getElementById('messageInput');
            input.value = finalTranscript + interimTranscript;
        };
    }

    setupEventListeners() {
        // Send button click event
        document.getElementById('sendMessage').addEventListener('click', () => this.handleSendMessage());

        // Voice input button
        document.getElementById('voiceInput').addEventListener('mousedown', () => {
            this.startRecording();
        });

        document.getElementById('voiceInput').addEventListener('mouseup', () => {
            this.stopRecording();
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

    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];
            this.isRecording = true;
            
            this.mediaRecorder.ondataavailable = (event) => {
                this.audioChunks.push(event.data);
            };

            this.mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
                await this.sendAudioToServer(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            };

            this.mediaRecorder.start();
            this.toggleVoiceInputClass(true);
        } catch (error) {
            console.error('Error starting recording:', error);
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            this.toggleVoiceInputClass(false);
        }
    }

    async sendAudioToServer(audioBlob) {
        const formData = new FormData();
        formData.append('audio', audioBlob);

        try {
            const response = await fetch('/api/voice', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error('Failed to send audio');

            const data = await response.json();
            if (data.text) {
                document.getElementById('messageInput').value = data.text;
            }
            if (data.response) {
                this.addMessage(data.response, 'bot');
                if (this.voiceEnabled) {
                    this.speak(data.response);
                }
            }
        } catch (error) {
            console.error('Error sending audio:', error);
            this.addMessage('Sorry, there was an error processing your voice input.', 'bot');
        }
    }

    handleSendMessage() {
        const input = document.getElementById('messageInput');
        const message = input.value.trim();
        if (message) {
            this.stopSpeaking();
            this.sendMessage(message);
            input.value = '';
        }
    }

    async sendMessage(message) {
        this.addMessage(message, 'user');
        this.showTypingIndicator();

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message })
            });

            if (!response.ok) throw new Error('Failed to send message');

            const data = await response.json();
            this.removeTypingIndicator();
            this.addMessage(data.response, 'bot');

            if (this.voiceEnabled) {
                this.speak(data.response);
            }
        } catch (error) {
            console.error('Error:', error);
            this.removeTypingIndicator();
            this.addMessage('Sorry, there was an error processing your request.', 'bot');
        }
    }

    speak(text) {
        if (this.synthesis.speaking) {
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

    toggleVoiceInputClass(isActive) {
        const button = document.getElementById('voiceInput');
        button.classList.toggle('active', isActive);
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
}

document.addEventListener('DOMContentLoaded', () => {
    window.chatBot = new ChatBot();
});