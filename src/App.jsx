import { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { pipeline, env, Tensor } from '@xenova/transformers';
import Box from '@mui/material/Box'; // Assuming you still use these
import Slider from '@mui/material/Slider'; // Assuming you still use these
import './App.css';

import * as ort from 'onnxruntime-web'; 

function App() {

async function runTextToImageWASM(promptText) {
    try {
        // 1. Create an inference session with the ONNX model
        // The model.onnx file would be your pre-trained text-to-image model
        // converted to ONNX format and placed in your web server's public path.
        const session = await ort.InferenceSession.create('./path/to/your_model.onnx', {
            executionProviders: ['wasm'], // Use WebAssembly backend
            // graphOptimizationLevel: 'all' // Optional: for performance
        });
        console.log("ONNX session created.");

        // 2. Pre-process the input text
        // This is highly model-specific. You'll need a tokenizer and a way
        // to convert text to the tensor format your model expects.
        // For simplicity, let's assume a function preprocessText exists.
        const inputTensor = await preprocessTextToExpectedTensor(promptText, session.inputNames[0]); // Placeholder

        if (!inputTensor) {
            console.error("Failed to create input tensor.");
            return null;
        }

        const feeds = {};
        feeds[session.inputNames[0]] = inputTensor;

        // 3. Run inference
        console.log("Running model inference...");
        const results = await session.run(feeds);
        console.log("Inference complete.");

        // 4. Post-process the output
        // This is also highly model-specific. The output might be raw pixel data,
        // probabilities, etc., that you need to convert into a displayable image.
        // Let's assume a function postprocessOutputToImage exists.
        const outputTensor = results[session.outputNames[0]];
        const imageElement = await postprocessOutputToTensorToImage(outputTensor); // Placeholder

        return imageElement;

    } catch (e) {
        console.error(`Failed to run ONNX model: ${e}`);
        // Display error to user
        document.getElementById('status').innerText = `Error: ${e.message}`;
        return null;
    }
}

async function preprocessTextToExpectedTensor(text, inputName) {
    console.log(`Preprocessing text for input: ${inputName}, text: "${text}"`);
    // Example: If your model expects a tensor of shape [1, sequence_length] with int32 token IDs
    // This is a VAST simplification. Real tokenization is complex.
    const tokenizedText = text.split('').map(char => char.charCodeAt(0) % 100); // Highly simplistic tokenization
    const sequenceLength = 64; // Example, model dependent
    const paddedTokens = new Array(sequenceLength).fill(0);
    for (let i = 0; i < Math.min(tokenizedText.length, sequenceLength); i++) {
        paddedTokens[i] = tokenizedText[i];
    }
    const data = Int32Array.from(paddedTokens);
    return new ort.Tensor('int32', data, [1, sequenceLength]);
}

// Placeholder for output postprocessing:
// The output tensor needs to be converted to an image.
// This depends heavily on the model's output format (e.g., [batch, height, width, channels]).
async function postprocessOutputToTensorToImage(tensor) {
    console.log("Postprocessing output tensor:", tensor);
    // Assuming tensor.data contains pixel values (e.g., RGB) and tensor.dims gives dimensions.
    // This is a very simplified example of creating a canvas and drawing pixels.
    // A real implementation would handle normalization, color spaces, etc.
    const [batchSize, channels, height, width] = tensor.dims; // Or [b,h,w,c] depending on model
    if (batchSize !== 1) console.warn("Batch size is not 1, displaying first image only.");

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data; // Uint8ClampedArray: R, G, B, A, R, G, B, A...

    // Assuming tensor.data is Float32Array of normalized pixel values (0-1)
    // And model output is in CHW (Channels, Height, Width) format
    const pixelData = tensor.data;

    if (channels === 3) { // RGB
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const rIdx = (0 * height * width) + (y * width) + x;
                const gIdx = (1 * height * width) + (y * width) + x;
                const bIdx = (2 * height * width) + (y * width) + x;
                const dataIdx = (y * width + x) * 4;
                data[dataIdx]     = pixelData[rIdx] * 255; // R
                data[dataIdx + 1] = pixelData[gIdx] * 255; // G
                data[dataIdx + 2] = pixelData[bIdx] * 255; // B
                data[dataIdx + 3] = 255;                   // Alpha (opaque)
            }
        }
    } else if (channels === 1) { // Grayscale
         for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const valIdx = (y * width) + x;
                const dataIdx = (y * width + x) * 4;
                const intensity = pixelData[valIdx] * 255;
                data[dataIdx]     = intensity; // R
                data[dataIdx + 1] = intensity; // G
                data[dataIdx + 2] = intensity; // B
                data[dataIdx + 3] = 255;       // Alpha
            }
        }
    } else {
        console.error("Unsupported channel count:", channels);
        return null;
    }

    ctx.putImageData(imageData, 0, 0);
    const img = document.createElement('img');
    img.src = canvas.toDataURL();
    return img;
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
scr.type = 'module';
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


  document.getElementById('generateButton').addEventListener('click', async () => {
    const prompt = document.getElementById('promptInput').value;
    if (!prompt) {
        alert("Please enter a prompt.");
        return;
    }
    document.getElementById('status').innerText = "Loading model and generating...";
    document.getElementById('imageOutput').innerHTML = ""; // Clear previous image
    const imageElement = await runTextToImageWASM(prompt);
    if (imageElement) {
        document.getElementById('imageOutput').appendChild(imageElement);
        document.getElementById('status').innerText = "Image generated!";
    } else {
        document.getElementById('status').innerText = "Failed to generate image. Check console for errors.";
    }
});

  
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

<div style={{ marginTop: '20px', padding: '15px', borderTop: '1px solid #ddd', backgroundColor: 'rgba(230, 240, 250, 0.9)' }}>

<input type="text" id="promptInput" placeholder="Enter text prompt" /> 
<button id="generateButton"></button>
<div id="status"></div>
<div id="imageOutput"></div>
        
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
    value={webSpeechApiDedicatedInput} // Use the new state here
    onChange={(e) => setWebSpeechApiDedicatedInput(e.target.value)} // Update the new state
    placeholder="Enter text for browser TTS..."
    rows={3}
    style={{ width: '100%', padding: '8px', boxSizing: 'border-box', marginBottom: '10px' }}
    disabled={isSpeaking} // Or a dedicated isWebSpeaking state
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
