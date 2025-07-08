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

@app.route("/", methods=["GET"])
def root():
    return send_from_directory(app.static_folder, "index.html")

@app.route("/<path:path>")
def static_proxy(path):
    return send_from_directory(app.static_folder, path)

# Simplified /chats endpoint (not strictly needed, but can return info if desired)
@app.route("/chats", methods=["GET"])
def get_chats():
    # Ensure an anonymous chat ID exists for the session
    if "anon_chat_id" not in session:
        session["anon_chat_id"] = str(uuid.uuid4())
        session["anon_history"] = []
    
    # Return a dummy chat to satisfy any frontend expectation of a list
    return jsonify({
        "chats": [{"chat_id": session["anon_chat_id"], "title": "Your Chat"}]
    })

@app.route("/history/<chat_id>", methods=["GET"])
def get_history(chat_id):
    # This route now ALWAYS serves the history of the CURRENT anonymous session.
    # The 'chat_id' parameter from the URL is ignored, as there's only one anonymous session.
    if "anon_chat_id" not in session:
        session["anon_chat_id"] = str(uuid.uuid4())
        session["anon_history"] = []
    
    return jsonify({"history": session.get("anon_history", [])})

@app.route("/chat/<chat_id>", methods=["POST"])
def chat(chat_id):
    # This route now ALWAYS handles messages for the CURRENT anonymous session.
    # The 'chat_id' parameter from the URL is ignored, as there's only one anonymous session.
    if "anon_chat_id" not in session:
        session["anon_chat_id"] = str(uuid.uuid4())
        session["anon_history"] = []
    
    anon_history = session.get("anon_history", [])
    prompt = request.json.get("prompt", "")

    # The message limit for anonymous users
    if len([msg for msg in anon_history if msg["role"] == "user"]) >= 5:
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
        "chat_id": session["anon_chat_id"] # Always return the actual session ID
    })
