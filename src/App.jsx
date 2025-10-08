import { useState, useRef, useEffect, useCallback } from 'react';
import useAI from './hooks/useAI';
import useTTS from './hooks/useTTS';
import useSpeechRecognition from './hooks/useSpeechRecognition'; // 1. UNCOMMENT this line
import Avatar from './three/Avatar';
import ControlPanel from './components/ControlPanel';
import './App.css';

const personalityProfiles = {
  default: { displayName: "Default Assistant" },
  // ... other profiles
};

const LoadingOverlay = ({ statusMessage }) => (
  <div className="loading-overlay">
    <div className="spinner"></div>
    <p>{statusMessage}</p>
  </div>
);

function App() {
  const [prompt, setPrompt] = useState('');
  const [currentPersonalityKey, setCurrentPersonalityKey] = useState('default');
  const [appStatus, setAppStatus] = useState("Initializing...");

  const mountRef = useRef(null);
  const avatarRef = useRef(null);

  const {
    statusMessage: aiStatus,
    isGenerating,
    isCaptioning,
    generatedOutput,
    generatedCaption,
    handleGenerateText,
    handleImageCaptioning,
    modelsLoaded,
    getGestureForText
  } = useAI();

  const {
    isSpeaking,
    availableVoices,
    selectedVoiceURI,
    setSelectedVoiceURI,
    textToSpeak,
    setTextToSpeak,
    speakWithWebAPI,
    speakWithKokoro,
  } = useTTS();

  // 2. ACTIVATE THE SPEECH RECOGNITION HOOK
  // This function will receive the transcribed text from the hook.
  const handleTranscript = useCallback((transcript) => {
    setPrompt(transcript); // Update the main prompt with your speech.
  }, [setPrompt]);

  const {
    isListening,
    toggleListen,
    recognitionSupported
  } = useSpeechRecognition(handleTranscript);

  useEffect(() => {
    if (modelsLoaded && mountRef.current && !avatarRef.current) {
      const initAvatar = async () => {
        try {
          setAppStatus("Loading 3D Avatar...");
          const avatar = new Avatar(mountRef.current);
          await avatar.load();
          avatarRef.current = avatar;
          setAppStatus("Avatar loaded successfully!");
        } catch (error) {
          console.error(error);
          setAppStatus(error.message);
        }
      };
      initAvatar();
    }
  }, [modelsLoaded]);
  
 useEffect(() => {
    const handleNewOutput = async (text) => {
      // Make the avatar speak the text
      speakWithKokoro(text);
      // And simultaneously, analyze the text to choose and play a gesture
      if (avatarRef.current && getGestureForText) {
        const gesture = await getGestureForText(text);
        if (gesture !== 'idle') {
          // Only trigger a specific animation if it's not the default state
          avatarRef.current.setAnimation(gesture);
        }
      }
    };
       if (generatedOutput) {
      handleNewOutput(generatedOutput);
    }
  }, [generatedOutput, speakWithKokoro, getGestureForText]); // 3. ADD getGestureForText to dependency array

  const displayStatus = isGenerating || isCaptioning || isSpeaking ? aiStatus : appStatus;

  return (
    <div className="app-container">
      {!modelsLoaded && <LoadingOverlay statusMessage={aiStatus} />}
      
      <div className="main-content-area">
        <div className="ui-panel">
          <ControlPanel
            // ... (all the other props remain the same)
            personalityProfiles={personalityProfiles}
            currentPersonalityKey={currentPersonalityKey}
            statusMessage={displayStatus}
            handleImageCaptioning={handleImageCaptioning}
            isCaptioning={isCaptioning}
            generatedCaption={generatedCaption}
            modelsLoaded={modelsLoaded}
            isSpeaking={isSpeaking}
            availableVoices={availableVoices}
            selectedVoiceURI={selectedVoiceURI}
            setSelectedVoiceURI={setSelectedVoiceURI}
            textToSpeak={textToSpeak}
            setTextToSpeak={setTextToSpeak}
            speakWithWebAPI={speakWithWebAPI}
            // 3. PASS THE NEW PROPS DOWN
            isListening={isListening}
            toggleListen={toggleListen}
            recognitionSupported={recognitionSupported}
          />
        </div>
        <div ref={mountRef} className="viewer-panel" />
      </div>

      <div className="interaction-bar">
        <div className="interaction-bar-input-section">
          <label htmlFor="prompt-textarea">Your Message:</label>
          <textarea
            id="prompt-textarea"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Type your message..."
            disabled={!modelsLoaded || isGenerating}
          />
          <button onClick={() => handleGenerateText(prompt)} disabled={!modelsLoaded || isGenerating || !prompt.trim()}>
            {isGenerating ? 'Generating...' : 'Send Message'}
          </button>
        </div>
        <div className="interaction-bar-output-section">
          <label>AI Response:</label>
          <div className='generated-output-display'>{generatedOutput}</div>
        </div>
      </div>
    </div>
  );
}

export default App;
