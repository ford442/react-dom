import { useState, useRef, useEffect } from 'react';
import useAI from './hooks/useAI';
import useTTS from './hooks/useTTS';
import useSpeechRecognition from './hooks/useSpeechRecognition';
import Avatar from './three/Avatar';
import ControlPanel from './components/ControlPanel';
import './App.css';

const personalityProfiles = {
  default: {
    displayName: "Default Assistant",
    systemPrompt: "You are a helpful and expressive AI assistant.",
    avatar: "/avatars/default.png",
  },
  // ... other profiles
};

// FIX: New component for the loading screen
const LoadingOverlay = ({ statusMessage }) => (
  <div className="loading-overlay">
    <div className="spinner"></div>
    <p>{statusMessage}</p>
  </div>
);


function App() {
  const [prompt, setPrompt] = useState('');
  const [currentPersonalityKey, setCurrentPersonalityKey] = useState('default');
  const [isSelfConversationMode, setIsSelfConversationMode] = useState(false);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [textToSpeak, setTextToSpeak] = useState("Hello from browser TTS!");

  const mountRef = useRef(null);
  const avatarRef = useRef(null);

  const {
    statusMessage,
    isGenerating,
    isCaptioning,
    generatedOutput,
    generatedCaption,
    handleGenerateText,
    handleImageCaptioning,
    modelsLoaded // We get this from the hook now
  } = useAI();

  const {
    isSpeaking,
    availableVoices,
    selectedVoiceURI,
    setSelectedVoiceURI,
    speakWithWebAPI,
    speakWithKokoro
  } = useTTS();

  const handleTranscript = (transcript) => {
    setPrompt(transcript);
    // Optional: automatically send transcript to AI
    // handleGenerateText(transcript);
  };
  const { isListening, toggleListen } = useSpeechRecognition(handleTranscript);


  useEffect(() => {
    if (modelsLoaded && mountRef.current && !avatarRef.current) {
      const avatar = new Avatar(mountRef.current);
      avatar.load();
      avatarRef.current = avatar;
    }
  }, [modelsLoaded]); // Depend on modelsLoaded to initialize the avatar

  useEffect(() => {
    if (generatedOutput) {
      speakWithKokoro(generatedOutput);
    }
  }, [generatedOutput, speakWithKokoro]);

  useEffect(() => {
    if (generatedCaption && !generatedCaption.startsWith("Error:")) {
        speakWithKokoro(generatedCaption);
    }
  }, [generatedCaption, speakWithKokoro]);


  return (
    <>
      {/* FIX: Conditionally render the loading overlay */}
      {!modelsLoaded && <LoadingOverlay statusMessage={statusMessage} />}

      <div ref={mountRef} className="canvas-container" />
      <ControlPanel
        personalityProfiles={personalityProfiles}
        currentPersonalityKey={currentPersonalityKey}
        setCurrentPersonalityKey={setCurrentPersonalityKey}
        statusMessage={statusMessage}
        prompt={prompt}
        setPrompt={setPrompt}
        handleGenerateText={handleGenerateText}
        isGenerating={isGenerating}
        toggleListen={toggleListen}
        isListening={isListening}
        generatedOutput={generatedOutput}
        isSelfConversationMode={isSelfConversationMode}
        setIsSelfConversationMode={setIsSelfConversationMode}
        conversationHistory={conversationHistory}
        isSpeaking={isSpeaking}
        availableVoices={availableVoices}
        selectedVoiceURI={selectedVoiceURI}
        setSelectedVoiceURI={setSelectedVoiceURI}
        speakWithWebAPI={speakWithWebAPI}
        textToSpeak={textToSpeak}
        setTextToSpeak={setTextToSpeak}
        handleImageCaptioning={handleImageCaptioning}
        isCaptioning={isCaptioning}
        generatedCaption={generatedCaption}
        modelsLoaded={modelsLoaded}
      />
    </>
  );
}

export default App;
