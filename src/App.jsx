import { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { pipeline, env, Tensor } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.6.0";
import Box from '@mui/material/Box';
import Slider from '@mui/material/Slider';
import './App.css';
import { KokoroTTS } from 'kokoro-js';

const personalityProfiles = {
  default: {
    displayName: "Default Assistant",
    systemPrompt: "",
    avatar: "/avatars/default.png",
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
    introVideo: "/intros/captain_playful.mp4",
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
  const [ttsPipeline, setTtsPipeline] = useState(null); // This state is unused, consider removing if not needed elsewhere.
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
  const [finalSttTranscript, setFinalSttTranscript] = useState(null); // Unused, consider removing
  const [webSpeechApiDedicatedInput, setWebSpeechApiDedicatedInput] = useState("Hello from browser TTS!");
  const [currentPersonalityKey, setCurrentPersonalityKey] = useState('default');
  const [currentProfile, setCurrentProfile] = useState(personalityProfiles.default); // Store the whole profile

  const [activeTtsEngine, setActiveTtsEngine] = useState('kokoro'); // Default: 'webSpeechAPI', 'speechT5', 'kokoro'

  // NEW: State to hold the loaded Kokoro TTS model instance.
  const [kokoroTtsInstance, setKokoroTtsInstance] = useState(null);

  // NEW: State for Image Captioning
  const [imageCaptioner, setImageCaptioner] = useState(null);
  const [imageToCaption, setImageToCaption] = useState(null); // Will store URL or File object
  const [generatedCaption, setGeneratedCaption] = useState('');
  const [isCaptioning, setIsCaptioning] = useState(false);

  // NEW: State to manage the sequence of inputs
  const [sequence, setSequence] = useState([]);
  const [isPredicting, setIsPredicting] = useState(false);

  const promptTextareaRef = useRef(null); // Ref for the prompt textarea
  const audioContextRef = useRef(null); // For playing audio
  const recognitionRef = useRef(null); // To hold the SpeechRecognition instance
  const synthRef = useRef(null);
  const sttJustFinishedRef = useRef(false);
  const playedIntroForPersonalityRef = useRef(null);
  const sequenceOutputRef = useRef(null); // Ref for the sequence output display

  // ... (rest of your existing functions like speakWithWebSpeechAPI, initializeAudioContext, playAudio, etc.)
  // Ensure these functions correctly handle state updates and potential errors.
  // For simplicity, I'll only paste the relevant new/modified parts and assume the rest is as in your original code.
  // Please integrate the modified parts into your existing functions.

  const speakWithWebSpeechAPI = useCallback((textToSay) => {
    if (!synthRef.current || !textToSay || !textToSay.trim()) {
      console.warn("Web Speech API synth or text not ready.");
      return;
    }
    if (synthRef.current.speaking) {
      synthRef.current.cancel();
    }
    const utterance = new SpeechSynthesisUtterance(textToSay);
    const selectedVoice = availableVoices.find(voice => voice.voiceURI === selectedVoiceURI);
    if (selectedVoice) utterance.voice = selectedVoice;
    else if (availableVoices.length > 0) utterance.voice = availableVoices[0]; // Fallback
    utterance.onstart = () => { setIsWebSpeaking(true); setStatusMessage("Speaking (Web Speech API)..."); };
    utterance.onend = () => { setIsWebSpeaking(false); setStatusMessage("Web Speech API finished."); };
    utterance.onerror = (event) => {
      console.error('Web Speech API error:', event.error);
      setStatusMessage(`Web Speech API Error: ${event.error}`);
      setIsWebSpeaking(false);
    };
    synthRef.current.speak(utterance);
  }, [synthRef, availableVoices, selectedVoiceURI, setIsWebSpeaking, setStatusMessage]);

  const speakWithWebAPI = useCallback((textToSay) => {
    if (!synthRef.current || !textToSay || !textToSay.trim()) {
      console.warn("Web Speech API synth or text not ready.");
      return;
    }
    if (synthRef.current.speaking) {
      synthRef.current.cancel();
    }
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
      if (typeof profile.webSpeechApiParams.pitch === 'number') utterance.pitch = profile.webSpeechApiParams.pitch;
      if (typeof profile.webSpeechApiParams.rate === 'number') utterance.rate = profile.webSpeechApiParams.rate;
      if (typeof profile.webSpeechApiParams.volume === 'number') utterance.volume = profile.webSpeechApiParams.volume;
    }
    utterance.onstart = () => { setIsSpeaking(true); setStatusMessage("Speaking (Browser)..."); };
    utterance.onend = () => { setIsSpeaking(false); setStatusMessage("Browser speech finished."); };
    utterance.onerror = (event) => {
      console.error('Web Speech API error:', event.error);
      setStatusMessage(`Web Speech API Error: ${event.error}`);
      setIsSpeaking(false);
    };
    synthRef.current.speak(utterance);
  }, [availableVoices, selectedVoiceURI, currentPersonalityKey, synthRef, setIsSpeaking, setStatusMessage]);

  const initializeAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      console.log("AudioContext created. Initial state:", audioContextRef.current.state);
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().catch(err => {
        console.warn("Initial attempt to resume AudioContext failed. Will try again before playing.", err);
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
      audioCtx.resume().catch(e => console.error("Resume in playAudio failed:", e));
    }
    const buffer = audioCtx.createBuffer(1, audioArray.length, samplingRate);
    buffer.copyToChannel(audioArray, 0);
    const sourceNode = audioCtx.createBufferSource();
    sourceNode.buffer = buffer;
    let currentNode = sourceNode;
    const profile = personalityProfiles[currentPersonalityKey] || personalityProfiles.default;
    const effects = profile.transformersAudioEffects; // Assuming this might be used for SpeechT5
    if (effects) {
      if (typeof effects.playbackRate === 'number') sourceNode.playbackRate.value = effects.playbackRate;
      if (effects.filter && effects.filter.type) {
        const filterNode = audioCtx.createBiquadFilter();
        filterNode.type = effects.filter.type;
        if (typeof effects.filter.frequency === 'number') filterNode.frequency.setValueAtTime(effects.filter.frequency, audioCtx.currentTime);
        if (typeof effects.filter.Q === 'number') filterNode.Q.setValueAtTime(effects.filter.Q, audioCtx.currentTime);
        if (typeof effects.filter.gain === 'number') filterNode.gain.setValueAtTime(effects.filter.gain, audioCtx.currentTime);
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
        console.warn("Reverb effect with ConvolverNode requires preloading or async handling of impulse responses. Not fully implemented.");
      }
    }
    currentNode.connect(audioCtx.destination);
    sourceNode.start();
    // Update speaking state only after the audio has been scheduled to play
    sourceNode.onended = () => {
      setIsSpeaking(false);
      setStatusMessage("Speech synthesis finished.");
    };
    setIsSpeaking(true); // Set speaking state when starting playback
    setStatusMessage("Playing synthesized speech...");
  }, [initializeAudioContext, currentPersonalityKey, setIsSpeaking, setStatusMessage]);

  const synthesizeAndPlayText = useCallback(async (text) => {
    if (!ttsPipelineInstance || !speakerEmbeddings) {
      setStatusMessage("SpeechT5 TTS model or speaker embeddings not loaded yet.");
      return false;
    }
    if (!text || !text.trim()) {
      setStatusMessage("No text provided to synthesize.");
      return false;
    }
    const audioCtx = initializeAudioContext();
    if (!audioCtx) { alert("Could not initialize audio player."); setIsSpeaking(false); return false; }
    if (audioCtx.state === 'suspended') {
      try { await audioCtx.resume(); }
      catch (resumeError) { console.error("Failed to resume audio context for TTS:", resumeError); setStatusMessage("TTS Error: Could not resume audio. Please interact with the page."); setIsSpeaking(false); return false; }
    }
    if (audioCtx.state !== 'running') { console.warn(`AudioContext not running (state: ${audioCtx.state}). TTS may fail.`); setStatusMessage("TTS Error: AudioContext not active. Please interact."); setIsSpeaking(false); return false; }

    setIsSpeaking(true);
    setStatusMessage(`Synthesizing (SpeechT5): "${text.substring(0, 30)}..."`);
    try {
      const output = await ttsPipelineInstance(text.trim(), { speaker_embeddings: speakerEmbeddings });
      console.log("Transformers.js TTS Output:", output);
      const modelSamplingRate = output.sampling_rate;
      if (output.audio && typeof modelSamplingRate === 'number' && modelSamplingRate > 0) {
        console.log(`Playing audio with sampling rate: ${modelSamplingRate}`);
        playAudio(output.audio, modelSamplingRate);
        // Note: onended handler in playAudio will set setIsSpeaking(false)
      } else {
        console.error("TTS pipeline output missing valid audio or sampling_rate. Output was:", output);
        throw new Error("TTS pipeline did not return valid audio data or sampling rate.");
      }
      return true;
    } catch (error) {
      console.error("Error during Transformers.js speech synthesis:", error);
      setStatusMessage(`Transformers.js TTS Error: ${error.message}`);
      setIsSpeaking(false);
      return false;
    }
  }, [ttsPipelineInstance, speakerEmbeddings, initializeAudioContext, playAudio, setStatusMessage, setIsSpeaking]);

  // NEW: Synthesis function for the Kokoro TTS model.
  const synthesizeWithKokoroAndPlay = useCallback(async (text) => {
    if (!kokoroTtsInstance) {
      setStatusMessage("Kokoro TTS model not loaded yet.");
      return false;
    }
    if (!text || !text.trim()) {
      setStatusMessage("No text provided for Kokoro to synthesize.");
      return false;
    }

    const audioCtx = initializeAudioContext();
    if (!audioCtx) { alert("Could not initialize audio player."); setIsSpeaking(false); return false; }
    if (audioCtx.state === 'suspended') {
      try { await audioCtx.resume(); }
      catch (resumeError) { console.error("Failed to resume audio context for Kokoro TTS:", resumeError); setStatusMessage("Kokoro TTS Error: Could not resume audio. Please interact."); setIsSpeaking(false); return false; }
    }
    if (audioCtx.state !== 'running') { console.warn(`AudioContext not running (state: ${audioCtx.state}). Kokoro TTS may fail.`); setStatusMessage("Kokoro TTS Error: AudioContext not active. Please interact."); setIsSpeaking(false); return false; }

    setIsSpeaking(true);
    setStatusMessage(`Synthesizing with Kokoro: "${text.substring(0, 30)}..."`);

    try {
      const output = await kokoroTtsInstance.generate(text.trim(), { voice: "af_nova" }); // Example voice, adjust as needed
      const kokoroAudioOutput = output;

      let audioData = kokoroAudioOutput.audio;
      let sampleRate = kokoroAudioOutput.sampling_rate;

      if (audioData === undefined) {
        console.error("Audio data not found on Kokoro output object using key 'audio'. Available keys:", Object.keys(kokoroAudioOutput));
        throw new Error("Audio data property 'audio' not found on Kokoro output.");
      }
      if (sampleRate === undefined) {
        console.error("Sample rate not found on Kokoro output object using key 'sampling_rate'. Available keys:", Object.keys(kokoroAudioOutput));
        throw new Error("Sample rate property 'sampling_rate' not found on Kokoro output.");
      }

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
          console.error("Kokoro TTS audio data is not Float32Array and could not be converted. Type was:", Object.prototype.toString.call(rawData));
          throw new Error("Unsupported audio data type from Kokoro TTS after attempting extraction.");
        }
      }

      if (audioData && typeof sampleRate === 'number' && sampleRate > 0) {
        playAudio(audioData, sampleRate);
        setStatusMessage("Speech synthesized and playing (Kokoro).");
        // Note: onended handler in playAudio will set setIsSpeaking(false)
      } else {
        throw new Error("Kokoro TTS did not return valid audio data or sample rate after processing.");
      }
      return true;
    } catch (error) {
      console.error("Error during Kokoro speech synthesis:", error);
      setStatusMessage(`Kokoro TTS Error: ${error.message}`);
      setIsSpeaking(false);
      return false;
    }
  }, [kokoroTtsInstance, initializeAudioContext, playAudio, setStatusMessage, setIsSpeaking]);

  const setupSpeechRecognition = useCallback(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      setSttError("Your browser doesn't support Speech Recognition. Try Chrome or Edge.");
      setStatusMessage(prev => `$ Speech Recognition not supported.`);
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
      setPrompt(transcript); // Set the prompt for general text generation
      // NEW: If we want to add this directly to the sequence:
      addToSequence({ type: 'text', content: transcript, timestamp: new Date().toISOString() });
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
  }, [setPrompt, setStatusMessage, setSttError, setIsListening, addToSequence]); // Added addToSequence dependency

  const toggleListen = () => {
    if (!recognitionRef.current) {
      setSttError("Speech recognition not initialized.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        setPrompt(''); // Clear previous prompt if starting new listening
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

  // Function to add an item to the sequence
  const addToSequence = useCallback((item) => {
    setSequence(prevSequence => [...prevSequence, item]);
  }, []);


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
        const fullPromptForLLM = systemInstruction ? `${systemInstruction}\nUser: ${textToProcess}\nAssistant:` : `${textToProcess}\n`;
        console.log("Sending to LLM:", fullPromptForLLM);
        const outputs = await generator(fullPromptForLLM, {
          max_new_tokens: 128,
          min_new_tokens: 32,
        });
        if (outputs && outputs.length > 0 && outputs[0].generated_text) {
          newLLMText = outputs[0].generated_text.trim();
          setGeneratedOutput(newLLMText);
        } else {
          newLLMText = "No text was generated or output format was unexpected.";
          setGeneratedOutput(newLLMText);
          setStatusMessage("Text generation failed to produce output.");
          if (!isRespeaking) setIsGenerating(false);
          return;
        }
      } else {
        newLLMText = textToProcess; // If re-speaking, use the existing output
      }

      setStatusMessage("Text processing complete. Auto-speaking...");

      // Speak the generated text based on the preferred engine
      if (preferredTtsEngine === 'webSpeechAPI') {
        setWebSpeechApiDedicatedInput(newLLMText); // Update dedicated input too
        speakWithWebAPI(newLLMText);
      } else if (preferredTtsEngine === 'speechT5') {
        setTextToSpeakInput(newLLMText);
        await synthesizeAndPlayText(newLLMText);
      } else if (preferredTtsEngine === 'kokoro') {
        setTextToSpeakInput(newLLMText);
        await synthesizeWithKokoroAndPlay(newLLMText);
      }

      // NEW: Add the generated text to the sequence
      if (!isRespeaking) { // Only add if it's a new generation, not a re-speak for TTS
        addToSequence({ type: 'text', content: newLLMText, timestamp: new Date().toISOString() });
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
    generator, prompt, generatedOutput, currentProfile, preferredTtsEngine,
    speakWithWebAPI, synthesizeAndPlayText, synthesizeWithKokoroAndPlay,
    setIsGenerating, setGeneratedOutput, setStatusMessage, setTextToSpeakInput,
    setWebSpeechApiDedicatedInput, addToSequence // Added addToSequence
  ]);

  const handleWebSpeechSpeakButton = () => {
    speakWithWebSpeechAPI(webSpeechApiDedicatedInput); // Use the dedicated input state
  };

  const handleSynthesizeSpeech = async () => {
    if (!textToSpeakInput.trim()) {
      alert("Please enter text in the TTS input area to synthesize.");
      return;
    }
    await synthesizeAndPlayText(textToSpeakInput);
  };

  // Effect to handle personality changes (keep existing logic)
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
            speakWithWebSpeechAPI(profile.introPhrase); // Use the correct function name
          } else {
            console.warn("Web Speech API (synthRef) not ready for intro phrase.");
            playedIntroForPersonalityRef.current = null;
          }
        } else if (preferredTtsEngine === 'speechT5') {
          if (ttsPipelineInstance && speakerEmbeddings) {
            await synthesizeAndPlayText(profile.introPhrase);
          } else {
            console.warn(`SpeechT5 TTS engine not ready for intro phrase.`);
            playedIntroForPersonalityRef.current = null;
          }
        } else if (preferredTtsEngine === 'kokoro') {
          if (kokoroTtsInstance) {
            await synthesizeWithKokoroAndPlay(profile.introPhrase);
          } else {
            console.warn(`Kokoro TTS engine not ready for intro phrase.`);
            playedIntroForPersonalityRef.current = null;
          }
        }
      };
      const timerId = setTimeout(playIntroPhrase, profile.introVideo ? 1000 : 200);
      return () => clearTimeout(timerId);
    }
  }, [currentPersonalityKey, preferredTtsEngine, speakWithWebSpeechAPI, synthesizeAndPlayText, synthesizeWithKokoroAndPlay, ttsPipelineInstance, speakerEmbeddings, kokoroTtsInstance, isSpeaking, synthRef]);


  // NEW: Handler for image captioning
  const handleImageCaptioning = useCallback(async () => {
    if (!imageCaptioner || !imageToCaption) {
      setStatusMessage("Image captioner not ready or no image selected.");
      return;
    }

    setIsCaptioning(true);
    setGeneratedCaption("Generating caption...");
    setStatusMessage("Captioning image...");

    try {
      const imageSrc = typeof imageToCaption === 'string' ? imageToCaption : URL.createObjectURL(imageToCaption);

      const captions = await imageCaptioner(imageSrc, {
        max_new_tokens: 128,
      });

      if (captions && captions.length > 0 && captions[0].generated_text) {
        const captionText = captions[0].generated_text.trim();
        setGeneratedCaption(captionText);
        setStatusMessage("Image caption generated successfully.");

        // NEW: Add the generated caption to the sequence
        addToSequence({ type: 'caption', content: captionText, timestamp: new Date().toISOString() });

      } else {
        setGeneratedCaption("No caption generated or unexpected output format.");
        setStatusMessage("Caption generation failed to produce output.");
      }
    } catch (error) {
      console.error("Error during image captioning:", error);
      setGeneratedCaption(`Error: ${error.message}`);
      setStatusMessage(`Image Captioning Error: ${error.message}`);
    } finally {
      setIsCaptioning(false);
    }
  }, [imageCaptioner, imageToCaption, setStatusMessage, setGeneratedCaption, setIsCaptioning, addToSequence]); // Added addToSequence

  const handleImageSelection = (event) => {
    const file = event.target.files[0];
    if (file) {
      setImageToCaption(file);
      setGeneratedCaption(''); // Clear previous caption
    } else {
      setImageToCaption(null);
    }
  };

  // Effect to populate voices for Web Speech API
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
  }, [selectedVoiceURI]); // Dependency on selectedVoiceURI to potentially re-run if it changes

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

  // Effect to automatically trigger text generation after STT
  useEffect(() => {
    if (prompt.trim() && sttJustFinishedRef.current && !isGenerating && !isSpeaking) {
      console.log("STT provided new prompt, automatically triggering text generation:", prompt);
      handleGenerateText();
      sttJustFinishedRef.current = false;
    }
  }, [prompt, isGenerating, isSpeaking, handleGenerateText]);

  // Main model loading effect
  useLayoutEffect(() => {
    console.log('Forcing remote settings and disabling cache for loading.');
    env.localFilesOnly = false;
    env.allowLocalModels = false;
    env.useBrowserCache = true;
    env.remoteHost = 'https://huggingface.co';
    env.remotePathTemplate = '/resolve/main/';

    setStatusMessage('Loading models, please wait...');

    async function loadModels() {
      try {
        // Text Generation Model (LaMini-Flan-T5-783M)
        const textGenPipeline = await pipeline('text2text-generation', 'Xenova/LaMini-Flan-T5-783M', {
          progress_callback: (progress) => {
            const message = `Loading TextGen: ${progress.file} (${progress.status} ${progress.progress !== undefined ? progress.progress.toFixed(2) + '%' : ''})`;
            console.log(message);
            setStatusMessage(message);
          },
        }, { device: "webnn" });
        setGenerator(() => textGenPipeline);
        console.log("Text Generation pipeline loaded successfully.");
      } catch (error) {
        console.error("Failed to load text generation pipeline:", error);
        setStatusMessage(`Error loading TextGen: ${error.message}`);
      }

      try {
        // SpeechT5 TTS Model
        setStatusMessage(prev => `Loading TTS (SpeechT5)...`);
        const ttsPipe = await pipeline('text-to-speech', 'Xenova/speecht5_tts', {
          progress_callback: (progress) => {
            const message = `Loading SpeechT5 TTS: ${progress.file} (${progress.status} ${progress.progress !== undefined ? progress.progress.toFixed(2) + '%' : ''})`;
            console.log(message);
            setStatusMessage(message);
          },
        }, { device: "webnn" });
        setTtsPipelineInstance(() => ttsPipe);
        console.log("SpeechT5 TTS pipeline loaded successfully.");

        setStatusMessage(prev => `Loading Speaker Embeddings...`);
        const speaker_embeddings_url = 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/speaker_embeddings.bin';
        const response = await fetch(speaker_embeddings_url);
        if (!response.ok) throw new Error(`Failed to fetch speaker embeddings: ${response.statusText}`);
        const speakerEmb = new Float32Array(await response.arrayBuffer());
        const reshapedSpeakerEmb = new Tensor('float32', speakerEmb, [1, 512]);
        setSpeakerEmbeddings(reshapedSpeakerEmb);
        console.log("Speaker embeddings loaded successfully.");
      } catch (error) {
        console.error("Failed to load SpeechT5 TTS pipeline or speaker embeddings:", error);
        setStatusMessage(prev => `SpeechT5 TTS Error: ${error.message}.`);
      }

      try {
        // Kokoro TTS Model
        setStatusMessage(prev => `Loading TTS (Kokoro)...`);
        const kokoroInstance = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: "fp32", device: "webgpu", });
        setKokoroTtsInstance(() => kokoroInstance);
        console.log("Kokoro TTS pipeline loaded successfully.");
      } catch (error) {
        console.error("Failed to load Kokoro TTS pipeline:", error);
        setStatusMessage(prev => `Kokoro TTS Error: ${error.message}.`);
      }

      try {
        // Image Captioning Model
        setStatusMessage(prev => `Loading Image Captioning...`);
        const captionerInstance = await pipeline('image-to-text', 'Xenova/vit-gpt2-image-captioning', {
          progress_callback: (progress) => {
            const message = `Loading Captioner: ${progress.file} (${progress.status} ${progress.progress !== undefined ? progress.progress.toFixed(2) + '%' : ''})`;
            console.log(message);
            setStatusMessage(message);
          },
        }, { device: "webnn" });
        setImageCaptioner(() => captionerInstance);
        console.log("Image Captioning model loaded successfully.");
      } catch (error) {
        console.error("Failed to load Image Captioning model:", error);
        setStatusMessage(prev => `Image Captioning Error: ${error.message}.`);
      } finally {
        // Attempt to hide splash screens and enable interaction once *some* models are ready
        // A more robust approach would be to track readiness of all essential models
        document.querySelector('#splash2').style.display = 'none';
        setTimeout(function() {
          document.querySelector('#splash1').style.display = 'none';
          document.querySelector('#contain1').style.pointerEvents = 'auto';
          setStatusMessage("Models loaded! Ready for interaction.");
        }, 1500);
      }
    }

    // Script loading part (keep as is)
    const xhrPath = document.querySelector('#loadPath').innerHTML;
    const xhr = new XMLHttpRequest();
    xhr.open('GET', xhrPath, true);
    xhr.responseType = 'arraybuffer';
    console.log('Preparing to load external script...');
    function decodeUTF32(uint8Array, isLittleEndian = true) {
      const dataView = new DataView(uint8Array.buffer);
      let result = "";
      for (let i = 0; i < uint8Array.length; i += 4) {
        let codePoint;
        if (isLittleEndian) codePoint = dataView.getUint32(i, true);
        else codePoint = dataView.getUint32(i, false);
        result += String.fromCodePoint(codePoint);
      }
      return result;
    }
    xhr.onload = function() {
      console.log('External script loaded. Executing...');
      if (xhr.status === 200) {
        const utf32Data = xhr.response;
        const jsCode = decodeUTF32(new Uint8Array(utf32Data), true);
        const scr = document.createElement('script');
        scr.type = 'module';
        scr.text = jsCode;
        document.body.appendChild(scr);
        var Module = {};
        setTimeout(function() {
          Module = libload();
          Module.onRuntimeInitialized = function() {
            console.log('Runtime initialized. Calling main loader.');
            Module.callMain();
          };
        }, 2500);
      } else {
        console.error("Failed to load external script:", xhr.statusText);
      }
    };
    xhr.onerror = function() { console.error("Network error while loading external script."); };
    xhr.send();

    loadModels();
  }, []);

  // NEW: Function to predict the next event from the sequence
  const predictNextEvent = useCallback(async () => {
    if (!generator || sequence.length === 0) {
      setStatusMessage("LLM model not loaded or sequence is empty.");
      return;
    }

    setIsPredicting(true);
    setStatusMessage("Predicting next event based on sequence...");

    // Construct the prompt from the sequence
    let sequencePrompt = "Here is a sequence of events:\n";
    sequence.forEach((item, index) => {
      sequencePrompt += `${index + 1}. `;
      if (item.type === 'text') {
        sequencePrompt += `Text: "${item.content}"`;
      } else if (item.type === 'caption') {
        sequencePrompt += `Image Caption: "${item.content}"`;
      }
      sequencePrompt += ` (at ${new Date(item.timestamp).toLocaleTimeString()})\n`;
    });

    // Add a prompt for the LLM to predict the next step
    const predictionPrompt = sequencePrompt + "\nWhat is the most likely next event or observation in this sequence? Predict the next item.";
    console.log("Sending to LLM for prediction:", predictionPrompt);

    try {
      const outputs = await generator(predictionPrompt, {
        max_new_tokens: 100, // Adjust as needed
        // You might want to use a more specific prompt or fine-tune for sequence prediction
      });

      if (outputs && outputs.length > 0 && outputs[0].generated_text) {
        const predictedEvent = outputs[0].generated_text.trim();
        setGeneratedOutput(predictedEvent); // Display prediction in the main output
        setStatusMessage("Prediction successful!");

        // NEW: Add the predicted event to the sequence as well
        addToSequence({ type: 'prediction', content: predictedEvent, timestamp: new Date().toISOString() });

      } else {
        setGeneratedOutput("Could not predict the next event. Unexpected output format.");
        setStatusMessage("Prediction failed to produce output.");
      }
    } catch (error) {
      console.error("Error during sequence prediction:", error);
      setGeneratedOutput(`Error during prediction: ${error.message}`);
      setStatusMessage(`Prediction Error: ${error.message}`);
    } finally {
      setIsPredicting(false);
    }
  }, [generator, sequence, setGeneratedOutput, setStatusMessage, addToSequence]); // Added addToSequence

  // Effect to update the sequence display (scroll to bottom)
  useEffect(() => {
    if (sequenceOutputRef.current) {
      sequenceOutputRef.current.scrollTop = sequenceOutputRef.current.scrollHeight;
    }
  }, [sequence]); // Re-run whenever sequence state changes


  return (
    <>
      <link charset={"utf-8"} crossorigin rel='stylesheet' href='https://css.1ink.us/predictor.1iss'/>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Audiowide"/>
      <img id={'splash1'} src={'./image/shroud.jpg'} style={{backgroundColor:'rgba(233,233,233,0.0)',display:'block',position:'absolute',height:'100vh',width:'100vw',zIndex:3590}}></img>
      <img id={'splash2'} src={'./image/spinner.gif'} style={{backgroundColor:'rgba(47,47,47,1.0)',display:'block',top:'50%',left:'50%',transform:'translate(-50%,-50%)',position:'absolute',height:'20vh',width:'20vh',zIndex:3591}}></img>
      {/* ... (rest of your JSX for nav, panel, canvas, etc. remains the same) ... */}

      <main id={'panel'}>
        {/* ... (all your existing JSX for iframes, buttons, etc.) ... */}

        <div id={'wrap'}>
          <div id={'contain1'} style={{ pointerEvents: 'none', position: 'relative', height: '100vh', width: '100vw' }}> {/* Added relative positioning and dimensions for contained elements */}

            {/* Main Panels for Controls and Outputs */}
            <div style={{
              position: 'fixed', // Use fixed to keep panels visible while scrolling
              top: '20px',
              left: '20px',
              bottom: '20px', // Make it take available vertical space
              width: '400px', // Fixed width for panels
              maxWidth: '90vw', // Prevent it from being too wide
              marginRight: '20px', // Space between panels and canvas
              padding: '20px',
              backgroundColor: 'rgba(245, 245, 245, 0.97)',
              border: '1px solid #ccc',
              borderRadius: '10px',
              boxShadow: '0 5px 15px rgba(0,0,0,0.2)',
              zIndex: 6000,
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              maxHeight: 'calc(100vh - 40px)', // Ensure it fits within viewport
              overflowY: 'auto', // Add scroll if content overflows
              pointerEvents: 'auto', // Allow interaction with panels
            }}>

              {/* Personality and TTS Settings Section */}
              <div style={{ borderBottom: '1px solid #ddd', paddingBottom: '15px', marginBottom: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
                  {currentProfile.avatar && (
                    <img
                      src={currentProfile.avatar}
                      alt={`${currentProfile.displayName} Avatar`}
                      style={{ width: '60px', height: '60px', borderRadius: '50%', border: `3px solid ${currentProfile.themeColors['--ai-primary-color'] || '#ccc'}` }}
                    />
                  )}
                  <div>
                    <h2 style={{ margin: 0, color: currentProfile.themeColors['--ai-primary-color'] || '#333' }}>
                      {currentProfile.displayName}
                    </h2>
                  </div>
                </div>

                <h4>Select AI Personality:</h4>
                <select
                  id="personality-select"
                  value={currentPersonalityKey}
                  onChange={(e) => setCurrentPersonalityKey(e.target.value)}
                  style={{ padding: '8px', width: '100%', boxSizing: 'border-box' }}
                >
                  {Object.keys(personalityProfiles).map(key => (
                    <option key={key} value={key}>
                      {personalityProfiles[key].displayName}
                    </option>
                  ))}
                </select>

                <h4 style={{ marginTop: '15px' }}>Active Text-to-Speech Engine:</h4>
                <select
                  value={activeTtsEngine}
                  onChange={(e) => setActiveTtsEngine(e.target.value)}
                  style={{ padding: '8px', width: '100%', boxSizing: 'border-box' }}
                >
                  <option value="webSpeechAPI">Browser Built-in</option>
                  <option value="speechT5" disabled={!ttsPipelineInstance || !speakerEmbeddings}>
                    SpeechT5 (Transformers.js)
                  </option>
                  <option value="kokoro" disabled={!kokoroTtsInstance}>
                    Kokoro (ONNX Community)
                  </option>
                </select>

                <h4 style={{ marginTop: '15px' }}>Auto-Speak Engine after LLM Generation:</h4>
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
                    disabled={!ttsPipelineInstance || !speakerEmbeddings}
                  /> Transformers.js (SpeechT5)
                </label>
              </div>

              {/* Text Generation Section */}
              <div style={{ borderBottom: '1px solid #ddd', paddingBottom: '15px', marginBottom: '15px' }}>
                <h2>Text Generation</h2>
                <textarea
                  ref={promptTextareaRef}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Enter prompt or use Speech-to-Text..."
                  rows="4"
                  style={{ width: '100%', padding: '8px', boxSizing: 'border-box', marginBottom: '10px', resize: 'vertical' }}
                  disabled={!generator || isGenerating}
                />
                <button onClick={handleGenerateText} disabled={!generator || isGenerating} style={{ padding: '10px 15px', width: '100%', cursor: (!generator || isGenerating) ? 'not-allowed' : 'pointer' }}>
                  {isGenerating ? 'Generating...' : 'Generate Text'}
                </button>
                <div style={{ marginTop: '10px' }}>
                  <button onClick={toggleListen} disabled={!recognitionRef.current} style={{ padding: '8px 12px', cursor: (!recognitionRef.current) ? 'not-allowed' : 'pointer' }}>
                    {isListening ? 'Stop Listening' : 'Start Listening'}
                  </button>
                  {isListening && <p style={{ fontStyle: 'italic', margin: '5px 0 0' }}>Listening...</p>}
                  {sttError && <p style={{ color: 'red', margin: '5px 0 0' }}>{sttError}</p>}
                </div>
                <h3>Generated Output:</h3>
                <div style={{ minHeight: '50px', padding: '10px', border: '1px solid #eee', backgroundColor: '#f9f9f9', whiteSpace: 'pre-wrap', borderRadius: '5px' }}>
                  {generatedOutput}
                </div>
              </div>

              {/* Image Captioning Section */}
              <div style={{ borderBottom: '1px solid #ddd', paddingBottom: '15px', marginBottom: '15px' }}>
                <h2>Image Captioning</h2>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelection}
                  disabled={isCaptioning || !imageCaptioner}
                  style={{ marginBottom: '10px', display: 'block', width: '100%', padding: '8px', boxSizing: 'border-box' }}
                />
                {imageToCaption && (
                  <img
                    src={typeof imageToCaption === 'string' ? imageToCaption : URL.createObjectURL(imageToCaption)}
                    alt="Selected for captioning"
                    style={{ maxWidth: '100%', maxHeight: '200px', marginBottom: '10px', border: '1px solid #ccc', borderRadius: '5px' }}
                    onLoad={() => {
                      // Revoke object URL if it was created for preview and is no longer needed
                      // (though it's generally safe to leave it until component unmounts or is replaced)
                    }}
                  />
                )}
                <button
                  onClick={handleImageCaptioning}
                  disabled={!imageCaptioner || !imageToCaption || isCaptioning}
                  style={{ padding: '10px 15px', width: '100%', cursor: (!imageCaptioner || !imageToCaption || isCaptioning) ? 'not-allowed' : 'pointer' }}
                >
                  {isCaptioning ? 'Generating Caption...' : 'Generate Caption'}
                </button>
                <h3>Generated Caption:</h3>
                <div style={{ minHeight: '40px', padding: '10px', border: '1px solid #eee', backgroundColor: '#f9f9f9', whiteSpace: 'pre-wrap', borderRadius: '5px' }}>
                  {generatedCaption}
                </div>
              </div>

              {/* Sequence Prediction Section */}
              <div>
                <h2>Sequence Prediction</h2>
                <button
                  onClick={predictNextEvent}
                  disabled={!generator || sequence.length === 0 || isPredicting}
                  style={{ padding: '10px 15px', width: '100%', marginBottom: '15px', cursor: (!generator || sequence.length === 0 || isPredicting) ? 'not-allowed' : 'pointer' }}
                >
                  {isPredicting ? 'Predicting...' : 'Predict Next Event'}
                </button>
                <h3>Current Sequence:</h3>
                <div ref={sequenceOutputRef} style={{
                  height: '200px', // Fixed height for sequence display
                  overflowY: 'auto',
                  border: '1px solid #ddd',
                  backgroundColor: '#f0f0f0',
                  padding: '10px',
                  borderRadius: '5px',
                  whiteSpace: 'pre-wrap'
                }}>
                  {sequence.length === 0 ? "Sequence is empty. Add text or image captions." :
                    sequence.map((item, index) => (
                      <div key={index} style={{ marginBottom: '10px', paddingBottom: '5px', borderBottom: '1px dashed #eee' }}>
                        <strong>{index + 1}. {item.type === 'text' ? 'Text' : item.type === 'caption' ? 'Image Caption' : 'Prediction'}</strong> ({new Date(item.timestamp).toLocaleTimeString()}):<br />
                        <span style={{ marginLeft: '10px', fontStyle: item.type === 'prediction' ? 'italic' : 'normal' }}>
                          {item.content}
                        </span>
                      </div>
                    ))
                  }
                </div>
              </div>
            </div>

            {/* Canvas should be positioned next to or behind the panels */}
            <canvas className='emscripten' id={'scanvas'} style={{
              pointerEvents: 'auto', // Enable interaction with canvas if needed
              display: 'block',
              position: 'absolute',
              top: '0',
              left: '400px', // Position it to the right of the fixed panels
              height: '100vh',
              width: 'calc(100vw - 400px - 20px)', // Adjust width to fill remaining space, minus margin
              zIndex: 3000,
              backgroundColor: 'rgba(233,233,233,1.0)',
              imageRendering: 'auto',
              transform: 'scaleY(1.0)'
            }}></canvas>

            {/* Other elements like 'imgAnimPNG', 'mvi', 'ldv', 'track' etc. would need positioning adjustments */}
            {/* For simplicity, they are omitted here, but you'd place them correctly within the main container */}

          </div>
          {/* Other contain divs */}
          <div id={'contain2'}>
            <canvas id={'bcanvas'} hidden style={{ pointerEvents: 'none', display: 'none', zIndex: 2100, position: 'absolute', height: '100vh', width: '100vh', marginLeft: 'auto', marginRight: 'auto', backgroundColor: 'rgba(0,255,0,1.0)', top: '0', imageRendering: 'auto' }}></canvas>
            <img id={'resultImage'} src={''} alt="" ></img>
          </div>
        </div>
      </main>

      {/* Hidden elements etc. */}
      <img id={"imgAnimPNG"} src={''} alt=""></img>
      <img id={'mvi'} src={'./image/901464_400093426755894_1205176414_o.jpg'} alt=""></img>
      <div style={{ pointerEvents: 'none', height: '100vh' }}>
        <video hidden muted src={'./video-1456459792.mp4'} loop crossorigin playsinline id={'ivi'} preload={'auto'} style={{ pointerEvents: 'none', transform: 'scaleY(-1.0)' }}></video>
      </div>
      <div style={{ pointerEvents: 'none', height: '100vh' }}>
        <video hidden muted crossorigin playsinline id={'ldv'} preload={'auto'} style={{ pointerEvents: 'none' }}></video>
      </div>
      <audio crossorigin id={'track'} preload={'auto'} hidden style={{ pointerEvents: 'none' }}></audio>

      {/* Status Messages Display */}
      <div style={{
        position: 'fixed',
        bottom: '10px',
        left: '10px',
        right: '10px',
        textAlign: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        color: 'white',
        padding: '5px 10px',
        borderRadius: '5px',
        zIndex: 9999, // Very high zIndex to be on top
      }}>
        {statusMessage}
      </div>
    </>
  );
}

export default App;
