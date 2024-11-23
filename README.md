# Conversational Language Learning Assistant

## 🌐 Project Overview

The Conversational Language Learning Assistant is an innovative web-based application designed to revolutionize language learning through interactive, AI-powered conversations. By leveraging advanced language models and modern web technologies, the app provides a personalized and engaging language learning experience.

## ✨ Key Features

### 🔐 User Management
- Secure user registration and authentication
- Personalized profile creation with details like:
  - Name
  - Mobile number
  - Age
  - Profession
  - Learning objectives
- Persistent login with access to chat history

### 💬 Intelligent Chatbot Interaction
- Dual-mode communication:
  - Text-based chat
  - Voice input and output
- Context-aware conversations powered by Groq's Llama model
- Continuous learning and personalization

### 📊 User Experience
- Full-screen, modern chat interface
- Dynamic message display
- Persistent chat history
- Responsive design for multiple devices

## 🛠 Technology Stack

### Frontend
- **HTML5**: Semantic markup
- **CSS3**: Responsive styling
- **JavaScript**: Interactive features

### Backend
- **Flask**: Python web framework
- **MongoDB Atlas**: Database management
- **Groq API**: Conversational AI

### Additional Technologies
- Speech-to-Text API
- Text-to-Speech synthesis
- WebSocket for real-time communication

## 📁 Project Structure

```
project/
│
├── static/
│   ├── css/
│   │   └── styles.css      # Application styling
│   ├── js/
│   │   └── script.js       # Client-side interactivity
│   └── assets/             # Media and design resources
│
├── templates/
│   ├── index.html          # Main chat interface
│   └── login.html          # User authentication page
│
├── models/
│   └── user.py             # User data schema
│
├── app.py                  # Flask application core
├── requirements.txt        # Python dependencies
└── .env                    # Environment configuration
```

## 🚀 Getting Started

### Prerequisites
- Python 3.8+
- pip
- MongoDB Atlas account
- Groq API key

### Installation Steps

1. Clone the repository
   ```bash
   git clone https://github.com/anshh-arora/conversational-language-learning-assistant.git
   cd conversational-language-learning-assistant
   ```

2. Create a virtual environment
   ```bash
   python -m venv venv
   source venv/bin/activate  # Unix/macOS
   venv\Scripts\activate     # Windows
   ```

3. Install dependencies
   ```bash
   pip install -r requirements.txt
   ```

4. Configure environment variables
   Create a `.env` file with:
   ```
   GROQ_API_KEY=your_groq_api_key
   MONGO_URI=your_mongodb_connection_string
   ```

5. Run the application
   ```bash
   flask run
   ```

## 🔮 Future Roadmap

- [ ] Multi-language support
- [ ] Advanced user progress tracking
- [ ] Grammar correction integration
- [ ] Personalized learning paths
- [ ] Pronunciation assessment

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

## 📧 Contact

Your Name - your.email@example.com

Project Link: [https://github.com/anshh-arora/conversational-language-learning-assistant](https://github.com/anshh-arora/conversational-language-learning-assistant)

---

**Happy Language Learning! 🌍🗣️**