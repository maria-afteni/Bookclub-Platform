# Bookclub Platform

A platform that allows users to vote for a book that they will all read next month and discuss it in a specially created lobby. The MVP will consist of two microservices: one for a voting system to select the book of the month and another for real-time discussions. The voting service allows users to cast and view votes, while the discussion service creates a space for users to talk about the book.

### Setup and Deployment
To properly run the project, you have to:

1. Clone the repository:  
    `git clone https://github.com/maria-afteni/Bookclub-Platform `

2. Create an `.env` file for the environment variables used in docker-compose.yml. The file should have the following structure:
    ```
        GATEWAY_PORT=3000

        VOTING_SERVICE_PORT=5000
        VOTING_DB_HOST=localhost
        VOTING_DB_PORT=5432
        VOTING_DB_NAME=voting_db
        VOTING_DB_USER=your_postgre_user
        VOTING_DB_PASSWORD=your_postgre_password

        FORUM_SERVICE_PORT=5001
        FORUM_DB_HOST=localhost
        FORUM_DB_PORT=27017
        FORUM_DB_NAME=forum_db

        REDIS_HOST=localhost
        REDIS_PORT=6379
    ```

3. Run Docker Compose to build all the services.  
    `docker-compose up --build`

4. Access the services using their ports. Note that all the requests should be done through the gateway.  
    ```
        Gateway: http://localhost:3000
        Voting Service: http://localhost:5000
        Discussion Service: http://localhost:5001
    ```

It is preferable to start using the services by running the `/register` endpoint to make them visible to the gateway. Once registered, requests to the services can be made through the gateway.

Example of `/register` endpoint:
```
{
    "name": "forum_service",
    "address": "localhost",
    "port": 5005
}
```

To stop all runing containers, execute `docker-compose down`


### Application Suitability

The use of distributed systems in this case is relevant because:

- **Real-time Capability:**
  The discussion forum needs to operate in real-time and use websockets, while the voting service can rely on HTTP requests. Given the difference in communication methods, the use of microservices will ensure that the specific needs for each of them are met.

- **Scalability:**
  The voting system doesn't require a lot of resources, considering that it will be used by each user once a month. On the other hand, the chat forum will require more resources during peak usage. Creating them as different microservices will ensure that each component is scaled based on it's load.

- **Modular Growth:**
  The platform can be expanded by adding features like multiple book clubs, user profiles, or bookshelves. Adding them as separate services won't disturb the existing architecture of the system.

- **Improved Responsiveness:**
  The use of distributed systems will allow each service to respond quickly to user requests, considering that the services that are not called can run asynchronously.

**Similar real-world projects:**

- Goodreads - a popular platform for book lovers, where users can join groups or book clubs, vote on polls and participate in book discussions. Is likely that the service uses distributed systems to manage different functionalities. Each component can function independently which ensures the application's scalability with the growing number of users.

- Trello - a collaborative tool where users can create boards, lists, and cards to organize tasks. It has included a voting feature and real-time updates in shared workspace among other features. Trello operates on a microservices architecture, which ensures that all real-time functionalities are handles with precision.

### Service Boundaries

1. The `Voting Service` handles the process of choosing the book of the month by allowing the users to vote on available book options. It manages the vote submissions, tracks the results, and provides real-time updates regarding the voting procces.
2. The `Discussion Forum Service` enables users to participate in real-time conversations about the selected book by using websockets to facilitate live messaging.

![alt text](img/architectural_diagram_updated.png)

### Technology Stack

**Gateway, Service Discovery, Load Balancer** in Node.js - Node.js is an event-driven framework that will be able to handle multiple requests at once, which is perfect for the gateway.

**Voting and Discussion Forum Services** in Flask - Flask is a lightweight and flexible framework that is perfect for building RESTful APIs.

**Voting Service Database** in PostgreSQL - The Voting Service requires strong data consistency and integrity, so a relational database as PostgreSQL will be a suitable choice for it.

**Discussion Forum Service Database** in MongoDB - The Discussion Forum will have high volumes of simultaneous requests so to handle the throughput efficiently we should use a non-relational database such as MongoSB.

**Cache** in Redis - Redis allows the Voting Service to store and retrieve the data about the voting process with extremely low latency.

**Inter-Service Communication** in gRPC - gRPC is much faster and more efficent communication than the traditional ones and it supports bi-directional streaming which enhances the real-time communication between services.

**User-Service Communication** as RESTful APIs - REST is a simple architecture that is ideal for microservices architecture, enabling the services to easily communicate with one another


### Data Management Design
#### Updated Endpoints:
**Voting Service Endpoints:**  
**Base URL:** `http://127.0.0.1:5000` 

- **GET `/status`**  
  **Description:** Returns the status of the Voting Service.  
  **Response:**  
  ```
    {
        "service": "voting_service",
        "status": "running",
        "timestamp": "2024-11-04T12:00:00Z"
    }
  ```

- **GET `/books`**  
  **Description:** Retrieves the list of books available for voting.  
  **Response:**
  ```
  [
    {
        "id": 1,
        "title": "Book Title",
        "author": "Author Name",
        "votes": 5
    },
  ...
  ]
  ```

- **POST `/vote`**  
  **Description:** Casts a vote for a book.  
  **Body:**  
  ```
  {
    "book_id": 1,
    "user_id": 123
  }
  ```
  **Response:**
  ```
    {
        "message": "Vote submitted successfully",
        "votes": 11   
    }
  ```

- **GET `/vote/status`**   
  **Description:** Retrieves the current voting status, showing the vote counts.  
  **Response:**  
  ```
    {
        "status": [
            {
            "book_id": 1,
            "title": "Book Title",
            "votes": 10
            },
            // more books...
        ],
        "cache_messages": [
            "Cache hit: book 1.",
            "Cache miss: book 2."
        ]
    }
  ```

- **POST `/vote/end`**  
  **Description:** Ends the voting session and creates a discussion thread for the book with most votes casted.   
  **Response:**  
  ```
    {
        "message": "Voting ended and discussion thread created"
    }
  ```

**Discussion Forum Service Endpoints:**
- **GET `/status`**  
  **Description:** Returns the status of the service.  
  **Response:**  
  ```
    {
        "service": "forum_service",
        "status": "running",
        "timestamp": "2024-11-04T12:00:00Z"
    }
  ```

- **GET `/discussions`**  
  **Description:** Get a list of discussions for the book of the month.  
  **Response:**
  ```
    {
       "discussions": [
        {
            "thread_id": 1,
            "title": "Discussion Title 1",
            "author": "User123",
            "created_at": "2024-09-05T12:30:00Z",
            "replies": 10
        },
        {
            "thread_id": 2,
            "title": "Discussion Title 2",
            "author": "User456",
            "created_at": "2024-09-05T14:00:00Z",
            "replies": 5
        }
        ]
    }
  ```

- **POST `/discussions`**  
  **Description:** Create a new discussion thread.  
  **Request:**
  ```
    {
        "title": "Discussion for Book Title",
        "author": "Admin",
        "content": "This is the discussion thread for Book Title by Author Name"
    }  
  ```  
  **Response:**
  ```
    {
        "message": "Discussion thread created successfully",
        "thread_id": 3
    }   
   ```

- ```domain.com/discussions/{thread_id}``` - connect to websocket to post a reply to a specific discussion thread.
**Request:**
  ```
    {
        "author": "User456",
        "thread_id": 1,
        "content": "Reply content"
    }
  ```  
  **Response:**
  ```
    {
        "message": "Reply submitted successfully",
        "reply_id": 3
        "thread_id": 1
    }   
  ``` 

**Gateway Endpoints:**  
- **POST `/register`**  
  **Description:** Registers a new service with the gateway.  
  **Request:**  
  ```
    {
        "name": "service_name",
        "address": "localhost",
        "port": 5000
    }
  ```
  **Response:**  
  ```
  {
    "success": true,
    "message": "Service registered successfully"
  }
  ```

- **GET `/services/{service_name}`**  
  **Description:** Fetches a list of all instances of a specific service.  
  **Response:**  
  ```
    {
        "services": [
        "localhost:5000",
        "localhost:5001"
        ]
    }  
  ``` 

### Deployment and Scaling

To deploy the book club platform I will be using Docker, which will help me containerize each microservice and will ensure isolated execution. The deployment and scaling will be managed by Docker Compose. It will handle the load balancer, service discovery and the horizintal scaling, based on the load. The cache, created with Redis, will optimize performance by caching frequently accessed data.

