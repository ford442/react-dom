import React from 'react';

const TtsEngineSelector = ({
  activeTtsEngine,
  setActiveTtsEngine,
  preferredTtsEngine,
  setPreferredTtsEngine,
  ttsPipelineInstance,
  speakerEmbeddings,
  kokoroTtsInstance,
}) => {
  return (
    <>
      <div style={{ padding: '10px 0', borderBottom: '1px solid #ddd', marginBottom: '15px' }}>
        <h4>Active Text-to-Speech Engine:</h4>
        <select
          value={activeTtsEngine}
          onChange={(e) => setActiveTtsEngine(e.target.value)}
          style={{ padding: '8px', width: '100%', boxSizing: 'border-box' }}
        >
          <option value="webSpeechAPI">Browser Built-in</option>
          <option value="speechT5" disabled={!ttsPipelineInstance || !speakerEmbeddings}>
            SpeechT5 (Transformers.js)
          </option>
          <option value="kokoro" disabled={!kokoroTtsInstance}>
            Kokoro (ONNX Community)
          </option>
        </select>
      </div>
      <div style={{ padding: '10px 0', borderBottom: '1px solid #ddd', marginBottom: '15px' }}>
        <h4>Auto-Speak Engine after LLM Generation:</h4>
        <label style={{ marginRight: '15px', cursor: 'pointer' }}>
          <input
            type="radio"
            name="ttsEnginePref"
            value="webSpeechAPI"
            checked={preferredTtsEngine === 'webSpeechAPI'}
            onChange={() => setPreferredTtsEngine('webSpeechAPI')}
          /> Browser Built-in
        </label>
        <label style={{ marginRight: '15px', cursor: 'pointer' }}>
          <input
            type="radio"
            name="ttsEnginePref"
            value="speechT5" // Value changed from transformersJS to speechT5 for consistency
            checked={preferredTtsEngine === 'speechT5'}
            onChange={() => setPreferredTtsEngine('speechT5')}
            disabled={!ttsPipelineInstance || !speakerEmbeddings}
          /> Transformers.js (SpeechT5)
        </label>
        <label style={{ cursor: 'pointer' }}>
          <input
            type="radio"
            name="ttsEnginePref"
            value="kokoro"
            checked={preferredTtsEngine === 'kokoro'}
            onChange={() => setPreferredTtsEngine('kokoro')}
            disabled={!kokoroTtsInstance}
          /> Kokoro (ONNX Community)
        </label>
      </div>
    </>
  );
};

export default TtsEngineSelector;
