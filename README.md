# Clare Coding Challenge

This coding challenge involves creating a chatbot that helps users via CBT techniques. The chatbot uses `gpt-4o-mini` for response generation and message classification (General, FAQ and Suicide Risk). Additionally, it includes a bonus front-end interface built with Streamlit. It integrates with Redis and has a toy JWT auth implementation.

## Setup Instructions

### Prerequisites

- **Docker**: Ensure Docker is installed on your system.
- If running locally (optional), install these dependencies:
  ```bash
  npm install nodemon ts-node --save-dev
  ```
  > Note: This step was required on Ubuntu but works fine on my mac without it...

### Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd <repository-directory>
   ```

2. Set up environment variables:

   - Copy `.env_example` to `.env` and configure it with your OpenAI API key. Also you can add more VALID_TOKENS.

3. Run the application using Docker Compose:
   ```bash
   docker-compose up
   ```

## Usage Instructions

### Access Points

- **Node.js API**: Interact with the chatbot via HTTP requests at `http://localhost:3000`.
- **Streamlit App**: Access the front-end interface at `http://localhost:8501`.

### API Endpoints

#### **Send a Message**

Send a message to the chatbot.

```bash
curl -X POST http://localhost:3000/api/send-message \
-H "Authorization: Bearer abc123" \
-H "Content-Type: application/json" \
-d '{
  "userId": "123",
  "message": "Hello!"
}'
```

#### **Initiate a Check-In**

Start a check-in flow.

```bash
curl -X POST http://localhost:3000/api/initiate-check-in \
-H "Authorization: Bearer abc123" \
-H "Content-Type: application/json" \
-d '{
  "userId": "123"
}'
```

#### **Get Context**

Retrieve all conversation contexts for a user.

```bash
curl -X GET http://localhost:3000/api/get-context/123 \
-H "Authorization: Bearer abc123"
```

#### **Update Context**

Update the context of a specific conversation.

```bash
curl -X POST http://localhost:3000/api/update-context \
-H "Authorization: Bearer abc123" \
-H "Content-Type: application/json" \
-d '{
  "userId": "123",
  "flow": "normal",
  "conversationId": "2695ed07-4a86-4144-bc7f-d4fc186d7d30",
  "contextUpdates": {
    "messages": [
      { "role": "user", "content": "Follow-up message" }
    ]
  }
}'
```

### Running Tests

Run tests using Jest:

```bash
npm test
```
