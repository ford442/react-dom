import React from 'react';

const TTS_Controls = ({ isSpeaking, availableVoices, selectedVoiceURI, setSelectedVoiceURI, onSpeak, text, onTextChange }) => (
  <div className="panel-section">
    <h3>TTS Testing (Web API)</h3>
    <textarea
      value={text}
      onChange={(e) => onTextChange(e.target.value)}
      rows={2}
      disabled={isSpeaking}
    />
    <select
      value={selectedVoiceURI}
      onChange={(e) => setSelectedVoiceURI(e.target.value)}
      disabled={availableVoices.length === 0 || isSpeaking}
    >
      {availableVoices.map((voice) => (
        <option key={voice.voiceURI} value={voice.voiceURI}>
          {voice.name} ({voice.lang})
        </option>
      ))}
    </select>
    <button onClick={() => onSpeak(text)} disabled={isSpeaking || !text.trim()}>
      {isSpeaking ? 'Speaking...' : 'Play with Browser'}
    </button>
  </div>
);

export default TTS_Controls;
