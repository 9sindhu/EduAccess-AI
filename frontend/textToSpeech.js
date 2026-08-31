let currentSpeech = null;
let speechRate = 1;

function speakText(text) {

    if (!text || text.trim() === "") {
        alert("There is no text available to read.");
        return;
    }

    // Stop previous speech
    window.speechSynthesis.cancel();

    currentSpeech = new SpeechSynthesisUtterance(text);

    currentSpeech.rate = speechRate;
    currentSpeech.pitch = 1;
    currentSpeech.volume = 1;

    // Try to use an English voice
    const voices = window.speechSynthesis.getVoices();

    const englishVoice = voices.find(
        voice => voice.lang.startsWith("en")
    );

    if (englishVoice) {
        currentSpeech.voice = englishVoice;
    }

    window.speechSynthesis.speak(currentSpeech);
}


function pauseSpeech() {

    if (window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
    }
}


function resumeSpeech() {

    if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
    }
}


function stopSpeech() {

    window.speechSynthesis.cancel();
}


function changeSpeechSpeed(rate) {

    speechRate = parseFloat(rate);

    // If currently speaking, restart with new speed
    if (window.speechSynthesis.speaking) {

        const text = currentSpeech ? currentSpeech.text : "";

        window.speechSynthesis.cancel();

        if (text) {
            speakText(text);
        }
    }
}


// Load voices
window.speechSynthesis.onvoiceschanged = function () {
    window.speechSynthesis.getVoices();
};