import { useState, useRef, useEffect, useCallback } from 'react';
import { pipeline, env, Tensor } from '@xenova/transformers';
import Box from '@mui/material/Box';
import Slider from '@mui/material/Slider';
import './App.css';

import * as ort from 'onnxruntime-web';

function App() {
    // --- State Variables from JSX ---
    const [preferredTtsEngine, setPreferredTtsEngine] = useState('webSpeechAPI');
    const [webSpeechApiDedicatedInput, setWebSpeechApiDedicatedInput] = useState('');
    const [isTtsSpeaking, setIsTtsSpeaking] = useState(false); // General TTS speaking state
    const [isWebSpeechApiSpeaking, setIsWebSpeechApiSpeaking] = useState(false);
    const [selectedVoiceURI, setSelectedVoiceURI] = useState('');
    const [availableVoices, setAvailableVoices] = useState([]);

    const [transformersTtsInput, setTransformersTtsInput] = useState('');
    const [ttsPipelineInstance, setTtsPipelineInstance] = useState(null);
    const [speakerEmbeddings, setSpeakerEmbeddings] = useState(null);

    const [llmPrompt, setLlmPrompt] = useState('');
    const [llmStatusMessage, setLlmStatusMessage] = useState('Initializing models...');
    const [llmGenerator, setLlmGenerator] = useState(null);
    const [isLlmGenerating, setIsLlmGenerating] = useState(false);
    const [llmGeneratedOutput, setLlmGeneratedOutput] = useState('');
    const llmPromptTextareaRef = useRef(null);

    const [isSttListening, setIsSttListening] = useState(false);
    const [sttError, setSttError] = useState('');
    const recognitionRef = useRef(null);

    const [onnxImageSrc, setOnnxImageSrc] = useState('');
    const [onnxStatus, setOnnxStatus] = useState('');
    const onnxPromptInputRef = useRef(null);


    // --- ONNX Text-to-Image Functions ---
    async function runTextToImageWASM(promptText) {
        setOnnxStatus("Starting ONNX model...");
        try {
            const modelPath = './your_model.onnx'; // IMPORTANT: Update this path
            
            setOnnxStatus("Creating ONNX session... (Ensure your_model.onnx is in public folder)");
            console.log(`Attempting to load model from: ${modelPath}`);

            const session = await ort.InferenceSession.create(modelPath, {
                executionProviders: ['wasm'],
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
        const tokenizedText = text.split('').map(char => char.charCodeAt(0) % 100);
        const sequenceLength = 64; 
        const paddedTokens = new Array(sequenceLength).fill(0);
        for (let i = 0; i < Math.min(tokenizedText.length, sequenceLength); i++) {
            paddedTokens[i] = tokenizedText[i];
        }
        const data = Int32Array.from(paddedTokens);
        return new ort.Tensor('int32', data, [1, sequenceLength]);
    }

    async function postprocessOutputToTensorToImage(tensor) {
        console.log("Postprocessing output tensor:", tensor);
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
        const outputData = imageData.data; // Renamed to avoid conflict with ort.Tensor's data property
        const pixelData = tensor.data; 

        if (channels === 3) { // RGB
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const rIdx = (0 * height * width) + (y * width) + x;
                    const gIdx = (1 * height * width) + (y * width) + x;
                    const bIdx = (2 * height * width) + (y * width) + x;
                    const dataIdx = (y * width + x) * 4;

                    outputData[dataIdx]     = pixelData[rIdx] * 255; 
                    outputData[dataIdx + 1] = pixelData[gIdx] * 255; 
                    outputData[dataIdx + 2] = pixelData[bIdx] * 255; 
                    outputData[dataIdx + 3] = 255;                   
                }
            }
        } else if (channels === 1) { // Grayscale
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const valIdx = (y * width) + x;
                    const dataIdx = (y * width + x) * 4;
                    const intensity = pixelData[valIdx] * 255;
                    outputData[dataIdx]     = intensity;
                    outputData[dataIdx + 1] = intensity;
                    outputData[dataIdx + 2] = intensity;
                    outputData[dataIdx + 3] = 255;
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
    useEffect(() => {
        const imageChannel = new BroadcastChannel('imageChannel');

        const fileInputElement = document.getElementById('fileInput');
        const fileChangeHandler = (event) => {
            let file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const imageDataURL = e.target.result;
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

        const loadPathDiv = document.querySelector('#loadPath');
        let xhr; 
        if (loadPathDiv && loadPathDiv.innerHTML) {
            const xhrPath = loadPathDiv.innerHTML;
            xhr = new XMLHttpRequest(); 
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
                    scr.type = 'module'; 
                    scr.text = jsCode;
                    document.body.appendChild(scr);
                    console.log("XHR: Appended loaded script to body.");

                    if (typeof window.libload === 'function') {
                        window.Module = {}; 
                        setTimeout(function() {
                            try {
                                window.Module = window.libload();
                                console.log("Emscripten Module object:", window.Module);
                                if (window.Module && typeof window.Module.onRuntimeInitialized === 'function') { // This check is problematic if onRuntimeInitialized is a property to be set
                                    window.Module.onRuntimeInitialized = function() { // This line SETS the property
                                        console.log('Emscripten runtime initialized. Calling main.');
                                        if (typeof window.Module.callMain === 'function') {
                                            window.Module.callMain();
                                        } else {
                                            console.warn("Module.callMain is not a function.");
                                        }
                                    };
                                } else if (window.Module && window.Module.asm) { // Alternative check: if it's already somewhat initialized
                                     console.warn("Module.onRuntimeInitialized not found or not a function, attempting to call main or assuming auto-run.");
                                     // If Module.onRuntimeInitialized is a property that *should* be set by the user (as is common),
                                     // the previous block `window.Module.onRuntimeInitialized = function() { ... }` is the correct pattern.
                                     // The logic here depends on how your specific Emscripten module is structured.
                                     // For many Emscripten modules, you *set* onRuntimeInitialized.
                                     // If it's already initialized, you might not need to do anything or just callMain.
                                     if (typeof window.Module.callMain === 'function' && !window.Module.onRuntimeInitialized) {
                                        //  window.Module.callMain(); // Potentially call if not handled by onRuntimeInitialized
                                     }
                                } else {
                                    console.warn("Emscripten module loaded but 'onRuntimeInitialized' is not a function to set, or 'asm' is not present. Review module structure.");
                                }
                            } catch(e) {
                                console.error("Error during Emscripten libload/initialization:", e);
                            }
                        }, 2500); 
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

        return () => {
            if (fileInputElement) {
                fileInputElement.removeEventListener('change', fileChangeHandler);
            }
            imageChannel.close();
            if (xhr && xhr.readyState !== XMLHttpRequest.DONE) {
                xhr.abort(); 
            }
        };
    }, []); 

    const handleOnnxGenerateClick = async () => {
        if (onnxPromptInputRef.current && onnxPromptInputRef.current.value) {
            const prompt = onnxPromptInputRef.current.value;
            if (!prompt.trim()) {
                alert("Please enter a prompt for ONNX generation.");
                return;
            }
            setOnnxImageSrc(''); 
            await runTextToImageWASM(prompt);
        } else {
            alert("Please enter a prompt.");
        }
    };

    const handleWebSpeechSpeak = () => {
        if (!webSpeechApiDedicatedInput.trim() || isWebSpeechApiSpeaking || availableVoices.length === 0) return;
        setIsWebSpeechApiSpeaking(true);
        const utterance = new SpeechSynthesisUtterance(webSpeechApiDedicatedInput);
        const selected = availableVoices.find(v => v.voiceURI === selectedVoiceURI);
        if (selected) utterance.voice = selected;
        utterance.onend = () => setIsWebSpeechApiSpeaking(false);
        utterance.onerror = (e) => {
            console.error("Web Speech API error:", e);
            setIsWebSpeechApiSpeaking(false);
        };
        speechSynthesis.speak(utterance);
    };

    const handleSynthesizeSpeech = async () => {
        if (!ttsPipelineInstance || !speakerEmbeddings || !transformersTtsInput.trim() || isTtsSpeaking) return;
        setIsTtsSpeaking(true);
        setLlmStatusMessage(prev => prev + "\nSynthesizing speech with Transformers.js...");
        try {
            const result = await ttsPipelineInstance(transformersTtsInput, { speaker_embeddings: speakerEmbeddings });
            const audioBlob = new Blob([result.audio], { type: 'audio/wav' });
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            audio.play();
            audio.onended = () => {
                setIsTtsSpeaking(false);
                URL.revokeObjectURL(audioUrl);
            };
            audio.onerror = () => {
                setIsTtsSpeaking(false);
                URL.revokeObjectURL(audioUrl);
                console.error("Error playing synthesized audio.");
            };
        } catch (error) {
            console.error("Error synthesizing speech with Transformers.js:", error);
            setIsTtsSpeaking(false);
        }
        setLlmStatusMessage(prev => prev.replace("\nSynthesizing speech with Transformers.js...", "\nSpeech synthesis attempt complete."));
    };
    
    const handleGenerateText = async () => {
        if (!llmGenerator || !llmPrompt.trim() || isLlmGenerating) return;
        setIsLlmGenerating(true);
        setLlmStatusMessage("Generating text with LaMini...");
        setLlmGeneratedOutput('');
        try {
            const outputs = await llmGenerator(llmPrompt, { max_new_tokens: 100 });
            if (outputs && outputs.length > 0 && outputs[0].generated_text) {
                const generatedText = outputs[0].generated_text;
                setLlmGeneratedOutput(generatedText);
                if (preferredTtsEngine === 'webSpeechAPI' && generatedText) {
                    setWebSpeechApiDedicatedInput(generatedText); 
                    // To auto-speak, you might call handleWebSpeechSpeak() here,
                    // or better, use a useEffect to trigger speak when webSpeechApiDedicatedInput changes
                    // and some other condition (e.g., an 'autoSpeakNextLlmOutput' state) is true.
                } else if (preferredTtsEngine === 'transformersJS' && ttsPipelineInstance && generatedText) {
                    setTransformersTtsInput(generatedText); 
                    // Similar logic for auto-speaking with Transformers.js TTS
                }
            } else {
                setLlmGeneratedOutput("No text generated or unexpected output format.");
            }
        } catch (error) {
            console.error("Error generating text with LaMini:", error);
            setLlmGeneratedOutput(`Error: ${error.message}`);
        }
        setIsLlmGenerating(false);
        setLlmStatusMessage("Text generation complete. Model ready.");
    };

    const toggleListen = () => {
        if (!recognitionRef.current) {
            setSttError("STT not initialized.");
            return;
        }
        if (isSttListening) {
            recognitionRef.current.stop();
            // onend will set isSttListening to false
        } else {
            try {
                recognitionRef.current.start();
                setIsSttListening(true);
                setSttError('');
            } catch(e) {
                console.error("Error starting STT:", e);
                setSttError(`Error starting STT: ${e.message}. Might be already started or an issue with permissions.`);
                setIsSttListening(false); 
            }
        }
    };

    useEffect(() => {
        // Corrected: remove quotes from function name
        const loadVoices = () => {
            const voices = speechSynthesis.getVoices();
            if (voices.length > 0) {
                setAvailableVoices(voices);
                const defaultVoice = voices.find(v => v.default) || voices[0];
                if (defaultVoice) setSelectedVoiceURI(defaultVoice.voiceURI);
            }
        };
        loadVoices(); 
        speechSynthesis.onvoiceschanged = loadVoices; 
        return () => { speechSynthesis.onvoiceschanged = null; };
    }, []);

    useEffect(() => {
        if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
            const SpeechRecognitionApi = window.SpeechRecognition || window.webkitSpeechRecognition;
            recognitionRef.current = new SpeechRecognitionApi();
            recognitionRef.current.continuous = false;
            recognitionRef.current.interimResults = false;
            recognitionRef.current.lang = 'en-US';

            recognitionRef.current.onresult = (event) => {
                const transcript = event.results[event.results.length - 1][0].transcript.trim();
                setLlmPrompt(prev => prev ? `${prev} ${transcript}` : transcript); 
                // No setIsSttListening(false) here; let onend handle it.
            };
            recognitionRef.current.onerror = (event) => {
                console.error('STT Error:', event.error);
                setSttError(`STT Error: ${event.error}`);
                setIsSttListening(false); // Explicitly set on error
            };
            recognitionRef.current.onend = () => {
                 // This is called when recognition stops, either manually or automatically.
                setIsSttListening(false);
            };
        } else {
            setSttError('STT API not supported in this browser.');
        }
        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.abort(); 
            }
        };
    }, []); // Run once on mount

    useEffect(() => {
        // Corrected: remove quotes from function name
        async function loadGenerator() {
            try {
                env.allowLocalModels = false; 
                env.useBrowserCache = true;   
                
                setLlmStatusMessage("Loading LLM (LaMini-Flan-T5-783M)...");
                const generatorInstance = await pipeline('text2text-generation', 'Xenova/LaMini-Flan-T5-783M', {
                    progress_callback: (p) => setLlmStatusMessage(`Loading LLM: ${p.file} (${Math.round(p.progress)}%)`)
                });
                setLlmGenerator(() => generatorInstance);
                setLlmStatusMessage("LLM (LaMini) loaded. Ready.");
            } catch (e) {
                console.error("Failed to load LLM:", e);
                setLlmStatusMessage(`Failed to load LLM: ${e.message}`);
            }
        }
        loadGenerator();
    }, []);
    
    useEffect(() => {
        // Corrected: remove quotes from function name
        async function loadTTSPipeline() {
            try {
                setLlmStatusMessage(prev => prev.includes("Loading TTS model") ? prev : prev + "\nLoading TTS model (SpeechT5)...");
                const tts = await pipeline('text-to-speech', 'Xenova/speecht5_tts', {
                    quantized: true, 
                    progress_callback: (p) => console.log(`TTS Model loading: ${p.file} (${Math.round(p.progress)}%)`)
                });
                setTtsPipelineInstance(() => tts);

                const speaker_embeddings_url = 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/speaker_embeddings.bin';
                const speaker_response = await fetch(speaker_embeddings_url);
                const speaker_array_buffer = await speaker_response.arrayBuffer();
                const embeds = new Tensor('float32', new Float32Array(speaker_array_buffer), [1, 512]);
                setSpeakerEmbeddings(embeds);
                
                setLlmStatusMessage(prev => prev.replace("\nLoading TTS model (SpeechT5)...", "\nTTS Model loaded."));
                console.log("Transformers.js TTS Pipeline and speaker embeddings loaded.");
            } catch (e) {
                console.error("Failed to load Transformers.js TTS or speaker embeddings:", e);
                setLlmStatusMessage(prev => prev + `\nFailed to load TTS: ${e.message}`);
            }
        }
        loadTTSPipeline();
    }, []);

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
                <input type={'button'} id={'startBtn'} value="S1" style={{ backgroundColor: 'gold', position: 'absolute', display: 'block', left: '6%', top: '9%', zIndex: 3200, border: '4px solid #e7e7e7', borderRadius: '17%' }} />
                <input type="file" id={"fileInput"} style={{ zIndex: 5000, position: 'absolute', left: '50vh', top: '16vh' }} />


                <div id={'loadPath'} hidden>https://wasm.noahcohn.com/b3hd/w0-035-load-32.3ijs</div>


                <div id={'wrap'}>
                    <div id={'contain1'}>
                        <canvas className='emscripten' id={'scanvas'} style={{ pointerEvents: 'auto', display: 'block', position: 'absolute', zIndex: 3000, backgroundColor: 'rgba(233,233,233,1.0)', top: '0', height: '100vh', width: '100vw', imageRendering: 'auto', transform: 'scaleY(1.0)' }}></canvas>
                        
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
                        

                        <div style={{ padding: '10px 0', borderBottom: '1px solid #ddd', marginBottom: '15px', backgroundColor: 'rgba(230, 240, 250, 0.9)', position:'relative', zIndex: 3100 }}>
                            <h4>Auto-Speak Engine after LLM Generation:</h4>
                            <label style={{ marginRight: '15px', cursor: 'pointer' }}>
                                <input type="radio" name="ttsEnginePref" value="webSpeechAPI" checked={preferredTtsEngine === 'webSpeechAPI'} onChange={() => setPreferredTtsEngine('webSpeechAPI')} /> Browser Built-in
                            </label>
                            <label style={{ cursor: 'pointer' }}>
                                <input type="radio" name="ttsEnginePref" value="transformersJS" checked={preferredTtsEngine === 'transformersJS'} onChange={() => setPreferredTtsEngine('transformersJS')} disabled={!ttsPipelineInstance || !speakerEmbeddings} /> Transformers.js (SpeechT5)
                            </label>
                        </div>

                        <div style={{ marginTop: '20px', padding: '15px', borderTop: '1px solid #ddd', backgroundColor: 'rgba(230, 240, 250, 0.9)', position:'relative', zIndex: 3100 }}>
                            <h2>Text to Speech (Browser Built-in)</h2>
                            <textarea value={webSpeechApiDedicatedInput} onChange={(e) => setWebSpeechApiDedicatedInput(e.target.value)} placeholder="Enter text for browser TTS..." rows={3} style={{ width: '100%', padding: '8px', boxSizing: 'border-box', marginBottom: '10px' }} disabled={isWebSpeechApiSpeaking} />
                            <div style={{ marginBottom: '10px' }}>
                                <label htmlFor="voice-select-webapi" style={{ marginRight: '10px' }}>Voice:</label>
                                <select id="voice-select-webapi" value={selectedVoiceURI} onChange={(e) => setSelectedVoiceURI(e.target.value)} style={{ padding: '8px', width: 'calc(100% - 70px)' }} disabled={availableVoices.length === 0 || isWebSpeechApiSpeaking}>
                                    {availableVoices.length === 0 && <option value="">Loading voices...</option>}
                                    {availableVoices.map((voice) => (
                                        <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name} ({voice.lang}) {voice.default ? '[Default]' : ''}</option>
                                    ))}
                                </select>
                            </div>
                            <button onClick={handleWebSpeechSpeak} disabled={isWebSpeechApiSpeaking || !webSpeechApiDedicatedInput.trim() || availableVoices.length === 0} style={{ padding: '10px 15px', width: '100%' }}>
                                {isWebSpeechApiSpeaking ? 'Speaking...' : 'Speak Text (Browser)'}
                            </button>
                        </div>
                    </div>

                    <div style={{ position: 'fixed', bottom: '10px', left: '10px', right: '10px', padding: '15px', backgroundColor: 'rgba(250, 250, 250, 0.97)', border: '1px solid #ccc', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 6000, display: 'flex', flexDirection: 'column', gap: '10px', pointerEvents: 'auto', maxHeight: 'calc(100vh - 40px)', overflowY: 'auto' }}>
                        <h2>LLM Text Generation (LaMini-Flan-T5-783M)</h2>
                        <div id="llmStatusDisplay" style={{ fontStyle: 'italic', marginBottom: '5px', whiteSpace: 'pre-wrap'}}>{llmStatusMessage}</div>
                        <textarea ref={llmPromptTextareaRef} value={llmPrompt} onChange={(e) => setLlmPrompt(e.target.value)} placeholder="Enter prompt or use Speech-to-Text..." rows={3} style={{ width: '100%', padding: '8px', boxSizing: 'border-box', pointerEvents: 'auto', border:'1px solid #ddd', borderRadius:'4px' }} disabled={!llmGenerator || isLlmGenerating} />
                        <button onClick={handleGenerateText} disabled={!llmGenerator || isLlmGenerating || !llmPrompt.trim()} style={{ padding: '10px 15px', cursor: (!llmGenerator || isLlmGenerating || !llmPrompt.trim()) ? 'not-allowed' : 'pointer' }}>
                            {isLlmGenerating ? 'Generating...' : 'Generate Text (LLM)'}
                        </button>
                        
                        <div style={{ marginTop: '5px', paddingTop: '5px', borderTop: '1px solid #eee' }}>
                            <button onClick={toggleListen} disabled={!recognitionRef.current || isLlmGenerating } style={{ pointerEvents: 'auto' }}>
                                {isSttListening ? 'Stop Listening' : 'Start STT (for LLM Prompt)'}
                            </button>
                            {isSttListening && <span style={{marginLeft:'10px'}}><i>Listening for LLM prompt...</i></span>}
                            {sttError && <p style={{ color: 'red', marginTop:'5px' }}>{sttError}</p>}
                        </div>
                        <h3>LLM Output:</h3>
                        <div style={{ minHeight: '50px', padding: '10px', border: '1px solid #eee', backgroundColor: '#f9f9f9', whiteSpace: 'pre-wrap', wordBreak: 'break-word', borderRadius:'4px' }}>{llmGeneratedOutput}</div>

                        <div style={{ marginTop: '10px', padding: '15px', borderTop: '1px solid #ddd', backgroundColor: 'rgba(230, 250, 230, 0.95)', borderRadius:'4px' }}>
                            <h2>Text to Speech (Transformers.js - SpeechT5)</h2>
                            <textarea value={transformersTtsInput} onChange={(e) => setTransformersTtsInput(e.target.value)} placeholder="Enter text to synthesize with Transformers.js..." rows={3} style={{ width: '100%', padding: '8px', boxSizing: 'border-box', marginBottom: '10px', pointerEvents: 'auto', border:'1px solid #ddd', borderRadius:'4px' }} disabled={!ttsPipelineInstance || isTtsSpeaking} />
                            <button onClick={handleSynthesizeSpeech} disabled={!ttsPipelineInstance || !speakerEmbeddings || isTtsSpeaking || !transformersTtsInput.trim()} style={{ padding: '10px 15px' }}>
                                {isTtsSpeaking ? 'Synthesizing...' : 'Synthesize & Play (Transformers.js)'}
                            </button>
                        </div>
                    </div>
                    
                    <div id={'contain1a'} style={{ height: '75%', width: '75%' }}></div> {/* This div might need specific content or purpose */}
                </div>
                <div id={'contain2'}> {/* This div might need specific content or purpose */}
                    <canvas id={'bcanvas'} hidden style={{ pointerEvents: 'none', display: 'none', zIndex: 2100, position: 'absolute', height: '100vh', width: '100vw', marginLeft: 'auto', marginRight: 'auto', backgroundColor: 'rgba(0,255,0,1.0)', top: '0', imageRendering: 'auto' }}></canvas>
                    {/* The img#resultImage seems redundant if onnxImageSrc is used for the ONNX output. Consider removing or repurposing. */}
                    {/* <img id={'resultImage'} src={''} alt="Result" style={{display: onnxImageSrc ? 'none': 'block'}} /> */}
                </div>
            </main>

            <div style={{pointerEvents:'none', display:'none'}}>
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
