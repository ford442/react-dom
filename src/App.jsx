import { useState, useRef, useEffect } from 'react';
import useAI from './hooks/useAI';
import useTTS from './hooks/useTTS';
import useSpeechRecognition from './hooks/useSpeechRecognition';
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
  const [textToSpeak, setTextToSpeak] = useState("Hello from browser TTS!");
  const [appStatus, setAppStatus] = useState("Initializing..."); // For all status updates

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

  // ... other hooks
  const { isSpeaking, speakWithKokoro } = useTTS();

  // FIX: New useEffect to handle avatar loading and errors
  useEffect(() => {
    if (modelsLoaded && mountRef.current && !avatarRef.current) {
      const initAvatar = async () => {
        try {
          setAppStatus("Loading 3D Avatar...");
          const avatar = new Avatar(mountRef.current);
          await avatar.load(); // Await the load function
          avatarRef.current = avatar;
          setAppStatus("Avatar loaded successfully!");
        } catch (error) {
          console.error(error);
          setAppStatus(error.message); // Display the error in the UI
        }
      };
      initAvatar();
    }
  }, [modelsLoaded]);

  // Combine AI status with general app status
  const displayStatus = isGenerating || isCaptioning || isSpeaking ? aiStatus : appStatus;

  return (
    <div className="app-container">
      {!modelsLoaded && <LoadingOverlay statusMessage={aiStatus} />}

      {/* NEW: Side-by-side layout structure */}
      <div className="ui-panel">
        <ControlPanel
          personalityProfiles={personalityProfiles}
          currentPersonalityKey={currentPersonalityKey}
          setCurrentPersonalityKey={setCurrentPersonalityKey}
          statusMessage={displayStatus}
          prompt={prompt}
          setPrompt={setPrompt}
          handleGenerateText={handleGenerateText}
          isGenerating={isGenerating}
          // ... other props
          handleImageCaptioning={handleImageCaptioning}
          isCaptioning={isCaptioning}
          generatedCaption={generatedCaption}
          modelsLoaded={modelsLoaded}
        />
      </div>
      <div ref={mountRef} className="viewer-panel" />
    </div>
  );
}

export default App;
