# JARVIS - Conversational AI Documentation

## 1. Introduction

JARVIS is a full-stack conversational AI web application designed to mimic the persona of a sophisticated AI assistant. It features a React-based frontend with a futuristic UI and a Node.js/Express backend that interfaces with the Groq API for high-intelligence responses.

## 2. Architecture Overview

The application follows a standard Client-Server architecture:

```mermaid
graph LR
    User[User] <--> Client[React Frontend (Vite)]
    Client <--> API[Express Backend API]
    API <--> AI[Groq Cloud API]
```

- **Frontend**: Built with React and Vite, responsible for the user interface, chat history management, and visual effects.
- **Backend**: built with Node.js and Express, handles secure API key management, conversation context processing, and communication with the Groq API.
- **AI Service**: Groq API (using Llama 3 based models) provides the intelligence and response generation.

## 3. Backend Documentation

**Location**: `/backend`

### Technologies
- **Node.js**: Runtime environment.
- **Express**: Web framework for handling API requests.
- **Axios**: HTTP client for communicating with external AI services.
- **Cors**: Middleware to enable Cross-Origin Resource Sharing.
- **Dotenv**: Module for loading environment variables.

### Key Files
- `server.js`: The main entry point. Sets up the server, middleware, and API routes.

### API Endpoints

#### 1. Health Check
- **URL**: `/`
- **Method**: `GET`
- **Description**: Returns a status message to verify the backend is running.
- **Response**: `JARVIS Backend System Online.`

#### 2. Chat Completion
- **URL**: `/chat`
- **Method**: `POST`
- **Description**: Sends the user's message and conversation history to the AI model and returns a generated response.
- **Request Body**:
    ```json
    {
      "message": "Hello Jarvis",
      "history": [ ...previous messages... ]
    }
    ```
- **Response**:
    ```json
    {
      "response": "Hello, sir. How can I assist you?",
      "history": [ ...updated messages... ]
    }
    ```

### Environment Variables (.env)
| Variable | Description | Required |
|----------|-------------|----------|
| `GROQ_API_KEY` | Secret key for authenticating with Groq API. | Yes |
| `PORT` | Port number for the server (defaults to 5000). | No |

## 4. Frontend Documentation

**Location**: `/frontend`

### Technologies
- **React**: UI Library.
- **Vite**: Build tool and development server.
- **CSS**: Custom styling for the sci-fi/technological aesthetic.

### Component Structure
- **App.jsx**: Main application controller. Manages state (`history`, `isThinking`) and handles API communication.
- **AICore.jsx**: Visual representation of the AI's processing state (animations).
- **ChatWindow.jsx**: Scrollable container displaying the list of messages.
- **ChatInput.jsx**: Input field for user messages.
- **MessageBubble.jsx**: Individual chat message component with role-based styling.

### State Management
The application uses local component state (React `useState`) in `App.jsx` to manage:
- `history`: Array of conversation messages.
- `isThinking`: Boolean flag indicating if the AI is processing a request.

## 5. Setup & Installation

### Prerequisites
- Node.js (v16+) installed.
- A valid Groq API Key.

### Local Development

#### Backend
1. Navigate to `backend/`.
2. Install dependencies: `npm install`.
3. Create `.env` file with `GROQ_API_KEY=your_key_here`.
4. Start server: `npm start` (Runs on port 5000).

#### Frontend
1. Navigate to `frontend/`.
2. Install dependencies: `npm install`.
3. Create `.env` (optional) to override `VITE_API_URL` if backend is on a different port.
4. Start dev server: `npm run dev`.
5. Open browser at the suggested URL (e.g., `http://localhost:5173`).

## 6. Deployment (Vercel)

### Backend
Deploy as a standalone Node.js project. ensure `GROQ_API_KEY` is added to Vercel's Environment Variables.

### Frontend
Deploy as a Vite project. Add `VITE_API_URL` to Environment Variables, pointing to the deployed backend URL (e.g., `https://your-backend.vercel.app/chat`).
