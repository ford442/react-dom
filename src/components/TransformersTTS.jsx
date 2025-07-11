// src/components/TransformersTTS.jsx
import React from 'react';

const TransformersTTS = ({
    textToSpeakInput,
    setTextToSpeakInput,
    handleSynthesizeSpeech,
    isTtsSpeaking,
    ttsPipelineInstance,
    speakerEmbeddings
}) => {
    return (
        <div className="panel-section">
            <h2>Text to Speech (Transformers.js - SpeechT5)</h2>
            <div className="input-group">
                <label htmlFor="tts-input-transformers">Text to Synthesize:</label>
                <textarea
                    id="tts-input-transformers"
                    value={textToSpeakInput}
                    onChange={(e) => setTextToSpeakInput(e.target.value)}
                    placeholder="Enter text to synthesize..."
                    rows={3}
                    disabled={!ttsPipelineInstance || isTtsSpeaking}
                />
            </div>
            <button
                onClick={handleWebSpeechSpeak}
                disabled={isSpeaking || !webSpeechApiInput}
            >
                {isTtsSpeaking ? 'Synthesizing...' : 'Synthesize & Play Speech'}
            </button>
        </div>
    );
};

export default TransformersTTS;
