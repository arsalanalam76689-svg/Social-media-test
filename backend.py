from flask import Flask, request, jsonify, render_template
import json
import os
import uuid
from datetime import datetime

app = Flask(__name__)
DATA_DIR = 'data'
USERS_FILE = os.path.join(DATA_DIR, 'users.json')
POSTS_FILE = os.path.join(DATA_DIR, 'posts.json')

# --- Helper Functions for File Storage ---
def init_files():
    if not os.path.exists(DATA_DIR): os.makedirs(DATA_DIR)
    if not os.path.exists(USERS_FILE):
        with open(USERS_FILE, 'w') as f: json.dump({}, f)
    if not os.path.exists(POSTS_FILE):
        with open(POSTS_FILE, 'w') as f: json.dump([], f)

def load_data(filepath):
    with open(filepath, 'r') as f: return json.load(f)

def save_data(filepath, data):
    with open(filepath, 'w') as f: json.dump(data, f, indent=4)

# --- Routes ---
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/auth', methods=['POST'])
def auth():
    data = request.json
    action = data.get('action')
    users = load_data(USERS_FILE)
    username = data.get('username')

    if action == 'signup':
        if username in users:
            return jsonify({"error": "Username already exists"}), 400
        users[username] = {
            "password": data.get('password'), # Stored in plain text for easy VS Code inspection
            "displayName": data.get('displayName'),
            "bio": "Hello! I am new here.",
            "joined": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        save_data(USERS_FILE, users)
        return jsonify({"success": True, "user": {"username": username, "displayName": users[username]['displayName']}})
    
    elif action == 'login':
        user = users.get(username)
        if user and user['password'] == data.get('password'):
            return jsonify({"success": True, "user": {"username": username, "displayName": user['displayName']}})
        return jsonify({"error": "Invalid credentials"}), 401

@app.route('/api/posts', methods=['GET', 'POST'])
def manage_posts():
    posts = load_data(POSTS_FILE)
    if request.method == 'GET':
        return jsonify(posts)
    
    if request.method == 'POST':
        data = request.json
        users = load_data(USERS_FILE)
        author = data.get('username')
        
        new_post = {
            "id": str(uuid.uuid4()),
            "author": author,
            "displayName": users.get(author, {}).get('displayName', author),
            "content": data.get('content'),
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "likes": [],
            "dislikes": []
        }
        posts.insert(0, new_post) # Add to front (newest first)
        save_data(POSTS_FILE, posts)
        return jsonify({"success": True, "post": new_post})

@app.route('/api/posts/<post_id>', methods=['DELETE', 'PUT'])
def modify_post(post_id):
    posts = load_data(POSTS_FILE)
    data = request.json
    username = data.get('username')

    for i, post in enumerate(posts):
        if post['id'] == post_id and post['author'] == username:
            if request.method == 'DELETE':
                del posts[i]
            elif request.method == 'PUT':
                post['content'] = data.get('content')
            save_data(POSTS_FILE, posts)
            return jsonify({"success": True})
    return jsonify({"error": "Unauthorized or not found"}), 403

@app.route('/api/posts/<post_id>/react', methods=['POST'])
def react_post(post_id):
    posts = load_data(POSTS_FILE)
    data = request.json
    username = data.get('username')
    action = data.get('action') # 'like' or 'dislike'

    for post in posts:
        if post['id'] == post_id:
            # Remove existing reactions from this user
            if username in post['likes']: post['likes'].remove(username)
            if username in post['dislikes']: post['dislikes'].remove(username)
            
            # Apply new reaction
            if action == 'like': post['likes'].append(username)
            elif action == 'dislike': post['dislikes'].append(username)
            
            save_data(POSTS_FILE, posts)
            return jsonify({"success": True, "likes": len(post['likes']), "dislikes": len(post['dislikes'])})
    return jsonify({"error": "Post not found"}), 404

@app.route('/api/profile/<username>', methods=['GET', 'POST'])
def profile(username):
    users = load_data(USERS_FILE)
    posts = load_data(POSTS_FILE)
    
    if username not in users:
        return jsonify({"error": "User not found"}), 404

    if request.method == 'POST':
        data = request.json
        if data.get('requester') == username: # Simple authorization check
            users[username]['displayName'] = data.get('displayName', users[username]['displayName'])
            users[username]['bio'] = data.get('bio', users[username]['bio'])
            save_data(USERS_FILE, users)
            
            # Update display names on existing posts
            for post in posts:
                if post['author'] == username:
                    post['displayName'] = users[username]['displayName']
            save_data(POSTS_FILE, posts)
            
            return jsonify({"success": True})
        return jsonify({"error": "Unauthorized"}), 403

    user_posts = [p for p in posts if p['author'] == username]
    likes_received = sum(len(p['likes']) for p in user_posts)

    profile_data = {
        "username": username,
        "displayName": users[username]['displayName'],
        "bio": users[username]['bio'],
        "joined": users[username]['joined'],
        "postCount": len(user_posts),
        "likesReceived": likes_received,
        "posts": user_posts
    }
    return jsonify(profile_data)

if __name__ == '__main__':
    init_files()
    app.run(debug=True)