import { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { pipeline, env, Tensor } from '@xenova/transformers';
import Box from '@mui/material/Box'; // Assuming you still use these
import Slider from '@mui/material/Slider'; // Assuming you still use these
import './App.css';

// NEW: Import KokoroTTS library for the new model
import { KokoroTTS } from 'kokoro-js';

// --- Personality Profiles Definition ---
// Defines various AI personalities including their display names, system prompts,
// avatars, intro media, and UI theme colors.
const personalityProfiles = {
  default: {
    displayName: "Default Assistant",
    systemPrompt: "",
    avatar: "/avatars/default.png", // Ensure these assets are in your public/avatars folder
    introVideo: null,
    introPhrase: "Hello! How can I assist you today?",
    themeColors: {
      '--ai-primary-color': '#4A90E2',
      '--ai-secondary-color': '#F5F5F5',
      '--ai-text-color': '#333333',
      '--ai-bubble-bg': '#E8F0FE',
    }
  },
  captainPlayful: {
    displayName: "Captain Playful",
    systemPrompt: "You are Captain Playful, a friendly, shiny red toy robot...",
    avatar: "/avatars/captain_playful.png",
    introVideo: "/intros/captain_playful.mp4", // Ensure these assets are in your public/intros folder
    introPhrase: "Ahoy there, matey! Captain Playful reporting for duty!",
    themeColors: {
      '--ai-primary-color': '#FF6347',
      '--ai-secondary-color': '#FFFF00',
      '--ai-text-color': '#4B0082',
      '--ai-bubble-bg': '#FFDAB9',
    }
  },
  professorPuzzle: {
    displayName: "Professor Puzzle (Owl)",
    systemPrompt: "Hoo-hoo! You are Professor Puzzle...",
    avatar: "/avatars/professor_puzzle.png",
    introVideo: null,
    introPhrase: "Hoo-hoo, a new challenger approaches! What puzzle can I help you unravel today?",
    themeColors: {
      '--ai-primary-color': '#228B22',
      '--ai-secondary-color': '#F5DEB3',
      '--ai-text-color': '#5D4037',
      '--ai-bubble-bg': '#E8F5E9',
    }
  },
  // Add more personalities as needed
};

function App() {
  // --- State Variables ---

  // LLM (Text Generation) States
  const [generator, setGenerator] = useState(null); // Stores the loaded text generation pipeline
  const [prompt, setPrompt] = useState(''); // Input prompt for the LLM
  const [generatedOutput, setGeneratedOutput] = useState(''); // Output from the LLM
  const [isGenerating, setIsGenerating] = useState(false); // Flag for LLM generation in progress

  // General UI & Status States
  const [statusMessage, setStatusMessage] = useState('Initializing...'); // Displays current status messages to the user
  const [isSpeaking, setIsSpeaking] = useState(false); // Generic flag if any TTS is currently speaking
  const [textToSpeakInput, setTextToSpeakInput] = useState("Hello, this is a test of text to speech."); // Shared input for SpeechT5/Kokoro

  // SpeechT5 TTS (Transformers.js) States
  const [ttsPipeline, setTtsPipeline] = useState(null); // Legacy, consider removing if ttsPipelineInstance is sufficient
  const [speakerEmbeddings, setSpeakerEmbeddings] = useState(null); // Speaker embeddings for SpeechT5
  const [ttsPipelineInstance, setTtsPipelineInstance] = useState(null); // Loaded SpeechT5 pipeline instance

  // Kokoro TTS States
  const [kokoroTtsInstance, setKokoroTtsInstance] = useState(null); // Loaded Kokoro TTS pipeline instance

  // Web Speech API (Browser built-in TTS) States
  const [webSpeechText, setWebSpeechText] = useState("Hello from the browser's built-in speech synthesis!"); // Legacy, related to a previous input field
  const [availableVoices, setAvailableVoices] = useState([]); // Available browser voices
  const [selectedVoiceURI, setSelectedVoiceURI] = useState(''); // Selected browser voice URI
  const [isWebSpeaking, setIsWebSpeaking] = useState(false); // Flag for Web Speech API speaking
  const [webSpeechApiDedicatedInput, setWebSpeechApiDedicatedInput] = useState("Hello from browser TTS!"); // Input for the dedicated Browser TTS section

  // Speech-to-Text (STT) States
  const [isListening, setIsListening] = useState(false); // Flag for STT listening in progress
  const [sttError, setSttError] = useState(''); // Errors from STT
  const [finalSttTranscript, setFinalSttTranscript] = useState(null); // Final transcript from STT (currently set by `setPrompt`)

  // Personality & Profile States
  const [currentPersonalityKey, setCurrentPersonalityKey] = useState('default'); // Key for the current AI personality
  const [currentProfile, setCurrentProfile] = useState(personalityProfiles.default); // Full profile object for the current personality

  // TTS Engine Preference States
  const [preferredTtsEngine, setPreferredTtsEngine] = useState('webSpeechAPI'); // Preferred engine for auto-speak after LLM
  const [activeTtsEngine, setActiveTtsEngine] = useState('webSpeechAPI'); // Currently active TTS engine selected by user (SpeechT5, Kokoro, WebSpeechAPI)

  // --- Refs ---
  const promptTextareaRef = useRef(null); // Ref for the LLM prompt textarea for focus control
  const audioContextRef = useRef(null); // Ref for the Web Audio API AudioContext
  const recognitionRef = useRef(null); // Ref for the SpeechRecognition instance
  const synthRef = useRef(null); // Ref for the browser's SpeechSynthesis instance
  const sttJustFinishedRef = useRef(false); // Ref to track if STT just completed, for auto-submit logic
  const playedIntroForPersonalityRef = useRef(null); // Ref to track if intro phrase has been played for the current personality

  // --- Callback Functions ---

  // Plays audio using the Web Speech API (Browser's built-in TTS)
  const speakWithWebSpeechAPI = useCallback((textToSay) => {
    if (!synthRef.current || !textToSay || !textToSay.trim()) { /* ... */ return; }
    if (synthRef.current.speaking) { synthRef.current.cancel(); }
  const utterance = new SpeechSynthesisUtterance(textToSay);
  const selectedVoice = availableVoices.find(voice => voice.voiceURI === selectedVoiceURI);
  if (selectedVoice) utterance.voice = selectedVoice;
  else if (availableVoices.length > 0) utterance.voice = availableVoices[0];
  utterance.onstart = () => { setIsSpeaking(true); setStatusMessage("Speaking (Web Speech API)..."); };
  utterance.onend = () => { setIsSpeaking(false); setStatusMessage("Web Speech API finished."); };
  utterance.onerror = (event) => { /* ... */ setIsSpeaking(false); /* ... */ };
  synthRef.current.speak(utterance);
}, [synthRef, availableVoices, selectedVoiceURI, setIsSpeaking, setStatusMessage]);

const [webSpeechApiInput, setWebSpeechApiInput] = useState("Hello from browser TTS!");
  
const initializeAudioContext = useCallback(() => {
  // Initializes (or resumes) the Web Audio API AudioContext.
  // Ensures there's a valid and running AudioContext for playing synthesized speech.
  if (!audioContextRef.current) {
    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    console.log("AudioContext created. Initial state:", audioContextRef.current.state);
  }
  if (audioContextRef.current.state === 'suspended') {
     audioContextRef.current.resume().catch(err => {
        console.warn("Initial attempt to resume AudioContext in initializeAudioContext failed. Will try again before playing.", err);
     });
  }
  return audioContextRef.current;
}, []);
  
  // Plays raw audio data (Float32Array) through the Web Audio API.
  // Applies personality-specific audio effects if defined.
const playAudio = useCallback((audioArray, samplingRate) => {
  const audioCtx = initializeAudioContext();
  if (!audioCtx) {
    alert("Audio player not initialized."); // TODO: Replace alert with a less obtrusive UI notification
    return;
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(e => console.error("Resume in playAudio failed during effect setup", e));
  }
  const buffer = audioCtx.createBuffer(1, audioArray.length, samplingRate);
  buffer.copyToChannel(audioArray, 0);
  const sourceNode = audioCtx.createBufferSource();
  sourceNode.buffer = buffer;
  let currentNode = sourceNode;
  const profile = personalityProfiles[currentPersonalityKey] || personalityProfiles.default;
  const effects = profile.transformersAudioEffects;
  if (effects) {
    if (typeof effects.playbackRate === 'number') {
      sourceNode.playbackRate.value = effects.playbackRate;
    }
    if (effects.filter && effects.filter.type) {
      const filterNode = audioCtx.createBiquadFilter();
      filterNode.type = effects.filter.type;
      if (typeof effects.filter.frequency === 'number') {
        filterNode.frequency.setValueAtTime(effects.filter.frequency, audioCtx.currentTime);
      }
      if (typeof effects.filter.Q === 'number') {
        filterNode.Q.setValueAtTime(effects.filter.Q, audioCtx.currentTime);
      }
      if (typeof effects.filter.gain === 'number') {
        filterNode.gain.setValueAtTime(effects.filter.gain, audioCtx.currentTime);
      }
      currentNode.connect(filterNode);
      currentNode = filterNode;
    }
    if (typeof effects.gain === 'number') {
      const gainNode = audioCtx.createGain();
      gainNode.gain.setValueAtTime(effects.gain, audioCtx.currentTime);
      currentNode.connect(gainNode);
      currentNode = gainNode;
    }
    if (effects.reverbImpulseResponse) {
      console.warn("Reverb effect with ConvolverNode requires preloading or async handling of impulse responses. Not fully implemented in this example.");
    }
  }
  currentNode.connect(audioCtx.destination);
  sourceNode.start();
}, [initializeAudioContext, currentPersonalityKey]);
  
const speakWithWebAPI = useCallback((textToSay) => {
  // Speaks text using the Web Speech API, applying personality-specific voice parameters (pitch, rate, volume).
  // This is used for general browser TTS and personality intro phrases via Web Speech API.
  if (!synthRef.current || !textToSay || !textToSay.trim()) { /* ... */ return; }
  if (synthRef.current.speaking) { synthRef.current.cancel(); }
  const utterance = new SpeechSynthesisUtterance(textToSay);
  const profile = personalityProfiles[currentPersonalityKey] || personalityProfiles.default;
  let voiceToUse = availableVoices.find(voice => voice.voiceURI === selectedVoiceURI);
  if (!voiceToUse && availableVoices.length > 0) {
    voiceToUse = availableVoices.find(v => v.lang.startsWith(profile.webSpeechApiParams?.langPrefix || 'en') && v.default) ||
                 availableVoices.find(v => v.lang.startsWith(profile.webSpeechApiParams?.langPrefix || 'en')) ||
                 availableVoices[0];
  }
  if (voiceToUse) {
    utterance.voice = voiceToUse;
  }
  if (profile.webSpeechApiParams) {
    if (typeof profile.webSpeechApiParams.pitch === 'number') {
      utterance.pitch = profile.webSpeechApiParams.pitch;
    }
    if (typeof profile.webSpeechApiParams.rate === 'number') {
      utterance.rate = profile.webSpeechApiParams.rate;
    }
    if (typeof profile.webSpeechApiParams.volume === 'number') {
      utterance.volume = profile.webSpeechApiParams.volume;
    }
  }
  utterance.onstart = () => { setIsSpeaking(true); setStatusMessage("Speaking (Browser)..."); };
  utterance.onend = () => { setIsSpeaking(false); setStatusMessage("Browser speech finished."); };
  utterance.onerror = (event) => { /* ... */ setIsSpeaking(false); /* ... */ };
  synthRef.current.speak(utterance);
}, [
    availableVoices,
    selectedVoiceURI,
    currentPersonalityKey,
    synthRef,
    setIsSpeaking,
    setStatusMessage
]);
  
const synthesizeAndPlayText = useCallback(async (text) => {
  // Synthesizes text to speech using the Transformers.js SpeechT5 model and plays it.
  // Handles AudioContext state and potential errors during synthesis.
  if (!ttsPipelineInstance || !speakerEmbeddings) {
    setStatusMessage("TTS model or speaker embeddings not loaded yet.");
    return false;
  }
  if (!text || !text.trim()) {
    setStatusMessage("No text provided to synthesize.");
    return false;
  }
  const audioCtx = initializeAudioContext();
  if (!audioCtx) {
    alert("Could not initialize audio player."); // TODO: Replace alert
    setIsSpeaking(false);
    return false;
  }
  if (audioCtx.state === 'suspended') { // Ensure AudioContext is running
    try {
      await audioCtx.resume();
    } catch (resumeError) {
      console.error("Failed to resume audio context for TTS:", resumeError);
      setStatusMessage("TTS Error: Could not resume audio. Please click a button to interact.");
      setIsSpeaking(false);
      return false;
    }
  }
  if (audioCtx.state !== 'running') {
    console.warn(`AudioContext not running (state: ${audioCtx.state}). TTS may fail.`);
    setStatusMessage("TTS Error: AudioContext not active. Please interact with the page.");
    setIsSpeaking(false);
    return false;
  }

  setIsSpeaking(true);
  setStatusMessage(`Synthesizing (Transformers.js SpeechT5): "${text.substring(0, 30)}..."`);
  try {
    // Perform TTS using SpeechT5 model
    const output = await ttsPipelineInstance(text.trim(), {
      speaker_embeddings: speakerEmbeddings,
    });
    console.log("Transformers.js SpeechT5 TTS Output:", output);
    const modelSamplingRate = output.sampling_rate;
    if (output.audio && typeof modelSamplingRate === 'number' && modelSamplingRate > 0) {
      playAudio(output.audio, modelSamplingRate); // Play the synthesized audio
      setStatusMessage("Speech synthesized and playing (Transformers.js SpeechT5).");
    } else {
      console.error("SpeechT5 TTS pipeline output missing valid audio or sampling_rate. Output was:", output);
      throw new Error("SpeechT5 TTS pipeline did not return valid audio data or sampling rate.");
    }
  } catch (error) {
    console.error("Error during Transformers.js SpeechT5 speech synthesis:", error);
    setStatusMessage(`Transformers.js SpeechT5 TTS Error: ${error.message}`);
    setIsSpeaking(false);
    return false;
  }
  // Reset speaking state after a short delay (could be improved with onended event from audio playback)
  setTimeout(() => setIsSpeaking(false), 500); // Consider a more robust way to track audio end
  return true;
}, [
  ttsPipelineInstance,
  speakerEmbeddings,
  initializeAudioContext,
  playAudio,
  setStatusMessage,
  setIsSpeaking
]);

// REMOVED: The synthesis function for Bark is no longer needed.
// const synthesizeWithBarkAndPlay = useCallback(async (text, personalityKey) => { ... });

// NEW: Synthesis function for the Kokoro TTS model.
const synthesizeWithKokoroAndPlay = useCallback(async (text, personalityKey) => {
    // Synthesizes text to speech using the Kokoro TTS model and plays it.
    // Similar to SpeechT5, handles AudioContext and errors.
    if (!kokoroTtsInstance) {
        setStatusMessage("Kokoro TTS model not loaded yet.");
        return false;
    }
    if (!text || !text.trim()) {
        setStatusMessage("No text provided for Kokoro to synthesize.");
        return false;
    }

    const audioCtx = initializeAudioContext();
    if (!audioCtx) { /* TODO: handle error with UI notification */ setIsSpeaking(false); return false; }
    if (audioCtx.state === 'suspended') { // Ensure AudioContext is running
        try { await audioCtx.resume(); }
        catch (resumeError) { /* TODO: handle error */ setIsSpeaking(false); return false; }
    }
    if (audioCtx.state !== 'running') { /* TODO: handle error */ setIsSpeaking(false); return false; }

    setIsSpeaking(true);
    setStatusMessage(`Synthesizing with Kokoro: "${text.substring(0, 30)}..."`);

    try {
        // Generate audio using the Kokoro TTS instance
        const output = await kokoroTtsInstance.generate(text.trim());
        console.log("Kokoro TTS Raw Output:", output);

        if (output.data && typeof output.sample_rate === 'number' && output.sample_rate > 0) {
            playAudio(output.data, output.sample_rate, personalityKey || currentPersonalityKey); // Play audio with effects
            setStatusMessage("Speech synthesized and playing (Kokoro).");
        } else {
            throw new Error("Kokoro TTS did not return valid audio data or sampling rate.");
        }
    } catch (error) {
        console.error("Error during Kokoro speech synthesis:", error);
        setStatusMessage(`Kokoro TTS Error: ${error.message}`);
        setIsSpeaking(false);
        return false;
    }

    setTimeout(() => setIsSpeaking(false), 500); // Consider a more robust way to track audio end
    return true;
}, [
    kokoroTtsInstance,
    initializeAudioContext,
    playAudio,
    setStatusMessage,
    setIsSpeaking,
    currentPersonalityKey,
]);
  
const setupSpeechRecognition = useCallback(() => {
  // Sets up the browser's SpeechRecognition API.
  // Configures callbacks for results, errors, and end of speech.
  const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognitionAPI) {
    setSttError("Your browser doesn't support Speech Recognition. Try Chrome or Edge.");
    setStatusMessage(prev => `${prev} Speech Recognition not supported.`);
    return;
  }
  const recognitionInstance = new SpeechRecognitionAPI();
  recognitionInstance.continuous = false; // Only capture a single utterance
  recognitionInstance.interimResults = false; // Only provide final results
  recognitionInstance.lang = 'en-US'; // Set language

  recognitionInstance.onresult = (event) => {
    const last = event.results.length - 1;
    const transcript = event.results[last][0].transcript.trim();
    console.log('Speech recognized by onresult:', transcript);
    setPrompt(transcript); // Update the main prompt input with the transcript
    sttJustFinishedRef.current = true; // Signal that STT has finished for auto-generation
  };

  recognitionInstance.onerror = (event) => {
    console.error('Speech recognition error:', event.error, event.message);
    setSttError(`Speech Error: ${event.error} - ${event.message || 'Unknown error'}`);
    setIsListening(false);
    sttJustFinishedRef.current = false;
  };

  recognitionInstance.onend = () => {
    setIsListening(false); // Update listening state when recognition ends
    console.log('Speech recognition ended.');
  };
  recognitionRef.current = recognitionInstance; // Store the instance in a ref
}, [setPrompt, setStatusMessage, setSttError, setIsListening]);

  // Toggles the Speech-to-Text (STT) listening state.
const toggleListen = () => {
  if (!recognitionRef.current) {
    setSttError("Speech recognition not initialized.");
    return;
  }
  if (isListening) {
    recognitionRef.current.stop(); // Stop listening if already active
  } else {
    try {
      setPrompt(''); // Clear previous prompt
      sttJustFinishedRef.current = false;
      recognitionRef.current.start(); // Start listening
      setIsListening(true);
      setSttError('');
      setStatusMessage("Listening for speech...");
    } catch (e) {
      // Handle cases where starting recognition might fail (e.g., already started)
      console.error("Error starting recognition (already started?):", e);
      setIsListening(false);
    }
  }
};

  // Handles text generation using the loaded LLM.
  // Can either generate from the current prompt or re-speak the previous output.
  // After generation, automatically triggers speech synthesis using the preferred engine.
const handleGenerateText = useCallback(async () => {
  if (!generator) {
    alert("The text generation model is not loaded yet. Please wait."); // TODO: Replace alert
    return;
  }

  let textToProcess = prompt.trim();
  let isRespeaking = false;

  // If no new prompt, and there's a previous output, re-speak the output.
  if (!textToProcess && generatedOutput.trim()) {
    textToProcess = generatedOutput.trim();
    isRespeaking = true;
    setStatusMessage("Re-speaking previous output...");
  } else if (!textToProcess) {
    alert("Please enter some text or use speech-to-text to provide a prompt."); // TODO: Replace alert
    return;
  }

  if (!isRespeaking) {
    setIsGenerating(true);
    setGeneratedOutput("Generating, please wait..."); // Placeholder while generating
    setStatusMessage("Generating text with personality: " + (currentProfile?.displayName || 'Default'));
  }

  let newLLMText = "";
  try {
    const systemInstruction = currentProfile.systemPrompt || ""; // Get system prompt from current personality

    if (!isRespeaking) {
      // Construct the full prompt with system instructions for the LLM
      const fullPromptForLLM = systemInstruction + textToProcess;
      console.log("Sending to LLM:", fullPromptForLLM);
      const outputs = await generator(fullPromptForLLM, { // Call the LLM pipeline
        max_new_tokens: 150, // Configure generation parameters
      });
      if (outputs && outputs.length > 0 && outputs[0].generated_text) {
        newLLMText = outputs[0].generated_text;
        setGeneratedOutput(newLLMText); // Update state with the generated text
      } else {
        newLLMText = "No text was generated or output format was unexpected.";
        setGeneratedOutput(newLLMText);
        setStatusMessage("Text generation failed to produce output.");
        if (!isRespeaking) setIsGenerating(false);
        return;
      }
    } else {
      newLLMText = textToProcess; // Use existing text for re-speaking
    }

    setStatusMessage("Text processing complete. Auto-speaking...");
    
    // Auto-speak the generated/selected text using the preferred TTS engine
    if (preferredTtsEngine === 'webSpeechAPI') {
      setWebSpeechApiDedicatedInput(newLLMText); // Update input for browser TTS section
      speakWithWebAPI(newLLMText);
    } else if (preferredTtsEngine === 'speechT5') {
      setTextToSpeakInput(newLLMText); // Update input for SpeechT5/Kokoro section
      await synthesizeAndPlayText(newLLMText); // Synthesize with SpeechT5
    } else if (preferredTtsEngine === 'kokoro') {
      setTextToSpeakInput(newLLMText);
      await synthesizeWithKokoroAndPlay(newLLMText, currentPersonalityKey); // Synthesize with Kokoro
    }
  } catch (error) {
    console.error("Error during text generation or auto-speak setup:", error);
    setGeneratedOutput(`Error: ${error.message}`);
    setStatusMessage(`Error in processing: ${error.message}`);
  }
  if (!isRespeaking) {
    setIsGenerating(false); // Reset generating flag
  }
}, [
  generator,
  prompt,
  generatedOutput,
  currentProfile,
  preferredTtsEngine,
  synthesizeAndPlayText,
  speakWithWebAPI,
  synthesizeWithKokoroAndPlay, // MODIFIED
  setIsGenerating,
  setGeneratedOutput,
  setStatusMessage,
  setTextToSpeakInput,
  setWebSpeechApiDedicatedInput,
  currentPersonalityKey
]);
  
const handleWebSpeechSpeakButton = () => {
speakWithWebAPI(webSpeechApiInput);
};

const handleSynthesizeSpeech = async () => {
  // Triggers speech synthesis for the dedicated browser TTS input field.
  // Note: This seems to use `webSpeechApiInput` which might be different from `webSpeechApiDedicatedInput`.
  // This might be a bug or legacy code. `handleWebSpeechSpeakButton` uses `webSpeechApiInput`.
  // The button in the UI for "Browser Built-in" TTS is actually `handleWebSpeechSpeakButton` which uses `webSpeechApiDedicatedInput`.
  // This `handleWebSpeechSpeak` function seems unused given the current UI.
speakWithWebAPI(webSpeechApiInput); // `webSpeechApiInput` might be outdated, check if `webSpeechApiDedicatedInput` is intended.
};

  // Triggers Transformers.js SpeechT5 TTS for the dedicated `textToSpeakInput` field.
const handleSynthesizeSpeech = async () => {
  if (!textToSpeakInput.trim()) {
      alert("Please enter text in the TTS input area to synthesize."); // TODO: Replace alert
      return;
  }
  await synthesizeAndPlayText(textToSpeakInput); // Uses SpeechT5
};

// --- useEffect Hooks ---

// Effect to handle personality changes:
// - Updates the currentProfile state.
// - Applies theme colors to the UI.
// - Plays intro video or phrase if available and not already played for the session.
useEffect(() => {
  const profile = personalityProfiles[currentPersonalityKey] || personalityProfiles.default;
  setCurrentProfile(profile);

  // Apply theme colors from the personality profile to CSS variables
  if (profile.themeColors) {
    for (const [key, value] of Object.entries(profile.themeColors)) {
      document.documentElement.style.setProperty(key, value);
    }
  }

  // Logic for playing intro video (currently just logs)
  if (profile.introVideo) {
    console.log(`Personality changed to ${profile.displayName}. Should play intro video: ${profile.introVideo}`);
    // Future: Implement video playback if a video element is added to the UI
  }

  // Play intro phrase if available, not yet played for this personality, and no other TTS is active
  if (profile.introPhrase && playedIntroForPersonalityRef.current !== currentPersonalityKey && !isSpeaking) {
    playedIntroForPersonalityRef.current = currentPersonalityKey; // Mark as played for this session

    const playIntroPhrase = async () => {
      console.log(`Playing intro phrase for ${profile.displayName} using ${preferredTtsEngine}`);
      if (preferredTtsEngine === 'webSpeechAPI') {
        if (synthRef.current) { // Ensure WebSpeech API is ready
          speakWithWebAPI(profile.introPhrase);
        } else {
          console.warn("Web Speech API (synthRef) not ready for intro phrase.");
          playedIntroForPersonalityRef.current = null; // Allow re-try if it failed due to unready synth
        }
      } else { // For SpeechT5 or Kokoro
        let ttsFunctionToCall = null;
        let ttsReady = false;
        if (preferredTtsEngine === 'speechT5') {
          if (ttsPipelineInstance && speakerEmbeddings) { // Check if SpeechT5 model is loaded
            ttsFunctionToCall = () => synthesizeAndPlayText(profile.introPhrase);
            ttsReady = true;
          }
        } 
        else if (preferredTtsEngine === 'kokoro') { 
          if (kokoroTtsInstance) { // Check if Kokoro model is loaded
            ttsFunctionToCall = () => synthesizeWithKokoroAndPlay(profile.introPhrase, currentPersonalityKey);
            ttsReady = true;
          }
        }
        
        if (ttsReady && ttsFunctionToCall) {
          await ttsFunctionToCall();
        } else {
          console.warn(`Transformers.js TTS engine '${preferredTtsEngine}' not ready for intro phrase.`);
          playedIntroForPersonalityRef.current = null; // Allow re-try
        }
      }
    };
    // Delay intro phrase slightly, especially if a video might play first
    const timerId = setTimeout(playIntroPhrase, profile.introVideo ? 1000 : 200); // Short delay
    return () => clearTimeout(timerId); // Cleanup timer on unmount or if dependencies change
  }
}, [
  currentPersonalityKey,
  preferredTtsEngine,
  speakWithWebAPI,
  synthesizeAndPlayText,
  synthesizeWithKokoroAndPlay, // MODIFIED
  ttsPipelineInstance,
  speakerEmbeddings,
  kokoroTtsInstance, // MODIFIED
  isSpeaking,
  synthRef
]);

useEffect(() => {
synthRef.current = window.speechSynthesis;
const populateVoices = () => {
    if (synthRef.current) {
      const voices = synthRef.current.getVoices();
      setAvailableVoices(voices);
      if (voices.length > 0) {
        const preferredVoice = voices.find(voice => voice.lang.startsWith('en') && voice.default) ||
                               voices.find(voice => voice.lang.startsWith('en')) ||
                               voices[0];
        if (preferredVoice && !selectedVoiceURI) {
          setSelectedVoiceURI(preferredVoice.voiceURI);
        }
      }
    }
  };
populateVoices();
  if (synthRef.current && synthRef.current.onvoiceschanged !== undefined) {
    synthRef.current.onvoiceschanged = populateVoices;
}
return () => {
  // Effect to initialize SpeechSynthesis and populate available voices for Web Speech API.
  // It also handles changes in available voices.
    if (synthRef.current && synthRef.current.onvoiceschanged !== undefined) {
    synthRef.current.onvoiceschanged = null; // Clean up previous event listener
    }
  };
}, [selectedVoiceURI]); // Re-run if selectedVoiceURI changes (though populateVoices doesn't directly use it, it ensures correct initial selection)

  // This `handleWebSpeechSpeak` function is likely redundant or for a different UI element
  // as `handleWebSpeechSpeakButton` is used for the main "Speak Text (Browser)" button.
  // It uses `webSpeechText` state which is not connected to the main browser TTS input.
const handleWebSpeechSpeak = () => {
  if (!webSpeechText.trim()) {
      alert("Please enter text in the 'Browser Built-in TTS' textarea."); // TODO: Replace alert
      return;
  }
  speakWithWebSpeechAPI(webSpeechText);
};
  
  // Effect to set up Speech Recognition functionality once on component mount.
useEffect(() => {
  setupSpeechRecognition();
}, [setupSpeechRecognition]); // useCallback ensures setupSpeechRecognition is stable unless its own deps change
  
  // Effect to auto-focus the prompt textarea when models are loaded.
useEffect(() => {
  if (generator && ttsPipelineInstance && promptTextareaRef.current) {
    promptTextareaRef.current.focus();
  }
}, [generator, ttsPipelineInstance]); // Runs when generator or ttsPipelineInstance becomes available

  // Effect to automatically trigger LLM text generation when STT finishes and provides a prompt.
  // Only triggers if not already generating or speaking.
useEffect(() => {
  if (prompt.trim() && sttJustFinishedRef.current && !isGenerating && !isSpeaking) {
    console.log("STT provided new prompt, automatically triggering text generation:", prompt);
    handleGenerateText(); 
    sttJustFinishedRef.current = false; // Reset the flag
  }
}, [prompt, isGenerating, isSpeaking, handleGenerateText]); // Depends on these states and the callback

  // Main effect for initializing models and WASM environment. Runs once on component mount.
useLayoutEffect(() => {
    // Configure Transformers.js environment variables
    console.log('Setting up Transformers.js environment.');
    env.localFilesOnly = false; // Allow fetching models/files from remote URLs
    env.allowLocalModels = false; // Disallow loading local models (enforces remote fetching)
    // Performance: env.useBrowserCache should ideally be true in production to allow caching of models.
    // Setting to false means models are re-downloaded on every page load.
    env.useBrowserCache = true; // Changed from false to true for improved performance
    env.remoteHost = 'https://huggingface.co'; // Base URL for Hugging Face models
    env.remotePathTemplate = '{model}/resolve/main/'; // Path template for model files on Hugging Face
    // env.wasm.numThreads = 16; // Optional: Configure WASM multi-threading (if supported and beneficial)

    setStatusMessage('Loading models, please wait...');

    // Asynchronously loads all required AI models (LLM, TTS).
    async function loadModel() {
      // Load Text Generation Model (LaMini-Flan-T5)
      try {
        const pipelineInstance = await pipeline('text2text-generation', 'Xenova/LaMini-Flan-T5-783M', {
          progress_callback: (progress) => { // Optional: Callback for loading progress updates
            const percentage = progress.total > 0 ? (progress.loaded / progress.total * 100).toFixed(2) : 'N/A';
            const message = `Loading LLM: ${progress.file} - ${progress.status} (${percentage}%)`;
            console.log(message);
            setStatusMessage(message);
          }
        });
        console.log("LLM Pipeline loaded successfully.");
        setStatusMessage("LLM Model loaded! Ready to generate.");
        setGenerator(() => pipelineInstance);
      } catch (error) {
        console.error("Failed to load LLM pipeline:", error);
        setStatusMessage(`Error loading LLM model: ${error.message}`);
      }

      // Load SpeechT5 TTS Model & Speaker Embeddings
      try {
        setStatusMessage(prev => `${prev} Loading TTS model (SpeechT5)...`);
        const ttsPipe = await pipeline('text-to-speech', 'Xenova/speecht5_tts', {
          progress_callback: (progress) => {
            const percentage = progress.total > 0 ? (progress.loaded / progress.total * 100).toFixed(2) : 'N/A';
            const message = `Loading SpeechT5 TTS: ${progress.file} (${percentage}%)`;
            setStatusMessage(message);
          },
        });
        setTtsPipelineInstance(() => ttsPipe);
        console.log("SpeechT5 TTS pipeline loaded successfully.");

        setStatusMessage(prev => `${prev} Loading SpeechT5 speaker embeddings...`);
        const speaker_embeddings_url = 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/speaker_embeddings.bin';
        const response = await fetch(speaker_embeddings_url);
        if (!response.ok) throw new Error(`Failed to fetch speaker embeddings: ${response.statusText}`);
        const speakerEmb = new Float32Array(await response.arrayBuffer());
        const reshapedSpeakerEmb = new Tensor('float32', speakerEmb, [1, 512]); // Reshape for the model
        setSpeakerEmbeddings(reshapedSpeakerEmb);
        console.log("SpeechT5 speaker embeddings loaded successfully.");
        // Update status after SpeechT5 fully loaded, before potentially loading other models
        // setStatusMessage("SpeechT5 loaded. Checking other models...");
      } catch (error) {
        console.error("Failed to load SpeechT5 TTS pipeline or speaker embeddings:", error);
        setStatusMessage(prev => `${prev} SpeechT5 TTS Error: ${error.message}.`);
      }
      
      // Load Kokoro TTS Model
      try {
        setStatusMessage(prev => `${prev} Loading TTS model (Kokoro)...`);
        const kokoroInstance = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX');
        setKokoroTtsInstance(() => kokoroInstance);
        console.log("Kokoro TTS pipeline loaded successfully.");
      } catch (error) {
        console.error("Failed to load Kokoro TTS pipeline:", error);
        setStatusMessage(prev => `${prev} Kokoro TTS Error: ${error.message}.`);
      }

      // Final status update after all models attempt to load
      if (generator && ttsPipelineInstance && speakerEmbeddings && kokoroTtsInstance) {
        setStatusMessage("All models loaded! Ready.");
      } else if (generator && (!ttsPipelineInstance || !kokoroTtsInstance)) {
        setStatusMessage("LLM loaded. Some TTS models may have failed. Check console.");
      } else {
        // A general message if some critical models failed.
        // Specific errors are already logged by individual try-catch blocks.
        // setStatusMessage("Some models failed to load. Application may not be fully functional.");
      }
    }

    // --- WASM Module Loading and Initialization ---
    // This section uses a custom mechanism to load and run JavaScript code,
    // which then likely initializes and interacts with a WASM module.
    // The .3ijs files are fetched as ArrayBuffers and decoded from UTF-32.
    const xhrPath = document.querySelector('#loadPath').innerHTML; // Path to the initial JS loader for WASM
    const xhr = new XMLHttpRequest();
    xhr.open('GET', xhrPath, true);
    xhr.responseType = 'arraybuffer'; // Fetch as raw binary data

    console.log('Requesting WASM loader script from:', xhrPath);

    // Custom UTF-32 decoder function
    // This is unconventional for web JavaScript, which is typically UTF-8.
    // It suggests the .3ijs files might be pre-processed or obfuscated.
    function decodeUTF32(uint8Array, isLittleEndian = true) {
      const dataView = new DataView(uint8Array.buffer);
      let result = "";
      for (let i = 0; i < uint8Array.length; i += 4) {
        let codePoint = isLittleEndian ? dataView.getUint32(i, true) : dataView.getUint32(i, false);
        result += String.fromCodePoint(codePoint);
      }
      return result;
    }

    xhr.onload = function() {
      console.log('WASM loader script received.');
      if (xhr.status === 200) {
        const utf32Data = xhr.response;
        // Decode the UTF-32 encoded JavaScript code
        const jsCode = decodeUTF32(new Uint8Array(utf32Data), true); // Assuming little-endian

        // Execute the decoded JavaScript code by injecting it as a module script
        const scr = document.createElement('script');
        scr.type = 'module';
        scr.text = jsCode;
        document.body.appendChild(scr); // Consider appending to <head> or a specific container

        // The injected script is expected to define `libload` and `Module` globally or make them accessible.
        // This part seems to interact with Emscripten-generated WASM code.
        var Module = {}; // Prepare for Emscripten module
        setTimeout(function(){ // Delay to allow the injected script to execute and define libload
          Module = libload(); // `libload` is presumably defined in the decoded jsCode
          Module.onRuntimeInitialized = function(){ // Emscripten specific: callback when WASM is ready
            console.log('WASM runtime initialized. Calling main().');
            Module.callMain(); // Execute the main function of the WASM module
          };
        },2500); // This timeout is critical and might be a source of flakiness if 2.5s isn't always enough.
      } else {
        console.error("Failed to load WASM loader script:", xhr.status, xhr.statusText);
        setStatusMessage("Error: Failed to load critical WASM components.");
      }
    };
    xhr.onerror = function() {
        console.error("Network error while loading WASM loader script.");
        setStatusMessage("Error: Network issue loading WASM components.");
    };
    xhr.send(); // Send the request to fetch the WASM loader script

    loadModel(); // Start loading AI models in parallel with WASM initialization
  }, []); // Empty dependency array ensures this runs only once on mount

  // --- JSX Render ---
  return (
<>
<link charset={"utf-8"} crossorigin rel='stylesheet' href='https://css.1ink.us/sh1.1iss'/>
<link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Audiowide"/>
<img id={'splash1'} src={'./image/shroud.jpg'} style={{backgroundColor:'rgba(233,233,233,0.0)',display:'block',position:'absolute',height:'100vh',width:'100vw',zIndex:3590}}></img>
<img id={'splash2'} src={'./image/spinner.gif'} style={{backgroundColor:'rgba(47,47,47,1.0)',display:'block',top:'50%',left:'50%',transform:'translate(-50%,-50%)',position:'absolute',height:'20vh',width:'20vh',zIndex:3591}}></img>
<nav id={'menu'}>
<section className='menu-section' id={'menu-sections'}>
<div style={{textAlign:'center'}}>
TIMESLIDER
</div>
<ul className='menu-section-list'>
<div id={'mnu'}>
<select id={'resMode'} hidden style={{position:'absolute',zIndex:1,pointerEvents:'auto'}}>
<option value="false">False</option>
<option value="true">True</option>
</select>
<div id={'slideframe'}>
<input type={'text'} id={'timeslider'}></input>
</div>
<div id={'slideframe2'}>
<input type={'text'} id={'srslider'}></input>
</div>
<div id={'slideframe3'}>
<Box sx={{ width: '15vh' }}>
<Slider
aria-label="TEST"
defaultValue={1.0}
valueLabelDisplay="auto"
shiftStep={0.25}
step={0.05}
min={0.05}
max={2.0}
/>
</Box></div>
</div></ul></section>
</nav>
<main id={'panel'}>
<iframe src={'./bezz.1ink'} id={'circle'} title='Circular mask'></iframe>
<input type={'button'} id={'startBtn'} style={{backgroundColor:'gold',position:'absolute',display:'block',left:'6%',top:'9%',zIndex:3200,border:'4px solid #e7e7e7',borderRadius:'17%'}}></input>
<input type={'button'} id={'menuBtn'} style={{backgroundColor:'black',position:'absolute',display:'block',left:'3%',top:'5%',zIndex:3200,border:'6px solid #e7e7e7',borderRadius:'20%'}}></input>
<input type={'button'} id={'musicBtn'} style={{backgroundColor:'cyan',position:'absolute',display:'block',left:'3%',bottom:'5%',zIndex:3200,border:'6px solid green',borderRadius:'20%'}}></input>
<input type={'button'} id={'startBtn5'} style={{backgroundColor:'yellow',position:'absolute',display:'block',left:'2%',top:'9%',zIndex:3200,border:'4px solid #e7e7e7',borderRadius:'17%'}}></input>
<input type={'button'} id={'startBtn2'} style={{backgroundColor:'gold',position:'absolute',display:'block',left:'9%',top:'9%',zIndex:3200,border:'4px solid #e7e7e7',borderRadius:'17%'}}></input>
<input type={'button'} id={'startBtnC'} style={{backgroundColor:'green',position:'absolute',display:'block',left:'5%',top:'12%',zIndex:3200,border:'4px solid #e7e7e7',borderRadius:'17%'}}></input>
<input type={'button'} id={'downloadButton'} style={{backgroundColor:'grey',position:'absolute',display:'block',left:'15%',top:'22%',zIndex:3200,border:'4px solid #e7e7e7',borderRadius:'17%'}}></input>
<input type={'button'} id={'startBtnI'} style={{backgroundColor:'white',position:'absolute',display:'block',left:'15%',top:'12%',zIndex:3200,border:'4px solid #e7e7e7',borderRadius:'17%'}}></input>
<input type={'button'} id={'pyBtn'} style={{backgroundColor:'green',position:'absolute',display:'block',left:'15%',top:'6%',zIndex:3200,border:'4px solid #e7e7e7',borderRadius:'17%'}}></input>
<input type={'button'} id={'pyBtn2'} style={{backgroundColor:'green',position:'absolute',display:'block',left:'18%',top:'6%',zIndex:3200,border:'4px solid #e7e7e7',borderRadius:'17%'}}></input>
<input type={'button'} id={'pyBtn3'} style={{backgroundColor:'yellow',position:'absolute',display:'block',left:'22%',top:'6%',zIndex:3200,border:'4px solid #e7e7e7',borderRadius:'17%'}}></input>
<input type={'button'} id={'pyBtn4'} style={{backgroundColor:'red',position:'absolute',display:'block',left:'22%',top:'8%',zIndex:3200,border:'4px solid #e7e7e7',borderRadius:'17%'}}></input>
<input type={'button'} id={'apngBtn'} style={{backgroundColor:'green',position:'absolute',display:'block',left:'35%',top:'12%',zIndex:3200,border:'4px solid #e7e7e7',borderRadius:'17%'}}></input>
<input type={'button'} id={'apngBtn2'} style={{backgroundColor:'green',position:'absolute',display:'block',left:'37%',top:'12%',zIndex:3200,border:'4px solid #e7e7e7',borderRadius:'17%'}}></input>
<input type={'button'} id={'mviBtn'} style={{backgroundColor:'black',position:'absolute',display:'block',left:'15%',top:'9%',zIndex:3200,border:'4px solid #e7e7e7',borderRadius:'17%'}}></input>
<input type={'button'} id={'uniUp'} style={{backgroundColor:'black',position:'absolute',display:'block',left:'3%',top:'50%',zIndex:3200,border:'6px solid #e7e7e7',borderRadius:'20%'}}></input>
<input type={'button'} id={'uniDown'} style={{backgroundColor:'black',position:'absolute',display:'block',left:'7%',top:'50%',zIndex:3200,border:'6px solid #e7e7e7',borderRadius:'20%'}}></input>
<input type={'button'} id={'viewUp'} style={{backgroundColor:'black',position:'absolute',display:'block',left:'5%',top:'46%',zIndex:3200,border:'6px solid #e7e7e7',borderRadius:'20%'}}></input>
<input type={'button'} id={'viewDown'} style={{backgroundColor:'black',position:'absolute',display:'block',left:'5%',top:'54%',zIndex:3200,border:'6px solid #e7e7e7',borderRadius:'20%'}}></input>
<input type={'button'} id={'sizeUp'} style={{backgroundColor:'black',position:'absolute',display:'block',left:'5%',top:'86%',zIndex:3200,border:'6px solid #e7e7e7',borderRadius:'20%'}}></input>
<input type={'button'} id={'sizeDown'} style={{backgroundColor:'black',position:'absolute',display:'block',left:'5%',top:'90%',zIndex:3200,border:'6px solid #e7e7e7',borderRadius:'20%'}}></input>
<input type={'button'} id={'moveDown'} style={{backgroundColor:'black',position:'absolute',display:'block',right:'5%',top:'90%',zIndex:3200,border:'6px solid #e7e7e7',borderRadius:'20%'}}></input>
<input type={'button'} id={'moveUp'} style={{backgroundColor:'black',position:'absolute',display:'block',right:'5%',top:'86%',zIndex:3200,border:'6px solid #e7e7e7',borderRadius:'20%'}}></input>
<input type={'button'} id={'moveLeft'} style={{backgroundColor:'black',position:'absolute',display:'block',right:'3%',top:'90%',zIndex:3200,border:'6px solid #e7e7e7',borderRadius:'20%'}}></input>
<input type={'button'} id={'moveRight'} style={{backgroundColor:'black',position:'absolute',display:'block',right:'7%',top:'90%',zIndex:3200,border:'6px solid #e7e7e7',borderRadius:'20%'}}></input>
<input className="button" type={'button'} id={'moveFwd'} style={{backgroundColor:'gold',position:'absolute',display:'none',width:'6vh',height:'5vh',left:'47%',bottom:'3%',zIndex:3200,border:'4px solid #e7e7e7',borderRadius:'17%'}}></input>
<input className="button" type={'button'} id={'cruiseFwd'} style={{backgroundColor:'red',position:'absolute',display:'none',width:'6vh',height:'5vh',left:'47%',bottom:'7%',zIndex:3200,border:'4px solid #e7e7e7',borderRadius:'17%'}}></input>
<input type="file" id={"fileInput"} style={{zIndex:5000,position:'absolute',left:'50vh',top:'16vh'}}></input>
<input type="file" id={"fileInput2"} style={{zIndex:5000,position:'absolute',left:'42vh',top:'26vh'}}></input>
<label for="fileInput" className="custom-file-upload">Select File</label>
<div id={'outText'} style={{opacity:0.0,backgroundColor:'green',position:'absolute',top:'50vh',left:'47vw',zIndex:4200}}></div>
<div id={'outText1'} style={{opacity:0.0,backgroundColor:'green',position:'absolute',top:'52vh',left:'47vw',zIndex:4200}}></div>
<div id={'outText2'} style={{opacity:0.0,backgroundColor:'green',position:'absolute',top:'54vh',left:'47vw',zIndex:4200}}></div>
<div id={'modPath'} hidden>https://wasm.noahcohn.com/b3hd/w0-035-mod.3ijs</div>
<div id={'loadPath'} hidden>https://wasm.noahcohn.com/b3hd/w0-035-load-32.3ijs</div>
<div id={'computePath'} hidden>https://glsl.1ink.us/wgsl/compute_070.wgsl'</div>
<div id={'computePathNovid'} hidden>https://glsl.1ink.us/wgsl/compute_070v.wgsl'</div>
<div id={'fragPath'} hidden>https://glsl.1ink.us/wgsl/fragment_007.wgsl'</div>
<div id={'vertPath'} hidden>https://glsl.1ink.us/wgsl/vertex_003.wgsl'</div>
<div id={'path'} hidden>https://glsl.1ink.us/wgsl/synapse.wgsl'</div>
<div id={'imagePath'} hidden>https://www.noahcohn.com/image/901464_400093426755894_1205176414_o.jpg'</div>
<div className='emscripten' id={'stat'}></div>
<div className='emscripten' id={'status'}></div>
<div className='emscripten'>
<progress value={'0'} max={'100'} id={'progress'}></progress>
</div>
<input type={'checkbox'} id={"di"} hidden></input>
//   //   //   //
<div id={'srsiz'} hidden>1000</div>
<div id={'ffire'} hidden>0</div>
<div id={'iwid'} hidden>0</div>
<div id={'ihig'} hidden>0</div>
<div id={'pmhig'} hidden>0</div>
<div id={'canvasSize'} hidden>0</div>
<div id={'floatHigh'} hidden>1</div>
<div id={'wid'} hidden>0</div>
<div id={'hig'} hidden>0</div>
<div id={'tileNum'} hidden>0</div>
<div id={'vsiz'} hidden>0</div>
<div id={'lwid'} hidden>0</div>
<div id={'lhig'} hidden>0</div>
<div id={'ihid'} hidden>0</div>
<div id={'tim'} hidden>2500</div>
<div id={'shut'} hidden>2</div>
<div id={'isrc'} hidden>./intro.mp4</div>
<div id={'idur'} hidden>0</div>
<div id={'itim'} hidden>0</div>
<div id={'smd'} hidden>110.10</div>
// //  //
<div id={'wrap'}>
<div id={'contain1'}>
<canvas className='emscripten' id={'scanvas'} style={{pointerEvents:'auto',display:'block',position:'absolute',zIndex:3000,backgroundColor:'rgba(233,233,233,1.0)',top:'0',height:'100vh',width:'100vh',imageRendering:'auto',transform:'scaleY(1.0)'}}></canvas>
<div className="floating-control-panel base-panel">
  {/* Section for TTS Engine, Personality, and Auto-Speak Preference */}
  <div className="panel-section">
    <div className="input-group">
      <h4>Active Text-to-Speech Engine:</h4>
      <select
        value={activeTtsEngine}
        onChange={(e) => setActiveTtsEngine(e.target.value)}
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

    <div className="personality-header">
      {currentProfile.avatar && (
        <img
          src={currentProfile.avatar}
          alt={`${currentProfile.displayName} Avatar`}
          className="personality-avatar"
          style={{ borderColor: currentProfile.themeColors['--ai-primary-color'] || 'var(--ai-primary-color)' }}
        />
      )}
      <div>
        <h2 style={{ color: currentProfile.themeColors['--ai-primary-color'] || 'var(--ai-text-color)' }}>
          {currentProfile.displayName}
        </h2>
      </div>
    </div>

    <div className="input-group">
      <h4>Select AI Personality:</h4>
      <select
        id="personality-select"
        value={currentPersonalityKey}
        onChange={(e) => setCurrentPersonalityKey(e.target.value)}
      >
        {Object.keys(personalityProfiles).map(key => (
          <option key={key} value={key}>
            {personalityProfiles[key].displayName}
          </option>
        ))}
      </select>
    </div>

    <div className="input-group">
      <h4>Auto-Speak Engine after LLM Generation:</h4>
      <div className="radio-group">
        <label>
          <input
            type="radio"
            name="ttsEnginePref"
            value="webSpeechAPI"
            checked={preferredTtsEngine === 'webSpeechAPI'}
            onChange={() => setPreferredTtsEngine('webSpeechAPI')}
          /> Browser Built-in
        </label>
        <label>
          <input
            type="radio"
            name="ttsEnginePref"
            value="transformersJS" // This value should ideally match one of the activeTtsEngine options like 'speechT5' or 'kokoro'
            checked={preferredTtsEngine === 'transformersJS'} // Consider renaming this state or its values for clarity
            onChange={() => setPreferredTtsEngine('transformersJS')}
            disabled={!ttsPipelineInstance || !speakerEmbeddings} // This condition might need to check activeTtsEngine
          /> Transformers.js (SpeechT5)
        </label>
         {/* Optionally add Kokoro as an auto-speak option */}
        <label>
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
    </div>
  </div>


  {/* Section for Browser Built-in TTS */}
  <div className="panel-section">
    <h2>Text to Speech (Browser Built-in)</h2>
    <textarea
      value={webSpeechApiDedicatedInput}
      onChange={(e) => setWebSpeechApiDedicatedInput(e.target.value)}
      placeholder="Enter text for browser TTS..."
      rows={3}
      disabled={isSpeaking}
    />
    <div className="input-group inline">
      <label htmlFor="voice-select-webapi">Voice:</label>
      <select
        id="voice-select-webapi"
        value={selectedVoiceURI}
        onChange={(e) => setSelectedVoiceURI(e.target.value)}
        disabled={availableVoices.length === 0 || isWebSpeaking}
      >
        {availableVoices.length === 0 && <option value="">Loading voices...</option>}
        {availableVoices.map((voice) => (
          <option key={voice.voiceURI} value={voice.voiceURI}>
            {voice.name} ({voice.lang}) {voice.default ? '[Default]' : ''}
          </option>
        ))}
      </select>
    </div>
    <button
      onClick={handleWebSpeechSpeakButton} // Corrected this handler name from previous version
      disabled={isWebSpeaking || !webSpeechApiDedicatedInput.trim() || availableVoices.length === 0}
    >
      {isWebSpeaking ? 'Speaking...' : 'Speak Text (Browser)'}
    </button>
  </div>
</div>

{/* Panel for Text Generation */}
<div className="content-panel base-panel top-left-panel">
  <div className="panel-section">
    <h2>Text Generation (LaMini-Flan-T5-783M)</h2>
    <div className="status-display">
      {statusMessage}
    </div>
    <textarea
      ref={promptTextareaRef}
      value={prompt}
      onChange={(e) => setPrompt(e.target.value)}
      placeholder="Enter prompt or use Speech-to-Text..."
      rows={3}
      disabled={!generator || isGenerating}
    />
    <button
      onClick={handleGenerateText}
      disabled={!generator || isGenerating}
    >
      {isGenerating ? 'Generating...' : 'Generate Text'}
    </button>

    <div className="input-group" style={{ marginTop: '10px', paddingTop:'10px', borderTop: '1px solid #eee' }}>
      <button onClick={toggleListen} disabled={!recognitionRef.current} className="auto-width">
        {isListening ? 'Stop Listening' : 'Start Listening'}
      </button>
      {isListening && <p style={{margin: '5px 0 0 0'}}><i>Listening...</i></p>}
      {sttError && <p style={{ color: 'red', margin: '5px 0 0 0' }}>{sttError}</p>}
    </div>
    <h3>Generated Output:</h3>
    <div className="generated-output-display">
      {generatedOutput}
    </div>
  </div>
</div>

{/* Panel for Transformers.js + Kokoro TTS */}
<div className="content-panel base-panel top-right-panel">
  <div className="panel-section">
    <h2>Text to Speech (Transformers.js - SpeechT5)</h2>
    <textarea
      value={textToSpeakInput}
      onChange={(e) => setTextToSpeakInput(e.target.value)}
      placeholder="Enter text to synthesize..."
      rows={3}
      disabled={!ttsPipelineInstance || isSpeaking}
    />
    <button
      onClick={handleSynthesizeSpeech}
      disabled={!ttsPipelineInstance || !speakerEmbeddings || isSpeaking || !textToSpeakInput.trim()}
    >
      {isSpeaking ? 'Synthesizing...' : 'Synthesize & Play Speech'}
    </button>
  </div>
  {/* Kokoro TTS section within the same right panel */}
  <div className="panel-section">
    <h2>Text to Speech (Kokoro - ONNX Community)</h2>
    <textarea
        value={textToSpeakInput}
        onChange={(e) => setTextToSpeakInput(e.target.value)}
        placeholder="Enter text for Kokoro TTS..."
        rows={3}
        disabled={!kokoroTtsInstance || isSpeaking}
    />
    <button
        onClick={() => synthesizeWithKokoroAndPlay(textToSpeakInput, currentPersonalityKey)}
        disabled={!kokoroTtsInstance || isSpeaking || !textToSpeakInput.trim()}
    >
        {isSpeaking && activeTtsEngine === 'kokoro' ? 'Synthesizing (Kokoro)...' : 'Synthesize & Play (Kokoro)'}
    </button>
  </div>
</div>

<div id={'contain1a'} style={{height:'75%',width:'75%'}}>
</div>
</div>
<div id={'contain2'}>
<canvas id={'bcanvas'} hidden style={{pointerEvents:'none',display:'none',zIndex:2100,position:'absolute',height:'100vh',width:'100vh',marginLeft:'auto',marginRight:'auto',backgroundColor:'rgba(0,255,0,1.0)',top:'0',imageRendering:'auto'}}></canvas>
<img id={'resultImage'} src={''}></img>
</div>
</div>
</main>
<div>
<img id={"imgAnimPNG"} src={''}></img>
<img id={'mvi'} src={'./image/901464_400093426755894_1205176414_o.jpg'}></img>
</div>
<div style={{pointerEvents:'none',height:'100vh'}}>
<video hidden muted src={'./video-1456459792.mp4'}
       loop crossorigin playsinline
       id={'ivi'} preload={'auto'}
       style={{pointerEvents:'none',transform:'scaleY(-1.0)'}}></video>
</div>
<div style={{pointerEvents:'none',height:'100vh'}}>
<video hidden muted crossorigin playsinline id={'ldv'} preload={'auto'} style={{pointerEvents:'none'}}></video>
</div>
<audio crossorigin id={'track'} preload={'auto'} hidden style={{pointerEvents:'none'}}></audio>
</>
);
}

export default App;
