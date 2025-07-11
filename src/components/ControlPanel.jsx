// src/components/ControlPanel.jsx
import React from 'react';

const ControlPanel = ({
    statusMessage,
    prompt,
    setPrompt,
    handleGenerateText,
    isGenerating,
    toggleListen,
    isListening,
    sttError,
    generatedOutput,
    activeTtsEngine,
    setActiveTtsEngine,
    kokoroTtsInstance,
    ttsPipelineInstance,
    speakerEmbeddings,
    personalityProfiles,
    currentPersonalityKey,
    setCurrentPersonalityKey,
    currentProfile
}) => {
    return (
        <div className="floating-control-panel base-panel">
            {/* Personality Header */}
            <div className="personality-header">
                <img
                  src={currentProfile.avatar}
                  alt={`${currentProfile.displayName} Avatar`}
                  className="personality-avatar"
                />
                <h2>{currentProfile.displayName}</h2>
            </div>


            {/* Personality Selector */}
            <div className="panel-section">
                <h4>Select AI Personality:</h4>
                <select
                    value={currentPersonalityKey}
                    onChange={(e) => setCurrentPersonalityKey(e.target.value)}
                >
                    {Object.keys(personalityProfiles).map(key => (
                        <option key={key} value={key}>
                            {personalityProfiles[key].displayName}
                        </option>
                    ))}
                </select>
            </div>

            {/* TTS Engine Selector */}
            <div className="panel-section">
                <h4>Active Text-to-Speech Engine:</h4>
                <select
                    value={activeTtsEngine}
                    onChange={(e) => setActiveTtsEngine(e.target.value)}
                >
                    <option value="kokoro" disabled={!kokoroTtsInstance}>
                        Kokoro (ONNX Community)
                    </option>
                    <option value="speechT5" disabled={!ttsPipelineInstance || !speakerEmbeddings}>
                        SpeechT5 (Transformers.js)
                    </option>
                </select>
            </div>

            {/* Text Generation */}
            <div className="panel-section">
                <h2>Text Generation</h2>
                <div className="status-display">{statusMessage}</div>
                <div className="input-group">
                    <label htmlFor="prompt-textarea">Your Prompt:</label>
                    <textarea
                        id="prompt-textarea"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Enter prompt or use Speech-to-Text..."
                        rows={3}
                        disabled={isGenerating}
                    />
                </div>
                <button onClick={handleGenerateText} disabled={isGenerating}>
                    {isGenerating ? 'Generating...' : 'Generate Text'}
                </button>
                <div style={{ marginTop: '10px' }}>
                    <button onClick={toggleListen} className="auto-width">
                        {isListening ? 'Stop Listening' : 'Start Listening'}
                    </button>
                    {sttError && <p style={{ color: 'red' }}>{sttError}</p>}
                </div>
                <h3>Generated Output:</h3>
                <div className="generated-output-display">
                    {generatedOutput}
                </div>
            </div>
        </div>
    );
};

export default ControlPanel;
