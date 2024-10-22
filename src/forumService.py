from flask import Flask, request, jsonify
from datetime import datetime
from pymongo import MongoClient
import requests
from flask_socketio import SocketIO, emit

app = Flask(__name__)
socketio = SocketIO(app) 

client = MongoClient("mongodb://localhost:27017/")  
db = client["discussionsDB"]
discussions_collection = db["discussions"] 

SERVICE_NAME = "forum_service"
GATEWAY_URL = "http://localhost:3000/register"  
SERVICE_PORT = 5001

def register_service():
    try:
        response = requests.post(GATEWAY_URL, json={
            "name": SERVICE_NAME,
            "address": "localhost",
            "port": SERVICE_PORT
        })
        if response.status_code == 200:
            print(f"{SERVICE_NAME} registered successfully.")
        else:
            print(f"Failed to register {SERVICE_NAME}: {response.text}")
    except Exception as e:
        print(f"Error during registration: {e}")

@app.route("/status", methods=["GET"])
def status():
    return jsonify({
        "service": "forum_service",
        "status": "running",
        "timestamp": datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
    }), 200

@app.route("/discussions", methods=['GET'])
def get_discussions():
    discussions = list(discussions_collection.find({}))
    for discussion in discussions:
        discussion['_id'] = str(discussion['_id'])  
    return jsonify({"discussions": discussions}), 200

@app.route("/discussions", methods=['POST'])
def create_discussion():
    data = request.get_json()

    if 'title' not in data or 'author' not in data or 'content' not in data:
        return jsonify({"error": "Missing required fields"}), 400

    new_thread = {
        "title": data['title'],
        "author": data['author'],
        "created_at": datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
        "replies": 0
    }

    result = discussions_collection.insert_one(new_thread)
    new_thread["thread_id"] = result.inserted_id  

    socketio.emit('new_discussion', new_thread)

    return jsonify({
        "message": "Discussion thread created successfully",
        "thread_id": str(result.inserted_id) 
    }), 201

@socketio.on('connect')
def handle_connect():
    print('Client connected')
    emit('response', {'message': 'Connected to the forum service'})

@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected')

if __name__ == "__main__":
    import sys
    port = 5001  

    if len(sys.argv) > 1:
        port = int(sys.argv[1])
    app.run(debug=True, port=port)
