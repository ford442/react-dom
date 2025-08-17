import { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import './App.css';
import * as mm from '@magenta/music';

function App() {

  const [toneTransferMode, setToneTransferMode] = useState(false);
  const [transcriptionResult, setTranscriptionResult] = useState(null);
  const [statusMessage, setStatusMessage] = useState('Click "Record Birdsong" to start.');
  const [model, setModel] = useState(null);


  const runTranscription = async (audioBuffer) => {
    setStatusMessage('Running note detection...');
    if (!model) {
        setStatusMessage('Model not loaded yet.');
        return;
    }
    try {
        const result = await model.transcribeFromAudioBuffer(audioBuffer);
        setTranscriptionResult(result);
        setStatusMessage('Detection complete!');
    } catch (error) {
        console.error("Transcription failed:", error);
        setStatusMessage(`Transcription failed: ${error.message}`);
    }
  };

  const captureAndTranscribe = async () => {
    setStatusMessage('Waiting for microphone permission...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const recorder = new MediaRecorder(stream);
      const audioChunks = [];

      recorder.ondataavailable = event => {
        audioChunks.push(event.data);
      };

      recorder.onstop = async () => {
        source.disconnect();
        stream.getTracks().forEach(track => track.stop());
        // We don't close the initial audioContext to prevent issues on subsequent recordings.

        setStatusMessage('Processing audio...');
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        const arrayBuffer = await audioBlob.arrayBuffer();
        
        // Use a new AudioContext for decoding to avoid issues with a closed context.
        const decodingAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffer = await decodingAudioContext.decodeAudioData(arrayBuffer);
        runTranscription(audioBuffer);
      };

      setStatusMessage('Recording for 5 seconds...');
      recorder.start();
      setTimeout(() => {
        if (recorder.state === "recording") {
            recorder.stop();
            setStatusMessage('Recording finished.');
        }
      }, 5000);

    } catch (error) {
      console.error("Failed to capture audio:", error);
      setStatusMessage(`Error: ${error.message}. Please grant microphone permission.`);
    }
  };


  useLayoutEffect(() => {

    const loadModel = async () => {
        setStatusMessage('Loading models, please wait...');
        try {
            const loadedModel = new mm.OnsetsAndFrames('https://storage.googleapis.com/magentadata/js/checkpoints/transcription/onsets_frames_uni');
            await loadedModel.initialize();
            setModel(() => loadedModel);
            setStatusMessage('Model loaded! Ready to record.');
        } catch (error) {
            console.error("Failed to load model:", error);
            setStatusMessage(`Error loading model: ${error.message}`);
        }
    };


    loadModel();
  }, []);
  
  return (
    <>
      <link charset={"utf-8"} crossorigin rel='stylesheet' href='https://css.1ink.us/birdsong.1iss'/>
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
            <div style={{ position: 'absolute', top: 100, left: 20, zIndex: 4000, color: 'white', backgroundColor: 'rgba(0,0,0,0.5)', padding: '10px', borderRadius: '5px' }}>
                {statusMessage}
            </div>
              {transcriptionResult && (
  <div style={{ background: '#fff', padding: 10, borderRadius: 6, marginTop: 10, position: 'absolute', top: 140, left: 20, zIndex: 3999, color: 'black' }}>
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
