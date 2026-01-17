# JARVIS - Conversational AI

A complete, full-stack conversational AI application mimicking the JARVIS persona.
Built with React (Frontend), Node/Express (Backend), and Groq (AI).

## Project Structure

```
/jarvis-chatbot
 ├── backend     # Node.js + Express Server
 └── frontend    # React + Vite Client
```

## Prerequisites

- Node.js (v16 or higher)
- A Groq API Key (Get it from [console.groq.com](https://console.groq.com))

## Setup & Run Instructions

### 1. Backend Setup

1.  Navigate to the backend directory:
    cd backend
    2.  Install dependencies:
    ```bash
    npm install
    

4.  Start the Server:
    ```bash
    npm start
    
    - The server runs on `http://localhost:5000`.

### 2. Frontend Setup

1.  Open a new terminal and navigate to the frontend directory:
    ```bash
    cd frontend
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the Development Server:
    ```bash
    npm run dev
    ```
4.  Open your browser to the URL shown (usually `http://localhost:5173`).

## Usage

- Type your message in the chat input and press Enter or Send.
- JARVIS will respond based on the conversation history.
- The system remembers the context of the current session.

## Deployment

### Backend (Render)
1.  Push code to GitHub.
2.  Create a new Web Service on Render.
3.  Connect your repository.
4.  Set **Root Directory** to `backend`.
5.  Set **Build Command** to `npm install`.
6.  Set **Start Command** to `node server.js`.
7.  Add Environment Variable `GROQ_API_KEY`.

### Frontend (Vercel)
1.  Push code to GitHub.
2.  Import project in Vercel.
3.  Set **Root Directory** to `frontend`.
4.  Vercel automatically detects Vite.
5.  Add Environment Variable `VITE_API_URL` set to your **Deployed Backend URL** (e.g., `https://your-app.onrender.com/chat`).
