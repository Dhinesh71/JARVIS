let currentUtterance = null;

export function speakText(text) {
  if (!("speechSynthesis" in window)) {
    alert("Text-to-Speech not supported in this browser.");
    return;
  }

  // Stop any ongoing speech
  window.speechSynthesis.cancel();

  currentUtterance = new SpeechSynthesisUtterance(text);

  // Voice tuning (Jarvis-style, neutral)
  currentUtterance.rate = 0.95;
  currentUtterance.pitch = 1.0;
  currentUtterance.volume = 1.0;
  currentUtterance.lang = "en-US";

  window.speechSynthesis.speak(currentUtterance);
}

export function stopSpeech() {
  window.speechSynthesis.cancel();
}
