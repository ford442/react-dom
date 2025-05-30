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

  }, []);

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
<link charset={"utf-8"} crossorigin rel='stylesheet' href='https://css.1ink.us/sh1.1iss'/>
<link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Audiowide"/>
<img id={'splash1'} src={'./image/shroud.jpg'} style={{backgroundColor:'rgba(233,233,233,0.0)',display:'block',position:'absolute',height:'100vh',width:'100vw',zIndex:3590}}></img>
<img id={'splash2'} src={'./image/spinner.gif'} style={{backgroundColor:'rgba(47,47,47,1.0)',display:'block',top:'50%',left:'50%',transform:'translate(-50%,-50%)',position:'absolute',height:'20vh',width:'20vh',zIndex:3591}}></img>
<nav id={'menu'}>
<section className='menu-section' id={'menu-sections'}>
<div style={{textAlign:'center'}}>
TIMESLIDER
</div>
<ul className='menu-section-list'>
<div id={'mnu'}>
<select id={'resMode'} hidden style={{position:'absolute',zIndex:1,pointerEvents:'auto'}}>
<option value="false">False</option>
<option value="true">True</option>
</select>
<div id={'slideframe'}>
<input type={'text'} id={'timeslider'}></input>
</div>
<div id={'slideframe2'}>
<input type={'text'} id={'srslider'}></input>
</div>
<div id={'slideframe3'}>
<Box sx={{ width: '15vh' }}>
<Slider
aria-label="TEST"
defaultValue={1.0}
valueLabelDisplay="auto"
shiftStep={0.25}
step={0.05}
min={0.05}
max={2.0}
/>
</Box></div>
</div></ul></section>
</nav>
<main id={'panel'}>
  
<iframe src={'./bezz.1ink'} id={'circle'} title='Circular mask'></iframe>
<input type={'button'} id={'startBtn'} style={{backgroundColor:'gold',position:'absolute',display:'block',left:'6%',top:'9%',zIndex:3200,border:'4px solid #e7e7e7',borderRadius:'17%'}}></input>
<input type={'button'} id={'menuBtn'} style={{backgroundColor:'black',position:'absolute',display:'block',left:'3%',top:'5%',zIndex:3200,border:'6px solid #e7e7e7',borderRadius:'20%'}}></input>
<input type={'button'} id={'musicBtn'} style={{backgroundColor:'cyan',position:'absolute',display:'block',left:'3%',bottom:'5%',zIndex:3200,border:'6px solid green',borderRadius:'20%'}}></input>
<input type={'button'} id={'startBtn5'} style={{backgroundColor:'yellow',position:'absolute',display:'block',left:'2%',top:'9%',zIndex:3200,border:'4px solid #e7e7e7',borderRadius:'17%'}}></input>
<input type={'button'} id={'startBtn2'} style={{backgroundColor:'gold',position:'absolute',display:'block',left:'9%',top:'9%',zIndex:3200,border:'4px solid #e7e7e7',borderRadius:'17%'}}></input>
<input type={'button'} id={'startBtnC'} style={{backgroundColor:'green',position:'absolute',display:'block',left:'5%',top:'12%',zIndex:3200,border:'4px solid #e7e7e7',borderRadius:'17%'}}></input>
<input type={'button'} id={'downloadButton'} style={{backgroundColor:'grey',position:'absolute',display:'block',left:'15%',top:'22%',zIndex:3200,border:'4px solid #e7e7e7',borderRadius:'17%'}}></input>
<input type={'button'} id={'startBtnI'} style={{backgroundColor:'white',position:'absolute',display:'block',left:'15%',top:'12%',zIndex:3200,border:'4px solid #e7e7e7',borderRadius:'17%'}}></input>
<input type={'button'} id={'pyBtn'} style={{backgroundColor:'green',position:'absolute',display:'block',left:'15%',top:'6%',zIndex:3200,border:'4px solid #e7e7e7',borderRadius:'17%'}}></input>
<input type={'button'} id={'pyBtn2'} style={{backgroundColor:'green',position:'absolute',display:'block',left:'18%',top:'6%',zIndex:3200,border:'4px solid #e7e7e7',borderRadius:'17%'}}></input>
<input type={'button'} id={'pyBtn3'} style={{backgroundColor:'yellow',position:'absolute',display:'block',left:'22%',top:'6%',zIndex:3200,border:'4px solid #e7e7e7',borderRadius:'17%'}}></input>
<input type={'button'} id={'pyBtn4'} style={{backgroundColor:'red',position:'absolute',display:'block',left:'22%',top:'8%',zIndex:3200,border:'4px solid #e7e7e7',borderRadius:'17%'}}></input>
<input type={'button'} id={'apngBtn'} style={{backgroundColor:'green',position:'absolute',display:'block',left:'35%',top:'12%',zIndex:3200,border:'4px solid #e7e7e7',borderRadius:'17%'}}></input>
<input type={'button'} id={'apngBtn2'} style={{backgroundColor:'green',position:'absolute',display:'block',left:'37%',top:'12%',zIndex:3200,border:'4px solid #e7e7e7',borderRadius:'17%'}}></input>
<input type={'button'} id={'mviBtn'} style={{backgroundColor:'black',position:'absolute',display:'block',left:'15%',top:'9%',zIndex:3200,border:'4px solid #e7e7e7',borderRadius:'17%'}}></input>
<input type={'button'} id={'uniUp'} style={{backgroundColor:'black',position:'absolute',display:'block',left:'3%',top:'50%',zIndex:3200,border:'6px solid #e7e7e7',borderRadius:'20%'}}></input>
<input type={'button'} id={'uniDown'} style={{backgroundColor:'black',position:'absolute',display:'block',left:'7%',top:'50%',zIndex:3200,border:'6px solid #e7e7e7',borderRadius:'20%'}}></input>
<input type={'button'} id={'viewUp'} style={{backgroundColor:'black',position:'absolute',display:'block',left:'5%',top:'46%',zIndex:3200,border:'6px solid #e7e7e7',borderRadius:'20%'}}></input>
<input type={'button'} id={'viewDown'} style={{backgroundColor:'black',position:'absolute',display:'block',left:'5%',top:'54%',zIndex:3200,border:'6px solid #e7e7e7',borderRadius:'20%'}}></input>
<input type={'button'} id={'sizeUp'} style={{backgroundColor:'black',position:'absolute',display:'block',left:'5%',top:'86%',zIndex:3200,border:'6px solid #e7e7e7',borderRadius:'20%'}}></input>
<input type={'button'} id={'sizeDown'} style={{backgroundColor:'black',position:'absolute',display:'block',left:'5%',top:'90%',zIndex:3200,border:'6px solid #e7e7e7',borderRadius:'20%'}}></input>
<input type={'button'} id={'moveDown'} style={{backgroundColor:'black',position:'absolute',display:'block',right:'5%',top:'90%',zIndex:3200,border:'6px solid #e7e7e7',borderRadius:'20%'}}></input>
<input type={'button'} id={'moveUp'} style={{backgroundColor:'black',position:'absolute',display:'block',right:'5%',top:'86%',zIndex:3200,border:'6px solid #e7e7e7',borderRadius:'20%'}}></input>
<input type={'button'} id={'moveLeft'} style={{backgroundColor:'black',position:'absolute',display:'block',right:'3%',top:'90%',zIndex:3200,border:'6px solid #e7e7e7',borderRadius:'20%'}}></input>
<input type={'button'} id={'moveRight'} style={{backgroundColor:'black',position:'absolute',display:'block',right:'7%',top:'90%',zIndex:3200,border:'6px solid #e7e7e7',borderRadius:'20%'}}></input>
<input className="button" type={'button'} id={'moveFwd'} style={{backgroundColor:'gold',position:'absolute',display:'none',width:'6vh',height:'5vh',left:'47%',bottom:'3%',zIndex:3200,border:'4px solid #e7e7e7',borderRadius:'17%'}}></input>
<input className="button" type={'button'} id={'cruiseFwd'} style={{backgroundColor:'red',position:'absolute',display:'none',width:'6vh',height:'5vh',left:'47%',bottom:'7%',zIndex:3200,border:'4px solid #e7e7e7',borderRadius:'17%'}}></input>
<input type="file" id={"fileInput"} style={{zIndex:5000,position:'absolute',left:'50vh',top:'16vh'}}></input>
<input type="file" id={"fileInput2"} style={{zIndex:5000,position:'absolute',left:'42vh',top:'26vh'}}></input>
<label for="fileInput" className="custom-file-upload">Select File</label>
<div id={'outText'} style={{opacity:0.0,backgroundColor:'green',position:'absolute',top:'50vh',left:'47vw',zIndex:4200}}></div>
<div id={'outText1'} style={{opacity:0.0,backgroundColor:'green',position:'absolute',top:'52vh',left:'47vw',zIndex:4200}}></div>
<div id={'outText2'} style={{opacity:0.0,backgroundColor:'green',position:'absolute',top:'54vh',left:'47vw',zIndex:4200}}></div>
<div className='emscripten' id={'stat'}></div>
<div className='emscripten' id={'status'}></div>
<div className='emscripten'>
<progress value={'0'} max={'100'} id={'progress'}></progress>
</div>
<input type={'checkbox'} id={"di"} hidden></input>
//   //   //   //
<div id={'srsiz'} hidden>1000</div>
<div id={'ffire'} hidden>0</div>
<div id={'iwid'} hidden>0</div>
<div id={'ihig'} hidden>0</div>
<div id={'pmhig'} hidden>0</div>
<div id={'canvasSize'} hidden>0</div>
<div id={'floatHigh'} hidden>1</div>
<div id={'wid'} hidden>0</div>
<div id={'hig'} hidden>0</div>
<div id={'tileNum'} hidden>0</div>
<div id={'vsiz'} hidden>0</div>
<div id={'lwid'} hidden>0</div>
<div id={'lhig'} hidden>0</div>
<div id={'ihid'} hidden>0</div>
<div id={'tim'} hidden>2500</div>
<div id={'shut'} hidden>2</div>
<div id={'isrc'} hidden>./intro.mp4</div>
<div id={'idur'} hidden>0</div>
<div id={'itim'} hidden>0</div>
<div id={'smd'} hidden>110.10</div>
// //  //
<div id={'wrap'}>
<div id={'contain1'}>
<canvas className='emscripten' id={'scanvas'} style={{pointerEvents:'auto',display:'block',position:'absolute',zIndex:3000,backgroundColor:'rgba(233,233,233,1.0)',top:'0',height:'100vh',width:'100vh',imageRendering:'auto',transform:'scaleY(1.0)'}}></canvas>

  
    <div style={{
        position: 'absolute', // Or 'absolute' if you prefer, relative to a parent
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
          style={{ width: '100%', padding: '8px', boxSizing: 'border-box', pointerEvents: 'auto' }}
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

  
  <div id={'contain1a'} style={{height:'75%',width:'75%'}}>
</div>
</div>
<div id={'contain2'}>
<canvas id={'bcanvas'} hidden style={{pointerEvents:'none',display:'none',zIndex:2100,position:'absolute',height:'100vh',width:'100vh',marginLeft:'auto',marginRight:'auto',backgroundColor:'rgba(0,255,0,1.0)',top:'0',imageRendering:'auto'}}></canvas>
<img id={'resultImage'} src={''}></img>
</div>
</div>
</main>
<div>
<img id={"imgAnimPNG"} src={''}></img>
<img id={'mvi'} src={'./image/901464_400093426755894_1205176414_o.jpg'}></img>
</div>
<div style={{pointerEvents:'none',height:'100vh'}}>
<video hidden muted src={'./video-1456459792.mp4'}
       loop crossorigin playsinline
       id={'ivi'} preload={'auto'}
       style={{pointerEvents:'none',transform:'scaleY(-1.0)'}}></video>
</div>
<div style={{pointerEvents:'none',height:'100vh'}}>
<video hidden muted crossorigin playsinline id={'ldv'} preload={'auto'} style={{pointerEvents:'none'}}></video>
</div>
<audio crossorigin id={'track'} preload={'auto'} hidden style={{pointerEvents:'none'}}></audio>
</>
);
}

export default App;
