import React from 'react';

const STT_Controls = ({ isListening, toggleListen, recognitionSupported }) => {
  // If the browser doesn't support the Web Speech API, show a message.
  if (!recognitionSupported) {
    return (
      <div className="panel-section">
        <h3>Speech Recognition</h3>
        <p>Speech recognition is not supported in this browser.</p>
      </div>
    );
  }

  // Otherwise, show the button.
  return (
    <div className="panel-section">
      <h3>Speech Recognition (STT)</h3>
      <button onClick={toggleListen} style={{ backgroundColor: isListening ? '#E74C3C' : '#4A90E2' }}>
        {isListening ? '🛑 Stop Listening' : '🎤 Start Listening'}
      </button>
      {isListening && <p style={{ marginTop: '10px', color: '#555' }}>Listening...</p>}
    </div>
  );
};

export default STT_Controls;
