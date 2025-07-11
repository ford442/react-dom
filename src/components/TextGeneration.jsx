import React, { useRef } from 'react'; // Added useRef

const TextGeneration = ({
  prompt,
  setPrompt,
  generatedOutput,
  isGenerating,
  statusMessage, // Only relevant status messages for this component
  generator, // LLM model instance
  handleGenerateText,
  // STT related props
  toggleListen,
  isListening,
  sttError,
  recognitionRef, // Pass the ref itself
  // promptTextareaRef // This ref will be created and managed within this component
}) => {
  const promptTextareaRef = useRef(null); // Internal ref

  // If STT directly sets the prompt, that logic is fine.
  // The auto-submit logic useEffect from App.jsx that depends on `prompt`
  // will need to be replicated here or handled by `handleGenerateText` if it's smart enough.
  // For now, let's assume `handleGenerateText` is called by the button or by an effect here.

  return (
    <div style={{
      // Copied from App.jsx for the container div of text generation
      // position: 'absolute',
      // bottom: '20px',
      // left: '20px',
      // right: '20px',
      padding: '20px',
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      border: '1px solid #ccc',
      borderRadius: '8px',
      boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
      // zIndex: 6000, // zIndex might need to be managed by parent
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      pointerEvents: 'auto',
      marginBottom: '20px', // Added for spacing if sections are stacked
    }}>
      <h2>Text Generation (LaMini-Flan-T5)</h2>
      <div id="outputTextGenerationStatus" style={{ fontStyle: 'italic', marginBottom: '10px' }}>
        {statusMessage} {/* Display relevant status here */}
      </div>
      <textarea
        ref={promptTextareaRef}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Enter prompt or use Speech-to-Text..."
        rows={3}
        style={{ width: '100%', padding: '8px', boxSizing: 'border-box', pointerEvents: 'auto' }}
        disabled={!generator || isGenerating}
      />
      <button
        onClick={handleGenerateText}
        disabled={!generator || isGenerating || !prompt.trim()} // Disable if no prompt
        style={{ padding: '10px 15px', pointerEvents: 'auto', cursor: (!generator || isGenerating || !prompt.trim()) ? 'not-allowed' : 'pointer' }}
      >
        {isGenerating ? 'Generating...' : 'Generate Text & Speak'}
      </button>

      {/* STT Button and status */}
      <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #eee' }}>
        <button onClick={toggleListen} disabled={!recognitionRef || !recognitionRef.current} style={{ pointerEvents: 'auto' }}>
          {isListening ? 'Stop Listening' : 'Start Listening'}
        </button>
        {isListening && <p style={{ margin: '5px 0 0 0' }}><i>Listening...</i></p>}
        {sttError && <p style={{ color: 'red', margin: '5px 0 0 0' }}>{sttError}</p>}
      </div>

      <h3>Generated Output:</h3>
      <div style={{
        minHeight: '50px', padding: '10px', border: '1px solid #eee',
        backgroundColor: '#f9f9f9', whiteSpace: 'pre-wrap'
      }}>
        {generatedOutput}
      </div>
    </div>
  );
};

export default TextGeneration;
