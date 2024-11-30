from flask import Flask, render_template, request, redirect, url_for, session, jsonify, send_file
from flask_pymongo import PyMongo
from flask_bcrypt import Bcrypt
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from dotenv import load_dotenv
from groq import Groq
import os
import uuid
from datetime import datetime, timedelta
import speech_recognition as sr
from gtts import gTTS
import tempfile
import time
import threading
import queue

# Load environment variables
load_dotenv()

# Flask App Initialization
app = Flask(__name__)
app.config["MONGO_URI"] = os.getenv("MONGO_URI")
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY")
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(days=7)

# MongoDB and Bcrypt Setup
mongo = PyMongo(app)
bcrypt = Bcrypt(app)

# Flask-Login Setup
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = "login"

# Groq API Configuration
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
client = Groq(api_key=GROQ_API_KEY)
MODEL = "llama3-70b-8192"

# MongoDB Collections
users_collection = mongo.db.users
conversations_collection = mongo.db.conversations
messages_collection = mongo.db.messages
sessions_collection = mongo.db.sessions
user_preferences_collection = mongo.db.user_preferences

# Thread-safe queue for TTS requests
tts_queue = queue.Queue()

# Constants
MAX_CONVERSATIONS = 100000000000
DEFAULT_LANGUAGE = "English"

# Helper Classes and Functions
class User(UserMixin):
    def __init__(self, user_data):
        self.id = str(user_data["_id"])
        self.name = user_data["name"]
        self.email = user_data["email"]
        self.preferred_language = user_data.get("preferred_language", DEFAULT_LANGUAGE)
        self.learning_goals = user_data.get("learning_goals", [])
        self.proficiency_level = user_data.get("proficiency_level", "beginner")

@login_manager.user_loader
def load_user(user_id):
    user_data = users_collection.find_one({"_id": user_id})
    return User(user_data) if user_data else None

def text_to_speech(text):
    """Convert text to speech and return audio file path."""
    try:
        tts = gTTS(text=text, lang='en')
        with tempfile.NamedTemporaryFile(delete=False, suffix='.mp3') as fp:
            temp_filename = fp.name
            tts.save(temp_filename)
            return temp_filename
    except Exception as e:
        print(f"TTS Error: {str(e)}")
        return None

def speech_to_text(audio_data):
    """Convert speech to text using recognition."""
    recognizer = sr.Recognizer()
    try:
        text = recognizer.recognize_google(audio_data)
        return text
    except sr.UnknownValueError:
        return "Could not understand audio"
    except sr.RequestError as e:
        return f"Could not request results; {str(e)}"

def cleanup_temp_audio_files():
    """Clean up old temporary audio files."""
    temp_dir = tempfile.gettempdir()
    current_time = time.time()
    for filename in os.listdir(temp_dir):
        if filename.endswith('.mp3'):
            filepath = os.path.join(temp_dir, filename)
            if current_time - os.path.getctime(filepath) > 3600:  # 1 hour old
                try:
                    os.remove(filepath)
                except:
                    pass

def load_base_prompt():
    try:
        with open("base_prompt.txt", "r") as file:
            return file.read().strip()
    except FileNotFoundError:
        print("Error: base_prompt.txt file not found.")
        return "You are a helpful assistant for language learning."

def get_base_prompt(user_name):
    base_prompt = load_base_prompt()
    return base_prompt.replace("{user_name}", user_name)

def get_user_preferences(user_id):
    """Get user preferences including language learning details."""
    prefs = user_preferences_collection.find_one({"user_id": user_id})
    if not prefs:
        return {
            "target_language": DEFAULT_LANGUAGE,
            "proficiency_level": "beginner",
            "learning_goals": [],
            "preferred_topics": [],
            "daily_practice_time": 30
        }
    return prefs

def get_personalized_prompt(user_id):
    """Generate a personalized prompt based on user preferences."""
    user_data = users_collection.find_one({"_id": user_id})
    prefs = get_user_preferences(user_id)
    
    base_prompt = load_base_prompt()
    return base_prompt.format(
        user_name=user_data["name"],
        target_language=prefs["target_language"],
        proficiency_level=prefs["proficiency_level"],
        learning_goals=", ".join(prefs["learning_goals"])
    )

def cleanup_old_conversations(user_id):
    """Delete oldest conversations if user exceeds maximum limit."""
    conversation_count = conversations_collection.count_documents({"user_id": user_id})
    if conversation_count >= MAX_CONVERSATIONS:
        excess_count = conversation_count - MAX_CONVERSATIONS + 1
        oldest_conversations = conversations_collection.find(
            {"user_id": user_id}
        ).sort("updated_at", 1).limit(excess_count)

        for conv in oldest_conversations:
            conv_id = conv["_id"]
            conversations_collection.delete_one({"_id": conv_id})
            messages_collection.delete_many({"conversation_id": conv_id})
            sessions_collection.delete_one({
                "user_id": user_id,
                "conversation_id": conv_id
            })

def save_session_history(user_id, conversation_id, messages):
    """Save session history to MongoDB."""
    session_data = {
        "user_id": user_id,
        "conversation_id": conversation_id,
        "messages": messages,
        "updated_at": datetime.utcnow()
    }
    
    sessions_collection.update_one(
        {"user_id": user_id, "conversation_id": conversation_id},
        {"$set": session_data},
        upsert=True
    )

def get_session_history(user_id, conversation_id):
    """Retrieve session history from MongoDB."""
    session = sessions_collection.find_one({
        "user_id": user_id,
        "conversation_id": conversation_id
    })
    return session.get("messages", []) if session else []

def chat_with_groq(conversation_history, user_query, user_id):
    """Enhanced chat function with personalized context."""
    try:
        personalized_prompt = get_personalized_prompt(user_id)
        messages = [
            {"role": "system", "content": personalized_prompt},
        ]
        
        prefs = get_user_preferences(user_id)
        context_message = (
            f"Remember: The user is learning {prefs['target_language']} at a "
            f"{prefs['proficiency_level']} level. They typically practice for "
            f"{prefs['daily_practice_time']} minutes per day."
        )
        messages.append({"role": "system", "content": context_message})
        
        for msg in conversation_history[-10:]:
            role = "assistant" if msg["is_bot"] else "user"
            messages.append({"role": role, "content": msg["content"]})
        
        messages.append({"role": "user", "content": user_query})
        
        completion = client.chat.completions.create(
            model=MODEL,
            messages=messages,
            temperature=0.7,
            max_tokens=2048,
            top_p=0.95
        )
        
        return completion.choices[0].message.content.strip()
    except Exception as e:
        print(f"Error in chat_with_groq: {str(e)}")
        return f"I apologize, but I'm having trouble responding right now. Error: {str(e)}"
    
    # Routes
@app.route("/")
@login_required
def home():
    session.permanent = True
    return render_template("index.html", email=current_user.email)

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        email = request.form.get("email")
        password = request.form.get("password")
        
        user_data = users_collection.find_one({"email": email})
        if user_data and bcrypt.check_password_hash(user_data["password"], password):
            user = User(user_data)
            login_user(user, remember=True)
            session.permanent = True
            return redirect(url_for("home"))
            
        return render_template("login.html", error="Invalid credentials")
    
    return render_template("login.html")

@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        name = request.form.get("name")
        email = request.form.get("email")
        password = request.form.get("password")
        mobile = request.form.get("mobile")
        target_language = request.form.get("target_language", DEFAULT_LANGUAGE)
        proficiency_level = request.form.get("proficiency_level", "beginner")

        if users_collection.find_one({"email": email}):
            return render_template("register.html", error="Email already registered")

        user_id = str(uuid.uuid4())
        new_user = {
            "_id": user_id,
            "name": name,
            "email": email,
            "password": bcrypt.generate_password_hash(password).decode("utf-8"),
            "mobile": mobile,
            "created_at": datetime.utcnow(),
            "preferred_language": target_language,
            "proficiency_level": proficiency_level
        }
        
        users_collection.insert_one(new_user)
        
        initial_preferences = {
            "user_id": user_id,
            "target_language": target_language,
            "proficiency_level": proficiency_level,
            "learning_goals": [],
            "preferred_topics": [],
            "daily_practice_time": 30,
            "created_at": datetime.utcnow()
        }
        user_preferences_collection.insert_one(initial_preferences)
        
        return redirect(url_for("login"))

    return render_template("register.html")

@app.route("/query", methods=["POST"])
@login_required
def query():
    """Enhanced query handler with voice support."""
    data = request.json
    user_query = data.get("question", "").strip()
    conversation_id = data.get("conversationId")
    voice_output = data.get("voiceOutput", False)
    
    if not user_query or not conversation_id:
        return jsonify({"error": "Invalid request"}), 400

    history = get_session_history(current_user.id, conversation_id)
    bot_response = chat_with_groq(history, user_query, current_user.id)

    user_message = {
        "content": user_query,
        "is_bot": False,
        "created_at": datetime.utcnow(),
        "user_name": current_user.name,
        "user_proficiency": get_user_preferences(current_user.id)["proficiency_level"]
    }
    
    bot_message = {
        "content": bot_response,
        "is_bot": True,
        "created_at": datetime.utcnow()
    }

    messages_collection.insert_many([
        {**user_message, "_id": str(uuid.uuid4()), "conversation_id": conversation_id},
        {**bot_message, "_id": str(uuid.uuid4()), "conversation_id": conversation_id}
    ])

    history.extend([user_message, bot_message])
    save_session_history(current_user.id, conversation_id, history)
    
    conversations_collection.update_one(
        {"_id": conversation_id},
        {
            "$set": {
                "updated_at": datetime.utcnow(),
                "last_interaction": datetime.utcnow(),
                "user_proficiency": user_message["user_proficiency"]
            }
        }
    )

    audio_url = None
    if voice_output:
        try:
            audio_file_path = text_to_speech(bot_response)
            if audio_file_path:
                audio_url = f"/get-audio/{os.path.basename(audio_file_path)}"
        except Exception as e:
            print(f"Voice output error: {str(e)}")

    return jsonify({
        "response": bot_response,
        "conversationId": conversation_id,
        "audioUrl": audio_url
    })

@app.route("/speech-to-text", methods=["POST"])
@login_required
def handle_speech_to_text():
    """Handle voice input from client."""
    if "audio" not in request.files:
        return jsonify({"error": "No audio file provided"}), 400
    
    audio_file = request.files["audio"]
    recognizer = sr.Recognizer()
    
    try:
        with sr.AudioFile(audio_file) as source:
            audio_data = recognizer.record(source)
        text = speech_to_text(audio_data)
        return jsonify({"text": text})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/text-to-speech", methods=["POST"])
@login_required
def handle_text_to_speech():
    """Convert text to speech and return audio file."""
    data = request.json
    text = data.get("text")
    
    if not text:
        return jsonify({"error": "No text provided"}), 400
    
    try:
        audio_file_path = text_to_speech(text)
        if audio_file_path:
            return send_file(
                audio_file_path,
                mimetype="audio/mp3",
                as_attachment=True,
                download_name="response.mp3"
            )
        else:
            return jsonify({"error": "Failed to generate speech"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/get-audio/<filename>")
@login_required
def get_audio(filename):
    """Serve generated audio files."""
    try:
        return send_file(
            os.path.join(tempfile.gettempdir(), filename),
            mimetype="audio/mp3"
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/new-conversation", methods=["POST"])
@login_required
def new_conversation():
    """Create a new conversation."""
    conversation_id = str(uuid.uuid4())
    conversation = {
        "_id": conversation_id,
        "user_id": current_user.id,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "title": "New Conversation"
    }
    
    conversations_collection.insert_one(conversation)
    cleanup_old_conversations(current_user.id)
    
    return jsonify({
        "conversationId": conversation_id,
        "title": "New Conversation"
    })

@app.route("/conversations")
@login_required
def get_conversations():
    """Get user's conversations."""
    conversations = conversations_collection.find(
        {"user_id": current_user.id}
    ).sort("updated_at", -1)
    
    return jsonify([{
        "id": str(conv["_id"]),
        "title": conv.get("title", "Untitled"),
        "updated_at": conv["updated_at"].isoformat()
    } for conv in conversations])

@app.route("/conversation/<conversation_id>")
@login_required
def get_conversation(conversation_id):
    """Get messages from a specific conversation."""
    messages = messages_collection.find(
        {"conversation_id": conversation_id}
    ).sort("created_at", 1)
    
    return jsonify([{
        "content": msg["content"],
        "is_bot": msg["is_bot"],
        "created_at": msg["created_at"].isoformat()
    } for msg in messages])

@app.route("/update-preferences", methods=["POST"])
@login_required
def update_preferences():
    """Update user preferences."""
    data = request.json
    user_preferences_collection.update_one(
        {"user_id": current_user.id},
        {
            "$set": {
                "target_language": data.get("target_language", DEFAULT_LANGUAGE),
                "proficiency_level": data.get("proficiency_level", "beginner"),
                "learning_goals": data.get("learning_goals", []),
                "preferred_topics": data.get("preferred_topics", []),
                "daily_practice_time": data.get("daily_practice_time", 30),
                "updated_at": datetime.utcnow()
            }
        },
        upsert=True
    )
    return jsonify({"status": "success"})

@app.route("/logout")
@login_required
def logout():
    """Log out the current user."""
    logout_user()
    return redirect(url_for("login"))

@app.route("/delete-conversation/<conversation_id>", methods=["DELETE"])
@login_required
def delete_conversation(conversation_id):
    """Delete a specific conversation and its messages."""
    conversations_collection.delete_one({
        "_id": conversation_id,
        "user_id": current_user.id
    })
    messages_collection.delete_many({"conversation_id": conversation_id})
    sessions_collection.delete_one({
        "user_id": current_user.id,
        "conversation_id": conversation_id
    })
    return jsonify({"status": "success"})

@app.route("/rename-conversation/<conversation_id>", methods=["PUT"])
@login_required
def rename_conversation(conversation_id):
    """Rename a conversation."""
    new_title = request.json.get("title", "Untitled")
    conversations_collection.update_one(
        {"_id": conversation_id, "user_id": current_user.id},
        {"$set": {"title": new_title}}
    )
    return jsonify({"status": "success"})

def start_cleanup_thread():
    """Start a background thread to clean up old audio files."""
    def cleanup_loop():
        while True:
            cleanup_temp_audio_files()
            time.sleep(3600)  # Run every hour
    
    cleanup_thread = threading.Thread(target=cleanup_loop, daemon=True)
    cleanup_thread.start()

if __name__ == "__main__":
    start_cleanup_thread()
    app.run(debug=True)