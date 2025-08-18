import React, { useState, useEffect, useRef } from 'react';

// URLs for the pre-trained Magenta models
const VAE_CHECKPOINT = 'https://storage.googleapis.com/magentadata/js/checkpoints/music_vae/mel_4bar_small_q2';
const RNN_CHECKPOINT = 'https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/basic_rnn';

function MagentaComposer() {
  // Refs to hold the model instances and the visualizer canvases
  const musicVaeRef = useRef();
  const musicRnnRef = useRef();
  const playerRef = useRef();
  const generatedVizRef = useRef();
  const songVizRef = useRef();

  // State to manage the UI
  const [libsLoaded, setLibsLoaded] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Loading libraries...');
  const [generatedSequence, setGeneratedSequence] = useState(null);
  const [songSequence, setSongSequence] = useState(null); // State for the full song
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
      await tf.setBackend('webgl');
    }

    setIsGenerating(true);
    setStatusMessage(`Generating with MusicVAE (Temp: ${vaeTemperature.toFixed(1)})...`);
    setGeneratedSequence(null);

    try {
      const sequences = await musicVaeRef.current.sample(1, vaeTemperature);
      setGeneratedSequence(sequences[0]);
      setStatusMessage('New clip generated with MusicVAE!');
    } catch (error) {
      console.error('MusicVAE generation failed:', error);
      setStatusMessage('Error during VAE generation.');
    } finally {
      if (originalBackend === 'wasm' && tf.getBackend() !== 'wasm') {
        await tf.setBackend('wasm');
      }
      setIsGenerating(false);
    }
  };
  
  const handleContinueWithRNN = async () => {
    const { mm, tf } = window;
    if (!musicRnnRef.current || !mm || !tf) return;

    const originalBackend = tf.getBackend();
    if (originalBackend === 'wasm') {
      await tf.setBackend('webgl');
    }

    setIsGenerating(true);
    setStatusMessage(`Continuing with MelodyRNN (Temp: ${rnnTemperature.toFixed(1)})...`);
    
    let seedSequence;
    if (songSequence && songSequence.notes.length > 0) {
        let lastNotes = songSequence.notes.slice(-16); // Get up to the last 16 notes
        
        // FIX: Filter out notes with pitches outside the model's valid range.
        // The basic_rnn model works well with pitches roughly in the piano's main range.
        const validPitchRange = { min: 48, max: 84 }; // C3 to C6
        lastNotes = lastNotes.filter(note => note.pitch >= validPitchRange.min && note.pitch <= validPitchRange.max);

        if (lastNotes.length > 0) {
            const startTime = lastNotes[0].startTime;
            seedSequence = {
                notes: lastNotes.map(n => ({
                    ...n,
                    startTime: n.startTime - startTime,
                    endTime: n.endTime - startTime,
                })),
                totalTime: lastNotes[lastNotes.length - 1].endTime - startTime
            };
        }
    } 
    
    // If there's no valid seed from the song, create a default one.
    if (!seedSequence) {
        seedSequence = {
            notes: [ { pitch: 60, startTime: 0.0, endTime: 0.5 } ], totalTime: 0.5
        };
    }
    
    const quantizedSeed = mm.sequences.quantizeNoteSequence(seedSequence, 4);

    try {
      const continuedSequence = await musicRnnRef.current.continueSequence(quantizedSeed, 60, rnnTemperature);
      setGeneratedSequence(continuedSequence);
      setStatusMessage('New clip generated with MelodyRNN!');
    } catch (error) {
      console.error('MelodyRNN generation failed:', error);
      setStatusMessage('Error during RNN generation.');
    } finally {
       if (originalBackend === 'wasm' && tf.getBackend() !== 'wasm') {
        await tf.setBackend('wasm');
      }
      setIsGenerating(false);
    }
  };

  const handleAddToSong = () => {
    if (!generatedSequence) return;
    const { mm } = window;
    if (songSequence) {
      const concatenated = mm.sequences.concatenate([songSequence, generatedSequence]);
      setSongSequence(concatenated);
    } else {
      setSongSequence(generatedSequence);
    }
    setGeneratedSequence(null); // Clear the generated clip after adding it
  };

  const handleClearSong = () => {
    setSongSequence(null);
    setGeneratedSequence(null);
    if (playerRef.current && playerRef.current.isPlaying()) {
      playerRef.current.stop();
      setIsPlaying(false);
    }
  };
  
  // Effect to draw the PREVIEW clip
  useEffect(() => {
    const { mm } = window;
    if (generatedSequence && generatedVizRef.current && mm) {
      const unquantizedSeq = mm.sequences.unquantizeSequence(generatedSequence);
      new mm.PianoRollCanvasVisualizer(unquantizedSeq, generatedVizRef.current);
    } else if (generatedVizRef.current) {
        const ctx = generatedVizRef.current.getContext('2d');
        ctx.clearRect(0, 0, generatedVizRef.current.width, generatedVizRef.current.height);
    }
  }, [generatedSequence]);

  // Effect to draw the FULL song
  useEffect(() => {
    const { mm } = window;
    if (songSequence && songVizRef.current && mm) {
        const unquantizedSeq = mm.sequences.unquantizeSequence(songSequence);
        new mm.PianoRollCanvasVisualizer(unquantizedSeq, songVizRef.current);
    } else if (songVizRef.current) {
        const ctx = songVizRef.current.getContext('2d');
        ctx.clearRect(0, 0, songVizRef.current.width, songVizRef.current.height);
    }
  }, [songSequence]);

  const handlePlay = () => {
    const { mm } = window;
    if (!songSequence || !playerRef.current || !mm) return;
    const player = playerRef.current;

    if (isPlaying) {
      player.stop();
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      player.start(mm.sequences.unquantizeSequence(songSequence))
        .then(() => setIsPlaying(false));
    }
  };

  const handleDownload = () => {
    const { mm } = window;
    if (!songSequence || !mm) return;
    const midiBlob = new Blob([mm.sequenceToMidi(songSequence)], { type: 'audio/midi' });
    const url = URL.createObjectURL(midiBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'full-song.mid';
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
      <h1>Magenta.js Song Composer</h1>
      
      <div style={styles.settings}>
        {/* Settings controls remain the same */}
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
            {isGenerating ? 'Working...' : 'New Idea (VAE)'}
          </button>
          <button onClick={handleContinueWithRNN} disabled={isGenerating || isPlaying} style={styles.button}>
            {isGenerating ? 'Working...' : 'Continue (RNN)'}
          </button>
        </div>
      )}

      {generatedSequence && (
        <div style={styles.results}>
          <h3>Generated Clip (Preview)</h3>
          <canvas ref={generatedVizRef} style={styles.canvas}></canvas>
          <button onClick={handleAddToSong} disabled={isGenerating || isPlaying} style={styles.button}>
            Add to Song
          </button>
        </div>
      )}

      <div style={styles.results}>
        <h3>Full Song</h3>
        <canvas ref={songVizRef} style={styles.canvas}></canvas>
        {songSequence && (
          <div style={styles.playbackControls}>
            <button onClick={handlePlay} disabled={isGenerating} style={styles.button}>
              {isPlaying ? 'Stop' : 'Play Song'}
            </button>
            <button onClick={handleDownload} style={styles.button}>
              Download MIDI
            </button>
            <button onClick={handleClearSong} style={{...styles.button, ...styles.clearButton}}>
              Clear Song
            </button>
          </div>
        )}
      </div>
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
    marginTop: '20px',
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
  clearButton: {
      backgroundColor: '#dc3545'
  }
};

export default MagentaComposer;
