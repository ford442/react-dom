import React from 'react';

const WebSpeechControls = ({
  webSpeechApiDedicatedInput,
  setWebSpeechApiDedicatedInput,
  selectedVoiceURI,
  setSelectedVoiceURI,
  availableVoices,
  handleWebSpeechSpeakButton, // Renamed for clarity, was handleWebSpeechSpeak
  isWebSpeaking,
  // synthRef, // synthRef is initialized and managed in App.jsx, not directly needed here if handleWebSpeechSpeakButton encapsulates its usage
}) => {
  return (
    <div style={{ padding: '10px 0', borderBottom: '1px solid #ddd', marginBottom: '15px' }}>
      <h2>Text to Speech (Browser Built-in)</h2>
      <textarea
        value={webSpeechApiDedicatedInput}
        onChange={(e) => setWebSpeechApiDedicatedInput(e.target.value)}
        placeholder="Enter text for browser TTS..."
        rows={3}
        style={{ width: '100%', padding: '8px', boxSizing: 'border-box', marginBottom: '10px' }}
        disabled={isWebSpeaking}
      />
      <div style={{ marginBottom: '10px' }}>
        <label htmlFor="voice-select-webapi" style={{ marginRight: '10px' }}>Voice:</label>
        <select
          id="voice-select-webapi"
          value={selectedVoiceURI}
          onChange={(e) => setSelectedVoiceURI(e.target.value)}
          style={{ padding: '8px', width: 'calc(100% - 70px)' }}
          disabled={availableVoices.length === 0 || isWebSpeaking}
        >
          {availableVoices.length === 0 && <option value="">Loading voices...</option>}
          {availableVoices.map((voice) => (
            <option key={voice.voiceURI} value={voice.voiceURI}>
              {voice.name} ({voice.lang}) {voice.default ? '[Default]' : ''}
            </option>
          ))}
        </select>
      </div>
      <button
        onClick={handleWebSpeechSpeakButton}
        disabled={isWebSpeaking || !webSpeechApiDedicatedInput.trim() || availableVoices.length === 0}
        style={{ padding: '10px 15px', width: '100%' }}
      >
        {isWebSpeaking ? 'Speaking...' : 'Speak Text (Browser)'}
      </button>
    </div>
  );
};

export default WebSpeechControls;
