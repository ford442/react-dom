import React, { useState, useEffect, useRef } from 'react';
import * as mm from '@magenta/music';

// URLs for the pre-trained Magenta models
const VAE_CHECKPOINT = 'https://storage.googleapis.com/magentadata/js/checkpoints/music_vae/mel_4bar_small_q2';
const RNN_CHECKPOINT = 'https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/basic_rnn';

function MagentaComposer() {
  // Refs to hold the model instances. Using refs prevents them from being re-initialized on every render.
  const musicVaeRef = useRef();
  const musicRnnRef = useRef();
  const playerRef = useRef(new mm.Player());

  // State to manage the UI
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Click "Load Models" to begin.');
  const [generatedSequence, setGeneratedSequence] = useState(null);

  // Effect to load the models when the component mounts
  const loadModels = async () => {
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
      // The sample() method generates a new sequence from the model.
      const sequences = await musicVaeRef.current.sample(1); // Generate 1 sequence
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
    
    // Create a short "seed" melody for the RNN to continue.
    // This is C4, D4, E4, F4.
    const seedSequence = {
      notes: [
        { pitch: 60, startTime: 0.0, endTime: 0.5 },
        { pitch: 62, startTime: 0.5, endTime: 1.0 },
        { pitch: 64, startTime: 1.0, endTime: 1.5 },
        { pitch: 65, startTime: 1.5, endTime: 2.0 }
      ],
      totalTime: 2.0
    };
    
    // Quantize the sequence - a required step for many models.
    const quantizedSeed = mm.sequences.quantizeNoteSequence(seedSequence, 4);

    try {
      // The continueSequence() method takes a seed and generates the rest.
      // Parameters: seed sequence, number of steps to generate, temperature (creativity)
      const continuedSequence = await musicRnnRef.current.continueSequence(quantizedSeed, 60, 1.1);
      setGeneratedSequence(continuedSequence);
      setStatusMessage('MelodyRNN continuation complete!');
    } catch (error) {
      console.error('MelodyRNN generation failed:', error);
      setStatusMessage('Error during RNN generation.');
    }

    setIsGenerating(false);
  };


  // --- Player and Download Functions ---

  const handlePlay = () => {
    if (!generatedSequence) return;
    const player = playerRef.current;

    if (player.isPlaying()) {
      player.stop();
    } else {
      // The NoteSequence must be unquantized before playback.
      player.start(mm.sequences.unquantizeSequence(generatedSequence));
    }
  };

  const handleDownload = () => {
    if (!generatedSequence) return;
    
    // Convert the NoteSequence to a MIDI file Blob
    const midiBlob = new Blob([mm.sequenceToMidi(generatedSequence)], { type: 'audio/midi' });
    
    // Create a temporary link to trigger the download
    const url = URL.createObjectURL(midiBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'generated-music.mid';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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
          <button onClick={handleGenerateWithVAE} disabled={isGenerating} style={styles.button}>
            {isGenerating ? 'Generating...' : 'Generate with MusicVAE'}
          </button>
          <button onClick={handleContinueWithRNN} disabled={isGenerating} style={styles.button}>
            {isGenerating ? 'Generating...' : 'Continue with MelodyRNN'}
          </button>
        </div>
      )}

      {generatedSequence && (
        <div style={styles.results}>
          <h3>Generated Music:</h3>
          <button onClick={handlePlay} style={styles.button}>
            {playerRef.current?.isPlaying() ? 'Stop' : 'Play'}
          </button>
          <button onClick={handleDownload} style={styles.button}>
            Download MIDI
          </button>
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
    maxWidth: '600px',
    margin: '40px auto',
    backgroundColor: '#f9f9f9',
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
