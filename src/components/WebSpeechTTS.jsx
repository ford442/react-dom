import React from 'react';

const WebSpeechTTS = ({
    webSpeechApiInput,
    setWebSpeechApiInput,
    handleWebSpeechSpeak,
    isSpeaking,
    availableVoices = [], // This is the definitive fix
    selectedVoiceURI,
    setSelectedVoiceURI,
}) => {
    return (
        <div className="panel-section">
            <h2>Text to Speech (Browser Built-in)</h2>
            <div className="input-group">
                <label htmlFor="web-speech-textarea">Text to Speak:</label>
                <textarea
                    id="web-speech-textarea"
                    value={webSpeechApiInput}
                    onChange={(e) => setWebSpeechApiInput(e.target.value)}
                    placeholder="Enter text for browser TTS..."
                    rows={3}
                    disabled={isSpeaking}
                />
            </div>
            <div className="input-group">
                <label htmlFor="voice-select-webapi">Select Voice:</label>
                <select
                    id="voice-select-webapi"
                    value={selectedVoiceURI}
                    onChange={(e) => setSelectedVoiceURI(e.target.value)}
                    // This check is now 100% safe because availableVoices is always an array
                    disabled={availableVoices.length === 0 || isSpeaking}
                >
                    {availableVoices.length === 0 && <option value="">Loading voices...</option>}
                    {availableVoices.map((voice) => (
                        <option key={voice.voiceURI} value={voice.voiceURI}>
                            {voice.name} ({voice.lang})
                        </option>
                    ))}
                </select>
            </div>
            <button
                onClick={handleWebSpeechSpeak}
                disabled={isSpeaking || !webSpeechApiInput || !webSpeechApiInput.trim()}
            >
                {isSpeaking ? 'Speaking...' : 'Speak Text (Browser)'}
            </button>
        </div>
    );
};

export default WebSpeechTTS;
