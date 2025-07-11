import { useState, useCallback, useRef, useEffect } from 'react';
import { useModels } from './hooks/useModels';
import { useSpeech } from './hooks/useSpeech';
import ControlPanel from './components/ControlPanel';
import Box from '@mui/material/Box';
import Slider from '@mui/material/Slider';
import WebSpeechTTS from './components/WebSpeechTTS';
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
        imageCaptioner,
    } = useModels();

    const [prompt, setPrompt] = useState('');
    const [generatedOutput, setGeneratedOutput] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [currentPersonalityKey, setCurrentPersonalityKey] = useState('default');
    const [activeTtsEngine, setActiveTtsEngine] = useState('kokoro');
    const [currentProfile, setCurrentProfile] = useState(personalityProfiles.default);
    const [preferredTtsEngine, setPreferredTtsEngine] = useState('kokoro');
    const audioContextRef = useRef(null);

    const [webSpeechText, setWebSpeechText] = useState("Hello from the browser's built-in TTS!");
    const [isWebSpeaking, setIsWebSpeaking] = useState(false); // For Browser TTS
    const [isTtsSpeaking, setIsTtsSpeaking] = useState(false); // For Kokoro/SpeechT5
    const [availableVoices, setAvailableVoices] = useState([]);
    const [selectedVoiceURI, setSelectedVoiceURI] = useState('');
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
    } = useSpeech(playAudio, kokoroTtsInstance, ttsPipelineInstance, speakerEmbeddings, setIsTtsSpeaking);

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
    value={webSpeechText} // Use the new state here
    onChange={(e) => setWebSpeechText(e.target.value)} // Update the new state
    placeholder="Enter text for browser TTS..."
    rows={3}
    style={{ width: '100%', padding: '8px', boxSizing: 'border-box', marginBottom: '10px' }}
    disabled={isWebSpeaking} // Or a dedicated isWebSpeaking state
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

{/* Image Captioning Section */}
<div style={{
  position: 'absolute', // Or 'absolute'
  zIndex: 7000, // Ensure it's on top
  marginTop: '20px',
  padding: '15px',
  borderTop: '1px solid #ddd',
  backgroundColor: 'rgba(230, 230, 250, 0.9)', // Light blue-ish green
  // Adjust positioning and dimensions as needed. Example:
  // bottom: 'calc(20px + 300px + 20px)', // Example: Stack above TTS sections if they are fixed height
  // left: '20px',
  // right: '20px',
  // width: 'auto', // Or specify a width
}}>
  <h2>Image Captioning (ViT-GPT2)</h2>
  <input
    type="file"
    accept="image/*"
    onChange={handleImageSelection} // This function will be created in a later step
    disabled={isCaptioning || !imageCaptioner}
    style={{ marginBottom: '10px', display: 'block', pointerEvents: 'auto', zIndex:9000 }}
  />
  {imageToCaption && (
    <img
      src={typeof imageToCaption === 'string' ? imageToCaption : URL.createObjectURL(imageToCaption)}
      alt="Selected for captioning"
      style={{ maxWidth: '100%', maxHeight: '200px', marginBottom: '10px', border: '1px solid #ccc' }}
    />
  )}
  <button
    onClick={handleImageCaptioning} // This function will be created in a later step
    disabled={!imageCaptioner || !imageToCaption || isCaptioning}
    style={{ padding: '10px 15px', width: '100%', marginBottom: '10px', pointerEvents: 'auto', zIndex:9000  }}
  >
    {isCaptioning ? 'Generating Caption...' : 'Generate Caption'}
  </button>
  <h3>Generated Caption:</h3>
  <div style={{
    minHeight: '40px', padding: '10px', border: '1px solid #eee',
    backgroundColor: '#f9f9f9', whiteSpace: 'pre-wrap'
  }}>
    {generatedCaption}
  </div>
</div>

<ControlPanel
currentProfile={currentProfile}
preferredTtsEngine={preferredTtsEngine}
setPreferredTtsEngine={setPreferredTtsEngine}
/>
  
<WebSpeechTTS
webSpeechApiInput={webSpeechApiInput}
setWebSpeechApiInput={setWebSpeechApiInput}
webSpeechText={webSpeechText}
setWebSpeechText={setWebSpeechText}
handleWebSpeechSpeak={handleWebSpeechSpeak}
isWebSpeaking={isWebSpeaking}
isTtsSpeaking={isTtsSpeaking}availableVoices={availableVoices}
webSpeechText={webSpeechText}
setWebSpeechText={setWebSpeechText}
handleWebSpeechSpeakButton={handleWebSpeechSpeakButton}
availableVoices={availableVoices}
selectedVoiceURI={selectedVoiceURI}
setSelectedVoiceURI={setSelectedVoiceURI}
/>
  
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
          disabled={!ttsPipelineInstance || isTtsSpeaking}
/>
<button
          onClick={handleSynthesizeSpeech}
          disabled={!ttsPipelineInstance || !speakerEmbeddings || isTtsSpeaking || !textToSpeakInput.trim()}
          style={{ position: 'absolute', zIndex: 4000, padding: '10px 15px' }}
        >
          {isTtsSpeaking ? 'Synthesizing...' : 'Synthesize & Play Speech'}
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
