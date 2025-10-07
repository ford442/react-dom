import React from 'react';
import PersonalitySelector from './PersonalitySelector';
import TTS_Controls from './TTS_Controls';
import ImageCaptioning from './ImageCaptioning';

const ControlPanel = ({
  personalityProfiles,
  currentPersonalityKey,
  setCurrentPersonalityKey,
  statusMessage,
  prompt,
  setPrompt,
  handleGenerateText,
  isGenerating,
  toggleListen,
  isListening,
  generatedOutput,
  isSelfConversationMode,
  setIsSelfConversationMode,
  conversationHistory,
  // TTS props
  isSpeaking,
  availableVoices,
  selectedVoiceURI,
  setSelectedVoiceURI,
  speakWithWebAPI,
  textToSpeak,
  setTextToSpeak,
  // Image Captioning props
  handleImageCaptioning,
  isCaptioning,
  generatedCaption,
  // Models loaded prop
  modelsLoaded
}) => {
  return (
    <div className="floating-control-panel">
      <div className="panel-header">
        <h2>{personalityProfiles[currentPersonalityKey].displayName}</h2>
        <div className='status-display'>{statusMessage}</div>
      </div>

      <div className="panel-content">
        <div className="panel-column">
          <PersonalitySelector
            personalityProfiles={personalityProfiles}
            currentPersonalityKey={currentPersonalityKey}
            setCurrentPersonalityKey={setCurrentPersonalityKey}
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
            <div className="button-group">
              <button onClick={() => handleGenerateText(prompt)} disabled={!modelsLoaded || isGenerating || !prompt.trim()}>
                {isGenerating ? 'Generating...' : 'Send to AI'}
              </button>
              <button onClick={toggleListen} disabled={!modelsLoaded}>
                {isListening ? 'Listening...' : 'Listen'}
              </button>
            </div>
            <div className='generated-output-display'>
              {isSelfConversationMode ?
                conversationHistory.map((msg, index) => (
                  <p key={index}><strong>{msg.speaker}:</strong> {msg.text}</p>
                )) : generatedOutput
              }
            </div>
          </div>
        </div>

        <div className="panel-column">
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
        </div>
      </div>
    </div>
  );
};

export default ControlPanel;
