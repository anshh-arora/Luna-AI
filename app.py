from flask import Flask, request, jsonify, render_template
from dotenv import load_dotenv
from groq import Groq
import os
import uuid
from gtts import gTTS
import io
import base64
import speech_recognition as sr
import tempfile
import json

try:
    import pyaudio
except ImportError:
    print("Warning: PyAudio not available, speech functionality will be limited")

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
            temperature=0.1,
            max_tokens=1024
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

def speech_to_text(audio_file):
    try:
        # Save the uploaded audio to a temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as temp_audio:
            audio_file.save(temp_audio.name)
            
        # Use SpeechRecognition to convert speech to text
        with sr.AudioFile(temp_audio.name) as source:
            # Adjust recognition settings
            recognizer.dynamic_energy_threshold = True
            recognizer.energy_threshold = 4000
            
            # Record the entire audio file
            audio = recognizer.record(source)
            
            # Perform recognition with increased timeout
            text = recognizer.recognize_google(audio, language='en-US')
            return text
            
    except sr.UnknownValueError:
        return "Could not understand audio"
    except sr.RequestError as e:
        return f"Could not request results; {str(e)}"
    except Exception as e:
        print(f"Error in speech_to_text: {str(e)}")
        return None
    finally:
        # Clean up temporary file
        try:
            os.unlink(temp_audio.name)
        except:
            pass

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        data = request.get_json()
        user_message = data.get('message', '')
        conversation_id = data.get('conversation_id', str(uuid.uuid4()))
        
        if not user_message:
            return jsonify({'error': 'No message provided'}), 400
        
        # Get response from Groq
        response = chat_with_groq(user_message, conversation_id)
        
        # Generate voice response
        audio_io = text_to_speech(response)
        result = {
            'response': response,
            'conversation_id': conversation_id
        }
        
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
        conversation_id = request.form.get('conversation_id', str(uuid.uuid4()))
        
        # Save the audio file temporarily with a .wav extension
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as temp_audio:
            audio_file.save(temp_audio.name)
            
            # Use FFmpeg to convert the audio to the correct format
            output_path = temp_audio.name + '_converted.wav'
            os.system(f'ffmpeg -i {temp_audio.name} -acodec pcm_s16le -ac 1 -ar 16000 {output_path}')
            
            try:
                # Use the converted file for speech recognition
                with sr.AudioFile(output_path) as source:
                    audio = recognizer.record(source)
                    text = recognizer.recognize_google(audio)
                
                if not text:
                    return jsonify({'error': 'Could not transcribe audio'}), 400
                
                # Get response from Groq
                response = chat_with_groq(text, conversation_id)
                
                # Generate voice response
                audio_io = text_to_speech(response)
                result = {
                    'text': text,
                    'response': response,
                    'conversation_id': conversation_id
                }
                
                if audio_io:
                    audio_base64 = base64.b64encode(audio_io.getvalue()).decode('utf-8')
                    result['voice_response'] = audio_base64
                
                return jsonify(result)
                
            finally:
                # Clean up temporary files
                try:
                    os.remove(temp_audio.name)
                    os.remove(output_path)
                except:
                    pass
                    
    except sr.UnknownValueError:
        return jsonify({'error': 'Could not understand audio'}), 400
    except sr.RequestError as e:
        return jsonify({'error': f'Could not request results: {str(e)}'}), 400
    except Exception as e:
        print(f"Error in speech_to_text: {str(e)}")
        return jsonify({'error': str(e)}), 400    
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=7860)