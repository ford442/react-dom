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

  const setupSpeechRecognition = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSttError("Your browser doesn't support Speech Recognition. Try Chrome or Edge.");
      setStatusMessage("Speech Recognition not supported."); // Update general status
      return;
    }

const recognition = new SpeechRecognition();
    recognition.continuous = false; // Set to true for continuous listening, false for single phrases
    recognition.interimResults = false; // Set to true to get interim results as user speaks
    recognition.lang = 'en-US'; // Set language

recognition.onresult = (event) => {
      const last = event.results.length - 1;
      const transcript = event.results[last][0].transcript.trim();
      console.log('Speech recognized:', transcript);
      setPrompt(prevPrompt => prevPrompt ? `${prevPrompt} ${transcript}` : transcript); // Append or set
      setIsListening(false);
};

recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setSttError(`Speech Error: ${event.error}`);
      setIsListening(false);
    };

recognition.onend = () => {
      setIsListening(false);
      console.log('Speech recognition ended.');
    };

recognitionRef.current = recognition;
  }, [setPrompt]); // setPrompt is a dependency

useEffect(() => {
    setupSpeechRecognition();
}, [setupSpeechRecognition]);


const toggleListen = () => {
    if (!recognitionRef.current) {
      setSttError("Speech recognition not initialized.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
        setSttError(''); // Clear previous errors
        setPrompt(''); // Optionally clear prompt before new speech input
        setStatusMessage("Listening...");
      } catch (e) {
        // This can happen if recognition is already started
        console.error("Error starting recognition (already started?):", e);
        setIsListening(false); // Reset state
      }
    }
};

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

const synthesizeAndPlayText = async (text) => {
  if (!ttsPipelineInstance || !speakerEmbeddings) {
    setStatusMessage("TTS model or speaker embeddings not loaded yet.");
    alert("TTS model or speaker embeddings not loaded yet.");
    return false; // Indicate failure
  }
  if (!text || !text.trim()) {
    setStatusMessage("No text provided to synthesize.");
    // alert("No text to synthesize."); // Might be too noisy if called automatically
    return false; // Indicate failure
  }

  // Ensure AudioContext is active (important for autoplay)
  initializeAudioContext();
  if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
    try {
      await audioContextRef.current.resume();
    } catch (resumeError) {
      console.error("Failed to resume audio context automatically:", resumeError);
      setStatusMessage("TTS Error: Could not resume audio. Please click to interact.");
      alert("Could not play audio automatically. Please click 'Synthesize & Play Speech' button once.");
      return false; // Indicate failure
    }
  }

  setIsSpeaking(true);
  setStatusMessage(`Synthesizing: "${text.substring(0, 30)}..."`);

  try {
    const output = await ttsPipelineInstance(text.trim(), {
      speaker_embeddings: speakerEmbeddings,
    });

    if (output.audio && output.sampling_rate) {
      playAudio(output.audio, output.sampling_rate);
      setStatusMessage("Speech synthesized and playing.");
    } else {
      throw new Error("TTS pipeline did not return valid audio data.");
    }
  } catch (error) {
    console.error("Error during speech synthesis:", error);
    setStatusMessage(`TTS Synthesis Error: ${error.message}`);
    setIsSpeaking(false); // Reset on error
    return false; // Indicate failure
  }

  // setIsSpeaking(false); // playAudio is async but doesn't return a promise for when it's *done* playing.
  // For now, we'll set isSpeaking to false quickly. A more robust solution might involve
  // tracking audio playback completion if needed.
  // Let's set it after a short delay or assume playback started.
  setTimeout(() => setIsSpeaking(false), 500); // Reset after a short delay
  return true; // Indicate success
};
  
const handleGenerateText = async () => {
  if (!generator) {
    alert("The text generation model is not loaded yet. Please wait.");
    return;
  }
  if (!prompt.trim() && !generatedOutput.trim()) { // Allow re-speaking previous output if prompt is empty
    if(generatedOutput.trim()){
        // If prompt is empty but there's previous generated output, speak that.
        setTextToSpeakInput(generatedOutput.trim()); // Update TTS input area
        await synthesizeAndPlayText(generatedOutput.trim());
    } else {
        alert("Please enter some text or use speech-to-text to provide a prompt.");
    }
    return;
  }

  let textToProcess = prompt.trim() || generatedOutput.trim(); // Use current prompt, or re-use last generated if prompt is empty

  setIsGenerating(true);
  setGeneratedOutput("Generating, please wait..."); // Clear previous LLM output display
  setStatusMessage("Generating text...");


    try {
      // Call the generator (pipeline) with the prompt
      // You can also pass parameters like max_length, temperature, etc.
      const outputs = await generator(textToProcess, {
        max_new_tokens: 150, // Limit the number of new tokens generated
        // temperature: 0.7,
        // num_beams: 2,
        // early_stopping: true,
      });

      // The output is usually an array of objects.
      // For text2text-generation, it's typically [{ generated_text: "..." }]
 if (outputs && outputs.length > 0 && outputs[0].generated_text) {
      newGeneratedText = outputs[0].generated_text;
      setGeneratedOutput(newGeneratedText); // Display LLM output
      setStatusMessage("Text generation complete. Preparing for TTS...");

      // --- Automatically send to TTS ---
      setTextToSpeakInput(newGeneratedText); // Update the TTS textarea content
      await synthesizeAndPlayText(newGeneratedText); // Synthesize and play
      // --- End of auto TTS ---

    } else {
      setGeneratedOutput("No text was generated or output format was unexpected.");
      console.log("Unexpected LLM output format:", outputs);
      setStatusMessage("Text generation failed to produce output.");
    }
  } catch (error) {
    console.error("Error during text generation:", error);
    setGeneratedOutput(`Error generating text: ${error.message}`);
    setStatusMessage(`Error in LLM generation: ${error.message}`);
  }
  setIsGenerating(false);
};

const initializeAudioContext = () => {
    if (!audioContextRef.current) {
      // Create AudioContext on user gesture if possible, or on demand
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
    }
    return audioContextRef.current;
};

const playAudio = (audioArray, samplingRate) => {
    const audioCtx = initializeAudioContext();
    if (!audioCtx) {
        alert("Could not initialize audio player. Please interact with the page first.");
        return;
    }
    // Ensure context is running (it might be suspended initially)
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    const buffer = audioCtx.createBuffer(1, audioArray.length, samplingRate); // 1 for mono
    buffer.copyToChannel(audioArray, 0);

    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);
    source.start();
};

  // --- Handle Text-to-Speech Generation ---
const [textToSpeakInput, setTextToSpeakInput] = useState("Hello, this is a test of text to speech.");
const [isSpeaking, setIsSpeaking] = useState(false);
const handleSynthesizeSpeech = async () => {
  // The text is already in textToSpeakInput state, bound to the TTS textarea
  if (!textToSpeakInput.trim()) {
      alert("Please enter text in the TTS input area to synthesize.");
      return;
  }
  await synthesizeAndPlayText(textToSpeakInput);
};

initializeAudioContext();
if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
}

setIsSpeaking(true);
setStatusMessage("Synthesizing speech...");

try {
      const output = await ttsPipelineInstance(textToSpeakInput.trim(), {
        speaker_embeddings: speakerEmbeddings,
      });
      // output.audio is a Float32Array
      output.sampling_rate=22050; // is the number (e.g., 16000 or 22050)
      playAudio(output.audio, output.sampling_rate);
      setStatusMessage("Speech synthesized and playing.");
    } catch (error) {
      console.error("Error during speech synthesis:", error);
      setStatusMessage(`TTS Synthesis Error: ${error.message}`);
    }
    setIsSpeaking(false);
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
