# JARVIS - Conversational AI Documentation

## 1. Introduction

JARVIS is a full-stack conversational AI web application designed to mimic the persona of a sophisticated AI assistant. It features a React-based frontend with a futuristic UI and a Node.js/Express backend that interfaces with the Groq API for high-intelligence responses.

## 2. Architecture Overview

The application follows a standard Client-Server architecture:

```mermaid
graph LR
    User[User] <--> Client[React Frontend (Vite)]
    Client <--> API[Express Backend API]
    API <--> Groq[Groq Cloud API (Text/Reasoning)]
    API <--> Pollinations[Pollinations.ai (Image Gen)]
    API <--> HF[Hugging Face API (Video Gen)]
    API <--> Web[DuckDuckGo (Web Search)]
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
- **Multer**: Middleware for handling `multipart/form-data`, used for file uploads.

### Key Files
- `server.js`: The main entry point. Sets up the server, middleware, and API routes.

### Utility Modules
- `utils/search.js`: Live web search functionality using DuckDuckGo.
- `utils/imageGenerator.js`: Generates images using Pollinations.ai (free) and enhances prompts via Groq.
- `utils/videoGenerator.js`: Converts generated images into video using Stable Video Diffusion (Hugging Face).
- `utils/fileProcessor.js`: Handles analysis and summarization of uploaded files.

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
    - **Content-Type**: `multipart/form-data` (if files attached) or `application/json`
    - **Fields**:
        - `message` (String): User's query.
        - `history` (String/JSON): Previous conversation context.
        - `files` (Array): Optional file uploads (images/text).

- **Response**:
    ```json
    {
      "response": "Hello, sir. How can I assist you?",
      "history": [ ...updated messages... ],
      "image": "data:image/jpeg;base64,...",   // Optional: Generated Image
      "video": "data:video/mp4;base64,..."      // Optional: Generated Video
    }
    ```

### Environment Variables (.env)
| Variable | Description | Required |
|----------|-------------|----------|
| `GROQ_API_KEY` | Secret key for authenticating with Groq API. | Yes |
| `HF_API_TOKEN` | Hugging Face API token for video generation (Stable Video Diffusion). | Yes |
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
- **MessageBubble.jsx**: Individual chat message component. Handles text, **images**, **videos**, and text-to-speech.

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
3. Create `.env` file with `GROQ_API_KEY=your_key_here` and `HF_API_TOKEN=your_token_here`.
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
