import { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import './App.css';
import * as mm from '@magenta/music';

// Helper function to convert an AudioBuffer to a MIDI file
const audioBufferToMidiFile = async (audioBuffer) => {
  // ... (Keep your existing audioBufferToMidiFile function if you still need it for AI mode)
  const midi = mm.NoteSequence.fromQuantizedNoteSequence({
    notes: audioBuffer.notes.map(note => ({
      pitch: note.pitch,
      startTime: note.startTime,
      endTime: note.endTime,
      velocity: note.velocity,
    })),
    quantizationInfo: {
      stepsPerQuarter: 4, // Default quantization, adjust if needed
    },
    tempos: [{ time: 0, qpm: 120 }], // Default tempo, adjust if needed
  }, 120); // Tempo (120 BPM)

  return mm.sequenceProtoToMidi(midi);
};

function App() {
  const [toneTransferMode, setToneTransferMode] = useState(false);
  const [transcriptionResult, setTranscriptionResult] = useState(null); // For AI detection results
  const [nonAiDetectionResult, setNonAiDetectionResult] = useState(null); // For non-AI detection results
  const [statusMessage, setStatusMessage] = useState('Click "Record Birdsong" or upload an audio file.');
  const [model, setModel] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const fileInputRef = useRef(null);

  // New state to track the detection mode
  const [detectionMode, setDetectionMode] = useState('ai'); // 'ai' or 'non-ai'

  const runAiTranscription = async (audioBuffer) => {
    setStatusMessage('Running AI note detection...');
    if (!model) {
      setStatusMessage('AI model not loaded yet.');
      return;
    }
    try {
      const result = await model.transcribeFromAudioBuffer(audioBuffer);
      setTranscriptionResult(result); // Store AI results
      setNonAiDetectionResult(null); // Clear non-AI results
      setStatusMessage('AI Detection complete!');
    } catch (error) {
      console.error("AI Transcription failed:", error);
      setStatusMessage(`AI Transcription failed: ${error.message}`);
    }
  };

  const captureAndTranscribe = async () => {
    if (detectionMode !== 'ai') {
      alert("Please switch to AI detection mode for recording.");
      return;
    }
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

        setStatusMessage('Processing audio...');
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        const arrayBuffer = await audioBlob.arrayBuffer();
        const decodingAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffer = await decodingAudioContext.decodeAudioData(arrayBuffer);
        runAiTranscription(audioBuffer);
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

  // New function for non-AI detection
  const runNonAiDetection = async (audioBuffer) => {
    setStatusMessage('Running non-AI detection...');
    // Placeholder: Simple duration calculation
    const duration = audioBuffer.duration;
    setNonAiDetectionResult({ duration });
    setTranscriptionResult(null); // Clear AI results
    setStatusMessage('Non-AI Detection complete!');
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) {
      setUploadedFile(null);
      setTranscriptionResult(null);
      setNonAiDetectionResult(null);
      return;
    }

    setUploadedFile(file);
    setStatusMessage('Processing uploaded audio...');

    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      if (detectionMode === 'ai') {
        runAiTranscription(audioBuffer);
      } else {
        runNonAiDetection(audioBuffer);
      }
    } catch (error) {
      console.error("Failed to process uploaded file:", error);
      setStatusMessage(`Error processing file: ${error.message}`);
      setUploadedFile(null);
      setTranscriptionResult(null);
      setNonAiDetectionResult(null);
    }
  };

  useLayoutEffect(() => {
    console.log('Forcing remote settings and disabling cache for loading.');
    mm.env.localFilesOnly = false;
    mm.env.allowLocalModels = false;
    mm.env.useBrowserCache = true;
    mm.env.remoteHost = 'https://huggingface.co';
    mm.env.remotePathTemplate = '/resolve/main/';

    const loadModel = async () => {
      setStatusMessage('Loading AI models, please wait...');
      try {
        const loadedModel = new mm.OnsetsAndFrames('https://storage.googleapis.com/magentadata/js/checkpoints/transcription/onsets_frames_uni');
        await loadedModel.initialize();
        setModel(() => loadedModel);
        setStatusMessage('AI model loaded! Ready.');
      } catch (error) {
        console.error("Failed to load AI model:", error);
        setStatusMessage(`Error loading AI model: ${error.message}`);
      }
    };

    async function load() {
      document.querySelector('#splash2').style.display = 'none';
      setTimeout(function() {
        document.querySelector('#splash1').style.display = 'none';
        document.querySelector('#contain1').style.pointerEvents = 'auto';
      }, 1500);
    }
    load();
    loadModel();
  }, []);

  // Function to download the transcribed MIDI (only relevant for AI mode)
  const downloadMidi = async () => {
    if (!transcriptionResult) return;

    setStatusMessage('Generating AI MIDI...');
    try {
      const midiProto = mm.NoteSequence.fromQuantizedNoteSequence({
        notes: transcriptionResult.notes.map(note => ({
          pitch: note.pitch,
          startTime: note.startTime,
          endTime: note.endTime,
          velocity: note.velocity,
          quantizedStart: Math.round(note.startTime * 4),
          quantizedEnd: Math.round(note.endTime * 4),
        })),
        tempos: [{ time: 0, qpm: 120 }],
        quantizationInfo: {
          stepsPerQuarter: 4,
        },
      }, 120);

      const midiBlob = new Blob([mm.sequenceProtoToMidi(midiProto)], { type: 'audio/midi' });
      const url = URL.createObjectURL(midiBlob);

      const link = document.createElement('a');
      link.href = url;
      link.download = 'transcribed_birdsong.mid';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setStatusMessage('AI MIDI file downloaded.');
    } catch (error) {
      console.error("Error downloading AI MIDI:", error);
      setStatusMessage(`Error downloading AI MIDI: ${error.message}`);
    }
  };

  return (
    <>
      <link charset={"utf-8"} crossorigin rel='stylesheet' href='https://css.1ink.us/birdsong.1iss' />
      <img id={'splash1'} src={'./image/shroud.jpg'} style={{ backgroundColor: 'rgba(233,233,233,0.0)', display: 'block', position: 'absolute', height: '100vh', width: '100vw', zIndex: 3590 }}></img>
      <img id={'splash2'} src={'./image/spinner.gif'} style={{ backgroundColor: 'rgba(47,47,47,1.0)', display: 'block', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', position: 'absolute', height: '20vh', width: '20vh', zIndex: 3591 }}></img>
      <main id={'panel'}>
        <div id={'wrap'}>
          <div id={'contain1'} style={{ pointerEvents: 'none' }}>
            <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 4000, display: 'flex', gap: '10px', flexDirection: 'column', alignItems: 'flex-start' }}>
              <button
                id="tone-transfer-btn"
                onClick={() => setToneTransferMode(!toneTransferMode)}
              >
                {toneTransferMode ? "Exit Tone Transfer Mode" : "Tone Transfer Mode"}
              </button>

              {/* Detection Mode Toggle */}
              <div style={{ display: 'flex', gap: '5px' }}>
                <button
                  onClick={() => setDetectionMode('ai')}
                  disabled={detectionMode === 'ai'}
                  style={{
                    backgroundColor: detectionMode === 'ai' ? '#4CAF50' : '#f0f0f0',
                    color: detectionMode === 'ai' ? 'white' : 'black'
                  }}
                >
                  AI Detection
                </button>
                <button
                  onClick={() => setDetectionMode('non-ai')}
                  disabled={detectionMode === 'non-ai'}
                  style={{
                    backgroundColor: detectionMode === 'non-ai' ? '#2196F3' : '#f0f0f0',
                    color: detectionMode === 'non-ai' ? 'white' : 'black'
                  }}
                >
                  Non-AI Detection
                </button>
              </div>

              {detectionMode === 'ai' && (
                <>
                  <button onClick={captureAndTranscribe} disabled={!model}>
                    Record Birdsong (AI)
                  </button>
                  <input
                    type="file"
                    accept="audio/*"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />
                  <button onClick={() => fileInputRef.current.click()} disabled={!model}>
                    Upload Audio (AI)
                  </button>
                </>
              )}

              {detectionMode === 'non-ai' && (
                <>
                  <input
                    type="file"
                    accept="audio/*"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />
                  <button onClick={() => fileInputRef.current.click()} disabled={!model}> {/* Model not strictly needed for non-AI, but keep for consistency */}
                    Upload Audio (Non-AI)
                  </button>
                  {/* Add recording for non-AI if you have a separate mechanism */}
                </>
              )}
            </div>

            <div style={{ position: 'absolute', top: 180, left: 20, zIndex: 4000, color: 'white', backgroundColor: 'rgba(0,0,0,0.5)', padding: '10px', borderRadius: '5px' }}>
              {statusMessage}
            </div>

            {/* Display results based on the detection mode */}
            {detectionMode === 'ai' && transcriptionResult && (
              <div style={{ background: '#fff', padding: 10, borderRadius: 6, marginTop: 10, position: 'absolute', top: 250, left: 20, zIndex: 3999, color: 'black', maxHeight: '400px', overflowY: 'auto' }}>
                <h4>AI Detected Notes:</h4>
                <ul>
                  {transcriptionResult.notes.map((note, i) => (
                    <li key={i}>
                      Pitch: {note.pitch}, Start: {note.startTime.toFixed(2)}s, End: {note.endTime.toFixed(2)}s, Velocity: {note.velocity}
                    </li>
                  ))}
                </ul>
                <button onClick={downloadMidi} disabled={!transcriptionResult}>Download AI MIDI</button>
              </div>
            )}

            {detectionMode === 'non-ai' && nonAiDetectionResult && (
              <div style={{ background: '#fff', padding: 10, borderRadius: 6, marginTop: 10, position: 'absolute', top: 250, left: 20, zIndex: 3999, color: 'black', maxHeight: '400px', overflowY: 'auto' }}>
                <h4>Non-AI Detection Results:</h4>
                <p>Audio Duration: {nonAiDetectionResult.duration.toFixed(2)} seconds</p>
                {/* Add more non-AI detection results here */}
              </div>
            )}

            {uploadedFile && (
              <div style={{ position: 'absolute', top: 220, left: 20, zIndex: 4000, color: 'white', backgroundColor: 'rgba(0,0,0,0.3)', padding: '5px', borderRadius: '3px' }}>
                Processing: {uploadedFile.name}
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}

export default App;
