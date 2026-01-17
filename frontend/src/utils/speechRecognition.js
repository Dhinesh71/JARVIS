export class SpeechRecognizer {
    constructor() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            this.recognition = null;
            console.warn("Web Speech API not supported in this browser.");
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true; // Keep listening until manually stopped
        this.recognition.interimResults = true; // Show results as they are spoken
        this.recognition.lang = "en-IN"; // Default
    }

    setLanguage(lang) {
        if (this.recognition) {
            this.recognition.lang = lang;
        }
    }

    start(onResult, onEnd, onError) {
        if (!this.recognition) return;

        this.recognition.onresult = (event) => {
            const transcript = Array.from(event.results)
                .map(result => result[0])
                .map(result => result.transcript)
                .join('');

            onResult(transcript);
        };

        this.recognition.onend = () => {
            if (onEnd) onEnd();
        };

        this.recognition.onerror = (event) => {
            console.error("Speech recognition error", event.error);
            if (onError) onError(event.error);
        };

        try {
            this.recognition.start();
        } catch (e) {
            console.error("Failed to start recognition", e);
            if (onEnd) onEnd(); // Force cleanup state
        }
    }

    stop() {
        if (this.recognition) {
            this.recognition.stop();
        }
    }
}

export const speechRecognizer = new SpeechRecognizer();
