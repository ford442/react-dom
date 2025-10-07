import { useState, useRef, useEffect } from 'react';
import useAI from './hooks/useAI';
import useTTS from './hooks/useTTS';
// NOTE: We are removing the old STT and other unused hooks for now to simplify
// import useSpeechRecognition from './hooks/useSpeechRecognition';
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
    modelsLoaded
  } = useAI();

  // FIX: Destructure all the necessary values and functions from the useTTS hook
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
  
  // Speak when new AI output is generated
  useEffect(() => {
      if (generatedOutput) speakWithKokoro(generatedOutput);
  }, [generatedOutput, speakWithKokoro]);


  const displayStatus = isGenerating || isCaptioning || isSpeaking ? aiStatus : appStatus;

  return (
    <div className="app-container">
      {!modelsLoaded && <LoadingOverlay statusMessage={aiStatus} />}
      <div className="ui-panel">
        <ControlPanel
          // Pass all props, including the newly added TTS props
          personalityProfiles={personalityProfiles}
          currentPersonalityKey={currentPersonalityKey}
          statusMessage={displayStatus}
          prompt={prompt}
          setPrompt={setPrompt}
          handleGenerateText={handleGenerateText}
          isGenerating={isGenerating}
          handleImageCaptioning={handleImageCaptioning}
          isCaptioning={isCaptioning}
          generatedCaption={generatedCaption}
          modelsLoaded={modelsLoaded}
          generatedOutput={generatedOutput}
          // FIX: Pass all the TTS props down to the Control Panel
          isSpeaking={isSpeaking}
          availableVoices={availableVoices}
          selectedVoiceURI={selectedVoiceURI}
          setSelectedVoiceURI={setSelectedVoiceURI}
          textToSpeak={textToSpeak}
          setTextToSpeak={setTextToSpeak}
          speakWithWebAPI={speakWithWebAPI}
        />
      </div>
      <div ref={mountRef} className="viewer-panel" />
    </div>
  );
}

export default App;
