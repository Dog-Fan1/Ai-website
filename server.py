from flask import Flask, request, jsonify, session
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
import shelve
import os
import requests

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", os.urandom(24))
CORS(app, supports_credentials=True)

USER_DB = "users.db"
MEMORY_DB = "memory.db"

def get_user(username):
    with shelve.open(USER_DB) as db:
        return db.get(username)

def save_user(username, password_hash):
    with shelve.open(USER_DB, writeback=True) as db:
        db[username] = password_hash

def get_memory(username):
    with shelve.open(MEMORY_DB) as db:
        return db.get(username, [])

def save_memory(username, memory):
    with shelve.open(MEMORY_DB, writeback=True) as db:
        db[username] = memory

@app.route("/", methods=["GET"])
def home():
    return "Backend is running! Use the frontend to interact.", 200

@app.route("/signup", methods=["POST"])
def signup():
    data = request.json
    username = data.get("username")
    password = data.get("password")
    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400
    if get_user(username):
        return jsonify({"error": "User already exists"}), 400
    password_hash = generate_password_hash(password)
    save_user(username, password_hash)
    return jsonify({"message": "User created successfully"})

@app.route("/login", methods=["POST"])
def login():
    data = request.json
    username = data.get("username")
    password = data.get("password")
    password_hash = get_user(username)
    if not password_hash or not check_password_hash(password_hash, password):
        return jsonify({"error": "Invalid credentials"}), 401
    session["username"] = username
    return jsonify({"message": "Login successful"})

@app.route("/logout", methods=["POST"])
def logout():
    session.pop("username", None)
    return jsonify({"message": "Logged out"})

@app.route("/chat", methods=["POST"])
def chat():
    if "username" not in session:
        return jsonify({"error": "Not authenticated"}), 401
    username = session["username"]
    prompt = request.json.get("prompt", "")
    memory = get_memory(username)
    memory.append({"role": "user", "content": prompt})

    # Prepare messages for Groq Llama-3 API
    messages = [{"role": "system", "content": "You are a helpful AI assistant."}]
    for msg in memory:
        messages.append({"role": msg["role"], "content": msg["content"]})

    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        return jsonify({"error": "Groq API key not set"}), 500

    response = requests.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        },
        json={
            "model": "llama3-70b-8192",  # Or "llama3-8b-8192" for the smaller model
            "messages": messages,
            "max_tokens": 500
        }
    )

    if response.status_code != 200:
        return jsonify({"error": "Groq API error", "details": response.text}), 500

    data = response.json()
    ai_response = data["choices"][0]["message"]["content"]

    memory.append({"role": "assistant", "content": ai_response})
    save_memory(username, memory)
    return jsonify({"response": ai_response})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=False)
