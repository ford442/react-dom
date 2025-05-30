import { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { pipeline, env } from '@xenova/transformers';
import Box from '@mui/material/Box'; // Assuming you still use these
import Slider from '@mui/material/Slider'; // Assuming you still use these
import './App.css';

function App() {
  // State for the pipeline instance
  const [generator, setGenerator] = useState(null);
  // State for the current status message (model loading, errors, etc.)
  const [statusMessage, setStatusMessage] = useState('Initializing...');
  // State for the user's input prompt
  const [prompt, setPrompt] = useState('');
  // State for the generated text
  const [generatedOutput, setGeneratedOutput] = useState('');
  // State to indicate if generation is in progress
  const [isGenerating, setIsGenerating] = useState(false);

  useLayoutEffect(() => {
    console.log('Forcing remote settings and disabling cache for loading.');
    env.localFilesOnly = false;
    env.allowLocalModels = false; // Explicitly disallow local models for fetching
    env.useBrowserCache = false;  // Disable browser cache for model files

    env.remoteHost = 'https://huggingface.co';
    env.remotePathTemplate = '{model}/resolve/main/';

    setStatusMessage('Loading model, please wait...');

    async function loadModel() {
      try {
        const pipelineInstance = await pipeline('text2text-generation', 'Xenova/LaMini-Flan-T5-783M', {
          progress_callback: (progress) => {
            const percentage = progress.total > 0 ? (progress.loaded / progress.total * 100).toFixed(2) : 'N/A';
            const message = `Loading: ${progress.file} - ${progress.status} (${percentage}%)`;
            console.log(message);
            setStatusMessage(message); // Update status message
          }
        });
        console.log("Pipeline loaded successfully.");
        setStatusMessage("Model loaded! Ready to generate.");
        setGenerator(() => pipelineInstance); // Store the loaded pipeline using functional update
      } catch (error) {
        console.error("Failed to load pipeline:", error);
        setStatusMessage(`Error loading model: ${error.message}`);
      }
    }

    loadModel();

    // --- Your existing XHR and event listener code ---
    // Ensure IDs like 'fileInput', 'loadPath' exist or this code is conditional
    const imageChannel = new BroadcastChannel('imageChannel');
    const fileInput = document.getElementById('fileInput');
    if (fileInput) { // Add null check
      fileInput.addEventListener('change', (event) => {
        let file = event.target.files[0];
        if (file) {
          // ... (your file handling logic) ...
          console.log("File selected, processing...");
        }
      });
    } else {
      console.warn("Element with ID 'fileInput' not found.");
    }

    const loadPathElement = document.getElementById('loadPath'); // Changed from querySelector
    if (loadPathElement) { // Add null check
      const xhrPath = loadPathElement.innerHTML;
      const xhr = new XMLHttpRequest();
      // ... (your XHR logic) ...
      console.log("XHR setup for path:", xhrPath);
    } else {
      console.warn("Element with ID 'loadPath' not found.");
    }
    // --- End of your existing code ---

  }, []); // Empty dependency array, so it runs once on mount

  const handleGenerateText = async () => {
    if (!generator) {
      alert("The text generation model is not loaded yet. Please wait.");
      return;
    }
    if (!prompt.trim()) {
      alert("Please enter some text to generate from.");
      return;
    }

    setIsGenerating(true);
    setGeneratedOutput("Generating, please wait...");

    try {
      // Call the generator (pipeline) with the prompt
      // You can also pass parameters like max_length, temperature, etc.
      const outputs = await generator(prompt, {
        max_new_tokens: 150, // Limit the number of new tokens generated
        // temperature: 0.7,
        // num_beams: 2,
        // early_stopping: true,
      });

      // The output is usually an array of objects.
      // For text2text-generation, it's typically [{ generated_text: "..." }]
      if (outputs && outputs.length > 0 && outputs[0].generated_text) {
        setGeneratedOutput(outputs[0].generated_text);
      } else {
        setGeneratedOutput("No text was generated. Output format might be unexpected.");
        console.log("Unexpected output format:", outputs);
      }
    } catch (error) {
      console.error("Error during text generation:", error);
      setGeneratedOutput(`Error generating text: ${error.message}`);
    }

    setIsGenerating(false);
  };

  return (
    <>
      {/* ... Your existing extensive JSX layout ... */}

      {/* Add these new elements for text generation testing */}
      {/* You can place them wherever it makes sense in your UI */}
      <div style={{
        position: 'fixed', // Or 'absolute' if you prefer, relative to a parent
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
        gap: '10px'
      }}>
        <h2>Test Text Generation (LaMini-Flan-T5-783M)</h2>
        <div id="outputText" style={{ fontStyle: 'italic', marginBottom: '10px' }}>
          {statusMessage} {/* Display model loading status here */}
        </div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter your prompt here (e.g., 'Translate to German: Good morning')"
          rows={3}
          style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          disabled={!generator || isGenerating}
        />
        <button
          onClick={handleGenerateText}
          disabled={!generator || isGenerating}
          style={{ padding: '10px 15px', cursor: (!generator || isGenerating) ? 'not-allowed' : 'pointer' }}
        >
          {isGenerating ? 'Generating...' : 'Generate Text'}
        </button>
        <h3>Generated Output:</h3>
        <div style={{
          minHeight: '50px',
          padding: '10px',
          border: '1px solid #eee',
          backgroundColor: '#f9f9f9',
          whiteSpace: 'pre-wrap' // To respect newlines in output
        }}>
          {generatedOutput}
        </div>
      </div>

      {/* ... The rest of your existing extensive JSX layout ... */}
    </>
  );
}

export default App;
