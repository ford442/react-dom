import { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import './App.css';
import * as mm from '@magenta/music';

function App() {
    
const [toneTransferMode, setToneTransferMode] = useState(false);
const [transcriptionResult, setTranscriptionResult] = useState(null);
    
    useLayoutEffect(() => {
    console.log('Forcing remote settings and disabling cache for loading.');
    env.localFilesOnly = false;
    env.allowLocalModels = false;
    env.useBrowserCache = true;
    env.remoteHost = 'https://huggingface.co';
    env.remotePathTemplate = '{model}/resolve/main/';

    setStatusMessage('Loading models, please wait...');

        async function runTranscription(audioBuffer) {
  setStatusMessage('Running note detection...');
            /*
  // Load the Onsets and Frames model
  const model = new mm.OnsetsAndFrames('https://storage.googleapis.com/magentadata/js/checkpoints/transcription/onsets_frames_uni');
  await model.initialize();

  // Run the transcription
  const result = await model.transcribeFromAudioBuffer(audioBuffer);
  setTranscriptionResult(result);
  setStatusMessage('Detection complete!');
  */
}
        
    async function load() {
              document.querySelector('#splash2').style.display='none';
         setTimeout(function() {
        document.querySelector('#splash1').style.display='none';
           document.querySelector('#contain1').style.pointerEvents='auto';
         }, 1500);
    }
    load();
  }, []);
  
  return (
    <>
      <link charset={"utf-8"} crossorigin rel='stylesheet' href='https://css.1ink.us/birdsong.1iss'/>
      <img id={'splash1'} src={'./image/shroud.jpg'} style={{backgroundColor:'rgba(233,233,233,0.0)',display:'block',position:'absolute',height:'100vh',width:'100vw',zIndex:3590}}></img>
      <img id={'splash2'} src={'./image/spinner.gif'} style={{backgroundColor:'rgba(47,47,47,1.0)',display:'block',top:'50%',left:'50%',transform:'translate(-50%,-50%)',position:'absolute',height:'20vh',width:'20vh',zIndex:3591}}></img>
      <main id={'panel'}>
        <div id={'wrap'}>
          <div id={'contain1'}>
              <button
  id="tone-transfer-btn"
  onClick={() => setToneTransferMode(!toneTransferMode)}
  style={{ position: 'absolute', top: 20, left: 20, zIndex: 4000 }}>
  {toneTransferMode ? "Exit Tone Transfer Mode" : "Tone Transfer Mode"}
</button>
              {toneTransferMode && (
  <button onClick={captureAndTranscribe} style={{ position: 'absolute', top: 60, left: 20, zIndex: 4000 }}>
    Record Birdsong & Detect Notes
  </button>
)}
              {transcriptionResult && (
  <div style={{ background: '#fff', padding: 10, borderRadius: 6, marginTop: 10 }}>
    <h4>Detected Notes:</h4>
    <ul>
      {transcriptionResult.notes.map((note, i) => (
        <li key={i}>
          Pitch: {note.pitch}, Start: {note.startTime.toFixed(2)}s, End: {note.endTime.toFixed(2)}s, Velocity: {note.velocity}
        </li>
      ))}
    </ul>
  </div>
)}
          </div>
        </div>
      </main>
    </>
  );
}

export default App;
