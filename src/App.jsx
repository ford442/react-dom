import React, { useState, useEffect, useRef } from 'react';
// Note: The '@magenta/music' import is removed as it will be loaded from a script tag in index.html
import * as mm from '@magenta/music';


// URLs for the pre-trained Magenta models
const VAE_CHECKPOINT = 'https://storage.googleapis.com/magentadata/js/checkpoints/music_vae/mel_4bar_small_q2';
const RNN_CHECKPOINT = 'https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/basic_rnn';

// Access the Magenta library from the window object
const mm = window.mm;

function MagentaComposer() {
  // Refs to hold the model instances and the visualizer canvas
  const musicVaeRef = useRef();
  const musicRnnRef = useRef();
  const playerRef = useRef(); // Initialize later
  const visualizerRef = useRef(); // Ref for the canvas element
  const visualizerInstanceRef = useRef(); // Ref for the visualizer instance

  // State to manage the UI
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Click "Load Models" to begin.');
  const [generatedSequence, setGeneratedSequence] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false); // State to track playback

  // Effect to load the models when the component mounts
  const loadModels = async () => {
    if (!mm) {
      setStatusMessage('Error: Magenta.js library not found. Please check the script tag in your HTML.');
      return;
    }
    
    // Initialize the player once the library is confirmed to be available
    playerRef.current = new mm.Player();

    setStatusMessage('Loading models... This may take a moment.');
    try {
      // Initialize MusicVAE
      musicVaeRef.current = new mm.MusicVAE(VAE_CHECKPOINT);
      await musicVaeRef.current.initialize();
      console.log('MusicVAE model loaded.');

      // Initialize MelodyRNN
      musicRnnRef.current = new mm.MusicRNN(RNN_CHECKPOINT);
      await musicRnnRef.current.initialize();
      console.log('MelodyRNN model loaded.');
      
      setModelsLoaded(true);
      setStatusMessage('Models loaded successfully! Ready to generate music.');
    } catch (error) {
      console.error('Failed to load models:', error);
      setStatusMessage('Error: Could not load models. Check the console.');
    }
  };

  // --- Model Interaction Functions ---

  const handleGenerateWithVAE = async () => {
    if (!musicVaeRef.current) return;

    setIsGenerating(true);
    setStatusMessage('Generating a new melody with MusicVAE...');
    setGeneratedSequence(null);

    try {
      const sequences = await musicVaeRef.current.sample(1);
      setGeneratedSequence(sequences[0]);
      setStatusMessage('MusicVAE generation complete!');
    } catch (error) {
      console.error('MusicVAE generation failed:', error);
      setStatusMessage('Error during VAE generation.');
    }

    setIsGenerating(false);
  };
  
  const handleContinueWithRNN = async () => {
    if (!musicRnnRef.current) return;

    setIsGenerating(true);
    setStatusMessage('Continuing a melody with MelodyRNN...');
    setGeneratedSequence(null);
    
    // A more interesting and harmonic seed melody (I-V-vi-IV progression in C)
    const seedSequence = {
      notes: [
        // C Major
        { pitch: 60, startTime: 0.0, endTime: 0.4 },  // C4
        { pitch: 64, startTime: 0.4, endTime: 0.8 },  // E4
        { pitch: 67, startTime: 0.8, endTime: 1.2 },  // G4
        // G Major
        { pitch: 67, startTime: 1.2, endTime: 1.6 },  // G4
        { pitch: 71, startTime: 1.6, endTime: 2.0 },  // B4
        // A minor
        { pitch: 69, startTime: 2.0, endTime: 2.4 },  // A4
        { pitch: 72, startTime: 2.4, endTime: 2.8 },  // C5
        // F Major
        { pitch: 71, startTime: 2.8, endTime: 3.2 },  // B4
        { pitch: 74, startTime: 3.2, endTime: 4.0 },  // D5
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
  
  // Effect to update the visualizer whenever the sequence changes
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


  // --- Player and Download Functions ---

  const handlePlay = () => {
    if (!generatedSequence || !playerRef.current) return;
    const player = playerRef.current;

    if (isPlaying) {
      player.stop();
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      player.start(mm.sequences.unquantizeSequence(generatedSequence))
        .then(() => {
          // This promise resolves when the music finishes playing.
          setIsPlaying(false);
        });
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

  // Cleanup effect to stop the player if the component unmounts
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
