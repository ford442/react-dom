import React from 'react';

const TransformersTtsControls = ({
  textToSpeakInput, // This state might be shared or specific
  setTextToSpeakInput, // Setter for the above
  handleSynthesizeSpeech, // The specific function for SpeechT5
  ttsPipelineInstance, // SpeechT5 model instance
  speakerEmbeddings,
  isSpeaking, // Global or specific speaking state
}) => {
  return (
    <div style={{
      // Copied from App.jsx for this section
      // position: 'absolute',
      // zIndex: 4000, // May need to adjust zIndex based on overall layout
      marginTop: '20px',
      padding: '15px',
      borderTop: '1px solid #ddd',
      backgroundColor: 'rgba(230, 250, 230, 0.9)', // Light green
      marginBottom: '20px', // Added for spacing
    }}>
      <h2>Text to Speech (Transformers.js - SpeechT5)</h2>
      <textarea
        value={textToSpeakInput}
        onChange={(e) => setTextToSpeakInput(e.target.value)}
        placeholder="Enter text to synthesize with SpeechT5..."
        rows={3}
        style={{ width: '100%', padding: '8px', boxSizing: 'border-box', marginBottom: '10px', pointerEvents: 'auto' }}
        disabled={!ttsPipelineInstance || isSpeaking}
      />
      <button
        onClick={handleSynthesizeSpeech}
        disabled={!ttsPipelineInstance || !speakerEmbeddings || isSpeaking || !textToSpeakInput.trim()}
        style={{ padding: '10px 15px', width: '100%' }} // Made button full width for consistency
      >
        {isSpeaking ? 'Synthesizing...' : 'Synthesize & Play (SpeechT5)'}
      </button>
    </div>
  );
};

export default TransformersTtsControls;
