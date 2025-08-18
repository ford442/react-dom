import React, { useState, useEffect, useRef } from 'react';
import './App.css';

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
  const [libsLoaded, setLibsLoaded] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Loading libraries...');
  const [generatedSequence, setGeneratedSequence] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // State for backend and model temperatures
  const [backend, setBackend] = useState('webgl');
  const [vaeTemperature, setVaeTemperature] = useState(1.0);
  const [rnnTemperature, setRnnTemperature] = useState(1.1);

  // Effect to check for the global Magenta/TF objects.
  useEffect(() => {
    const checkLibsInterval = setInterval(() => {
      if (window.mm && window.tf) {
        setLibsLoaded(true);
        setStatusMessage('Libraries loaded. Click "Load Models" to begin.');
        clearInterval(checkLibsInterval);
      }
    }, 100);
    return () => clearInterval(checkLibsInterval);
  }, []);

  const handleBackendChange = async (newBackend) => {
    const { tf } = window;
    if (!tf || tf.getBackend() === newBackend) return;
    setStatusMessage(`Switching backend to ${newBackend}...`);
    setBackend(newBackend);
    await tf.setBackend(newBackend);
    setStatusMessage(`Backend switched to ${tf.getBackend()}. Models need to be reloaded.`);
    setModelsLoaded(false);
  };

  const loadModels = async () => {
    const { mm, tf } = window;
    if (!mm || !tf) {
      setStatusMessage('Error: Libraries not yet available.');
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
    const { tf } = window;
    if (!musicVaeRef.current || !tf) return;

    const originalBackend = tf.getBackend();
    if (originalBackend === 'wasm') {
      setStatusMessage('Temporarily switching to WebGL for VAE compatibility...');
      await tf.setBackend('webgl');
    }

    setIsGenerating(true);
    setStatusMessage(`Generating with MusicVAE (Temp: ${vaeTemperature.toFixed(1)})...`);
    setGeneratedSequence(null);

    try {
      const sequences = await musicVaeRef.current.sample(1, vaeTemperature);
      setGeneratedSequence(sequences[0]);
      setStatusMessage('MusicVAE generation complete!');
    } catch (error) {
      console.error('MusicVAE generation failed:', error);
      setStatusMessage('Error during VAE generation. Check console.');
    } finally {
      if (originalBackend === 'wasm' && tf.getBackend() !== 'wasm') {
        setStatusMessage('Switching back to WASM backend...');
        await tf.setBackend('wasm');
        setStatusMessage(`Models ready on ${tf.getBackend()} backend.`);
      }
      setIsGenerating(false);
    }
  };
  
  const handleContinueWithRNN = async () => {
    const { mm, tf } = window;
    if (!musicRnnRef.current || !mm || !tf) return;

    const originalBackend = tf.getBackend();
    if (originalBackend === 'wasm') {
      setStatusMessage('Temporarily switching to WebGL for RNN compatibility...');
      await tf.setBackend('webgl');
    }

    setIsGenerating(true);
    setStatusMessage(`Continuing with MelodyRNN (Temp: ${rnnTemperature.toFixed(1)})...`);
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
      const continuedSequence = await musicRnnRef.current.continueSequence(quantizedSeed, 60, rnnTemperature);
      setGeneratedSequence(continuedSequence);
      setStatusMessage('MelodyRNN continuation complete!');
    } catch (error) {
      console.error('MelodyRNN generation failed:', error);
      setStatusMessage('Error during RNN generation.');
    } finally {
       if (originalBackend === 'wasm' && tf.getBackend() !== 'wasm') {
        setStatusMessage('Switching back to WASM backend...');
        await tf.setBackend('wasm');
        setStatusMessage(`Models ready on ${tf.getBackend()} backend.`);
      }
      setIsGenerating(false);
    }
  };
  
  useEffect(() => {
    const { mm } = window;
    if (generatedSequence && visualizerRef.current && mm) {
      visualizerInstanceRef.current = null;
      const ctx = visualizerRef.current.getContext('2d');
      ctx.clearRect(0, 0, visualizerRef.current.width, visualizerRef.current.height);

      const unquantizedSeq = mm.sequences.unquantizeSequence(generatedSequence);
      visualizerInstanceRef.current = new mm.PianoRollCanvasVisualizer(unquantizedSeq, visualizerRef.current);
    }
  }, [generatedSequence]);

  const handlePlay = () => {
    const { mm } = window;
    if (!generatedSequence || !playerRef.current || !mm) return;
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
    const { mm } = window;
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
          <select value={backend} onChange={(e) => handleBackendChange(e.target.value)} style={styles.select} disabled={!libsLoaded}>
            <option value="webgl">WebGL</option>
            <option value="wasm">WASM</option>
            <option value="cpu">CPU</option>
          </select>
        </div>
        <div style={styles.settingGroup}>
          <label htmlFor="vae-temp">VAE Creativity: {vaeTemperature.toFixed(1)}</label>
          <input 
            type="range" 
            id="vae-temp"
            min="0.1" 
            max="2.0" 
            step="0.1" 
            value={vaeTemperature} 
            onChange={(e) => setVaeTemperature(parseFloat(e.target.value))}
            style={{width: '100%'}}
            disabled={!libsLoaded}
          />
        </div>
        <div style={styles.settingGroup}>
          <label htmlFor="rnn-temp">RNN Creativity: {rnnTemperature.toFixed(1)}</label>
          <input 
            type="range" 
            id="rnn-temp"
            min="0.1" 
            max="2.0" 
            step="0.1" 
            value={rnnTemperature} 
            onChange={(e) => setRnnTemperature(parseFloat(e.target.value))}
            style={{width: '100%'}}
            disabled={!libsLoaded}
          />
        </div>
      </div>
      <small style={styles.note}>Note: VAE & RNN models will temporarily use WebGL if WASM is selected.</small>

      <p style={styles.status}>{statusMessage}</p>

      {libsLoaded && !modelsLoaded ? (
        <button onClick={loadModels} style={styles.button}>
          Load Models
        </button>
      ) : null}

      {modelsLoaded && (
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
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '20px',
    padding: '15px',
    marginBottom: '5px',
    backgroundColor: '#efefef',
    borderRadius: '5px',
    alignItems: 'start'
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
