import { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.1";
import './App.css';

const personalityProfiles = {
  default: {
    displayName: "Default Assistant",
    systemPrompt: "",
    avatar: "/avatars/default.png",
    introVideo: null,
    introPhrase: "Hello! How can I assist you today?",
    themeColors: {
      '--ai-primary-color': '#4A90E2',
      '--ai-secondary-color': '#F5F5F5',
      '--ai-text-color': '#333333',
      '--ai-bubble-bg': '#E8F0FE',
    }
  },
  sceneCreator: {
    displayName: "Scene Creator",
    systemPrompt: "You are a helpful and proficient text-to-image prompt expanding assistant. You should return an imaginative, expanded upon scene suitable for text to image generation.",
    avatar: "/avatars/default.png",
    introVideo: null,
    introPhrase: "Ready to create a scene! What's the idea?",
    themeColors: {
        '--ai-primary-color': '#4A90E2',
        '--ai-secondary-color': '#F5F5F5',
        '--ai-text-color': '#333333',
        '--ai-bubble-bg': '#E8F0FE',
    }
  },
  captainPlayful: {
    displayName: "Captain Playful",
    systemPrompt: "You are Captain Playful, a friendly, shiny red toy robot...",
    avatar: "/avatars/captain_playful.png",
    introVideo: "/intros/captain_playful.mp4",
    introPhrase: "Ahoy there, matey! Captain Playful reporting for duty!",
    themeColors: {
      '--ai-primary-color': '#FF6347',
      '--ai-secondary-color': '#FFFF00',
      '--ai-text-color': '#4B0082',
      '--ai-bubble-bg': '#FFDAB9',
    }
  },
  professorPuzzle: {
    displayName: "Professor Puzzle (Owl)",
    systemPrompt: "Hoo-hoo! You are Professor Puzzle...",
    avatar: "/avatars/professor_puzzle.png",
    introVideo: null,
    introPhrase: "Hoo-hoo, a new challenger approaches! What puzzle can I help you unravel today?",
    themeColors: {
      '--ai-primary-color': '#228B22',
      '--ai-secondary-color': '#F5DEB3',
      '--ai-text-color': '#5D4037',
      '--ai-bubble-bg': '#E8F5E9',
    }
  },
    spriteDrawing: {
    displayName: "Create a pixelated image",
    systemPrompt: "You can draw the input as a 32 by 32 grid of pixels. You can say [RED], [GREEN] or [BLUE] to output the image.",
    avatar: "/avatars/default.png",
    introVideo: null,
    introPhrase: "Tell me the image to draw.",
    themeColors: {
      '--ai-primary-color': '#228B22',
      '--ai-secondary-color': '#F5DEB3',
      '--ai-text-color': '#5D4037',
      '--ai-bubble-bg': '#E8F5E9',
    }
  },
};

function App() {
  const [generator, setGenerator] = useState(null);
  const [statusMessage, setStatusMessage] = useState('Initializing...');
  const [prompt, setPrompt] = useState('');
  const [generatedOutput, setGeneratedOutput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentPersonalityKey, setCurrentPersonalityKey] = useState('default');
  const [currentProfile, setCurrentProfile] = useState(personalityProfiles.default);

  const promptTextareaRef = useRef(null);

  const handleGenerateText = useCallback(async () => {
    if (!generator) {
      alert("The text generation model is not loaded yet. Please wait.");
      return;
    }
    let textToProcess = prompt.trim();
    if (!textToProcess) {
      alert("Please enter some text to provide a prompt.");
      return;
    }

    setIsGenerating(true);
    setGeneratedOutput("Generating, please wait...");
    setStatusMessage("Generating image prompt with personality: " + (currentProfile?.displayName || 'Default'));

    try {
      const systemInstruction = currentProfile.systemPrompt ? `${currentProfile.systemPrompt}\n\nExpand the following idea into a detailed scene description for a text-to-image AI:` : "Expand the following idea into a detailed scene description for a text-to-image AI:";
      const fullPromptForLLM = `${systemInstruction}\n\n${textToProcess}`;

      console.log("Sending to LLM:", fullPromptForLLM);
      const outputs = await generator(fullPromptForLLM, {
        max_new_tokens: 192,
        min_new_tokens: 128,
      });

      if (outputs && outputs.length > 0 && outputs[0].generated_text) {
        const newLLMText = outputs[0].generated_text.replace(fullPromptForLLM, "").trim();
        setGeneratedOutput(newLLMText);
        setStatusMessage("Image prompt generated successfully.");
      } else {
        setGeneratedOutput("No text was generated or output format was unexpected.");
        setStatusMessage("Text generation failed to produce output.");
      }
    } catch (error) {
      console.error("Error during text generation:", error);
      setGeneratedOutput(`Error: ${error.message}`);
      setStatusMessage(`Error in processing: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  }, [generator, prompt, currentProfile]);

  useEffect(() => {
    const profile = personalityProfiles[currentPersonalityKey] || personalityProfiles.default;
    setCurrentProfile(profile);

    if (profile.themeColors) {
      for (const [key, value] of Object.entries(profile.themeColors)) {
        document.documentElement.style.setProperty(key, value);
      }
    }
  }, [currentPersonalityKey]);

  useEffect(() => {
    if (generator && promptTextareaRef.current) {
      promptTextareaRef.current.focus();
    }
  }, [generator]);

  useLayoutEffect(() => {
    console.log('Forcing remote settings and disabling cache for loading.');
    env.localFilesOnly = false;
    env.allowLocalModels = false;
    env.useBrowserCache = true;
    env.remoteHost = 'https://huggingface.co';
    env.remotePathTemplate = '{model}/resolve/main/';

    setStatusMessage('Loading models, please wait...');

    async function loadModel() {
      try {
        const pipelineInstance = await pipeline('text2text-generation', 'Xenova/LaMini-Flan-T5-248M', {
          progress_callback: (progress) => {
            const percentage = progress.total > 0 ? (progress.loaded / progress.total * 100).toFixed(2) : 'N/A';
            const message = `Loading: ${progress.file} - ${progress.status} (${percentage}%)`;
            console.log(message);
            setStatusMessage(message);
          }, // dtype: "q8"
        },
          { device: "webnn" }
        );
        console.log("Pipeline loaded successfully.");
        setStatusMessage("Model loaded! Ready to generate.");
        document.querySelector('#splash2').style.display='none';
         setTimeout(function() {
        document.querySelector('#splash1').style.display='none';
           document.querySelector('#contain1').style.pointerEvents='auto';
         }, 1500);
        setGenerator(() => pipelineInstance);
      } catch (error) {
        console.error("Failed to load pipeline:", error);
        setStatusMessage(`Error loading model: ${error.message}`);
      }
    }
    loadModel();
  }, []);

  return (
    <>
      <link charset={"utf-8"} crossorigin rel='stylesheet' href='https://css.1ink.us/prompt.1iss'/>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Audiowide"/>
      <img id={'splash1'} src={'./image/shroud.jpg'} style={{backgroundColor:'rgba(233,233,233,0.0)',display:'block',position:'absolute',height:'100vh',width:'100vw',zIndex:3590}}></img>
      <img id={'splash2'} src={'./image/spinner.gif'} style={{backgroundColor:'rgba(47,47,47,1.0)',display:'block',top:'50%',left:'50%',transform:'translate(-50%,-50%)',position:'absolute',height:'20vh',width:'20vh',zIndex:3591}}></img>
      <main id={'panel'}>
        <div id={'wrap'}>
          <div id={'contain1'}>
            <div className="floating-control-panel">
              <div className="panel-header">
                <div className="personality-header">
                  {currentProfile.avatar && (
                    <img
                      src={currentProfile.avatar}
                      alt={`${currentProfile.displayName} Avatar`}
                      className="personality-avatar"
                    />
                  )}
                  <h2>{currentProfile.displayName}</h2>
                </div>
                <div className='status-display'>{statusMessage}</div>
              </div>
              <div className="panel-content">
                <div className="panel-column">
                  <div className="panel-section">
                    <h3>AI Configuration</h3>
                    <div className="input-group">
                      <label htmlFor="personality-select">AI Personality:</label>
                      <select
                        id="personality-select"
                        value={currentPersonalityKey}
                        onChange={(e) => setCurrentPersonalityKey(e.target.value)}
                      >
                        {Object.keys(personalityProfiles).map(key => (
                          <option key={key} value={key}>
                            {personalityProfiles[key].displayName}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="panel-section">
                    <h3>Image Prompt Generation</h3>
                    <div className="input-group">
                      <label htmlFor="prompt-textarea">Your Idea:</label>
                      <textarea
                        id="prompt-textarea"
                        ref={promptTextareaRef}
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Enter an idea..."
                        rows={3}
                        disabled={!generator || isGenerating}
                      />
                    </div>
                    <button
                      onClick={handleGenerateText}
                      disabled={!generator || isGenerating}
                    >
                      {isGenerating ? 'Expanding Idea...' : 'Expand Idea to Image Prompt'}
                    </button>
                    <div className="input-group">
                      <label>Generated Image Prompt:</label>
                      <div className='generated-output-display'>{generatedOutput}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

export default App;
