export class SpeechRecognizer {
    constructor() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            this.recognition = null;
            console.warn("Web Speech API not supported in this browser.");
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = "en-IN";

        // Mobile fix: Track active state and restart attempts
        this.isActive = false;
        this.manualStop = false; // Track if user explicitly clicked stop
        this.restartCount = 0;
        this.maxRestarts = 10;
        this.onResultCallback = null;
        this.onEndCallback = null;
        this.onErrorCallback = null;
        this.lastTranscript = ""; // Prevent duplicate updates
    }

    setLanguage(lang) {
        if (this.recognition) {
            this.recognition.lang = lang;
        }
    }

    start(onResult, onEnd, onError) {
        if (!this.recognition) return;

        this.isActive = true;
        this.manualStop = false;
        this.restartCount = 0;
        this.onResultCallback = onResult;
        this.onEndCallback = onEnd;
        this.onErrorCallback = onError;

        this.recognition.onresult = (event) => {
            // Reset restart count on successful speech
            this.restartCount = 0;

            const transcript = Array.from(event.results)
                .map(result => result[0])
                .map(result => result.transcript)
                .join('');

            if (this.onResultCallback && transcript !== this.lastTranscript) {
                this.lastTranscript = transcript;
                this.onResultCallback(transcript);
            }
        };

        this.recognition.onend = () => {
            // Auto-restart for mobile if still active and NOT manually stopped
            if (this.isActive && !this.manualStop && this.restartCount < this.maxRestarts) {
                console.log('Speech recognition ended, restarting...', this.restartCount);
                this.restartCount++;

                setTimeout(() => {
                    if (this.isActive && !this.manualStop) {
                        try {
                            this.recognition.start();
                        } catch (e) {
                            console.error('Failed to restart recognition', e);
                            this.handleStop();
                        }
                    }
                }, 100);
            } else {
                this.handleStop();
            }
        };

        this.recognition.onerror = (event) => {
            console.error("Speech recognition error:", event.error);

            // Handle mobile-specific errors
            if (event.error === 'no-speech' || event.error === 'aborted') {
                // These are common on mobile, just restart
                console.log('Recoverable error, will restart on next onend');
            } else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                // Permission denied, stop completely
                console.error('Permission denied for microphone');
                this.handleStop();
                if (this.onErrorCallback) {
                    this.onErrorCallback(event.error);
                }
            } else {
                // Other errors, try to recover
                if (this.onErrorCallback) {
                    this.onErrorCallback(event.error);
                }
            }
        };

        try {
            this.recognition.start();
        } catch (e) {
            console.error("Failed to start recognition", e);
            this.handleStop();
        }
    }

    stop() {
        this.isActive = false;
        this.manualStop = true;
        this.restartCount = 0;
        this.lastTranscript = "";

        // Clear callbacks immediately to prevent late-arriving results
        this.onResultCallback = null;

        if (this.recognition) {
            try {
                this.recognition.stop();
            } catch (e) {
                console.error('Error stopping recognition', e);
            }
        }
    }

    handleStop() {
        this.isActive = false;
        this.restartCount = 0;

        if (this.onEndCallback) {
            this.onEndCallback();
        }
    }
}

export const speechRecognizer = new SpeechRecognizer();
