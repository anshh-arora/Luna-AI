from flask import Flask, request, jsonify, render_template, send_file
from dotenv import load_dotenv
from groq import Groq
import os
import uuid
import tempfile
import speech_recognition as sr
from gtts import gTTS
import base64
import io

# Initialize Flask app
app = Flask(__name__, static_folder='static')

# Load environment variables
load_dotenv()

# Groq API Configuration
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
client = Groq(api_key=GROQ_API_KEY)
MODEL = "llama3-70b-8192"

# Initialize speech recognition
recognizer = sr.Recognizer()

# Store conversation history
conversations = {}

def load_base_prompt():
    try:
        with open("base_prompt.txt", "r") as file:
            return file.read().strip()
    except FileNotFoundError:
        print("Error: base_prompt.txt file not found.")
        return "You are a helpful assistant for language learning."

# Load the base prompt
base_prompt = load_base_prompt()

def chat_with_groq(user_message, conversation_id=None):
    try:
        # Get conversation history or create new
        messages = conversations.get(conversation_id, [])
        if not messages:
            messages.append({"role": "system", "content": base_prompt})
        
        # Add user message
        messages.append({"role": "user", "content": user_message})
        
        # Get completion from Groq
        completion = client.chat.completions.create(
            model=MODEL,
            messages=messages,
            temperature=0.7,
        )
        
        # Add assistant's response to history
        assistant_message = completion.choices[0].message.content.strip()
        messages.append({"role": "assistant", "content": assistant_message})
        
        # Update conversation history
        if conversation_id:
            conversations[conversation_id] = messages
        
        return assistant_message
    except Exception as e:
        print(f"Error in chat_with_groq: {str(e)}")
        return f"I apologize, but I'm having trouble responding right now. Error: {str(e)}"

def text_to_speech(text):
    try:
        tts = gTTS(text=text, lang='en')
        audio_io = io.BytesIO()
        tts.write_to_fp(audio_io)
        audio_io.seek(0)
        return audio_io
    except Exception as e:
        print(f"Error in text_to_speech: {str(e)}")
        return None

def speech_to_text(audio_data):
    try:
        # Convert audio data to AudioFile
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as temp_audio:
            temp_audio.write(audio_data)
            temp_audio.flush()
            
            with sr.AudioFile(temp_audio.name) as source:
                audio = recognizer.record(source)
                text = recognizer.recognize_google(audio)
                return text
    except Exception as e:
        print(f"Error in speech_to_text: {str(e)}")
        return None
    finally:
        if 'temp_audio' in locals():
            os.unlink(temp_audio.name)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        data = request.get_json()
        user_message = data.get('message', '')
        conversation_id = data.get('conversation_id', str(uuid.uuid4()))
        voice_output = data.get('voice_output', False)
        
        if not user_message:
            return jsonify({'error': 'No message provided'}), 400
        
        # Get response from Groq
        response = chat_with_groq(user_message, conversation_id)
        
        result = {
            'response': response,
            'conversation_id': conversation_id
        }
        
        # Generate voice response if requested
        if voice_output:
            audio_io = text_to_speech(response)
            if audio_io:
                audio_base64 = base64.b64encode(audio_io.getvalue()).decode('utf-8')
                result['voice_response'] = audio_base64
        
        return jsonify(result)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/voice', methods=['POST'])
def handle_voice():
    try:
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file provided'}), 400
        
        audio_file = request.files['audio']
        audio_data = audio_file.read()
        
        # Convert speech to text
        text = speech_to_text(audio_data)
        
        if not text:
            return jsonify({'error': 'Could not transcribe audio'}), 400
        
        # Get response from Groq
        conversation_id = request.form.get('conversation_id', str(uuid.uuid4()))
        response = chat_with_groq(text, conversation_id)
        
        result = {
            'text': text,
            'response': response,
            'conversation_id': conversation_id
        }
        
        # Generate voice response
        audio_io = text_to_speech(response)
        if audio_io:
            audio_base64 = base64.b64encode(audio_io.getvalue()).decode('utf-8')
            result['voice_response'] = audio_base64
        
        return jsonify(result)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500
