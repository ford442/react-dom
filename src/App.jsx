import { useState, useCallback, useRef, useEffect } from 'react';
import { useModels } from './hooks/useModels';
import { useSpeech } from './hooks/useSpeech';
import ControlPanel from './components/ControlPanel';
import Box from '@mui/material/Box';
import Slider from '@mui/material/Slider';
import WebSpeechTTS from './components/WebSpeechTTS';
import ImageCaptioning from './components/ImageCaptioning'; // <-- IMPORT ahe new component
import TransformersTTS from './components/TransformersTTS'; // <-- IMPORT the new component
import './App.css';

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
    const {
        generator,
        statusMessage,
        ttsPipelineInstance,
        speakerEmbeddings,
        kokoroTtsInstance,
        imageCaptioner, // <-- We get the model from our hook
    } = useModels();
    const [prompt, setPrompt] = useState('');
    const [generatedOutput, setGeneratedOutput] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [currentPersonalityKey, setCurrentPersonalityKey] = useState('default');
    const [activeTtsEngine, setActiveTtsEngine] = useState('kokoro');
    const [currentProfile, setCurrentProfile] = useState(personalityProfiles.default);
    const [preferredTtsEngine, setPreferredTtsEngine] = useState('kokoro');
    const audioContextRef = useRef(null);
    const promptTextareaRef = useRef(null);
    const [webSpeechText, setWebSpeechText] = useState("Hello from the browser's built-in TTS!");
    const [isWebSpeaking, setIsWebSpeaking] = useState(false); // For Browser TTS
    const [textToSpeakInput, setTextToSpeakInput] = useState("Hello from Transformers.js!");
    const [isTtsSpeaking, setIsTtsSpeaking] = useState(false);
    const [availableVoices, setAvailableVoices] = useState([]);
    const [selectedVoiceURI, setSelectedVoiceURI] = useState('');
    const [imageToCaption, setImageToCaption] = useState(null);
    const [generatedCaption, setGeneratedCaption] = useState('');
    const [isCaptioning, setIsCaptioning] = useState(false);
    const synthRef = useRef(null);

    useEffect(() => {
        const profile = personalityProfiles[currentPersonalityKey] || personalityProfiles.default;
        setCurrentProfile(profile);

        // This part applies the theme colors from the profile
        if (profile.themeColors) {
            for (const [key, value] of Object.entries(profile.themeColors)) {
                document.documentElement.style.setProperty(key, value);
            }
        }
    }, [currentPersonalityKey]);

    const initializeAudioContext = useCallback(() => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume();
        }
        return audioContextRef.current;
    }, []);

    const playAudio = useCallback((audioArray, samplingRate) => {
        const audioCtx = initializeAudioContext();
        if (!audioCtx) return;
        const buffer = audioCtx.createBuffer(1, audioArray.length, samplingRate);
        buffer.copyToChannel(audioArray, 0);
        const sourceNode = audioCtx.createBufferSource();
        sourceNode.buffer = buffer;
        sourceNode.connect(audioCtx.destination);
        sourceNode.start();
    }, [initializeAudioContext]);

    const {
        isListening,
        sttError,
        setupSpeechRecognition,
        toggleListen,
        synthesizeAndPlayText,
        recognitionRef // <-- Get it here
    } = useSpeech(playAudio, kokoroTtsInstance, ttsPipelineInstance, speakerEmbeddings, setIsTtsSpeaking);

    const handleImageSelection = (event) => {
        const file = event.target.files[0];
        if (file) {
            setImageToCaption(file);
            setGeneratedCaption(''); // Clear previous caption
        }
    };

    const handleImageCaptioning = useCallback(async () => {
        if (!imageCaptioner || !imageToCaption) {
            // You might want to set a status message here
            return;
        }

        setIsCaptioning(true);
        setGeneratedCaption("Generating caption...");

        try {
            const imageUrl = URL.createObjectURL(imageToCaption);
            const captions = await imageCaptioner(imageUrl);
            if (captions && captions.length > 0) {
                setGeneratedCaption(captions[0].generated_text);
            } else {
                setGeneratedCaption("Could not generate a caption.");
            }
        } catch (error) {
            console.error("Error during image captioning:", error);
            setGeneratedCaption(`Error: ${error.message}`);
        } finally {
            setIsCaptioning(false);
        }
    }, [imageCaptioner, imageToCaption]);

    const handleGenerateText = useCallback(async () => {
        if (!generator || !prompt.trim()) return;
        setIsGenerating(true);
        setGeneratedOutput("Generating...");
        try {
            const fullPrompt = (currentProfile.systemPrompt || "") + " " + prompt;
            const outputs = await generator(fullPrompt, { max_new_tokens: 128 });
            const newLLMText = outputs[0].generated_text;
            setGeneratedOutput(newLLMText);
            // Logic to select the auto-speak engine
            if (preferredTtsEngine === 'kokoro' || preferredTtsEngine === 'speechT5') {
                await synthesizeAndPlayText(newLLMText, preferredTtsEngine, currentPersonalityKey);
            } else {
                // If you want to support the browser's built-in speech as an option
                // you would add the speakWithWebAPI call here.
                console.log("Web Speech API selected, but not implemented in this refactor step.");
            }
        } catch (error) {
            console.error("Error during text generation:", error);
            setGeneratedOutput(`Error: ${error.message}`);
        }
        setIsGenerating(false);
    }, [generator, prompt, synthesizeAndPlayText, preferredTtsEngine, currentPersonalityKey, currentProfile]);
    useEffect(() => {
        setupSpeechRecognition(setPrompt);
    }, [setupSpeechRecognition]);

    const speakWithWebAPI = useCallback((textToSay) => {
        if (!synthRef.current || !textToSay || !textToSay.trim()) return;
        if (synthRef.current.speaking) synthRef.current.cancel();

        const utterance = new SpeechSynthesisUtterance(textToSay);
        const selectedVoice = availableVoices.find(voice => voice.voiceURI === selectedVoiceURI);
        if (selectedVoice) {
            utterance.voice = selectedVoice;
        }

        utterance.onstart = () => setIsWebSpeaking(true);
        utterance.onend = () => setIsWebSpeaking(false);
        utterance.onerror = () => setIsWebSpeaking(false);
        synthRef.current.speak(utterance);
    }, [availableVoices, selectedVoiceURI]);

    const handleWebSpeechSpeak = () => {
        speakWithWebAPI(webSpeechText);
    };

    // Effect to get system voices
    useEffect(() => {
        synthRef.current = window.speechSynthesis;
        const populateVoices = () => {
            const voices = synthRef.current.getVoices();
            setAvailableVoices(voices);
            if (voices.length > 0 && !selectedVoiceURI) {
                const defaultVoice = voices.find(v => v.default) || voices[0];
                setSelectedVoiceURI(defaultVoice.voiceURI);
            }
        };
        populateVoices();
        if (synthRef.current.onvoiceschanged !== undefined) {
            synthRef.current.onvoiceschanged = populateVoices;
        }
    }, [selectedVoiceURI]);

    useEffect(() => {
        // You can add focus logic back in here if you want
        if (generator && promptTextareaRef.current) {
            promptTextareaRef.current.focus();
        }
    }, [generator]);

    const handleSynthesizeSpeech = async () => {
        await synthesizeAndPlayText(textToSpeakInput, activeTtsEngine);
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
                <input type="file" id={"fileInput"} style={{zIndex:5000,display:'none',position:'absolute',left:'50vh',top:'16vh'}}></input>
                <input type="file" id={"fileInput2"} style={{zIndex:5000,display:'none',position:'absolute',left:'42vh',top:'26vh'}}></input>
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
                     
                        <ControlPanel
                            statusMessage={statusMessage}
                            prompt={prompt}
                            setPrompt={setPrompt}
                            handleGenerateText={handleGenerateText}
                            isGenerating={isGenerating}
                            toggleListen={toggleListen}
                            isListening={isListening}
                            sttError={sttError}
                            generatedOutput={generatedOutput}
                            activeTtsEngine={activeTtsEngine}
                            setActiveTtsEngine={setActiveTtsEngine}
                            kokoroTtsInstance={kokoroTtsInstance}
                            ttsPipelineInstance={ttsPipelineInstance}
                            speakerEmbeddings={speakerEmbeddings}
                            personalityProfiles={personalityProfiles}
                            currentPersonalityKey={currentPersonalityKey}
                            setCurrentPersonalityKey={setCurrentPersonalityKey}
                            currentProfile={currentProfile}
                            preferredTtsEngine={preferredTtsEngine}
                            setPreferredTtsEngine={setPreferredTtsEngine}
                            isTtsSpeaking={isTtsSpeaking}
                            promptTextareaRef={promptTextareaRef}
                            recognitionRef={recognitionRef}
                        />
                        <WebSpeechTTS
                            webSpeechApiInput={webSpeechText}
                            setWebSpeechApiInput={setWebSpeechText}
                            handleWebSpeechSpeak={handleWebSpeechSpeak}
                            isSpeaking={isWebSpeaking}
                            availableVoices={availableVoices}
                            selectedVoiceURI={selectedVoiceURI}
                            setSelectedVoiceURI={setSelectedVoiceURI}
                        />
                        <TransformersTTS
                            textToSpeakInput={textToSpeakInput}
                            setTextToSpeakInput={setTextToSpeakInput}
                            handleSynthesizeSpeech={handleSynthesizeSpeech}
                            isTtsSpeaking={isTtsSpeaking}
                            ttsPipelineInstance={ttsPipelineInstance}
                            speakerEmbeddings={speakerEmbeddings}
                        />
                        <ImageCaptioning
                            handleImageSelection={handleImageSelection}
                            handleImageCaptioning={handleImageCaptioning}
                            isCaptioning={isCaptioning}
                            imageCaptioner={imageCaptioner}
                            imageToCaption={imageToCaption}
                            generatedCaption={generatedCaption}
                        />
                     
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
