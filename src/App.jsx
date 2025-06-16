import { useState, useRef, useEffect, useCallback,useLayoutEffect } from 'react'

import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgpu';

import Box from '@mui/material/Box';
import Slider from '@mui/material/Slider';
import './App.css'

function App() {
useLayoutEffect(() => {

  
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

// --- Model and Tokenizer Configuration ---
// IMPORTANT: Replace these URLs with the actual URLs to your model.json,
// char_indices.json, and indices_char.json if you host them yourself
// or find a working set from tfjs-examples.
const MODEL_URL = 'https://storage.googleapis.com/tfjs-examples/lstm-text-generation/char-rnn-nietzsche/model.json';
const CHAR_INDICES_URL = 'https://storage.googleapis.com/tfjs-examples/lstm-text-generation/char-rnn-nietzsche/char_indices.json';
const INDICES_CHAR_URL = 'https://storage.googleapis.com/tfjs-examples/lstm-text-generation/char-rnn-nietzsche/indices_char.json';

const statusDiv = document.getElementById('status');
const generateButton = document.getElementById('generateButton');
const outputTextDiv = document.getElementById('outputText');
const seedTextInput = document.getElementById('seedText');
const generateLengthInput = document.getElementById('generateLength');
const temperatureInput = document.getElementById('temperature');

let model;
let charIndices; // Map: char -> index
let indicesChar; // Array or Map: index -> char
let maxLen; // Max length of sequence the model was trained on

async function setupWebGPUBackend() {
    try {
        await tf.setBackend('webgpu');
        await tf.ready(); // Wait for backend to be ready
        statusDiv.textContent = `Using backend: ${tf.getBackend()}. WebGPU is ready.`;
        console.log('WebGPU backend set successfully.');
        return true;
    } catch (error) {
        console.error('Failed to set WebGPU backend:', error);
        statusDiv.textContent = 'Error: Could not initialize WebGPU backend. Falling back to WASM or CPU.';
        // Fallback to WASM or CPU if WebGPU is not available
        await tf.setBackend('wasm');
        await tf.ready();
        statusDiv.textContent += ` Using fallback backend: ${tf.getBackend()}.`;
        console.log('Using fallback backend:', tf.getBackend());
        return false;
    }
}

async function loadModelAndTokenizer() {
    if (model && charIndices && indicesChar) {
        return; // Already loaded
    }
    try {
        statusDiv.textContent = 'Loading model...';
        model = await tf.loadLayersModel(MODEL_URL);
        // The model summary will show input shape, e.g., [null, maxLen, vocabSize]
        // We need maxLen from the model's input shape if not known
        // Assuming input shape is [batchSize, sequenceLength, features]
        maxLen = model.inputs[0].shape[1]; // e.g., 40 for Nietzsche model
        if (!maxLen) {
            console.warn("Could not determine maxLen from model, defaulting to 40. Ensure this is correct.");
            maxLen = 40; // Default, ensure this matches your model
        }

        statusDiv.textContent = 'Loading tokenizer vocabulary...';
        const charIndicesResponse = await fetch(CHAR_INDICES_URL);
        charIndices = await charIndicesResponse.json();

        const indicesCharResponse = await fetch(INDICES_CHAR_URL);
        indicesChar = await indicesCharResponse.json(); // This is often an array/object where index maps to char

        statusDiv.textContent = 'Model and tokenizer loaded successfully!';
        generateButton.disabled = false;
    } catch (error) {
        console.error('Error loading model or tokenizer:', error);
        statusDiv.textContent = `Error: ${error.message}`;
        generateButton.disabled = true;
    }
}

function preprocessText(text, maxLength) {
    const lowerText = text.toLowerCase();
    let sequence = [];
    for (let i = 0; i < lowerText.length; i++) {
        const char = lowerText[i];
        if (charIndices[char] !== undefined) {
            sequence.push(charIndices[char]);
        } else {
            sequence.push(charIndices[' ']); // Use space for unknown characters
        }
    }
    // Pad or truncate sequence to maxLength
    if (sequence.length > maxLength) {
        sequence = sequence.slice(sequence.length - maxLength);
    } else {
        while (sequence.length < maxLength) {
            sequence.unshift(0); // Pad with 0 (often representing a padding char or space)
        }
    }
    return sequence;
}

/**
 * Sample a token index from a probability distribution (logits).
 * @param {tf.Tensor} preds Logits/predictions from the model.
 * @param {number} temperature Controls randomness. Higher values (e.g., 1.0) make output more random,
 * lower values (e.g., 0.2) make it more deterministic.
 * @returns {number} The index of the sampled token.
 */
function sample(preds, temperature) {
    return tf.tidy(() => {
        // Softmax with temperature
        const logits = tf.div(preds, Math.max(temperature, 1e-6)); // Ensure temperature is not zero
        const probabilities = tf.softmax(logits);
        // Multinomial sampling (draws one sample)
        const nextTokenTensor = tf.multinomial(probabilities, 1);
        return nextTokenTensor.dataSync()[0];
    });
}


async function generateText(seed, length, temperature) {
    if (!model) {
        statusDiv.textContent = 'Model not loaded yet.';
        return 'Error: Model not available.';
    }

    generateButton.disabled = true;
    statusDiv.textContent = 'Generating text...';
    outputTextDiv.textContent = seed;

    let inputText = seed.toLowerCase();
    let generatedText = seed;

    // Prepare initial input sequence
    let currentSequence = preprocessText(inputText, maxLen);

    for (let i = 0; i < length; i++) {
        // Reshape sequence to [1, maxLen, vocabSize]
        // For char-level, vocabSize is implicit in one-hot encoding
        // Input tensor should be [1, maxLen] with indices
        const inputTensor = tf.tensor2d([currentSequence], [1, maxLen], 'int32');

        // Predict the next character
        const prediction = model.predict(inputTensor);

        // The output shape from LSTM is usually [batchSize, sequenceLength, numFeatures]
        // For char prediction, it's [1, maxLen, vocabSize]
        // We want the prediction for the *last* character in the sequence.
        const lastPrediction = tf.slice(prediction, [0, maxLen - 1, 0], [1, 1, Object.keys(charIndices).length]).squeeze();

        // Sample the next character index
        const nextCharIndex = sample(lastPrediction, temperature);
        const nextChar = indicesChar[nextCharIndex.toString()]; // Ensure index is string if indicesChar is object

        generatedText += nextChar;
        outputTextDiv.textContent = generatedText; // Update UI progressively

        // Update the current sequence for the next prediction
        currentSequence.shift();
        currentSequence.push(nextCharIndex);

        // Dispose tensors to free WebGPU memory
        tf.dispose(inputTensor);
        tf.dispose(prediction);
        tf.dispose(lastPrediction);

        // Allow UI to update
        await tf.nextFrame();
    }

    statusDiv.textContent = 'Text generation complete.';
    generateButton.disabled = false;
    return generatedText;
}

// --- Event Listeners and Initialization ---
generateButton.addEventListener('click', async () => {
    const seed = seedTextInput.value;
    const length = parseInt(generateLengthInput.value, 10);
    const temp = parseFloat(temperatureInput.value);

    if (seed && length > 0) {
        await generateText(seed, length, temp);
    } else {
        alert('Please provide seed text and a valid length.');
    }
});

async function main() {
    generateButton.disabled = true; // Disable until everything is ready
    await setupWebGPUBackend();
    await loadModelAndTokenizer();
}

main();
  
}, [])
  
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
<input type={'button'} id={'generateButton'} style={{backgroundColor:'gold',position:'absolute',display:'block',left:'3%',top:'3%',zIndex:3200,border:'4px solid #e7e7e7',borderRadius:'27%'}}></input>
<input type={'button'} id={'startBtn'} style={{backgroundColor:'gold',position:'absolute',display:'block',left:'6%',top:'9%',zIndex:3200,border:'4px solid #e7e7e7',borderRadius:'17%'}}></input>
<input type={'button'} id={'startBtnB'} style={{backgroundColor:'gold',position:'absolute',display:'block',left:'6%',top:'19%',zIndex:3200,border:'4px solid #e7e7e7',borderRadius:'17%'}}></input>
<input type={'button'} id={'startBtnPM'} style={{backgroundColor:'gold',position:'absolute',display:'block',left:'16%',top:'9%',zIndex:3200,border:'4px solid #e7e7e7',borderRadius:'17%'}}></input>
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
<div id={'modulePath'} hidden>https://wasm.noahcohn.com/b3hd/w0-035-mod.3ijs</div>
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

export default App
