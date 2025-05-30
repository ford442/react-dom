import { useState, useRef, useEffect, useCallback } from 'react';
// Removed: import { pipeline, env, Tensor } from '@xenova/transformers'; // No longer needed if TTS/LLM from Transformers.js are removed
import Box from '@mui/material/Box';
import Slider from '@mui/material/Slider';
import './App.css';

import * as ort from 'onnxruntime-web';

function App() {
    // --- State Variables ---
    // Kept state for ONNX Text-to-Image
    const [onnxImageSrc, setOnnxImageSrc] = useState('');
    const [onnxStatus, setOnnxStatus] = useState('');
    const onnxPromptInputRef = useRef(null);

    // Removed TTS and LLM related state variables:
    // preferredTtsEngine, webSpeechApiDedicatedInput, isTtsSpeaking, isWebSpeechApiSpeaking,
    // selectedVoiceURI, availableVoices, transformersTtsInput, ttsPipelineInstance,
    // speakerEmbeddings, llmPrompt, llmStatusMessage, llmGenerator, isLlmGenerating,
    // llmGeneratedOutput, isSttListening, sttError

    // Removed TTS and LLM related refs:
    // llmPromptTextareaRef, recognitionRef


    // --- ONNX Text-to-Image Functions (defined inside App or passed dependencies) ---
    async function runTextToImageWASM(promptText) {
        setOnnxStatus("Starting ONNX model...");
        try {
            // Ensure the model path is correct and accessible from your public folder.
            // For development, place 'your_model.onnx' in the 'public' directory.
            const modelPath = './your_model.onnx'; // IMPORTANT: Update this path
            
            setOnnxStatus("Creating ONNX session... (Ensure your_model.onnx is in public folder)");
            console.log(`Attempting to load model from: ${modelPath}`);

            const session = await ort.InferenceSession.create(modelPath, {
                executionProviders: ['wasm'], // or ['webgl'] for potential GPU acceleration
                // graphOptimizationLevel: 'all'
            });
            console.log("ONNX session created.");
            setOnnxStatus("ONNX session created.");

            setOnnxStatus("Preprocessing text...");
            const inputTensor = await preprocessTextToExpectedTensor(promptText, session.inputNames[0]);

            if (!inputTensor) {
                console.error("Failed to create input tensor.");
                setOnnxStatus("Error: Failed to create input tensor.");
                return null;
            }

            const feeds = {};
            feeds[session.inputNames[0]] = inputTensor;

            setOnnxStatus("Running model inference...");
            console.log("Running model inference...");
            const results = await session.run(feeds);
            console.log("Inference complete.");
            setOnnxStatus("Inference complete. Postprocessing...");

            const outputTensor = results[session.outputNames[0]];
            const imageElement = await postprocessOutputToTensorToImage(outputTensor);
            
            if (imageElement) {
                setOnnxImageSrc(imageElement.src);
                setOnnxStatus("Image generated!");
            } else {
                setOnnxStatus("Failed to postprocess output to image.");
            }

        } catch (e) {
            console.error(`Failed to run ONNX model: ${e}`);
            setOnnxStatus(`Error: ${e.message}. Check console & model path.`);
            if (e.message.includes("no such file or directory") || e.message.includes("404")) {
                setOnnxStatus(`Error: Model file not found at specified path. Ensure './your_model.onnx' is in the public folder and the path is correct.`);
            }
        }
    }

    async function preprocessTextToExpectedTensor(text, inputName) {
        console.log(`Preprocessing text for input: ${inputName}, text: "${text}"`);
        // This is a VAST simplification. Real tokenization is complex and model-specific.
        // You will need to replace this with the actual tokenizer and preprocessing
        // logic required by your specific ONNX text-to-image model.
        const tokenizedText = text.split('').map(char => char.charCodeAt(0) % 100);
        const sequenceLength = 64; // Example: This must match your model's expected input shape
        const paddedTokens = new Array(sequenceLength).fill(0);
        for (let i = 0; i < Math.min(tokenizedText.length, sequenceLength); i++) {
            paddedTokens[i] = tokenizedText[i];
        }
        // The data type (e.g., 'int32', 'float32') must also match your model.
        const data = Int32Array.from(paddedTokens);
        // The ort.Tensor constructor might be imported or available if onnxruntime-web is correctly set up
        return new ort.Tensor('int32', data, [1, sequenceLength]); // Shape [batch_size, sequence_length]
    }

    async function postprocessOutputToTensorToImage(tensor) {
        console.log("Postprocessing output tensor:", tensor);
        // This function heavily depends on your model's output format.
        // (e.g., shape, data type, normalization, color order RGB/BGR).
        // Assuming tensor.data contains normalized pixel values (0-1)
        // And model output is in NCHW (Batch, Channels, Height, Width) format.
        if (!tensor || !tensor.dims || !tensor.data) {
            console.error("Invalid tensor for postprocessing.");
            return null;
        }

        const [batchSize, channels, height, width] = tensor.dims;
        if (batchSize !== 1) console.warn("Batch size is not 1, displaying first image only.");

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(width, height);
        const outputImageData = imageData.data; // Renamed to avoid conflict with tensor.data
        const pixelData = tensor.data; // Should be TypedArray (e.g., Float32Array)

        if (channels === 3) { // RGB
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const rIdx = (0 * height * width) + (y * width) + x;
                    const gIdx = (1 * height * width) + (y * width) + x;
                    const bIdx = (2 * height * width) + (y * width) + x;
                    const dataIdx = (y * width + x) * 4;

                    outputImageData[dataIdx]     = pixelData[rIdx] * 255; // R
                    outputImageData[dataIdx + 1] = pixelData[gIdx] * 255; // G
                    outputImageData[dataIdx + 2] = pixelData[bIdx] * 255; // B
                    outputImageData[dataIdx + 3] = 255;                   // Alpha
                }
            }
        } else if (channels === 1) { // Grayscale
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const valIdx = (y * width) + x;
                    const dataIdx = (y * width + x) * 4;
                    const intensity = pixelData[valIdx] * 255;
                    outputImageData[dataIdx]     = intensity;
                    outputImageData[dataIdx + 1] = intensity;
                    outputImageData[dataIdx + 2] = intensity;
                    outputImageData[dataIdx + 3] = 255;
                }
            }
        } else {
            console.error("Unsupported channel count in output tensor:", channels);
            return null;
        }

        ctx.putImageData(imageData, 0, 0);
        const img = document.createElement('img');
        img.src = canvas.toDataURL();
        return img;
    }


    // --- Event Handlers and Effects ---

    // useEffect for ONNX Text-to-Image button and other initial setup
    useEffect(() => {
        const imageChannel = new BroadcastChannel('imageChannel');

        const fileInputElement = document.getElementById('fileInput');
        const fileChangeHandler = (event) => {
            let file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const imageDataURL = e.target.result;
                    // Ensure depth.1ink is a valid page that can receive this message
                    // window.open('./depth.1ink'); // This might be blocked by pop-up blockers
                    console.log("Attempting to post message to imageChannel after opening ./depth.1ink");
                    setTimeout(function() {
                        imageChannel.postMessage({ imageDataURL });
                    }, 4500);
                };
                reader.readAsDataURL(file);
            }
        };
        if (fileInputElement) {
            fileInputElement.addEventListener('change', fileChangeHandler);
        } else {
            console.warn("Element with ID 'fileInput' not found.");
        }

        // XHR for loading Emscripten module (example)
        const loadPathDiv = document.querySelector('#loadPath');
        let xhr; // Declare xhr here to potentially abort it in cleanup
        if (loadPathDiv && loadPathDiv.innerHTML) {
            const xhrPath = loadPathDiv.innerHTML;
            xhr = new XMLHttpRequest(); // Assign to the outer scope xhr
            xhr.open('GET', xhrPath, true);
            xhr.responseType = 'arraybuffer';
            console.log('XHR: starting request for Emscripten loader script from', xhrPath);

            xhr.onload = function() {
                console.log('XHR: loader script loaded, status:', xhr.status);
                if (xhr.status === 200) {
                    const utf32Data = xhr.response;
                    
                    function decodeUTF32(uint8Array, isLittleEndian = true) {
                        const dataView = new DataView(uint8Array.buffer);
                        let result = "";
                        for (let i = 0; i < uint8Array.length; i += 4) {
                            let codePoint = dataView.getUint32(i, isLittleEndian);
                            result += String.fromCodePoint(codePoint);
                        }
                        return result;
                    }
                    const jsCode = decodeUTF32(new Uint8Array(utf32Data), true);
                    
                    const scr = document.createElement('script');
                    scr.type = 'module'; // Or 'text/javascript' depending on the script
                    scr.text = jsCode;
                    document.body.appendChild(scr);
                    console.log("XHR: Appended loaded script to body.");

                    // Emscripten Module initialization (example)
                    if (typeof window.libload === 'function') {
                        window.Module = {}; // Initialize an empty Module object on window
                        setTimeout(function() {
                            try {
                                window.Module = window.libload();
                                console.log("Emscripten Module object:", window.Module);
                                // Standard Emscripten pattern: set onRuntimeInitialized
                                if (window.Module) {
                                    window.Module.onRuntimeInitialized = function() {
                                        console.log('Emscripten runtime initialized. Calling main.');
                                        if (typeof window.Module.callMain === 'function') {
                                            window.Module.callMain();
                                        } else {
                                            console.warn("Module.callMain is not a function.");
                                        }
                                    };
                                    // If the module might already be initialized by the time libload returns (less common)
                                    if (window.Module.calledRun === true && typeof window.Module.callMain === 'function') {
                                        // console.log('Emscripten module already initialized, calling main directly if onRuntimeInitialized was not set.');
                                        // window.Module.callMain(); // Or this might be handled by onRuntimeInitialized if libload sets it up
                                    }
                                } else {
                                     console.warn("libload() did not return a Module object.");
                                }
                            } catch(e) {
                                console.error("Error during Emscripten libload/initialization:", e);
                            }
                        }, 2500); // Delay might be for script execution
                    } else {
                        console.warn("'libload' function not found after script execution. Emscripten module may not load.");
                    }
                } else {
                    console.error("XHR: Failed to load script, status:", xhr.status);
                }
            };
            xhr.onerror = function() {
                console.error("XHR: Network error while trying to load script from", xhrPath);
            };
            xhr.send();
        } else {
            console.warn("Element with selector '#loadPath' not found or has no content. Cannot load Emscripten module.");
        }

        // Cleanup function
        return () => {
            if (fileInputElement) {
                fileInputElement.removeEventListener('change', fileChangeHandler);
            }
            imageChannel.close();
            if (xhr && xhr.readyState !== XMLHttpRequest.DONE) {
                xhr.abort(); // Abort ongoing XHR request if component unmounts
            }
        };
    }, []); // Empty dependency array: runs once on mount and cleans up on unmount

    const handleOnnxGenerateClick = async () => {
        if (onnxPromptInputRef.current && onnxPromptInputRef.current.value) {
            const prompt = onnxPromptInputRef.current.value;
            if (!prompt.trim()) {
                alert("Please enter a prompt for ONNX generation.");
                return;
            }
            setOnnxImageSrc(''); // Clear previous image
            await runTextToImageWASM(prompt);
        } else {
            alert("Please enter a prompt.");
        }
    };

    // Removed: handleWebSpeechSpeak, handleSynthesizeSpeech, handleGenerateText, toggleListen

    // Removed useEffect hooks for:
    // - Web Speech API voice loading
    // - Speech-to-Text (STT) setup
    // - Transformers.js Text Generation Pipeline (LaMini)
    // - Transformers.js TTS Pipeline (SpeechT5)

    return (
        <>
            {/* Links and static images */}
            <link charSet={"utf-8"} crossOrigin="" rel='stylesheet' href='https://css.1ink.us/sh1.1iss' />
            <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Audiowide" />
            <img id={'splash1'} src={'./image/shroud.jpg'} style={{ backgroundColor: 'rgba(233,233,233,0.0)', display: 'block', position: 'absolute', height: '100vh', width: '100vw', zIndex: 3590, pointerEvents: 'none' }} alt="Splash Shroud" />
            <img id={'splash2'} src={'./image/spinner.gif'} style={{ backgroundColor: 'rgba(47,47,47,1.0)', display: 'block', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', position: 'absolute', height: '20vh', width: '20vh', zIndex: 3591, pointerEvents: 'none' }} alt="Loading Spinner" />

            <nav id={'menu'}>
                <section className='menu-section' id={'menu-sections'}>
                    <div style={{ textAlign: 'center' }}>TIMESLIDER</div>
                    <ul className='menu-section-list'>
                        <div id={'mnu'}>
                            <select id={'resMode'} hidden style={{ position: 'absolute', zIndex: 1, pointerEvents: 'auto' }}>
                                <option value="false">False</option>
                                <option value="true">True</option>
                            </select>
                            <div id={'slideframe'}><input type={'text'} id={'timeslider'} readOnly /></div>
                            <div id={'slideframe2'}><input type={'text'} id={'srslider'} readOnly /></div>
                            <div id={'slideframe3'}>
                                <Box sx={{ width: '15vh' }}>
                                    <Slider aria-label="TEST" defaultValue={1.0} valueLabelDisplay="auto" shiftStep={0.25} step={0.05} min={0.05} max={2.0} />
                                </Box>
                            </div>
                        </div>
                    </ul>
                </section>
            </nav>

            <main id={'panel'}>
                <iframe src={'./bezz.1ink'} id={'circle'} title='Circular mask' style={{pointerEvents:'none', border:'none', width:'100%', height:'100%'}}></iframe>
                {/* Control Buttons: Consider managing their state/visibility via React if they change */}
                <input type={'button'} id={'startBtn'} value="S1" style={{ backgroundColor: 'gold', position: 'absolute', display: 'block', left: '6%', top: '9%', zIndex: 3200, border: '4px solid #e7e7e7', borderRadius: '17%' }} />
                {/* ... other buttons ... */}
                <input type="file" id={"fileInput"} style={{ zIndex: 5000, position: 'absolute', left: '50vh', top: '16vh' }} />
                {/* <label htmlFor="fileInput" className="custom-file-upload">Select File</label> */}


                {/* Hidden div for paths (ensure these are correct and files exist if used by loaded scripts) */}
                <div id={'loadPath'} hidden>https://wasm.noahcohn.com/b3hd/w0-035-load-32.3ijs</div>
                {/* ... other hidden divs ... */}


                <div id={'wrap'}>
                    <div id={'contain1'}>
                        <canvas className='emscripten' id={'scanvas'} style={{ pointerEvents: 'auto', display: 'block', position: 'absolute', zIndex: 3000, backgroundColor: 'rgba(233,233,233,1.0)', top: '0', height: '100vh', width: '100vw', imageRendering: 'auto', transform: 'scaleY(1.0)' }}></canvas>
                        
                        {/* === ONNX Text-to-Image Section === */}
                        <div style={{ marginTop: '20px', padding: '15px', borderTop: '1px solid #ddd', backgroundColor: 'rgba(220, 230, 240, 0.9)', position:'relative', zIndex: 3100 }}>
                            <h2>ONNX Text-to-Image</h2>
                            <p><em>Note: This requires a pre-converted ONNX model (e.g., a small Stable Diffusion variant) placed in your <code>public</code> folder and correctly pathed. The preprocessing/postprocessing functions are placeholders and need to be adapted to your specific model.</em></p>
                            <input type="text" id="onnxPromptInput" ref={onnxPromptInputRef} placeholder="Enter text for ONNX model" style={{width: 'calc(100% - 120px)', padding: '8px', marginRight:'5px'}} />
                            <button id="onnxGenerateButton" onClick={handleOnnxGenerateClick} style={{padding: '8px 15px'}}>Generate (ONNX)</button>
                            <div id="onnxStatusDisplay" style={{margin: '10px 0', fontStyle: 'italic'}}>{onnxStatus}</div>
                            <div id="onnxImageOutput" style={{marginTop: '10px', textAlign:'center'}}>
                                {onnxImageSrc && <img src={onnxImageSrc} alt="Generated by ONNX" style={{maxWidth: '100%', maxHeight: '300px', border:'1px solid #ccc'}} />}
                            </div>
                        </div>
                        
                        {/* Removed TTS and LLM UI sections */}

                    </div>

                    {/* Removed the absolutely positioned panel that contained LLM and Transformers.js TTS UI */}
                    
                    <div id={'contain1a'} style={{ height: '75%', width: '75%' }}></div> {/* This div might need specific content or purpose */}
                </div>
                <div id={'contain2'}> {/* This div might need specific content or purpose */}
                    <canvas id={'bcanvas'} hidden style={{ pointerEvents: 'none', display: 'none', zIndex: 2100, position: 'absolute', height: '100vh', width: '100vw', marginLeft: 'auto', marginRight: 'auto', backgroundColor: 'rgba(0,255,0,1.0)', top: '0', imageRendering: 'auto' }}></canvas>
                    {/* The img#resultImage seems redundant if onnxImageSrc is used for the ONNX output. Consider removing or repurposing. */}
                    {/* <img id={'resultImage'} src={''} alt="Result" style={{display: onnxImageSrc ? 'none': 'block'}} /> */}
                </div>
            </main>

            {/* Other hidden images and videos */}
            <div style={{pointerEvents:'none', display:'none'}}> {/* Keep these completely out of layout if hidden */}
                <img id={"imgAnimPNG"} src={''} alt="" />
                <img id={'mvi'} src={'./image/901464_400093426755894_1205176414_o.jpg'} alt="" />
                <video hidden muted src={'./video-1456459792.mp4'} loop crossOrigin="anonymous" playsInline id={'ivi'} preload={'auto'} style={{ pointerEvents: 'none', transform: 'scaleY(-1.0)' }}></video>
                <video hidden muted crossOrigin="anonymous" playsInline id={'ldv'} preload={'auto'} style={{ pointerEvents: 'none' }}></video>
                <audio crossOrigin="anonymous" id={'track'} preload={'auto'} hidden style={{ pointerEvents: 'none' }}></audio>
            </div>
        </>
    );
}

export default App;
