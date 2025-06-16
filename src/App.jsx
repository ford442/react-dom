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
const [preferredTtsEngine, setPreferredTtsEngine] = useState('kokoro'); // Default to 'webSpeechAPI' or 'transformersJS'
const [finalSttTranscript, setFinalSttTranscript] = useState(null);
const [webSpeechApiDedicatedInput, setWebSpeechApiDedicatedInput] = useState("Hello from browser TTS!");
const [currentPersonalityKey, setCurrentPersonalityKey] = useState('default');
const [currentProfile, setCurrentProfile] = useState(personalityProfiles.default); // Store the whole profile

// MODIFIED: Replaced 'bark' with 'kokoro'
const [activeTtsEngine, setActiveTtsEngine] = useState('kokoro'); // Default: 'webSpeechAPI', 'speechT5', 'kokoro'

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
        const output = await kokoroTtsInstance.generate(text.trim());
        
        // Store the result of generate()
        const kokoroAudioOutput = output; // Assuming 'output' is the variable holding the result of generate()

        // Log the entire object to help with debugging if property names are wrong
        console.log("Kokoro TTS output object:", kokoroAudioOutput);

        // Attempt to access audio data and sample rate using common property names
        let audioData = kokoroAudioOutput.audio; 
        let sampleRate = kokoroAudioOutput.sampling_rate;

        // Check if data and sample_rate were found
        if (audioData === undefined) {
            console.error("Audio data not found on Kokoro output object using key 'audio'. Available keys:", Object.keys(kokoroAudioOutput));
            throw new Error("Audio data property 'audio' not found on Kokoro output.");
        }
        if (sampleRate === undefined) {
            console.error("Sample rate not found on Kokoro output object using key 'sampling_rate'. Available keys:", Object.keys(kokoroAudioOutput));
            throw new Error("Sample rate property 'sampling_rate' not found on Kokoro output.");
        }

        // Proceed with conversion if necessary (similar to before)
        if (!(audioData instanceof Float32Array)) {
          console.warn("Kokoro TTS audio data was not Float32Array, attempting conversion from Int16Array.");
          const rawData = audioData instanceof ArrayBuffer ? new Int16Array(audioData) : (Array.isArray(audioData) ? Int16Array.from(audioData) : audioData);
          
          if (rawData instanceof Int16Array) {
             const float32Data = new Float32Array(rawData.length);
             for (let i = 0; i < rawData.length; i++) {
                 float32Data[i] = rawData[i] / 32768.0;
             }
             audioData = float32Data;
             console.log("Successfully converted Kokoro TTS audio data to Float32Array.");
          } else {
             console.error("Kokoro TTS audio data is not Float32Array and could not be converted from Int16Array. Type was:", Object.prototype.toString.call(rawData));
             throw new Error("Unsupported audio data type from Kokoro TTS after attempting extraction.");
          }
        }

        // Call playAudio with the (potentially converted) audioData and sampleRate
        if (audioData && typeof sampleRate === 'number' && sampleRate > 0) {
            playAudio(audioData, sampleRate, personalityKey || currentPersonalityKey);
            setStatusMessage("Speech synthesized and playing (Kokoro).");
        } else {
            throw new Error("Kokoro TTS did not return valid audio data or sample rate after property extraction and potential conversion.");
        }
    } catch (error) {
        console.error("Error during Kokoro speech synthesis:", error);
        setStatusMessage(`Kokoro TTS Error: ${error.message}`);
        setIsSpeaking(false);
        return false;
    }
    return true;
  }, [kokoroTtsInstance, initializeAudioContext, playAudio, currentPersonalityKey]);

  
  
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
    env.useBrowserCache = true; 
    env.remoteHost = 'https://huggingface.co';
    env.remotePathTemplate = '{model}/resolve/main/';
    // env.wasm.numThreads = 16;
setStatusMessage('Loading models, please wait...');

async function loadModel() {
      try {
        const pipelineInstance = await pipeline('text2text-generation', 'Xenova/LaMini-Flan-T5-783M', {
          progress_callback: (progress) => {
            const percentage = progress.total > 0 ? (progress.loaded / progress.total * 100).toFixed(2) : 'N/A';
            const message = `Loading: ${progress.file} - ${progress.status} (${percentage}%)`;
            console.log(message);
            setStatusMessage(message);
          },dtype: "q8"
  }
        );
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
        const kokoroInstance = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {dtype: "q4f16"});
        
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
<div style={{
  position: 'fixed', // Or 'absolute' if you prefer for your layout context
  bottom: '20px',
  left: '20px',
  right: '20px',    // This makes it stretch; consider a fixed width + centering instead
  // width: '600px', // Example: For a fixed width panel
  // maxWidth: '90vw', // Prevent it from being too wide on large screens
  // margin: '0 auto', // If using width and not left/right, this can help center (with left:0, right:0)
  padding: '20px',
  backgroundColor: 'rgba(245, 245, 245, 0.97)', // Light background for the panel
  border: '1px solid #ccc',
  borderRadius: '10px',
  boxShadow: '0 5px 15px rgba(0,0,0,0.2)',
  zIndex: 6000,
  display: 'flex',
  flexDirection: 'column', // Stack sections vertically
  gap: '20px',             // Space between sections
  pointerEvents: 'auto',
  maxHeight: 'calc(100vh - 40px - 40px)', // Max height considering top/bottom viewport margins
  overflowY: 'auto' // Add scroll if content exceeds maxHeight
}}>
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
        <option value="kokoro" disabled={!kokoroTtsInstance}>
          Kokoro (ONNX Community)
    </option>
    {/* You can add more options here later */}
  </select>
</div>
  <div style={{ display: 'flex', alignItems: 'center', gap: '15px', borderBottom: '1px solid #ddd', paddingBottom: '15px' }}>
  {currentProfile.avatar && (
    <img 
      src={currentProfile.avatar} 
      alt={`${currentProfile.displayName} Avatar`} 
      style={{ position:'absolute',zIndex:4000,width: '60px', height: '60px', borderRadius: '50%', border: `3px solid ${currentProfile.themeColors['--ai-primary-color'] || '#ccc'}` }} 
    />
  )}
  <div>
    <h2 style={{position:'absolute',zIndex:4000, margin: 0, color: currentProfile.themeColors['--ai-primary-color'] || '#333' }}>
      {currentProfile.displayName}
    </h2>
    {/* You can also put the select for currentPersonalityKey here if preferred */}
  </div>
</div>
{/* Selector for personality (if not already placed elsewhere) */}
<div style={{ position:'absolute',zIndex:4000,padding: '10px 0' }}>
 <h4>Select AI Personality:</h4> {/* Changed label slightly for clarity */}
  <select
    id="personality-select"
    value={currentPersonalityKey} // Use the KEY state here
    onChange={(e) => setCurrentPersonalityKey(e.target.value)} // Use the KEY setter
    style={{ padding: '8px', width: '100%', boxSizing: 'border-box', /* your zIndex if needed */ }}
  >
    {Object.keys(personalityProfiles).map(key => (
      <option key={key} value={key}>
        {personalityProfiles[key].displayName}
      </option>
    ))}
  </select>
</div>
<div style={{ position:'absolute',zIndex:4000,padding: '10px 0', borderBottom: '1px solid #ddd', marginBottom: '15px' }}>
  <h4>Auto-Speak Engine after LLM Generation:</h4>
  <label style={{ marginRight: '15px', cursor: 'pointer' }}>
    <input
      type="radio"
      name="ttsEnginePref"
      value="webSpeechAPI"
      checked={preferredTtsEngine === 'webSpeechAPI'}
      onChange={() => setPreferredTtsEngine('webSpeechAPI')}
    /> Browser Built-in
  </label>
  <label style={{ cursor: 'pointer' }}>
    <input
      type="radio"
      name="ttsEnginePref"
      value="transformersJS"
      checked={preferredTtsEngine === 'transformersJS'}
      onChange={() => setPreferredTtsEngine('transformersJS')}
      disabled={!ttsPipelineInstance || !speakerEmbeddings} // Disable if Transformers.js TTS isn't ready
    /> Transformers.js (SpeechT5)
  </label>
</div>
<h2>Text to Speech (Browser Built-in)</h2>
<textarea
    value={webSpeechApiDedicatedInput} // Use the new state here
    onChange={(e) => setWebSpeechApiDedicatedInput(e.target.value)} // Update the new state
    placeholder="Enter text for browser TTS..."
    rows={3}
    style={{ width: '100%', padding: '8px', boxSizing: 'border-box', marginBottom: '10px' }}
    disabled={isSpeaking} // Or a dedicated isWebSpeaking state
  />
<div style={{ position:'absolute',zIndex:4000,marginBottom: '10px' }}>
<label htmlFor="voice-select-webapi" style={{ position:'absolute',zIndex:4000,marginRight: '10px' }}>Voice:</label>
<select
      id="voice-select-webapi"
      value={selectedVoiceURI}
      onChange={(e) => setSelectedVoiceURI(e.target.value)}
      style={{ position:'absolute',zIndex:4000,padding: '8px', width: 'calc(100% - 70px)'}}
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
    onClick={handleWebSpeechSpeak}
    disabled={isWebSpeaking || !webSpeechText.trim() || availableVoices.length === 0}
    style={{ padding: '10px 15px', width: '100%' }}
  >
    {isWebSpeaking ? 'Speaking...' : 'Speak Text (Browser)'}
</button>
</div>
<div style={{
        position: 'absolute', // Or 'absolute' if you prefer, relative to a parent
        bottom: '20px',
        left: '20px',
        right: '20px', // Control width
        padding: '20px',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        border: '1px solid #ccc',
        borderRadius: '8px',
        boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
        zIndex: 6000, // Ensure it's above other elements
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        pointerEvents:'auto',
      }}>
<h2>Test Text Generation (LaMini-Flan-T5-783M)</h2>
<div id="outputTextGlobalStatus" style={{ fontStyle: 'italic', marginBottom: '10px' }}>
          {statusMessage} {/* Display model loading status here */}
</div>
<textarea
          ref={promptTextareaRef} // Assign the ref here
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter prompt or use Speech-to-Text..."
          rows={3}
          style={{ position: 'absolute', zIndex: 4000, width: '100%', padding: '8px', boxSizing: 'border-box', pointerEvents: 'auto' }}
          disabled={!generator || isGenerating}
/>
<button
          onClick={handleGenerateText}
          disabled={!generator || isGenerating}
          style={{ position: 'absolute', zIndex: 4000, padding: '10px 15px', pointerEvents: 'auto', cursor: (!generator || isGenerating) ? 'not-allowed' : 'pointer' }}
>
          {isGenerating ? 'Generating...' : 'Generate Text'}
</button>
        
        {/* STT Button and status from Option A */}
<div style={{ position: 'absolute', zIndex: 4000, marginTop: '10px', paddingTop:'10px', borderTop: '1px solid #eee' }}>
          <button onClick={toggleListen} disabled={!recognitionRef.current} style={{ pointerEvents: 'auto' }}> {/* Ensure toggleListen is defined */}
            {isListening ? 'Stop Listening' : 'Start Listening'}
          </button>
          {isListening && <p><i>Listening...</i></p>}
          {sttError && <p style={{ color: 'red' }}>{sttError}</p>}
</div>
<h3>Generated Output:</h3>
<div style={{
          minHeight: '50px', padding: '10px', border: '1px solid #eee',
          backgroundColor: '#f9f9f9', whiteSpace: 'pre-wrap'
}}>
          {generatedOutput}
</div>
</div>
<div style={{
        position: 'absolute', zIndex: 4000, marginTop: '20px', padding: '15px', borderTop: '1px solid #ddd',
        backgroundColor: 'rgba(230, 250, 230, 0.9)', // Light green
}}>
<h2>Text to Speech (Transformers.js - SpeechT5)</h2>
<textarea
          value={textToSpeakInput}
          onChange={(e) => setTextToSpeakInput(e.target.value)}
          placeholder="Enter text to synthesize..."
          rows={3}
          style={{ position: 'absolute', zIndex: 4000, width: '100%', padding: '8px', boxSizing: 'border-box', marginBottom: '10px', pointerEvents: 'auto' }}
          disabled={!ttsPipelineInstance || isSpeaking}
/>
<button
          onClick={handleSynthesizeSpeech}
          disabled={!ttsPipelineInstance || !speakerEmbeddings || isSpeaking || !textToSpeakInput.trim()}
          style={{ position: 'absolute', zIndex: 4000, padding: '10px 15px' }}
        >
          {isSpeaking ? 'Synthesizing...' : 'Synthesize & Play Speech'}
        </button>
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
