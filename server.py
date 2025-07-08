from flask import Flask, request, jsonify, session, send_from_directory
from flask_cors import CORS
import os
import requests
import uuid

app = Flask(__name__, static_folder="static")
# Keep a strong secret key for session management
app.secret_key = os.environ.get("SECRET_KEY", os.urandom(24))
app.config['SESSION_COOKIE_SAMESITE'] = "None"
app.config['SESSION_COOKIE_SECURE'] = True
CORS(app, supports_credentials=True)

# No more USER_DB or CHATS_DB needed as we're removing user accounts

@app.route("/", methods=["GET"])
def root():
    return send_from_directory(app.static_folder, "index.html")

@app.route("/<path:path>")
def static_proxy(path):
    return send_from_directory(app.static_folder, path)

# Removed /signup and /login routes entirely

# Removed /logout route as there's no login

# Removed /new_chat as there's only one anonymous chat session

# Simplified /chats endpoint (not strictly needed, but can return info if desired)
@app.route("/chats", methods=["GET"])
def get_chats():
    # For a single anonymous user, we can just return a placeholder chat or nothing.
    # The frontend will be adapted to not expect a list of chats.
    if "anon_chat_id" not in session:
        session["anon_chat_id"] = str(uuid.uuid4())
        session["anon_history"] = []
    
    # Return a dummy chat to satisfy the frontend's expected structure initially
    # The frontend's JS will be updated to not rely on this for navigation
    return jsonify({
        "chats": [{"chat_id": session["anon_chat_id"], "title": "Your Chat"}]
    })

@app.route("/history/<chat_id>", methods=["GET"])
def get_history(chat_id):
    # This route now ONLY serves the anonymous chat history
    if "anon_chat_id" in session and session["anon_chat_id"] == chat_id:
        return jsonify({"history": session.get("anon_history", [])})
    
    # If no anon_chat_id in session or a different ID is requested, create/return empty
    if "anon_chat_id" not in session:
        session["anon_chat_id"] = str(uuid.uuid4())
        session["anon_history"] = []
    
    # Ensure the requested chat_id matches the anon_chat_id for security/consistency
    if chat_id != session["anon_chat_id"]:
        return jsonify({"error": "Invalid chat ID for anonymous user"}), 403

    return jsonify({"history": session.get("anon_history", [])})

@app.route("/chat/<chat_id>", methods=["POST"])
def chat(chat_id):
    # This route now ONLY handles anonymous chat
    if "anon_chat_id" not in session:
        session["anon_chat_id"] = str(uuid.uuid4())
        session["anon_history"] = []
    
    anon_chat_id = session["anon_chat_id"]
    
    # Ensure the requested chat_id matches the current anonymous session chat_id
    if chat_id != anon_chat_id:
        return jsonify({"error": "Anonymous users can only use their own chat session"}), 403
    
    prompt = request.json.get("prompt", "")
    anon_history = session.get("anon_history", [])

    # The message limit for anonymous users is now the only "limitation"
    # This limit is reset when the session expires (e.g., browser close, or server restart)
    if len([msg for msg in anon_history if msg["role"] == "user"]) >= 5:
        # Instead of prompting to sign up, just tell them to restart or that limit is hit.
        return jsonify({"error": "Message limit reached. Please close and reopen your browser or clear cookies to start a new anonymous chat."}), 403
    
    anon_history.append({"role": "user", "content": prompt})

    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        return jsonify({"error": "GROQ_API_KEY is not configured on the server."}), 500

    messages = [{"role": "system", "content": "You are AmberMind, a warm and insightful AI assistant. Always use Markdown formatting in your responses."}]
    for msg in anon_history:
        messages.append({"role": msg["role"], "content": msg["content"]})

    try:
        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            json={
                "model": "llama3-70b-8192",
                "messages": messages,
                "max_tokens": 500
            }
        )
        response.raise_for_status() # Raise an HTTPError for bad responses (4xx or 5xx)
        data = response.json()
        ai_response = data["choices"][0]["message"]["content"]
    except requests.exceptions.RequestException as e:
        print(f"Groq API request failed: {e}")
        return jsonify({"error": "Groq API error", "details": str(e)}), 500
    except KeyError as e:
        print(f"Unexpected Groq API response format: {data}")
        return jsonify({"error": "Unexpected API response format", "details": str(e)}), 500


    anon_history.append({"role": "assistant", "content": ai_response})
    session["anon_history"] = anon_history # Update session with new history
    
    return jsonify({
        "response": ai_response,
        "history": anon_history,
        "chat_id": anon_chat_id # Return the chat_id for frontend consistency
    })

# Removed /admin route and functionality
# The concept of "Admin" users no longer exists without login.
