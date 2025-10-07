import React from 'react';
import PersonalitySelector from './PersonalitySelector';
import TTS_Controls from './TTS_Controls';
import ImageCaptioning from './ImageCaptioning';

// This component now receives many props and distributes them to child components.
const ControlPanel = ({
  // AI Interaction Props
  statusMessage,
  prompt,
  setPrompt,
  handleGenerateText,
  isGenerating,
  generatedOutput,
  modelsLoaded,
  // Personality Props
  personalityProfiles,
  currentPersonalityKey,
  // Image Captioning Props
  handleImageCaptioning,
  isCaptioning,
  generatedCaption,
  // TTS Props
  isSpeaking,
  availableVoices,
  selectedVoiceURI,
  setSelectedVoiceURI,
  textToSpeak,
  setTextToSpeak,
  speakWithWebAPI
}) => {
  return (
    <>
      <PersonalitySelector
        personalityProfiles={personalityProfiles}
        currentPersonalityKey={currentPersonalityKey}
        setCurrentPersonalityKey={() => {}} // Placeholder, not implemented yet
      />

      <div className="panel-section">
        <h3>Interaction</h3>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Type your message..."
          rows={3}
          disabled={!modelsLoaded || isGenerating}
        />
        <button onClick={() => handleGenerateText(prompt)} disabled={!modelsLoaded || isGenerating || !prompt.trim()}>
          {isGenerating ? 'Generating...' : 'Generate Text'}
        </button>
        <label>Generated Output:</label>
        <div className='generated-output-display'>{generatedOutput}</div>
      </div>

      <ImageCaptioning
        onCaption={handleImageCaptioning}
        isCaptioning={isCaptioning}
        caption={generatedCaption}
        disabled={!modelsLoaded}
      />

      <TTS_Controls
        isSpeaking={isSpeaking}
        availableVoices={availableVoices}
        selectedVoiceURI={selectedVoiceURI}
        setSelectedVoiceURI={setSelectedVoiceURI}
        onSpeak={speakWithWebAPI}
        text={textToSpeak}
        onTextChange={setTextToSpeak}
      />

      <div className='status-display'>{statusMessage}</div>
    </>
  );
};

export default ControlPanel;
