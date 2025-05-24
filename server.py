from flask import Flask, request, jsonify, send_from_directory, session
import sqlite3
import os

app = Flask(__name__, static_folder='.')
app.secret_key = 'your-super-secret-key'  # Use a strong key in production

# ---------------------
# Frontend Routes
# ---------------------

@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

@app.route('/script.js')
def serve_js():
    return send_from_directory('.', 'script.js')

@app.route('/styles.css')
def serve_css():
    return send_from_directory('.', 'styles.css')


# ---------------------
# Authentication Logic
# ---------------------

def init_db():
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )
    ''')
    conn.commit()
    conn.close()

@app.route('/signup', methods=['POST'])
def signup():
    data = request.get_json()
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()

    if not username or not password:
        return jsonify(error="Username and password required"), 400

    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    try:
        c.execute("INSERT INTO users (username, password) VALUES (?, ?)", (username, password))
        conn.commit()
        return jsonify(message="User created successfully")
    except sqlite3.IntegrityError:
        return jsonify(error="Username already exists"), 409
    finally:
        conn.close()

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()

    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    c.execute("SELECT * FROM users WHERE username = ? AND password = ?", (username, password))
    user = c.fetchone()
    conn.close()

    if user:
        session['username'] = username
        return jsonify(message="Login successful")
    else:
        return jsonify(error="Invalid username or password"), 401

@app.route('/logout', methods=['POST'])
def logout():
    session.pop('username', None)
    return jsonify(message="Logged out")


# ---------------------
# Chat Route (Authenticated)
# ---------------------

@app.route('/chat', methods=['POST'])
def chat():
    if 'username' not in session:
        return jsonify(error="Not authenticated"), 401

    data = request.get_json()
    prompt = data.get('prompt', '').strip()

    if not prompt:
        return jsonify(error="Prompt is required"), 400

    # Fake response for now
    return jsonify(response=f"Echo: {prompt}")

# ---------------------
# Run the App
# ---------------------

if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5000)
