from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_redis import FlaskRedis
import requests
from datetime import datetime

app = Flask(__name__)

app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://postgres:password@localhost/BookClub'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

app.config['REDIS_URL'] = "redis://localhost:6379/0"
redis_client = FlaskRedis(app)

SERVICE_NAME = "voting_service"
GATEWAY_URL = "http://localhost:3000/register" 
SERVICE_PORT = 5002

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

class Book(db.Model):
    __tablename__ = 'books'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    author = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    votes = db.Column(db.Integer, default=0)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "author": self.author,
            "description": self.description,
            "votes": self.votes
        }

def cache_vote_count(book_id, vote_count):
    try:
        redis_client.set(f"book:{book_id}:votes", vote_count, ex=3600) # 1-hour timeout for cache
        print(f"Cache set for book {book_id} with {vote_count} votes.")
    except Exception as e:
        print(f"Redis error (cache_vote_count): {e}")

def get_cached_vote_count(book_id):
    try:
        cached_votes = redis_client.get(f"book:{book_id}:votes")
        if cached_votes:
            print(f"Cache hit for book {book_id}.")
        else:
            print(f"Cache miss for book {book_id}.")
        return cached_votes
    except Exception as e:
        print(f"Redis error (get_cached_vote_count): {e}")
        return None

@app.route("/status", methods=["GET"])
def status():
    return jsonify({
        "service": "voting_service",
        "status": "running",
        "timestamp": datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
    }), 200

@app.route("/books", methods=['GET'])
def get_books():
    books = Book.query.all()
    return jsonify({"books": [book.to_dict() for book in books]}), 200

@app.route("/vote", methods=['POST'])
def submit_vote():
    data = request.get_json()
    
    book_id = data.get('book_id')
    user_id = data.get('user_id')

    if not book_id or not user_id:
        return jsonify({"message": "book_id and user_id are required"}), 400

    book = Book.query.get(book_id)

    if book is None:
        return jsonify({"message": "Book not found"}), 404

    try:
        book.votes += 1
        db.session.commit()
        cache_vote_count(book_id, book.votes)
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Failed to submit vote", "error": str(e)}), 500

    return jsonify({
        "message": "Vote submitted successfully",
        "votes": book.votes
    }), 200

@app.route("/vote/status", methods=['GET'])
def get_book_votes():
    books = Book.query.all()
    status = []
    cache_messages = []

    for book in books:
        cached_votes = get_cached_vote_count(book.id)

        if cached_votes is None:
            cached_votes = book.votes
            cache_vote_count(book.id, book.votes)
            cache_messages.append(f"Cache miss: book {book.id}.")
        else:
            try:
                cached_votes = int(cached_votes)
                cache_messages.append(f"Cache hit: book {book.id}.")
            except (TypeError, ValueError):
                cached_votes = book.votes
                cache_messages.append(f"Cache error for book {book.id}. Using database value.")

        status.append({
            "book_id": book.id,
            "title": book.title,
            "votes": cached_votes
        })

    return jsonify({"status": status, "cache_messages": cache_messages}), 200

@app.route("/vote/end", methods=["POST"])
def end_voting():
    winner = Book.query.order_by(Book.votes.desc()).first()

    if not winner:
        return jsonify({"message": "No books available"}), 400

    discussion_service_url = "http://localhost:5001/discussions" 
    payload = {
        "title": f"Discussion for {winner.title}",
        "author": "Admin",  
        "content": f"This is the official discussion thread for {winner.title} by {winner.author}"
    }

    try:
        response = requests.post(discussion_service_url, json=payload)
        response.raise_for_status()  
    except requests.exceptions.RequestException as e:
        return jsonify({"error": "Failed to create discussion thread", "details": str(e)}), 500

    return jsonify({"message": "Voting ended and discussion thread created"}), 200

if __name__ == "__main__":
    with app.app_context():
        db.create_all()

    app.run(debug=True)
