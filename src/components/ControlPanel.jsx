import React from 'react';
import PersonalitySelector from './PersonalitySelector';
import TTS_Controls from './TTS_Controls';
import ImageCaptioning from './ImageCaptioning';
import STT_Controls from './STT_Controls'; // 1. IMPORT the new component

// This component is now simpler and only manages secondary controls.
const ControlPanel = ({
  statusMessage,
  modelsLoaded,
  personalityProfiles,
  currentPersonalityKey,
  handleImageCaptioning,
  isCaptioning,
  generatedCaption,
  isSpeaking,
  availableVoices,
  selectedVoiceURI,
  setSelectedVoiceURI,
  textToSpeak,
  setTextToSpeak,
  speakWithWebAPI,
  // 2. RECEIVE the new props
  isListening,
  toggleListen,
  recognitionSupported,
}) => {
  return (
    <>
      <PersonalitySelector
        personalityProfiles={personalityProfiles}
        currentPersonalityKey={currentPersonalityKey}
        setCurrentPersonalityKey={() => {}} // Placeholder, not implemented yet
      />

      <ImageCaptioning
        onCaption={handleImageCaptioning}
        isCaptioning={isCaptioning}
        caption={generatedCaption}
        disabled={!modelsLoaded}
      />

      {/* 3. ADD the new component to the UI */}
      <STT_Controls
        isListening={isListening}
        toggleListen={toggleListen}
        recognitionSupported={recognitionSupported}
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
