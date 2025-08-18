import React, { useState, useEffect, useRef } from 'react';

// Access the Magenta and TensorFlow libraries from the window object
const mm = window.mm;
const tf = window.tf;

// URLs for the pre-trained Magenta models
const VAE_CHECKPOINT = 'https://storage.googleapis.com/magentadata/js/checkpoints/music_vae/mel_4bar_small_q2';
const RNN_CHECKPOINT = 'https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/basic_rnn';

function MagentaComposer() {
  // Refs to hold the model instances and the visualizer canvas
  const musicVaeRef = useRef();
  const musicRnnRef = useRef();
  const playerRef = useRef();
  const visualizerRef = useRef();
  const visualizerInstanceRef = useRef();

  // State to manage the UI
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Click "Load Models" to begin.');
  const [generatedSequence, setGeneratedSequence] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // New state for backend and VAE temperature
  const [backend, setBackend] = useState('webgl');
  const [vaeTemperature, setVaeTemperature] = useState(1.0);

  // Effect to set the initial TF.js backend
  useEffect(() => {
    if (tf && tf.getBackend() !== backend) {
      tf.setBackend(backend).then(() => {
        console.log(`TensorFlow.js backend set to: ${tf.getBackend()}`);
      });
    }
  }, []); // Runs only once on mount

  const handleBackendChange = async (newBackend) => {
    if (!tf || tf.getBackend() === newBackend) return;
    setStatusMessage(`Switching backend to ${newBackend}...`);
    setBackend(newBackend);
    await tf.setBackend(newBackend);
    setStatusMessage(`Backend switched to ${tf.getBackend()}. Models need to be reloaded.`);
    setModelsLoaded(false); // Force model reload on new backend
  };

  const loadModels = async () => {
    if (!mm) {
      setStatusMessage('Error: Magenta.js library not found.');
      return;
    }
    
    playerRef.current = new mm.Player();
    setStatusMessage(`Loading models on ${tf.getBackend()} backend...`);
    
    try {
      musicVaeRef.current = new mm.MusicVAE(VAE_CHECKPOINT);
      await musicVaeRef.current.initialize();
      console.log('MusicVAE model loaded.');

      musicRnnRef.current = new mm.MusicRNN(RNN_CHECKPOINT);
      await musicRnnRef.current.initialize();
      console.log('MelodyRNN model loaded.');
      
      setModelsLoaded(true);
      setStatusMessage(`Models loaded on ${tf.getBackend()}! Ready to generate.`);
    } catch (error) {
      console.error('Failed to load models:', error);
      setStatusMessage('Error: Could not load models.');
    }
  };

  const handleGenerateWithVAE = async () => {
    if (!musicVaeRef.current) return;

    const originalBackend = tf.getBackend();
    // The WASM backend in this TFJS version doesn't support the 'split' op needed by MusicVAE.
    // Temporarily switch to WebGL if WASM is active to avoid the error.
    if (originalBackend === 'wasm') {
      setStatusMessage('Temporarily switching to WebGL for VAE compatibility...');
      await tf.setBackend('webgl');
    }

    setIsGenerating(true);
    setStatusMessage(`Generating with MusicVAE (Temp: ${vaeTemperature})...`);
    setGeneratedSequence(null);

    try {
      // Use the temperature from the state
      const sequences = await musicVaeRef.current.sample(1, vaeTemperature);
      setGeneratedSequence(sequences[0]);
      setStatusMessage('MusicVAE generation complete!');
    } catch (error) {
      console.error('MusicVAE generation failed:', error);
      setStatusMessage('Error during VAE generation. Check console.');
    } finally {
      // If we switched the backend, switch it back now.
      if (originalBackend === 'wasm' && tf.getBackend() !== 'wasm') {
        setStatusMessage('Switching back to WASM backend...');
        await tf.setBackend('wasm');
        setStatusMessage(`Models ready on ${tf.getBackend()} backend.`);
      }
      setIsGenerating(false);
    }
  };
  
  const handleContinueWithRNN = async () => {
    if (!musicRnnRef.current) return;
    setIsGenerating(true);
    setStatusMessage('Continuing with MelodyRNN...');
    setGeneratedSequence(null);
    
    const seedSequence = {
      notes: [
        { pitch: 60, startTime: 0.0, endTime: 0.4 }, { pitch: 64, startTime: 0.4, endTime: 0.8 }, { pitch: 67, startTime: 0.8, endTime: 1.2 },
        { pitch: 67, startTime: 1.2, endTime: 1.6 }, { pitch: 71, startTime: 1.6, endTime: 2.0 },
        { pitch: 69, startTime: 2.0, endTime: 2.4 }, { pitch: 72, startTime: 2.4, endTime: 2.8 },
        { pitch: 71, startTime: 2.8, endTime: 3.2 }, { pitch: 74, startTime: 3.2, endTime: 4.0 },
      ],
      totalTime: 4.0
    };
    
    const quantizedSeed = mm.sequences.quantizeNoteSequence(seedSequence, 4);

    try {
      const continuedSequence = await musicRnnRef.current.continueSequence(quantizedSeed, 60, 1.1);
      setGeneratedSequence(continuedSequence);
      setStatusMessage('MelodyRNN continuation complete!');
    } catch (error) {
      console.error('MelodyRNN generation failed:', error);
      setStatusMessage('Error during RNN generation.');
    }
    setIsGenerating(false);
  };
  
  useEffect(() => {
    if (generatedSequence && visualizerRef.current && mm) {
      const unquantizedSeq = mm.sequences.unquantizeSequence(generatedSequence);
      if (!visualizerInstanceRef.current) {
        visualizerInstanceRef.current = new mm.Visualizer(unquantizedSeq, visualizerRef.current);
      } else {
        visualizerInstanceRef.current.redraw(unquantizedSeq);
      }
    }
  }, [generatedSequence]);

  const handlePlay = () => {
    if (!generatedSequence || !playerRef.current) return;
    const player = playerRef.current;

    if (isPlaying) {
      player.stop();
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      player.start(mm.sequences.unquantizeSequence(generatedSequence))
        .then(() => setIsPlaying(false));
    }
  };

  const handleDownload = () => {
    if (!generatedSequence || !mm) return;
    const midiBlob = new Blob([mm.sequenceToMidi(generatedSequence)], { type: 'audio/midi' });
    const url = URL.createObjectURL(midiBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'generated-music.mid';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    return () => {
      if (playerRef.current && playerRef.current.isPlaying()) {
        playerRef.current.stop();
      }
    };
  }, []);

  return (
    <div style={styles.container}>
      <h1>Magenta.js Composer in React</h1>
      
      <div style={styles.settings}>
        <div style={styles.settingGroup}>
          <label>Backend:</label>
          <select value={backend} onChange={(e) => handleBackendChange(e.target.value)} style={styles.select}>
            <option value="webgl">WebGL</option>
            <option value="wasm">WASM</option>
            <option value="cpu">CPU</option>
          </select>
        </div>
        <div style={styles.settingGroup}>
          <label htmlFor="vae-temp">MusicVAE Creativity (Temp): {vaeTemperature.toFixed(1)}</label>
          <input 
            type="range" 
            id="vae-temp"
            min="0.1" 
            max="2.0" 
            step="0.1" 
            value={vaeTemperature} 
            onChange={(e) => setVaeTemperature(parseFloat(e.target.value))}
            style={{width: '100%'}}
          />
        </div>
      </div>
      <small style={styles.note}>Note: MusicVAE is not fully compatible with the WASM backend and will temporarily use WebGL.</small>

      <p style={styles.status}>{statusMessage}</p>

      {!modelsLoaded ? (
        <button onClick={loadModels} style={styles.button}>
          Load Models
        </button>
      ) : (
        <div style={styles.controls}>
          <button onClick={handleGenerateWithVAE} disabled={isGenerating || isPlaying} style={styles.button}>
            {isGenerating ? 'Generating...' : 'Generate with MusicVAE'}
          </button>
          <button onClick={handleContinueWithRNN} disabled={isGenerating || isPlaying} style={styles.button}>
            {isGenerating ? 'Generating...' : 'Continue with MelodyRNN'}
          </button>
        </div>
      )}

      {generatedSequence && (
        <div style={styles.results}>
          <h3>Generated Music:</h3>
          <canvas ref={visualizerRef} style={styles.canvas}></canvas>
          <div style={styles.playbackControls}>
            <button onClick={handlePlay} disabled={isGenerating} style={styles.button}>
              {isPlaying ? 'Stop' : 'Play'}
            </button>
            <button onClick={handleDownload} style={styles.button}>
              Download MIDI
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Basic styling for the component
const styles = {
  container: {
    fontFamily: 'sans-serif',
    textAlign: 'center',
    padding: '20px',
    border: '1px solid #ccc',
    borderRadius: '8px',
    maxWidth: '800px',
    margin: '40px auto',
    backgroundColor: '#f9f9f9',
    boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
  },
  settings: {
    display: 'flex',
    justifyContent: 'space-around',
    gap: '20px',
    padding: '15px',
    marginBottom: '5px',
    backgroundColor: '#efefef',
    borderRadius: '5px',
  },
  settingGroup: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '5px'
  },
  select: {
    padding: '5px',
    borderRadius: '4px',
    border: '1px solid #ccc'
  },
  note: {
    fontSize: '0.8rem',
    color: '#666',
    marginBottom: '10px'
  },
  status: {
    minHeight: '40px',
    color: '#333',
    fontWeight: 'bold'
  },
  controls: {
    display: 'flex',
    justifyContent: 'center',
    gap: '15px',
    marginBottom: '20px',
  },
  results: {
    marginTop: '30px',
    borderTop: '1px solid #ddd',
    paddingTop: '20px',
  },
  canvas: {
    width: '100%',
    height: '150px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    backgroundColor: '#fff',
    marginBottom: '15px'
  },
  playbackControls: {
      display: 'flex',
      justifyContent: 'center',
      gap: '15px'
  },
  button: {
    padding: '10px 20px',
    fontSize: '16px',
    cursor: 'pointer',
    border: 'none',
    borderRadius: '5px',
    backgroundColor: '#007bff',
    color: 'white',
    transition: 'background-color 0.2s',
  },
};

export default MagentaComposer;
