from flask import Flask, request, jsonify, session
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
import shelve
import os

# Add this import
import lmstudio as lms

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

# Initialize the model once (outside the route)
model = lms.llm("llama-3.2-1b-instruct")

@app.route("/chat", methods=["POST"])
def chat():
    if "username" not in session:
        return jsonify({"error": "Not authenticated"}), 401
    username = session["username"]
    prompt = request.json.get("prompt", "")
    memory = get_memory(username)
    memory.append({"role": "user", "content": prompt})

    # Build the conversation history for context
    history = []
    for msg in memory:
        if msg["role"] == "user":
            history.append(f"User: {msg['content']}")
        elif msg["role"] == "assistant":
            history.append(f"AI: {msg['content']}")
    conversation = "\n".join(history)
    instruction = (
        "You are a helpful AI assistant. "
        "Format all your answers using Markdown. "
        "Do not say that you are using Markdown or mention formatting."
    )
    full_prompt = f"{instruction}\n\n{conversation}\nAI:"

    # Call LM Studio model
    ai_response = model.respond(full_prompt)

    memory.append({"role": "assistant", "content": ai_response})
    save_memory(username, memory)
    return jsonify({"response": ai_response})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=False)
