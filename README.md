# **Conversational Language Learning Assistant**  
Your Personal AI Language Coach  

## **Project Aim**  
**Conversational Language Learning Assistant** is an AI-powered virtual assistant designed to help users improve their English or any other language skills through interactive and engaging conversations. The bot leverages the LLaMA model API (via Groq) for intelligent language understanding and response generation. The chatbot allows users to interact using both voice and text inputs, providing real-time corrections and feedback on pronunciation and grammar.  

Additionally, the app integrates Wikipedia or Google to answer user queries that fall outside the LLM's knowledge scope. All user conversation history is saved in a text file for personalized learning, while user details and login information are stored securely in MongoDB Atlas.  

---

## **Key Features**  
1. **Two Modes of Interaction**:  
   - **Text-based**: Chat with the bot by typing.  
   - **Voice-based**: Use your microphone to talk, and the bot will respond via speech.  

2. **Personalized Feedback**:  
   - Corrects grammar, pronunciation, and sentence structure.  
   - Provides encouragement to help build user confidence.  

3. **Knowledge Integration**:  
   - Uses Google or Wikipedia APIs to provide answers for specific queries.  

4. **User Login and Personalization**:  
   - Users fill out a login form (name, age, purpose) when they first access the app.  
   - The app remembers the user’s name and preferences for a more tailored experience.  

5. **History Storage**:  
   - Conversation history is saved in a `.txt` file for future reference.  
   - This history can also be used to fine-tune the bot for the user.  

6. **Database Integration**:  
   - User details (e.g., login info) are securely stored in MongoDB Atlas.  

---

## **Technologies Used**  
- **Frontend**: Gradio  
- **Backend**: Python  
- **Database**: MongoDB Atlas  
- **API/Model**:  
  - LLaMA model (via Groq) for natural language processing.  
  - Google/Wikipedia APIs for query resolution.  
- **Libraries**:  
  - Speech Recognition (`speech_recognition`) for voice input.  
  - pyttsx3 or gTTS for text-to-speech conversion.  
  - Flask/FastAPI for backend logic (optional).  

---

## **How to Achieve This**  
### **Step 1: Learn the Required Skills**  
- **Python Programming**: Learn Python basics and libraries like Gradio, MongoDB, and APIs.  
- **Gradio**: Understand how to build interactive UIs.  
- **MongoDB Atlas**: Learn database integration with Python using `pymongo`.  
- **REST APIs**: Understand how to call and use APIs (Google/Wikipedia).  
- **Speech Processing**: Learn libraries like `speech_recognition` and `pyttsx3`.  

### **Step 2: Build the App**  
1. Set up the Gradio interface with login functionality.  
2. Integrate the LLaMA model API for language understanding and response generation.  
3. Implement voice input and text-to-speech for seamless interaction.  
4. Add a fallback system using Google or Wikipedia for external queries.  
5. Save user data in MongoDB Atlas and chat history in text files.  

### **Step 3: Test and Deploy**  
- Test the app locally.  
- Deploy it on a cloud platform (e.g., AWS, Heroku, or Google Cloud).  

---

## **Setup Instructions**  
1. Clone the repository:  
   ```bash  
   git clone https://github.com/your-username/conversational-language-assistant.git  
   cd conversational-language-assistant  

## To-Do List
1. Set up MongoDB Atlas for user login details storage.
2. Implement Gradio interface with login functionality.
3. Add LLaMA model API integration for language conversation.
4. Integrate voice input and text-to-speech features.
5. Add Google/Wikipedia API for fallback.
6. Save conversation history in text files.
7. Test and deploy the app.


## Future Scope
1. Add multi-language support for users wanting to learn languages other than English.
2. Introduce gamified learning elements to make language practice fun.
3. Allow users to review and analyze their conversation history for improvement.