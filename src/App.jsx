import { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { pipeline, env, Tensor } from '@xenova/transformers';
import Box from '@mui/material/Box'; // Assuming you still use these
import Slider from '@mui/material/Slider'; // Assuming you still use these
import './App.css';

function App() {
const [generator, setGenerator] = useState(null);
const [statusMessage, setStatusMessage] = useState('Initializing...');
const [prompt, setPrompt] = useState('');
const [generatedOutput, setGeneratedOutput] = useState('');
const [isGenerating, setIsGenerating] = useState(false);
const promptTextareaRef = useRef(null); // Ref for the prompt textarea
const [ttsPipeline, setTtsPipeline] = useState(null);
const [speakerEmbeddings, setSpeakerEmbeddings] = useState(null);
const [ttsPipelineInstance, setTtsPipelineInstance] = useState(null);
const audioContextRef = useRef(null); // For playing audio
const [isListening, setIsListening] = useState(false);
const [sttError, setSttError] = useState('');
const recognitionRef = useRef(null); // To hold the SpeechRecognition instance
const [textToSpeakInput, setTextToSpeakInput] = useState("Hello, this is a test of text to speech.");
const [isSpeaking, setIsSpeaking] = useState(false);
const [webSpeechText, setWebSpeechText] = useState("Hello from the browser's built-in speech synthesis!");
const [availableVoices, setAvailableVoices] = useState([]);
const [selectedVoiceURI, setSelectedVoiceURI] = useState('');
const [isWebSpeaking, setIsWebSpeaking] = useState(false);
const synthRef = useRef(null);
const [preferredTtsEngine, setPreferredTtsEngine] = useState('webSpeechAPI'); // Default to 'webSpeechAPI' or 'transformersJS'
const [finalSttTranscript, setFinalSttTranscript] = useState(null);
const sttJustFinishedRef = useRef(false);
  
const speakWithWebSpeechAPI = useCallback((textToSay) => {
  if (!synthRef.current || !textToSay || !textToSay.trim()) { /* ... */ return; }
  if (synthRef.current.speaking) { synthRef.current.cancel(); }

  const utterance = new SpeechSynthesisUtterance(textToSay);
  // ... (voice selection logic as above) ...
  const selectedVoice = availableVoices.find(voice => voice.voiceURI === selectedVoiceURI);
  if (selectedVoice) utterance.voice = selectedVoice;
  else if (availableVoices.length > 0) utterance.voice = availableVoices[0];


  utterance.onstart = () => { setIsSpeaking(true); setStatusMessage("Speaking (Web Speech API)..."); };
  utterance.onend = () => { setIsSpeaking(false); setStatusMessage("Web Speech API finished."); };
  utterance.onerror = (event) => { /* ... */ setIsSpeaking(false); /* ... */ };
  synthRef.current.speak(utterance);
}, [synthRef, availableVoices, selectedVoiceURI, setIsSpeaking, setStatusMessage]);

  
useEffect(() => {
  synthRef.current = window.speechSynthesis;
  const populateVoices = () => {
    if (synthRef.current) {
      const voices = synthRef.current.getVoices();
      setAvailableVoices(voices);
      if (voices.length > 0) {
        // Try to find a default or preferred English voice
        const preferredVoice = voices.find(voice => voice.lang.startsWith('en') && voice.default) ||
                               voices.find(voice => voice.lang.startsWith('en')) ||
                               voices[0];
        if (preferredVoice && !selectedVoiceURI) { // Set only if not already set
          setSelectedVoiceURI(preferredVoice.voiceURI);
        }
      }
    }
  };

  populateVoices();
  if (synthRef.current && synthRef.current.onvoiceschanged !== undefined) {
    synthRef.current.onvoiceschanged = populateVoices;
  }

return () => { // Cleanup
    if (synthRef.current && synthRef.current.onvoiceschanged !== undefined) {
      synthRef.current.onvoiceschanged = null;
    }
  };
}, [selectedVoiceURI]); // Re-run if selectedVoiceURI changes, or just once on mount initially.
  
const [webSpeechApiInput, setWebSpeechApiInput] = useState("Hello from browser TTS!");

  const speakWithWebAPI = useCallback((textToSay) => {
  if (!recognitionRef.current || !synthRef.current) { // Check synthRef.current for SpeechSynthesis
    setStatusMessage("Web Speech API not ready.");
    console.warn("Web Speech API (Synthesis or Recognition) not ready.");
    return;
  }
  if (!textToSay || !textToSay.trim()) {
    setStatusMessage("No text for Web Speech API to speak.");
    return;
  }

  if (synthRef.current.speaking) {
    synthRef.current.cancel(); // Cancel previous speech to allow new one
  }

  const utterance = new SpeechSynthesisUtterance(textToSay);
  const selectedVoice = availableVoices.find(voice => voice.voiceURI === selectedVoiceURI);
  if (selectedVoice) {
    utterance.voice = selectedVoice;
  } else if (availableVoices.length > 0) {
    utterance.voice = availableVoices[0]; // Fallback
  }

  utterance.onstart = () => {
    setIsSpeaking(true); // Use your global isSpeaking or a dedicated one
    setStatusMessage("Speaking (Browser)...");
  };
  utterance.onend = () => {
    setIsSpeaking(false);
    setStatusMessage("Browser speech finished.");
  };
  utterance.onerror = (event) => {
    console.error("Web Speech API Error:", event);
    setIsSpeaking(false);
    setStatusMessage(`Browser TTS Error: ${event.error}`);
  };
  synthRef.current.speak(utterance);
}, [availableVoices, selectedVoiceURI, synthRef, setIsSpeaking, setStatusMessage]); // Dependencies

// Your existing button handler for the "Browser Built-in TTS" section will call this
const handleWebSpeechSpeakButton = () => { // Renamed to avoid conflict if needed
    speakWithWebAPI(webSpeechApiInput); // Speaks text from its dedicated textarea
};
  
const handleWebSpeechSpeak = () => { // This function is now simpler
  if (!webSpeechText.trim()) { // webSpeechText is the state for its dedicated textarea
      alert("Please enter text in the 'Browser Built-in TTS' textarea.");
      return;
  }
  speakWithWebSpeechAPI(webSpeechText);
};
      
const initializeAudioContext = useCallback(() => {
  if (!audioContextRef.current) {
    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    console.log("AudioContext created. Initial state:", audioContextRef.current.state);
  }
  // You can try a non-blocking resume here, but it's more robust to await it before playing
  if (audioContextRef.current.state === 'suspended') {
     audioContextRef.current.resume().catch(err => {
        console.warn("Initial attempt to resume AudioContext in initializeAudioContext failed. Will try again before playing.", err);
     });
  }
  return audioContextRef.current;
}, []);

const playAudio = useCallback((audioArray, samplingRate) => {
  // ... (your playAudio logic using initializeAudioContext)
  const audioCtx = initializeAudioContext();
  if (!audioCtx) { /* ... */ return; }
  if (audioCtx.state === 'suspended') { audioCtx.resume().catch(e => console.error("Resume in playAudio failed",e)); } // Best effort resume
  
  const buffer = audioCtx.createBuffer(1, audioArray.length, samplingRate);
  buffer.copyToChannel(audioArray, 0);
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(audioCtx.destination);
  source.start();
}, [initializeAudioContext]);

 const setupSpeechRecognition = useCallback(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      setSttError("Your browser doesn't support Speech Recognition. Try Chrome or Edge.");
      setStatusMessage(prev => `${prev} Speech Recognition not supported.`); // Use prev for safety
      return;
    }

    const recognitionInstance = new SpeechRecognitionAPI();
    recognitionInstance.continuous = false;
    recognitionInstance.interimResults = false;
    recognitionInstance.lang = 'en-US';

    recognitionInstance.onresult = (event) => {
      const last = event.results.length - 1;
      const transcript = event.results[last][0].transcript.trim();
      console.log('Speech recognized:', transcript);
      setPrompt(prevPrompt => prevPrompt ? `${prevPrompt} ${transcript}` : transcript);
      setIsListening(false); // Usage of setIsListening
    };

    recognitionInstance.onerror = (event) => {
      console.error('Speech recognition error:', event.error, event.message);
      setSttError(`Speech Error: ${event.error} - ${event.message || 'Unknown error'}`);
      setIsListening(false); // Usage of setIsListening
    };

    recognitionInstance.onend = () => {
      setIsListening(false); // Usage of setIsListening
      console.log('Speech recognition ended.');
      // Check if statusMessage still contains "Listening..." and update it
      setStatusMessage(prevStatus => prevStatus.includes("Listening...") ? "Speech recognition finished." : prevStatus);
    };
    recognitionRef.current = recognitionInstance;
  }, [setPrompt, setStatusMessage, setSttError, setIsListening]); // setIsListening in dependency array

  const toggleListen = () => {
    if (!recognitionRef.current) {
      setSttError("Speech recognition not initialized.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      // setIsListening(false); // onend will handle this
    } else {
      try {
        setPrompt(''); // Clear prompt for new STT input
        // sttJustFinishedRef.current = false; // If you re-introduce this flag
        recognitionRef.current.start();
        setIsListening(true); // Usage of setIsListening
        setSttError('');
        setStatusMessage("Listening for speech...");
      } catch (e) {
        console.error("Error starting recognition (already started?):", e);
        setSttError("Failed to start listening. Microphone might be in use or permission denied.");
        setIsListening(false); // Usage of setIsListening
      }
    }
  };


  
const handleGenerateText = async () => {
  if (!generator) {
    alert("The text generation model is not loaded yet. Please wait.");
    return;
  }

  let textToProcess = prompt.trim(); // Text from the main LLM prompt

  if (!textToProcess && generatedOutput.trim()) {
    // If main prompt is empty, consider using the last generated output
    // This part depends on your desired UX for an empty prompt.
    // For now, let's assume we want to re-speak the last generated output if prompt is empty.
    textToProcess = generatedOutput.trim();
    if (!textToProcess) {
        alert("Please enter some text in the prompt.");
        return;
    }
    // Update text areas to reflect what's being spoken
    setTextToSpeakInput(textToProcess); // For Transformers.js TTS section
    setWebSpeechApiInput(textToProcess);  // For Web Speech API TTS section

  } else if (!textToProcess) {
    alert("Please enter some text to generate from.");
    return;
  }

  setIsGenerating(true);
  setGeneratedOutput("Generating, please wait...");
  setStatusMessage("Generating text...");
  let newLLMText = ""; // Use a distinct variable name

  try {
    const outputs = await generator(textToProcess, { max_new_tokens: 150 });

    if (outputs && outputs.length > 0 && outputs[0].generated_text) {
      newLLMText = outputs[0].generated_text;
      setGeneratedOutput(newLLMText); // Display LLM output
      setStatusMessage("Text generation complete. Auto-speaking...");

      // --- Automatically send to PREFERRED TTS ---
      if (preferredTtsEngine === 'webSpeechAPI') {
        setWebSpeechApiInput(newLLMText); // Update the WebSpeech textarea
        speakWithWebAPI(newLLMText);       // Call the refactored Web Speech function
      } else if (preferredTtsEngine === 'transformersJS') {
        setTextToSpeakInput(newLLMText);   // Update the Transformers.js TTS textarea
        await synthesizeAndPlayText(newLLMText); // Call your existing Transformers.js function
      }
      // --- End of auto TTS ---

    } else {
      setGeneratedOutput("No text was generated or output format was unexpected.");
      setStatusMessage("Text generation failed to produce output.");
    }
  } catch (error) {
    console.error("Error during text generation:", error);
    setGeneratedOutput(`Error generating text: ${error.message}`);
    setStatusMessage(`Error in LLM generation: ${error.message}`);
  }
  setIsGenerating(false);
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
  // Check if the prompt is not empty, STT just finished, and we are not already generating/speaking
  if (prompt.trim() && sttJustFinishedRef.current && !isGenerating && !isSpeaking) {
    console.log("STT provided new prompt, automatically triggering text generation:", prompt);
    handleGenerateText(); // Call your existing LLM generation handler
    sttJustFinishedRef.current = false; // Reset the flag immediately after triggering
  }
  // We don't want to trigger if the prompt was changed by typing,
  // or if the prompt was set by LLM output itself for the TTS input textarea.
  // This flag helps differentiate.
}, [prompt, isGenerating, isSpeaking, handleGenerateText]); // Watch these dependencies

useLayoutEffect(() => {
    console.log('Forcing remote settings and disabling cache for loading.');
    env.localFilesOnly = false;
    env.allowLocalModels = false; // Explicitly disallow local models for fetching
    env.useBrowserCache = false;  // Disable browser cache for model files
    env.remoteHost = 'https://huggingface.co';
    env.remotePathTemplate = '{model}/resolve/main/';
    setStatusMessage('Loading model, please wait...');

async function loadModel() {
      try {
        const pipelineInstance = await pipeline('text2text-generation', 'Xenova/LaMini-Flan-T5-783M', {
          progress_callback: (progress) => {
            const percentage = progress.total > 0 ? (progress.loaded / progress.total * 100).toFixed(2) : 'N/A';
            const message = `Loading: ${progress.file} - ${progress.status} (${percentage}%)`;
            console.log(message);
            setStatusMessage(message); // Update status message
          }
        });
        console.log("Pipeline loaded successfully.");
        setStatusMessage("Model loaded! Ready to generate.");
        setGenerator(() => pipelineInstance); // Store the loaded pipeline using functional update
      } catch (error) {
        console.error("Failed to load pipeline:", error);
        setStatusMessage(`Error loading model: ${error.message}`);
      }
       try {
        setStatusMessage(prev => `${prev} Loading TTS model (SpeechT5)...`);
        // 1. Load the TTS pipeline (vocoder is usually handled internally by this pipeline for SpeechT5)
        const ttsPipe = await pipeline('text-to-speech', 'Xenova/speecht5_tts', {
          progress_callback: (progress) => {
            const percentage = progress.total > 0 ? (progress.loaded / progress.total * 100).toFixed(2) : 'N/A';
            const message = `Loading TTS: ${progress.file} (${percentage}%)`;
            // console.log(message);
            setStatusMessage(message);
          },
          // The 'Xenova/speecht5_tts' pipeline will automatically look for 'Xenova/speecht5_vocoder'
        });
        setTtsPipelineInstance(() => ttsPipe);
        setStatusMessage(prev => `${prev} TTS model loaded.`);
        console.log("TTS pipeline (SpeechT5 + Vocoder) loaded successfully.");

        // 2. Load speaker embeddings (example from Hugging Face datasets)
        setStatusMessage(prev => `${prev} Loading speaker embeddings...`);
        const speaker_embeddings_url = 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/speaker_embeddings.bin';
        const response = await fetch(speaker_embeddings_url);
        if (!response.ok) {
          throw new Error(`Failed to fetch speaker embeddings: ${response.statusText}`);
        }
        const speakerEmb = new Float32Array(await response.arrayBuffer());
        // Reshape to [1, 512] as expected by the model
        const reshapedSpeakerEmb = new Tensor('float32', speakerEmb, [1, 512]);
        setSpeakerEmbeddings(reshapedSpeakerEmb);
        setStatusMessage("All models loaded! Ready.");
        console.log("Speaker embeddings loaded successfully.");

      } catch (error) {
        console.error("Failed to load TTS pipeline or speaker embeddings:", error);
        setStatusMessage(prev => `${prev} TTS Error: ${error.message}.`);
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
},4500);      };
reader.readAsDataURL(file);
}
});

const xhrPath = document.querySelector('#loadPath').innerHTML;
const xhr = new XMLHttpRequest();
xhr.open('GET', xhrPath, true); // Replace with your filename
xhr.responseType = 'arraybuffer'; // Get raw binary data
console.log('got react run');
function decodeUTF32(uint8Array, isLittleEndian = true) {
const dataView = new DataView(uint8Array.buffer);
let result = "";
for (let i = 0; i < uint8Array.length; i += 4) {
let codePoint;
if (isLittleEndian) {
codePoint = dataView.getUint32(i, true); // Little-endian
} else {
codePoint = dataView.getUint32(i, false); // Big-endian
}
result += String.fromCodePoint(codePoint);
}
return result;
}
xhr.onload = function() {
console.log('got load loader');
if (xhr.status === 200) {
const utf32Data = xhr.response;
  //  const decoder = new TextDecoder('utf-32'); // Or 'utf-32be'
const jsCode = decodeUTF32(new Uint8Array(utf32Data), true); // Assuming little-endian
const scr = document.createElement('script');
// scr.type = 'module';
scr.text = jsCode;
document.body.appendChild(scr);
var Module = {}; // Initialize an empty Module object
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

    console.log("Transformers.js TTS Output:", output); // Log the entire output object

    // Use the sampling rate from the model output
    const modelSamplingRate = output.sampling_rate;

    if (output.audio && typeof modelSamplingRate === 'number' && modelSamplingRate > 0) {
      console.log(`Playing audio with sampling rate: ${modelSamplingRate}`);
      playAudio(output.audio, modelSamplingRate); // Use the model's actual sampling rate
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
  setTimeout(() => setIsSpeaking(false), 500); // Adjust as needed, or use audio onended
  return true;
}, [
  ttsPipelineInstance,
  speakerEmbeddings,
  initializeAudioContext,
  playAudio,
  setStatusMessage,
  setIsSpeaking
]);
  


  // --- Handle Text-to-Speech Generation ---

const handleSynthesizeSpeech = async () => {
  // The text is already in textToSpeakInput state, bound to the TTS textarea
  if (!textToSpeakInput.trim()) {
      alert("Please enter text in the TTS input area to synthesize.");
      return;
  }
  await synthesizeAndPlayText(textToSpeakInput);
};

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

<div style={{ marginTop: '20px', padding: '15px', borderTop: '1px solid #ddd', backgroundColor: 'rgba(230, 240, 250, 0.9)' }}>

  <div style={{ padding: '10px 0', borderBottom: '1px solid #ddd', marginBottom: '15px' }}>
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
    value={webSpeechText}
    onChange={(e) => setWebSpeechText(e.target.value)}
    placeholder="Enter text for browser TTS..."
    rows={3}
    style={{ width: '100%', padding: '8px', boxSizing: 'border-box', marginBottom: '10px' }}
    disabled={isWebSpeaking}
  />
<div style={{ marginBottom: '10px' }}>
<label htmlFor="voice-select-webapi" style={{ position:'absolute',zIndex:4000,marginRight: '10px' }}>Voice:</label>
<select
      id="voice-select-webapi"
      value={selectedVoiceURI}
      onChange={(e) => setSelectedVoiceURI(e.target.value)}
      style={{ padding: '8px', width: 'calc(100% - 70px)'}}
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
