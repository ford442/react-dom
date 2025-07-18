import { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
// import { pipeline, env, Tensor } from '@huggingface/transformers';
import { pipeline, env, Tensor } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.6.0";
import Box from '@mui/material/Box';
import Slider from '@mui/material/Slider';
import './App.css';
import { KokoroTTS } from 'kokoro-js';
import { Gltf2, Armature, SkinMTX } from "./lib/ossos/ossos.ts";
import SkinMTXMaterial from '../../ossos/examples/threejs/_lib/SkinMTXMaterial.js';
import { UtilGltf2 } from '../../ossos/examples/threejs/_lib/UtilGltf2.js';
import Starter from '../../ossos/examples/threejs/_lib/Starter.js'; 
import Sentiment from 'sentiment';

import * as THREE from 'three';

const personalityProfiles = {
  default: {
    displayName: "Default Assistant",
    systemPrompt: "You are a helpful and expressive AI assistant having a friendly conversation.",
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
  sceneCreator: {
    displayName: "Scene Creator",
    systemPrompt: "You are a helpful assistant that expands a user's idea into a detailed scene for a text-to-image generator.",
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
 sceneCreator: { // We can repurpose your existing sceneCreator
        displayName: "Scene Creator",
        systemPrompt: "You are a screenwriter. Based on the user's topic, write a single, evocative sentence describing a setting for a conversation.",
        avatar: "/avatars/default.png", // Use a unique avatar
        introPhrase: "Give me a topic, and I'll set the stage.",
        themeColors: {
            '--ai-primary-color': '#00796B', // A professional teal
            '--ai-secondary-color': '#E0F2F1',
            '--ai-text-color': '#333333',
            '--ai-bubble-bg': '#B2DFDB',
        }
    },
    characterCreator: { // Add this new personality
        displayName: "Character Creator",
        systemPrompt: `You are a character designer for a TV show. Your job is to create one single, interesting character who can discuss a given topic in a specific setting.
You MUST reply in the following format, and nothing else:
NAME: [A unique first name for the character]
DESC: [A short personality description, starting with "You are..."]`,
        avatar: "/avatars/default.png", // Use a unique avatar
        introPhrase: "Let's create a character for your scene.",
        themeColors: {
            '--ai-primary-color': '#C2185B', // A creative magenta
            '--ai-secondary-color': '#FCE4EC',
            '--ai-text-color': '#333333',
            '--ai-bubble-bg': '#F8BBD0',
        }
    },
};



function App() {
  
const [isSelfConversationMode, setIsSelfConversationMode] = useState(false);
const [conversationHistory, setConversationHistory] = useState([]);
  
const sentimentAnalyzer = useRef(new Sentiment());

const mountRef = useRef(null); // Ref for the DOM element where the canvas will live
const appRef = useRef(null);   // Ref to hold the Three.js Starter instance
  
useEffect(() => {
        const container = mountRef.current;
        const app = new Starter({
                container: container ,
                width: container.clientHeight,
                height: container.clientHeight,
                webgl2: true,
                grid: true,
            });
        appRef.current = app;
        app.render();
        const armature_from_gltf = (gltf, defaultBoneLen = 0.07) => {
            const arm = new Armature();
            for (let j of gltf.getSkin().joints) {
                arm.addBone(j.name, j.parentIndex, j.rotation, j.position, j.scale);
            }
            arm.bind(SkinMTX, defaultBoneLen);
            return arm;
        };
  
app.setSize(container.clientHeight,container.clientHeight);
document.querySelector('canvas[data-engine="three.js r138"]').id='tvi';
document.querySelector('div[class="three-container"]').id='tti';

const setupCharacter = async () => {
            try {
                setStatusMessage("Loading avatar...");
                const gltf = await Gltf2.fetch('https://glsl.1ink.us/gltf/nabba.gltf');
                const arm = armature_from_gltf(gltf);

                      armRef.current = arm; // Store the armature in the ref

                const mat = SkinMTXMaterial('cyan', arm.getSkinOffsets()[0]);
                const mesh = UtilGltf2.loadMesh(gltf, null, mat);
                // Use the Starter instance from the ref to add the mesh
                if (appRef.current) {
                    appRef.current.add(mesh);
                    setStatusMessage(prev => prev.includes("Loading") ? "Avatar loaded." : prev);
                }
            } catch (error) {
                console.error("Failed to set up character:", error);
                setStatusMessage("Error loading avatar.");
            }
};
  
setupCharacter();
}, []); // The empty dependency array [] is crucial. It makes the effect run only ONCE.

  const handleGenerateScene = useCallback(async () => {
    const topic = prompt.trim();
    if (!generator || !topic) {
        alert("Please enter a topic for the scene.");
        return;
    }
    
    setIsGenerating(true);
    setStatusMessage("Creating scene...");
    // Reset previous work
    setSceneDescription('');
    setGeneratedPersonas([]);
    setConversationHistory([]);

    const sceneProfile = personalityProfiles.sceneCreator;
    const fullPrompt = `${sceneProfile.systemPrompt}\n\nTopic: "${topic}"`;

    try {
        const outputs = await generator(fullPrompt, { max_new_tokens: 64 });
        const sceneText = outputs[0].generated_text.replace(fullPrompt, "").trim();
        setSceneDescription(sceneText);
        setStatusMessage("Scene created! Now, add some characters.");
    } catch (error) { /* ... */ }
    
    setIsGenerating(false);
}, [generator, prompt]);


const handleAddCharacter = useCallback(async () => {
    const topic = prompt.trim();
    if (!generator || !sceneDescription) {
        alert("Please generate a scene before adding a character.");
        return;
    }

    setIsGenerating(true);
    setStatusMessage("Creating a new character...");

    const charProfile = personalityProfiles.characterCreator;
    const fullPrompt = `${charProfile.systemPrompt}\n\nTopic: "${topic}"\nSetting: "${sceneDescription}"`;
    
    try {
        const outputs = await generator(fullPrompt, { max_new_tokens: 128 });
        const charOutput = outputs[0].generated_text.replace(fullPrompt, "").trim();

        // Parse the NAME and DESC from the output
        const charName = charOutput.match(/NAME: (.*)/)?.[1];
        const charDesc = charOutput.match(/DESC: (.*)/)?.[1];

        if (charName && charDesc) {
            const newPersona = {
                name: charName,
                // Assign voices alternately
                voice: generatedPersonas.length % 2 === 0 ? 'af_alloy' : 'am_adam',
                personality: charDesc,
            };
            setGeneratedPersonas(prev => [...prev, newPersona]);
            setStatusMessage(`Character "${charName}" created!`);
        } else {
            setStatusMessage("Failed to create a valid character. Please try again.");
            console.error("Failed to parse character output:", charOutput);
        }
    } catch (error) { /* ... */ }

    setIsGenerating(false);
}, [generator, prompt, sceneDescription, generatedPersonas]);
  
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
const [preferredTtsEngine, setPreferredTtsEngine] = useState('kokoro');
const [finalSttTranscript, setFinalSttTranscript] = useState(null);
const [webSpeechApiDedicatedInput, setWebSpeechApiDedicatedInput] = useState("Hello from browser TTS!");
const [currentPersonalityKey, setCurrentPersonalityKey] = useState('default');
const [currentProfile, setCurrentProfile] = useState(personalityProfiles.default); // Store the whole profile
const [activeTtsEngine, setActiveTtsEngine] = useState('kokoro');
const [kokoroTtsInstance, setKokoroTtsInstance] = useState(null);
const [imageCaptioner, setImageCaptioner] = useState(null);
const [imageToCaption, setImageToCaption] = useState(null); // Will store URL or File object
const [generatedCaption, setGeneratedCaption] = useState('');
const [isCaptioning, setIsCaptioning] = useState(false);
  
const armRef = useRef(null);
const animationState = useRef({
    action: 'idle', // The current animation action (e.g., 'wave')
    startTime: 0,   // When the animation started
    duration: 1000, // Duration of the animation in milliseconds (1 second)
});
const clock = useRef(new THREE.Clock()); // Three.js clock for timing
const [isListeningForWakeWord, setIsListeningForWakeWord] = useState(false);
const WAKE_WORD = "hey ai";

const promptTextareaRef = useRef(null); // Ref for the prompt textarea
const audioContextRef = useRef(null); // For playing audio
const recognitionRef = useRef(null); // To hold the SpeechRecognition instance
const synthRef = useRef(null);
const sttJustFinishedRef = useRef(false);
const playedIntroForPersonalityRef = useRef(null);

useEffect(() => {
    // The main animation loop function
    const animate = () => {
        // Schedule the next frame
        requestAnimationFrame(animate);
        // Get the elapsed time since the animation started
        const elapsedTime = clock.current.getElapsedTime() * 1000;
        const animProgress = (elapsedTime - animationState.current.startTime) / animationState.current.duration;
        const arm = armRef.current;
        if (arm && animationState.current.action === 'wave') {
            const waveBone = arm.bones[arm.names.get('UpperArm_R')];
            if (waveBone && waveBone.local) {
                // Use a "ping-pong" effect for the wave
                // Math.sin creates a smooth back-and-forth motion from 0 -> 1 -> 0
                const waveAngle = (Math.PI / 2) * Math.sin(animProgress * Math.PI);
                // Apply the calculated angle
                const tempQuat = new THREE.Quaternion();
                tempQuat.setFromAxisAngle(new THREE.Vector3(0, 0, 1), waveAngle);
                waveBone.local.rot[0] = tempQuat.x;
                waveBone.local.rot[1] = tempQuat.y;
                waveBone.local.rot[2] = tempQuat.z;
                waveBone.local.rot[3] = tempQuat.w;
                // When the animation is done, reset to idle
                if (animProgress >= 1) {
                    animationState.current.action = 'idle';
                    waveBone.local.rot[0] = 0;
                    waveBone.local.rot[1] = 0;
                    waveBone.local.rot[2] = 0;
                    waveBone.local.rot[3] = 1;
                }
            }
        }
                // Render the scene
        if (appRef.current) {
            appRef.current.render();
        }
    };
    animate();
}, []); // The empty array ensures this runs only once
  
/**
 * Animate the avatar based on a command.
 * This final version uses the correct object path (bone.local.rot) to set the animation.
 * @param {string} command - The animation command (e.g., 'wave' or 'idle').
 */
const handleAvatarAnimation = (command) => {
    if (!armRef.current) return;
    // If a new command comes in, start its animation timer
    if (command === 'wave') {
        console.log("Triggering 'wave' animation.");
        animationState.current.action = 'wave';
        animationState.current.startTime = clock.current.getElapsedTime() * 1000;
    } else {
        // For 'idle', we simply set the action. The loop will handle resting position.
        animationState.current.action = 'idle';
    }
};
  
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
    if (!audioCtx) { /* TODO: handle error with UI notification */ setIsSpeaking(false); return false; }
    if (audioCtx.state === 'suspended') { // Ensure AudioContext is running
        try { await audioCtx.resume(); }
        catch (resumeError) { /* TODO: handle error */ setIsSpeaking(false); return false; }
    }
    if (audioCtx.state !== 'running') { /* TODO: handle error */ setIsSpeaking(false); return false; }
    setIsSpeaking(true);
    setStatusMessage(`Synthesizing with Kokoro: "${text.substring(0, 30)}..."`);
    try {
        const output = await kokoroTtsInstance.generate(text.trim(),{voice: "af_heart"});
        const kokoroAudioOutput = output; // Assuming 'output' is the variable holding the result of generate()
        console.log("Kokoro TTS output object:", kokoroAudioOutput);
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
             console.error("Kokoro TTS audio data is not Float32Array and could not be converted from Int16Array. Type was:", Object.prototype.toString.call(rawData));
             throw new Error("Unsupported audio data type from Kokoro TTS after attempting extraction.");
          }
        }
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

const speakForPersona = (text, voiceId) => {
    return new Promise(async (resolve, reject) => {
        if (!kokoroTtsInstance || !text || !text.trim()) {
            reject("TTS instance not ready or no text provided.");
            return;
        }
        const audioCtx = initializeAudioContext();
        if (audioCtx.state === 'suspended') {
            await audioCtx.resume();
        }
        if (audioCtx.state !== 'running') {
            reject("AudioContext not running.");
            return;
        }
        try {
            setIsSpeaking(true);
            setStatusMessage(`Synthesizing (${voiceId})...`);
            const output = await kokoroTtsInstance.generate(text.trim(), { voice: voiceId });
            const audioData = output.audio instanceof Float32Array ? output.audio : new Float32Array(output.audio);
            const buffer = audioCtx.createBuffer(1, audioData.length, output.sampling_rate);
            buffer.copyToChannel(audioData, 0);
            const source = audioCtx.createBufferSource();
            source.buffer = buffer;
            source.connect(audioCtx.destination);
            source.onended = () => {
                setIsSpeaking(false);
                resolve(); 
            };
            source.start();
        } catch (error) {
            console.error(`Error in speakForPersona with voice ${voiceId}:`, error);
            setIsSpeaking(false);
            reject(error);
        }
    });
};
  
const setupSpeechRecognition = useCallback(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
        setSttError("Your browser doesn't support Speech Recognition. Try Chrome or Edge.");
        setStatusMessage(prev => `${prev} Speech Recognition not supported.`);
        return;
    }
    const recognitionInstance = new SpeechRecognitionAPI();
    recognitionInstance.continuous = true; // Always on
    recognitionInstance.interimResults = true; // Get results as they come
    recognitionInstance.lang = 'en-US';
       recognitionInstance.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        console.log('Speech recognized:', transcript);
        setPrompt(transcript); // Put the text in the prompt box
        setIsListening(false); // We are done listening
        setStatusMessage("Speech recognized. Click 'Send to AI' to proceed.");
    };
    recognitionInstance.onend = () => {
        setIsListening(false);
    };
      recognitionInstance.onerror = (event) => {
        console.error('Speech recognition error:', event.error, event.message);
        setSttError(`Speech Error: ${event.error}`);
        setIsListening(false);
    };
    recognitionRef.current = recognitionInstance;
}, [setPrompt, setStatusMessage, setSttError, setIsListening, isListening, isListeningForWakeWord]);

const toggleListen = () => {
    if (!recognitionRef.current) {
        setSttError("Speech recognition not initialized.");
        return;
    }
  if (isListening) {
        recognitionRef.current.stop();
        setIsListening(false);
    } else {
        setPrompt(''); // Clear the prompt before listening
        try {
            recognitionRef.current.start();
            setIsListening(true);
            setStatusMessage("Listening...");
            setSttError('');
        } catch (e) {
            console.error("Error starting recognition:", e);
        }
    }
};
  
const handleGenerateText = useCallback(async () => {
    if (!generator) {
        alert("The text generation model is not loaded yet. Please wait.");
        return;
    }
    const textToProcess = prompt.trim();
    if (!textToProcess) {
        alert("Please enter a prompt.");
        return;
    }
    setGeneratedOutput('');
    setConversationHistory([]);
    setIsGenerating(true);
if (isSelfConversationMode) {
    setStatusMessage("Starting self-conversation...");
   if (generatedPersonas.length < 2) {
        alert("Please create at least two characters before starting the dialogue.");
        setIsGenerating(false);
        return;
    }
  
    const [personaA, personaB] = generatedPersonas;

    const CONVERSATION_TURNS = 4; // Results in 4 total messages
    const generationArgs = {
        max_new_tokens: 96,
        temperature: 0.85, // Slightly higher for more creativity
        top_k: 96,
        repetition_penalty: 1.2,
        no_repeat_ngram_size: 3,
    };
    
    const generateAndClean = async (promptText, personaName) => {
        const output = await generator(promptText, generationArgs);
        let rawText = output[0].generated_text.replace(promptText, "").trim();
        rawText = rawText.split('\n')[0];
        return rawText.replace(/^"|"$/g, '');
    };

    try {
        // --- NEW: The "Transcript" Prompt ---
        // We set the scene and characters ONLY ONCE at the beginning.
        let historyForLLM = `The following is a short, witty dialogue between two characters:
- ${personaA.name}: ${personaA.personality}
- ${personaB.name}: ${personaB.personality}

They are discussing the topic: "${prompt}".

The scene begins with ${personaA.name} speaking.
`;

        // The overlapping execution loop remains, but the prompt construction is much simpler.
        for (let i = 0; i < CONVERSATION_TURNS; i++) {
            // --- Persona A's Turn ---
            setStatusMessage(`${personaA.name} is thinking...`);
            let promptA = `${historyForLLM}${personaA.name}:`; // Prompt is just the history + the speaker's name
            let textA = await generateAndClean(promptA, personaA.name);
            
            // Add the new line to the history for the *next* turn
            historyForLLM += `${personaA.name}: ${textA}\n`;
            setConversationHistory(prev => [...prev, { speaker: personaA.name, text: textA }]);
            const ttsPromiseA = speakForPersona(textA, personaA.voice);

            // --- Persona B's Turn ---
            setStatusMessage(`${personaB.name} is thinking...`);
            let promptB = `${historyForLLM}${personaB.name}:`; // Prompt is the UPDATED history + speaker's name
            let textB = await generateAndClean(promptB, personaB.name);

            await ttsPromiseA; // Wait for A to finish talking
            
            // Add the new line to the history for the *next* turn
            historyForLLM += `${personaB.name}: ${textB}\n`;
            setConversationHistory(prev => [...prev, { speaker: personaB.name, text: textB }]);
            const ttsPromiseB = speakForPersona(textB, personaB.voice);

            await ttsPromiseB; // Wait for B to finish before the next loop
        }
        setStatusMessage("Self-conversation finished.");
    } catch (error) {
        console.error("Error during self-conversation:", error);
        setStatusMessage(`Error: ${error.message}`);
    }
    }
setIsGenerating(false);
}, [
    generator, prompt, currentProfile, isSelfConversationMode,
    synthesizeWithKokoroAndPlay, speakForPersona // Note: dependencies simplified
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

const handleImageSelection = (event) => {
  const file = event.target.files[0];
  if (file) {
    setImageToCaption(file);
    setGeneratedCaption(''); // Clear previous caption
  } else {
    setImageToCaption(null);
  }
};

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
        const captions = await imageCaptioner(imageSrc, { max_new_tokens: 256 });
        if (captions && captions.length > 0 && captions[0].generated_text) {
            const newCaption = captions[0].generated_text;
            setGeneratedCaption(newCaption);
            setStatusMessage("Image caption generated successfully.");
            if (newCaption) {
                if (preferredTtsEngine === 'kokoro') {
                    // *** FIX: Added the default 'en_sam' voiceId ***
                    await synthesizeWithKokoroAndPlay(newCaption, null, 'en_sam');
                } else if (preferredTtsEngine === 'webSpeechAPI') {
                    speakWithWebAPI(newCaption);
                } else if (preferredTtsEngine === 'speechT5') {
                    await synthesizeAndPlayText(newCaption);
                }
            }
        } else {
            setGeneratedCaption("No caption generated or unexpected output format.");
        }
    } catch (error) {
        console.error("Error during image captioning:", error);
        setGeneratedCaption(`Error: ${error.message}`);
    } finally {
        setIsCaptioning(false);
    }
}, [
    imageCaptioner,
    imageToCaption,
    preferredTtsEngine,
    speakWithWebAPI,
    synthesizeAndPlayText,
    synthesizeWithKokoroAndPlay
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
          // Xenova/LaMini-Flan-T5-783M
          // Xenova/LaMini-Flan-T5-248M
          // Xenova/LaMini-Flan-T5-77M
          progress_callback: (progress) => {
            const percentage = progress.total > 0 ? (progress.loaded / progress.total * 100).toFixed(2) : 'N/A';
            const message = `Loading: ${progress.file} - ${progress.status} (${percentage}%)`;
            console.log(message);
            setStatusMessage(message);
          },quantized: true
  },
  { device: "webnn" }
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
        },
  { device: "webnn" });
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
    try {
        setStatusMessage(prev => `${prev} Loading TTS model (Kokoro)...`);
        const kokoroInstance = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {dtype: "fp32", device: "webgpu", });
        setKokoroTtsInstance(() => kokoroInstance);
        console.log("Kokoro TTS pipeline loaded successfully.");
        if (generator && ttsPipelineInstance && speakerEmbeddings && kokoroInstance) {
            setStatusMessage("All models loaded! Ready.");
        } else {
            setStatusMessage(prev => `${prev} Kokoro TTS loaded.`);
        }
    } catch (error) {
        console.error("Failed to load Kokoro TTS pipeline:", error);
        setStatusMessage(prev => `${prev} Kokoro TTS Error: ${error.message}.`);
    }
    try {
      setStatusMessage(prev => `${prev} Loading Image Captioning model...`);
      const captionerInstance = await pipeline('image-to-text', 'Xenova/vit-gpt2-image-captioning', {
        progress_callback: (progress) => {
          const percentage = progress.total > 0 ? (progress.loaded / progress.total * 100).toFixed(2) : 'N/A';
          const message = `Loading Captioner: ${progress.file} (${percentage}%)`;
          setStatusMessage(message);
        },
      },
  { device: "webnn" });
      setImageCaptioner(() => captionerInstance);
      console.log("Image Captioning model loaded successfully.");
      // Update the overall status message
      if (generator && ttsPipelineInstance && speakerEmbeddings && kokoroInstance && captionerInstance) {
        setStatusMessage("All models loaded! Ready.");
      } else {
        setStatusMessage(prev => `${prev} Image Captioner loaded.`);
      }
    } catch (error) {
      console.error("Failed to load Image Captioning model:", error);
      setStatusMessage(prev => `${prev} Image Captioning Error: ${error.message}.`);
    }
}
  
document.getElementById("startBtn5").addEventListener('click', function() {
    const xhrPath = document.querySelector('#loadPath').innerHTML;
    const xhr = new XMLHttpRequest();
    xhr.open('GET', xhrPath, true);
    xhr.responseType = 'arraybuffer';
    console.log(`Requesting external script from: ${xhrPath}`);
function decodeUTF32(uint8Array, isLittleEndian = true) {
        const dataView = new DataView(uint8Array.buffer);
        let result = "";
        for (let i = 0; i < uint8Array.length; i += 4) {
            const codePoint = dataView.getUint32(i, true);
            result += String.fromCodePoint(codePoint);
        }
        return result;
    }
    xhr.onerror = function() {
        console.error("XHR request failed. Check the network path and CORS policy.");
    };
    xhr.onload = function() {
        try {
            if (xhr.status === 200) {
                console.log("Script content loaded. Decoding...");
                const jsCode = decodeUTF32(new Uint8Array(xhr.response), true);
                console.log("Decoding complete. Executing in a controlled scope...");
                const runAndGetModule = new Function(`
                    ${jsCode}
                    return libload;
                `);
                const ModuleFactory = runAndGetModule();
                if (typeof ModuleFactory !== 'function') {
                    throw new Error("The executed script did not return a function named 'libload'.");
                }
                console.log("SUCCESS: 'libload' has been captured. Initializing module...");
                const Module = ModuleFactory(); // Call the factory to get the final module object.
                if (Module && typeof Module.onRuntimeInitialized === 'function') {
                    Module.onRuntimeInitialized = function() {
                        console.log('Module runtime initialized. Calling main...');
                        Module.callMain();
                    };
                } else {
                     console.log('Module initialized directly. The onRuntimeInitialized callback might have already fired or is not needed.');
                     if (Module && typeof Module.callMain === 'function') {
                         Module.callMain();
                     }
                }
            } else {
                console.error(`XHR request failed with status: ${xhr.status}`);
            }
        } catch (error) {
            console.error("A critical error occurred while executing the dynamic script:", error);
        }
    };
    xhr.send();
});
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


<select id={'sh1'}>
<option value="Random">Random</option>
<option value="movewithouttracvveling">Move Without Travelling</option>
<option value="Default">Default</option>
<option value="crystalineballs">Crystal Palace</option>
<option value="WOOL">Infinite Wool</option>
<option value="hovercubes">Demoscene Cube</option>
<option value="melter">Northern Melt</option>
<option value="PSYfractal">Psychedelic Fractal</option>
<option value="EYEgod">The Eye of God</option>
</select>
  
  
</Box></div>
</div></ul></section>
</nav>
<main id={'panel'}>
<iframe src={'./bezz.1ink'} id={'circle'} title='Circular mask'></iframe>
<input type={'button'} id={'startBtn'} style={{backgroundColor:'gold',position:'absolute',display:'block',left:'6%',top:'9%',zIndex:3200,border:'4px solid #e7e7e7',borderRadius:'17%'}}></input>
<input type={'button'} id={'menuBtn'} style={{backgroundColor:'black',position:'absolute',display:'block',left:'3%',top:'5%',zIndex:3200,border:'6px solid #e7e7e7',borderRadius:'20%'}}></input>
<input type={'button'} id={'musicBtn'} style={{backgroundColor:'cyan',position:'absolute',display:'block',left:'3%',bottom:'5%',zIndex:3200,border:'6px solid green',borderRadius:'20%'}}></input>
<input type={'button'} id={'startBtn5'} style={{backgroundColor:'yellow',position:'absolute',display:'block',left:'2%',top:'9%',zIndex:3200,border:'4px solid #e7e7e7',borderRadius:'17%'}}></input>
<input type={'button'} id={'getThree'} style={{backgroundColor:'yellow',position:'absolute',display:'block',right:'2%',bottom:'9%',zIndex:3200,border:'4px solid #e7e7e7',borderRadius:'17%'}}></input>
<input type={'button'} id={'moveFwd'} style={{backgroundColor:'yellow',position:'absolute',display:'none',right:'12%',bottom:'9%',zIndex:3200,border:'4px solid #e7e7e7',borderRadius:'17%'}}></input>
<input type={'button'} id={'moveFwdb'} style={{backgroundColor:'yellow',position:'absolute',display:'none',right:'22%',bottom:'9%',zIndex:3200,border:'4px solid #e7e7e7',borderRadius:'17%'}}></input>
<input type={'button'} id={'startBtn2'} style={{backgroundColor:'gold',position:'absolute',display:'block',left:'9%',top:'9%',zIndex:3200,border:'4px solid #e7e7e7',borderRadius:'17%'}}></input>
<input type={'button'} id={'startBtnC'} style={{backgroundColor:'green',position:'absolute',display:'block',left:'5%',top:'12%',zIndex:3200,border:'4px solid #e7e7e7',borderRadius:'17%'}}></input>
<input type={'button'} id={'startBtnB'} style={{backgroundColor:'green',position:'absolute',display:'none',left:'15%',top:'12%',zIndex:3200,border:'4px solid #e7e7e7',borderRadius:'17%'}}></input>
<input type={'button'} id={'startBtnH'} style={{backgroundColor:'green',position:'absolute',display:'block',left:'7%',top:'32%',zIndex:3200,border:'4px solid #e7e7e7',borderRadius:'17%'}}></input>
<input type={'button'} id={'startBtnPM'} style={{backgroundColor:'green',position:'absolute',display:'none',left:'25%',top:'12%',zIndex:3200,border:'4px solid #e7e7e7',borderRadius:'17%'}}></input>
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
<input type="file" id={"fileInput"} style={{zIndex:5000,display:'none',position:'absolute',left:'50vh',top:'16vh'}}></input>
<input type="file" id={"fileInput2"} style={{zIndex:5000,display:'none',position:'absolute',left:'42vh',top:'26vh'}}></input>
<label for="fileInput" className="custom-file-upload">Select File</label>
<div id={'outText'} style={{opacity:0.0,backgroundColor:'green',position:'absolute',top:'50vh',left:'47vw',zIndex:4200}}></div>
<div id={'outText1'} style={{opacity:0.0,backgroundColor:'green',position:'absolute',top:'52vh',left:'47vw',zIndex:4200}}></div>
<div id={'outText2'} style={{opacity:0.0,backgroundColor:'green',position:'absolute',top:'54vh',left:'47vw',zIndex:4200}}></div>
<div id={'modPath'} hidden>https://wasm.noahcohn.com/b3hd/w0-035b-mod.3ijs</div>
<div id={'modulePath'} hidden>https://wasm.noahcohn.com/b3hd/w0-035b-mod.3ijs</div>
<div id={'loadPath'} hidden>https://wasm.noahcohn.com/b3hd/w0-037-load-32.3ijs</div>
<div id={'computePath'} hidden>https://glsl.1ink.us/wgsl/compute_070.wgsl</div>
<div id={'computePathNovid'} hidden>https://glsl.1ink.us/wgsl/compute_070v.wgsl</div>
<div id={'fragPath'} hidden>https://glsl.1ink.us/wgsl/fragment_007.wgsl</div>
<div id={'vertPath'} hidden>https://glsl.1ink.us/wgsl/vertex_003.wgsl</div>
<div id={'path'} hidden>https://glsl.1ink.us/wgsl/synapse.wgsl</div>
<div id={'imagePath'} hidden>https://www.noahcohn.com/image/901464_400093426755894_1205176414_o.jpg</div>
<div className='emscripten' id={'stat'}></div>
<div className='emscripten' id={'status'}></div>
<div className='emscripten'>
<progress value={'0'} max={'100'} id={'progress'}></progress>
</div>
<input type={'checkbox'} id={"di"} hidden></input>
//   //   //   //
<div id={'vsiz'} hidden>0</div>
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

<div className="canvas-container">
      <div 
        ref={mountRef} 
        className="centered-square" 
        style={{ width: '100vh', height: '100vh' }} // Example fixed size for your square
      />
<div ref={mountRef} className="three-container" style={{ position: 'absolute',display:'block', top: '0', width: '100vh', height: '100vh', zIndex: 3301, pointerEvents: 'auto' }} />
</div>

{/* =================================================================== */}
{/* NEW, CLEANED-UP UI PANEL - REPLACES ALL THE OVERLAPPING DIVS */}
{/* =================================================================== */}
<div className="floating-control-panel">
    <div className="panel-header">
        <div className="personality-header">
            {currentProfile.avatar && (
                <img
                    src={currentProfile.avatar}
                    alt={`${currentProfile.displayName} Avatar`}
                    className="personality-avatar"
                />
            )}
            <h2>{currentProfile.displayName}</h2>
        </div>
        <div className='status-display'>{statusMessage}</div>
    </div>
      <h3>Creative Mode</h3>
    <div className="input-group">
        <label htmlFor="prompt-textarea">Dialogue Topic:</label>
        <textarea
            id="prompt-textarea"
            ref={promptTextareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., The future of space travel"
            rows={2}
        />
    </div>
     {/* Display Area for Generated Scene */}
    {sceneDescription && (
        <div className="scene-display">
            <strong>Setting:</strong> {sceneDescription}
        </div>
    )}
    {/* Display Area for Generated Characters */}
    {generatedPersonas.length > 0 && (
        <div className="personas-display">
            <strong>Characters:</strong>
            <ul>
                {generatedPersonas.map((p, i) => <li key={i}>{p.name}</li>)}
            </ul>
        </div>
    )}
    {/* Buttons for the new workflow */}
    <div className="button-group" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button onClick={handleGenerateScene} disabled={isGenerating}>
            1. Create Scene
        </button>
        <button onClick={handleAddCharacter} disabled={isGenerating || !sceneDescription || generatedPersonas.length >= 2}>
            2. Add Character ({generatedPersonas.length}/2)
        </button>
        <button
            onClick={handleGenerateText}
            disabled={isGenerating || generatedPersonas.length < 2}
        >
            3. Start Dialogue
        </button>
    </div>
</div>
</div>
<div className="input-group">
    <label htmlFor="self-convo-checkbox" className="radio-group"> {/* Using radio-group style for alignment */}
        <input
            id="self-convo-checkbox"
            type="checkbox"
            checked={isSelfConversationMode}
            onChange={(e) => setIsSelfConversationMode(e.target.checked)}
        />
        Self-Conversation Mode
    </label>
</div>
    <div className="panel-content">
        {/* Column 1: Main Controls */}
        <div className="panel-column">
            <div className="panel-section">
                <h3>AI Configuration</h3>
                <div className="input-group">
                    <label htmlFor="personality-select">AI Personality:</label>
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
                    <label>Auto-Speak Engine (for intros):</label>
                    <div className="radio-group">
                        <label>
                            <input
                                type="radio"
                                name="ttsEnginePref"
                                value="webSpeechAPI"
                                checked={preferredTtsEngine === 'webSpeechAPI'}
                                onChange={() => setPreferredTtsEngine('webSpeechAPI')}
                            /> Browser
                        </label>
                        <label>
                            <input
                                type="radio"
                                name="ttsEnginePref"
                                value="speechT5"
                                checked={preferredTtsEngine === 'speechT5'}
                                onChange={() => setPreferredTtsEngine('speechT5')}
                                disabled={!ttsPipelineInstance || !speakerEmbeddings}
                            /> SpeechT5
                        </label>
                        <label>
                            <input
                                type="radio"
                                name="ttsEnginePref"
                                value="kokoro"
                                checked={preferredTtsEngine === 'kokoro'}
                                onChange={() => setPreferredTtsEngine('kokoro')}
                                disabled={!kokoroTtsInstance}
                            /> Kokoro
                        </label>
                    </div>
                </div>
            </div>

            <div className="panel-section">
    <h3>Interaction</h3> {/* Changed title from "Image Prompt Generation" */}
                <div className="input-group">
        <label htmlFor="prompt-textarea">Your Message:</label> {/* Changed label */}
     <textarea
            id="prompt-textarea"
            ref={promptTextareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Type your message or use the Listen button..."
            rows={3}
            disabled={!generator || isGenerating}
        />
                </div>

                 {/* This is the group of buttons for sending the prompt */}
    <div className="button-group" style={{ display: 'flex', gap: '10px' }}>
        <button
            onClick={handleGenerateText}
            disabled={!generator || isGenerating || !prompt.trim()}
        >
            {isGenerating ? 'Sending...' : 'Send to AI'} {/* Changed text */}
        </button>
        <button onClick={toggleListen} disabled={!recognitionRef.current}>
            {isListening ? 'Listening...' : 'Listen'} {/* Changed text */}
        </button>
    </div>

    {sttError && <p className="stt-error">{sttError}</p>}
<div className="input-group">
    <label>AI Response:</label>
    <div className='generated-output-display'>
        {isSelfConversationMode ? (
            // In self-conversation mode, render the history
            conversationHistory.map((msg, index) => (
                <p key={index}><strong>{msg.speaker}:</strong> {msg.text}</p>
            ))
        ) : (
            // In normal mode, show the single output
            generatedOutput
        )}
    </div>
</div>
</div>
        </div>

        {/* Column 2: Other Tools */}
        <div className="panel-column">
            <div className="panel-section">
                <h3>Image Captioning</h3>
                 <div className="input-group">
                    <label htmlFor="caption-file-input">Upload an Image:</label>
                    <input
                        id="caption-file-input"
                        type="file"
                        accept="image/*"
                        onChange={handleImageSelection}
                        disabled={isCaptioning || !imageCaptioner}
                    />
                </div>
                {imageToCaption && (
                    <img
                        src={typeof imageToCaption === 'string' ? imageToCaption : URL.createObjectURL(imageToCaption)}
                        alt="Selected for captioning"
                        className="image-preview"
                    />
                )}
                <button
                    onClick={handleImageCaptioning}
                    disabled={!imageCaptioner || !imageToCaption || isCaptioning}
                >
                    {isCaptioning ? 'Generating...' : 'Generate Caption'}
                </button>
                <div className="input-group">
                    <label>Generated Caption:</label>
                    <div className='generated-output-display'>{generatedCaption}</div>
                </div>
            </div>

            <div className="panel-section">
                <h3>TTS Testing</h3>
                 <div className="input-group">
                    <label htmlFor="tts-input">Text to Synthesize:</label>
                    <textarea
                        id="tts-input"
                        value={textToSpeakInput}
                        onChange={(e) => setTextToSpeakInput(e.target.value)}
                        placeholder="Enter text to synthesize..."
                        rows={2}
                        disabled={isSpeaking}
                    />
                </div>
                <button
                    onClick={handleSynthesizeSpeech}
                    disabled={!ttsPipelineInstance || !speakerEmbeddings || isSpeaking || !textToSpeakInput.trim()}
                >
                    {isSpeaking ? 'Synthesizing...' : 'Play with SpeechT5'}
                </button>
                 <div className="input-group">
                    <label htmlFor="voice-select-webapi">Browser Voice:</label>
                    <select
                        id="voice-select-webapi"
                        value={selectedVoiceURI}
                        onChange={(e) => setSelectedVoiceURI(e.target.value)}
                        disabled={availableVoices.length === 0 || isWebSpeaking}
                    >
                        {availableVoices.map((voice) => (
                            <option key={voice.voiceURI} value={voice.voiceURI}>
                                {voice.name} ({voice.lang})
                            </option>
                        ))}
                    </select>
                </div>
                <button
                    onClick={() => speakWithWebAPI(textToSpeakInput)}
                    disabled={isSpeaking || !textToSpeakInput.trim() || availableVoices.length === 0}
                >
                    {isSpeaking ? 'Speaking...' : 'Play with Browser'}
                </button>
            </div>
        </div>
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
