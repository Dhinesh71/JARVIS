# JARVIS Quiz Solver - User Guide

## Overview
JARVIS can now automatically attend online quizzes for you! Just provide the quiz URL and your details, and JARVIS will:
- Fill in your registration information
- Read each question
- Use AI to determine the correct answer
- Click the right option
- Navigate through all questions
- Submit the quiz

## How to Use

### Method 1: Through JARVIS Chat Interface
Simply chat with JARVIS and give it a command like:

```
Go to this quiz: https://quizz-master-two.vercel.app/quiz/1a074ae0-4849-499d-9313-48fe92619291

My details are:
- Name: Dhinesh V
- Email: dhineshjk17@gmail.com
- Phone: 9025873422
- Register Number: 731723106007

Please attend the quiz and answer all questions correctly.
```

JARVIS will automatically:
1. Detect that you want to solve a quiz
2. Extract your details from the conversation
3. Launch the browser agent
4. Complete the quiz

### Method 2: Direct Command (Backend)
You can also run it directly from the backend:

```bash
cd backend
node -e "const { solveQuiz } = require('./utils/browserAgent'); solveQuiz('YOUR_QUIZ_URL', { name: 'Your Name', regNo: 'Your Reg No', email: 'your@email.com', phone: '1234567890' }).then(console.log).catch(console.error)"
```

## Supported Quiz Platforms
- Google Forms
- Microsoft Forms
- Custom quiz platforms (like the example above)
- Any web-based quiz with standard HTML forms

## Features
✅ **Automatic Form Filling** - Fills name, email, phone, registration number  
✅ **AI-Powered Answers** - Uses Llama 3.1 70B model for accurate answers  
✅ **Multi-Question Support** - Handles quizzes with multiple pages  
✅ **Visual Browser** - You can watch JARVIS work in real-time (headless: false)  
✅ **Error Recovery** - Automatically retries if stuck  
✅ **Completion Detection** - Knows when the quiz is finished  

## Technical Details

### Browser Agent Location
`backend/utils/browserAgent.js`

### Key Functions
- `solveQuiz(url, userDetails)` - Main function
- `extractQuestionAndOptions(page)` - Detects questions
- `getAIAnswer(question, options)` - Gets AI recommendation
- `clickAnswer(page, answerText)` - Clicks the correct option
- `clickNextOrSubmit(page)` - Navigates to next question

### Configuration
- **Headless Mode**: Currently set to `false` (visible browser)
- **Max Iterations**: 50 questions maximum
- **Wait Times**: 2.5-3.5 seconds between actions
- **AI Model**: llama-3.1-70b-versatile

## Troubleshooting

### Issue: JARVIS doesn't detect the quiz
**Solution**: Make sure your message includes keywords like "quiz", "attend", "solve", or "take" along with a URL.

### Issue: Browser doesn't open
**Solution**: Ensure Puppeteer is installed:
```bash
cd backend
npm install puppeteer
```

### Issue: Wrong answers selected
**Solution**: The AI model tries its best, but accuracy depends on the question difficulty. You can upgrade to a more powerful model in `browserAgent.js`.

### Issue: Stuck on a question
**Solution**: The agent has built-in stuck detection and will force navigation after 2 attempts on the same question.

## Example Usage

```javascript
// In your JARVIS chat:
"Hey JARVIS, attend this quiz: https://example.com/quiz/123
My name is John Doe, email john@example.com, phone 9876543210, reg number 12345"

// JARVIS will respond and start the browser agent automatically
```

## Privacy & Security
- All quiz solving happens locally on your machine
- Your details are only used to fill the form fields
- No data is stored or transmitted except to the quiz platform
- The AI API (Groq) only receives the questions, not your personal info

## Future Enhancements
- [ ] Support for file upload questions
- [ ] Screenshot capture of results
- [ ] Multi-language quiz support
- [ ] Timed quiz handling with countdown awareness
- [ ] Anti-cheat bypass (randomized delays, human-like mouse movement)

## Notes
- Always ensure you have permission to use automated tools for the quiz
- Some platforms may have anti-bot measures
- The browser runs in visible mode so you can monitor progress
- Results are shown in the console after completion

---

**Created**: February 9, 2026  
**Version**: 1.0  
**Author**: JARVIS AI System
