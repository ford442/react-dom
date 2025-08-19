import React, { useState } from 'react';
import MidiFile from 'midi-file';
import './App.css';

function App() {
  // State variables using React hooks
  const [midiData, setMidiData] = useState(null);
  const [audioBuffers, setAudioBuffers] = useState([]);
  const [logs, setLogs] = useState(['Logs will appear here...']);

  // Helper to add a new message to the logs
  const log = (message) => {
    console.log(message);
    setLogs(prevLogs => [...prevLogs, message]);
  };

  // Handler for MIDI file input change
  const handleMidiFileChange = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsedMidi = MidiFile.parseMidi(e.target.result);
        setMidiData(parsedMidi);
        log(`MIDI file loaded: ${file.name}`);
      } catch (error) {
        log(`Error parsing MIDI file: ${error.message}`);
        setMidiData(null);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Handler for Audio files input change
  const handleAudioFilesChange = async (event) => {
    const files = event.target.files;
    if (files.length === 0) return;

    setAudioBuffers([]); // Reset the list
    log('Loading audio files...');
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();

    const loadedBuffers = [];
    for (const file of files) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);
        loadedBuffers.push({ name: file.name, buffer: decodedBuffer });
        log(`  - Loaded and decoded: ${file.name}`);
      } catch (error) {
        log(`Error loading audio file ${file.name}: ${error.message}`);
      }
    }
    setAudioBuffers(loadedBuffers);
    log('All audio files processed.');
  };

  // Handler for the "Generate" button click
  const handleGenerateClick = () => {
    if (!midiData) {
      log('Error: Please upload a MIDI file first.');
      return;
    }
    if (audioBuffers.length === 0) {
      log('Error: Please upload at least one audio sample.');
      return;
    }

    log('Starting XM file generation...');
    // The core XM building logic will go here.
    console.log("Parsed MIDI Data:", midiData);
    console.log("Loaded Audio Buffers:", audioBuffers);

    log('XM generation is not fully implemented yet.');
    log('Check the developer console (F12) to see the parsed data structures.');
  };
  
  return (
    <div className="container">
      <h1>MIDI + Audio to XM Converter</h1>
      <p>Upload a MIDI file and the audio samples you want to use for each track.</p>

      <label htmlFor="midi-file">1. Upload your MIDI file:</label>
      <input 
        type="file" 
        id="midi-file" 
        accept=".mid,.midi" 
        onChange={handleMidiFileChange} 
      />

      <label htmlFor="audio-files">2. Upload your audio samples (WAV, MP3, etc.):</label>
      <input 
        type="file" 
        id="audio-files" 
        accept="audio/*" 
        multiple 
        onChange={handleAudioFilesChange} 
      />

      <button onClick={handleGenerateClick}>Generate .XM File</button>

      <pre id="log">
        {logs.join('\n')}
      </pre>
    </div>
  );
}

export default App;
