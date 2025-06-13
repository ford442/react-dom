import { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { pipeline, env, Tensor } from '@xenova/transformers';
import Box from '@mui/material/Box'; // Assuming you still use these
import Slider from '@mui/material/Slider'; // Assuming you still use these
import './App.css';

// NEW: Import KokoroTTS library for the new model
import { KokoroTTS } from 'kokoro-js';

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
const [generator, setGenerator] = useState(null);
const [statusMessage, setStatusMessage] = useState('Initializing...');
const [prompt, setPrompt] = useState('');
const [generatedOutput, setGeneratedOutput] = useState('');
const [isGenerating, setIsGenerating] = useState(false);
const [ttsPipeline, setTtsPipeline] = useState(null);
const [speakerEmbeddings, setSpeakerEmbeddings] = useState(null);
const [ttsPipelineInstance, setTtsPipelineInstance] = useState(null);
const [isListening, setIsListening] = useState(false);
const [sttError, setSttError] = useState('');
const [textToSpeakInput, setTextToSpeakInput] = useState("Hello, this is a test of text to speech.");
const [isSpeaking, setIsSpeaking] = useState(false);
const [webSpeechText, setWebSpeechText] = useState("Hello from the browser's built-in speech synthesis!");
const [availableVoices, setAvailableVoices] = useState([]);
const [selectedVoiceURI, setSelectedVoiceURI] = useState('');
const [isWebSpeaking, setIsWebSpeaking] = useState(false);
const [preferredTtsEngine, setPreferredTtsEngine] = useState('webSpeechAPI'); // Default to 'webSpeechAPI' or 'transformersJS'
const [finalSttTranscript, setFinalSttTranscript] = useState(null);
const [webSpeechApiDedicatedInput, setWebSpeechApiDedicatedInput] = useState("Hello from browser TTS!");
const [currentPersonalityKey, setCurrentPersonalityKey] = useState('default');
const [currentProfile, setCurrentProfile] = useState(personalityProfiles.default); // Store the whole profile

// MODIFIED: Replaced 'bark' with 'kokoro'
const [activeTtsEngine, setActiveTtsEngine] = useState('webSpeechAPI'); // Default: 'webSpeechAPI', 'speechT5', 'kokoro'

// REMOVED: State for the Bark pipeline instance is no longer needed.
// const [barkPipelineInstance, setBarkPipelineInstance] = useState(null);

// NEW: State to hold the loaded Kokoro TTS model instance.
const [kokoroTtsInstance, setKokoroTtsInstance] = useState(null);

const promptTextareaRef = useRef(null); // Ref for the prompt textarea
const audioContextRef = useRef(null); // For playing audio
const recognitionRef = useRef(null); // To hold the SpeechRecognition instance
const synthRef = useRef(null);
const sttJustFinishedRef = useRef(false);
const playedIntroForPersonalityRef = useRef(null);

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
  
const playAudio = useCallback((audioArray, samplingRate) => {
  const audioCtx = initializeAudioContext();
  if (!audioCtx) {
    alert("Audio player not initialized.");
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
    alert("Could not initialize audio player.");
    setIsSpeaking(false);
    return false;
  }
  if (audioCtx.state === 'suspended') {
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
  setStatusMessage(`Synthesizing (Transformers.js): "${text.substring(0, 30)}..."`);
  try {
    const output = await ttsPipelineInstance(text.trim(), {
      speaker_embeddings: speakerEmbeddings,
    });
    console.log("Transformers.js TTS Output:", output);
    const modelSamplingRate = output.sampling_rate;
    if (output.audio && typeof modelSamplingRate === 'number' && modelSamplingRate > 0) {
      console.log(`Playing audio with sampling rate: ${modelSamplingRate}`);
      playAudio(output.audio, modelSamplingRate);
      setStatusMessage("Speech synthesized and playing (Transformers.js).");
    } else {
      console.error("TTS pipeline output missing valid audio or sampling_rate. Output was:", output);
      throw new Error("TTS pipeline did not return valid audio data or sampling rate.");
    }
  } catch (error) {
    console.error("Error during Transformers.js speech synthesis:", error);
    setStatusMessage(`Transformers.js TTS Error: ${error.message}`);
    setIsSpeaking(false);
    return false;
  }
  setTimeout(() => setIsSpeaking(false), 500);
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
    if (!kokoroTtsInstance) {
        setStatusMessage("Kokoro TTS model not loaded yet.");
        return false;
    }
    if (!text || !text.trim()) {
        setStatusMessage("No text provided for Kokoro to synthesize.");
        return false;
    }

    const audioCtx = initializeAudioContext();
    if (!audioCtx) { /* ... handle error ... */ setIsSpeaking(false); return false; }
    if (audioCtx.state === 'suspended') {
        try { await audioCtx.resume(); }
        catch (resumeError) { /* ... handle error ... */ setIsSpeaking(false); return false; }
    }
    if (audioCtx.state !== 'running') { /* ... handle error ... */ setIsSpeaking(false); return false; }

    setIsSpeaking(true);
    setStatusMessage(`Synthesizing with Kokoro: "${text.substring(0, 30)}..."`);

    try {
        // Generate audio using the Kokoro TTS instance
        const output = await kokoroTtsInstance.generate(text.trim());
        console.log("Kokoro TTS Raw Output:", output);

        // The output object contains `data` (Float32Array) and `sample_rate` (number)
        if (output.data && typeof output.sample_rate === 'number' && output.sample_rate > 0) {
            // Use your existing playAudio function to play the sound and apply effects
            playAudio(output.data, output.sample_rate, personalityKey || currentPersonalityKey);
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

    // A simple timer to reset speaking state. For more accuracy, you could use
    // the 'onended' event of the Web Audio API's AudioBufferSourceNode.
    setTimeout(() => setIsSpeaking(false), 500);
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
  const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognitionAPI) {
    setSttError("Your browser doesn't support Speech Recognition. Try Chrome or Edge.");
    setStatusMessage(prev => `${prev} Speech Recognition not supported.`);
    return;
  }
  const recognitionInstance = new SpeechRecognitionAPI();
  recognitionInstance.continuous = false;
  recognitionInstance.interimResults = false;
  recognitionInstance.lang = 'en-US';
  recognitionInstance.onresult = (event) => {
    const last = event.results.length - 1;
    const transcript = event.results[last][0].transcript.trim();
    console.log('Speech recognized by onresult:', transcript);
    setPrompt(transcript);
    sttJustFinishedRef.current = true;
  };
  recognitionInstance.onerror = (event) => {
    console.error('Speech recognition error:', event.error, event.message);
    setSttError(`Speech Error: ${event.error} - ${event.message || 'Unknown error'}`);
    setIsListening(false);
    sttJustFinishedRef.current = false;
  };
  recognitionInstance.onend = () => {
    setIsListening(false);
    console.log('Speech recognition ended.');
  };
  recognitionRef.current = recognitionInstance;
}, [setPrompt, setStatusMessage, setSttError, setIsListening]);

const toggleListen = () => {
  if (!recognitionRef.current) {
    setSttError("Speech recognition not initialized.");
    return;
  }
  if (isListening) {
    recognitionRef.current.stop();
  } else {
    try {
      setPrompt('');
      sttJustFinishedRef.current = false;
      recognitionRef.current.start();
      setIsListening(true);
      setSttError('');
      setStatusMessage("Listening for speech...");
    } catch (e) {
      console.error("Error starting recognition (already started?):", e);
      setIsListening(false);
    }
  }
};
const handleGenerateText = useCallback(async () => {
  if (!generator) {
    alert("The text generation model is not loaded yet. Please wait.");
    return;
  }
  let textToProcess = prompt.trim();
  let isRespeaking = false;
  if (!textToProcess && generatedOutput.trim()) {
    textToProcess = generatedOutput.trim();
    isRespeaking = true;
    setStatusMessage("Re-speaking previous output...");
  } else if (!textToProcess) {
    alert("Please enter some text or use speech-to-text to provide a prompt.");
    return;
  }
  if (!isRespeaking) {
    setIsGenerating(true);
    setGeneratedOutput("Generating, please wait...");
    setStatusMessage("Generating text with personality: " + (currentProfile?.displayName || 'Default'));
  }
  let newLLMText = "";
  try {
    const systemInstruction = currentProfile.systemPrompt || "";
    if (!isRespeaking) {
      const fullPromptForLLM = systemInstruction + textToProcess;
      console.log("Sending to LLM:", fullPromptForLLM);
      const outputs = await generator(fullPromptForLLM, {
        max_new_tokens: 150,
      });
      if (outputs && outputs.length > 0 && outputs[0].generated_text) {
        newLLMText = outputs[0].generated_text;
        setGeneratedOutput(newLLMText);
      } else {
        newLLMText = "No text was generated or output format was unexpected.";
        setGeneratedOutput(newLLMText);
        setStatusMessage("Text generation failed to produce output.");
        if (!isRespeaking) setIsGenerating(false);
        return;
      }
    } else {
      newLLMText = textToProcess;
    }
    setStatusMessage("Text processing complete. Auto-speaking...");
    
    // MODIFIED: Replaced 'bark' with 'kokoro' and updated the function call
    if (preferredTtsEngine === 'webSpeechAPI') {
      setWebSpeechApiDedicatedInput(newLLMText);
      speakWithWebAPI(newLLMText);
    } else if (preferredTtsEngine === 'speechT5') {
      setTextToSpeakInput(newLLMText);
      await synthesizeAndPlayText(newLLMText);
    } else if (preferredTtsEngine === 'kokoro') {
      setTextToSpeakInput(newLLMText);
      await synthesizeWithKokoroAndPlay(newLLMText, currentPersonalityKey);
    }
  } catch (error) {
    console.error("Error during text generation or auto-speak setup:", error);
    setGeneratedOutput(`Error: ${error.message}`);
    setStatusMessage(`Error in processing: ${error.message}`);
  }
  if (!isRespeaking) {
    setIsGenerating(false);
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
  if (!textToSpeakInput.trim()) {
      alert("Please enter text in the TTS input area to synthesize.");
      return;
  }
  await synthesizeAndPlayText(textToSpeakInput);
};

useEffect(() => {
const profile = personalityProfiles[currentPersonalityKey] || personalityProfiles.default;
  setCurrentProfile(profile);

  if (profile.themeColors) {
    for (const [key, value] of Object.entries(profile.themeColors)) {
      document.documentElement.style.setProperty(key, value);
    }
  }
  if (profile.introVideo) {
    console.log(`Personality changed to ${profile.displayName}. Should play intro video: ${profile.introVideo}`);
  }
  if (profile.introPhrase && playedIntroForPersonalityRef.current !== currentPersonalityKey && !isSpeaking) {
    playedIntroForPersonalityRef.current = currentPersonalityKey;
    const playIntroPhrase = async () => {
      console.log(`Playing intro phrase for ${profile.displayName} using ${preferredTtsEngine}`);
      if (preferredTtsEngine === 'webSpeechAPI') {
        if (synthRef.current) {
          speakWithWebAPI(profile.introPhrase);
        } else {
          console.warn("Web Speech API (synthRef) not ready for intro phrase.");
          playedIntroForPersonalityRef.current = null;
        }
      } else {
        let ttsFunctionToCall = null;
        let ttsReady = false;
        if (preferredTtsEngine === 'speechT5') {
          if (ttsPipelineInstance && speakerEmbeddings) {
            ttsFunctionToCall = () => synthesizeAndPlayText(profile.introPhrase);
            ttsReady = true;
          }
        } 
        // MODIFIED: Check for 'kokoro' and the corresponding instance.
        else if (preferredTtsEngine === 'kokoro') { 
          if (kokoroTtsInstance) {
            ttsFunctionToCall = () => synthesizeWithKokoroAndPlay(profile.introPhrase, currentPersonalityKey);
            ttsReady = true;
          }
        }
        
        if (ttsReady && ttsFunctionToCall) {
          await ttsFunctionToCall();
        } else {
          console.warn(`Transformers.js TTS engine '${preferredTtsEngine}' not ready for intro phrase.`);
          playedIntroForPersonalityRef.current = null;
        }
      }
    };
    const timerId = setTimeout(playIntroPhrase, profile.introVideo ? 1000 : 200);
    return () => clearTimeout(timerId);
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
    if (synthRef.current && synthRef.current.onvoiceschanged !== undefined) {
      synthRef.current.onvoiceschanged = null;
    }
  };
}, [selectedVoiceURI]);

const handleWebSpeechSpeak = () => {
  if (!webSpeechText.trim()) {
      alert("Please enter text in the 'Browser Built-in TTS' textarea.");
      return;
  }
  speakWithWebSpeechAPI(webSpeechText);
};
  
useEffect(() => {
setupSpeechRecognition();
}, [setupSpeechRecognition]);
  
useEffect(() => {
if (generator && ttsPipelineInstance && promptTextareaRef.current) {
promptTextareaRef.current.focus();
}
}, [generator, ttsPipelineInstance]);

useEffect(() => {
  if (prompt.trim() && sttJustFinishedRef.current && !isGenerating && !isSpeaking) {
    console.log("STT provided new prompt, automatically triggering text generation:", prompt);
    handleGenerateText(); 
    sttJustFinishedRef.current = false;
  }
}, [prompt, isGenerating, isSpeaking, handleGenerateText]);
  
useLayoutEffect(() => {
    console.log('Forcing remote settings and disabling cache for loading.');
    env.localFilesOnly = false;
    env.allowLocalModels = false;
    env.useBrowserCache = false; 
    env.remoteHost = 'https://huggingface.co';
    env.remotePathTemplate = '{model}/resolve/main/';
    env.wasm.numThreads = 16;
setStatusMessage('Loading models, please wait...');

async function loadModel() {
      try {
        const pipelineInstance = await pipeline('text2text-generation', 'Xenova/LaMini-Flan-T5-783M', {
          progress_callback: (progress) => {
            const percentage = progress.total > 0 ? (progress.loaded / progress.total * 100).toFixed(2) : 'N/A';
            const message = `Loading: ${progress.file} - ${progress.status} (${percentage}%)`;
            console.log(message);
            setStatusMessage(message);
          }
        });
        console.log("Pipeline loaded successfully.");
        setStatusMessage("Model loaded! Ready to generate.");
        setGenerator(() => pipelineInstance);
      } catch (error) {
        console.error("Failed to load pipeline:", error);
        setStatusMessage(`Error loading model: ${error.message}`);
      }
      try {
        setStatusMessage(prev => `${prev} Loading TTS model (SpeechT5)...`);
        const ttsPipe = await pipeline('text-to-speech', 'Xenova/speecht5_tts', {
          progress_callback: (progress) => {
            const percentage = progress.total > 0 ? (progress.loaded / progress.total * 100).toFixed(2) : 'N/A';
            const message = `Loading TTS: ${progress.file} (${percentage}%)`;
            setStatusMessage(message);
          },
        });
        setTtsPipelineInstance(() => ttsPipe);
        setStatusMessage(prev => `${prev} TTS model loaded.`);
        console.log("TTS pipeline (SpeechT5 + Vocoder) loaded successfully.");
        setStatusMessage(prev => `${prev} Loading speaker embeddings...`);
        const speaker_embeddings_url = 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/speaker_embeddings.bin';
        const response = await fetch(speaker_embeddings_url);
        if (!response.ok) {
          throw new Error(`Failed to fetch speaker embeddings: ${response.statusText}`);
        }
        const speakerEmb = new Float32Array(await response.arrayBuffer());
        const reshapedSpeakerEmb = new Tensor('float32', speakerEmb, [1, 512]);
        setSpeakerEmbeddings(reshapedSpeakerEmb);
        setStatusMessage("All models loaded! Ready.");
        console.log("Speaker embeddings loaded successfully.");
      } catch (error) {
        console.error("Failed to load TTS pipeline or speaker embeddings:", error);
        setStatusMessage(prev => `${prev} TTS Error: ${error.message}.`);
      }
      
    // REMOVED: Logic for loading the Bark TTS model.
    // try { ... } catch (error) { ... }

    // NEW: Logic for loading the Kokoro TTS model.
    try {
        setStatusMessage(prev => `${prev} Loading TTS model (Kokoro)...`);
        
        // This single line downloads and initializes the Kokoro TTS model.
        const kokoroInstance = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX');
        
        setKokoroTtsInstance(() => kokoroInstance);
        console.log("Kokoro TTS pipeline loaded successfully.");

        // Update the overall status message after all models are loaded.
        if (generator && ttsPipelineInstance && speakerEmbeddings && kokoroInstance) {
            setStatusMessage("All models loaded! Ready.");
        } else {
            setStatusMessage(prev => `${prev} Kokoro TTS loaded.`);
        }
    } catch (error) {
        console.error("Failed to load Kokoro TTS pipeline:", error);
        setStatusMessage(prev => `${prev} Kokoro TTS Error: ${error.message}.`);
    }
}

const imageChannel = new BroadcastChannel('imageChannel');
const fileInput = document.getElementById('fileInput');
fileInput.addEventListener('change', (event) => {
let file = event.target.files[0];
if (file) {
const reader = new FileReader();
reader.onload = (e) => {
const imageDataURL = e.target.result;
window.open('./depth.1ink');
setTimeout(function(){
imageChannel.postMessage({ imageDataURL });
},4500);     };
reader.readAsDataURL(file);
}
});

const xhrPath = document.querySelector('#loadPath').innerHTML;
const xhr = new XMLHttpRequest();
xhr.open('GET', xhrPath, true);
xhr.responseType = 'arraybuffer';
console.log('got react run');
function decodeUTF32(uint8Array, isLittleEndian = true) {
const dataView = new DataView(uint8Array.buffer);
let result = "";
for (let i = 0; i < uint8Array.length; i += 4) {
let codePoint;
if (isLittleEndian) {
codePoint = dataView.getUint32(i, true);
} else {
codePoint = dataView.getUint32(i, false);
}
result += String.fromCodePoint(codePoint);
}
return result;
}
xhr.onload = function() {
console.log('got load loader');
if (xhr.status === 200) {
const utf32Data = xhr.response;
const jsCode = decodeUTF32(new Uint8Array(utf32Data), true);
const scr = document.createElement('script');
scr.type = 'module';
scr.text = jsCode;
document.body.appendChild(scr);
var Module = {};
setTimeout(function(){
Module = libload();
Module.onRuntimeInitialized = function(){
console.log('call main loader');
Module.callMain();
};
},2500);
}
};
xhr.send();
loadModel();
}, []);

return (
<>
{/* ... Your existing JSX structure ... */}
<div style={{ /* ... your container styles ... */ }}>
    {/* ... other UI elements ... */}

    <div style={{ position:'absolute',zIndex:4000,padding: '10px 0', borderBottom: '1px solid #ddd', marginBottom: '15px' }}>
      <h4>Active Text-to-Speech Engine:</h4>
      <select
        value={activeTtsEngine}
        onChange={(e) => setActiveTtsEngine(e.target.value)}
        style={{ position:'absolute',zIndex:4000,padding: '8px', width: '100%', boxSizing: 'border-box' }}
      >
        <option value="webSpeechAPI">Browser Built-in</option>
        <option value="speechT5" disabled={!ttsPipelineInstance || !speakerEmbeddings}>
          SpeechT5 (Transformers.js)
        </option>
        {/* MODIFIED: Replaced the 'Bark' option with 'Kokoro' */}
        <option value="kokoro" disabled={!kokoroTtsInstance}>
          Kokoro (ONNX Community)
        </option>
      </select>
    </div>

    {/* ... rest of your JSX ... */}
</div>
{/* ... The rest of your extensive JSX structure remains the same ... */}
</>
);
}

export default App;
