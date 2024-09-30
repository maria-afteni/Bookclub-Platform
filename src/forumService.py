from flask import Flask, request, jsonify
from datetime import datetime
from pymongo import MongoClient

app = Flask(__name__)


client = MongoClient("mongodb://localhost:27017/")  
db = client["discussionsDB"]
discussions_collection = db["discussions"] 

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

    return jsonify({
        "message": "Discussion thread created successfully",
        "thread_id": str(result.inserted_id) 
    }), 201


if __name__ == "__main__":
    app.run(debug=True, port=5001)
