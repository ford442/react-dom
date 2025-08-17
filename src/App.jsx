import { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.1";
import './App.css';
import * as mm from '@magenta/music';

function App() {

const [toneTransferMode, setToneTransferMode] = useState(false);
const [transcriptionResult, setTranscriptionResult] = useState(null);
    
    useLayoutEffect(() => {
    console.log('Forcing remote settings and disabling cache for loading.');
    env.localFilesOnly = false;
    env.allowLocalModels = false;
    env.useBrowserCache = true;
    env.remoteHost = 'https://huggingface.co';
    env.remotePathTemplate = '{model}/resolve/main/';

    setStatusMessage('Loading models, please wait...');

    async function load() {
              document.querySelector('#splash2').style.display='none';
         setTimeout(function() {
        document.querySelector('#splash1').style.display='none';
           document.querySelector('#contain1').style.pointerEvents='auto';
         }, 1500);
      /*
      try {
        const pipelineInstance = await pipeline('text2text-generation', 'Xenova/LaMini-Flan-T5-248M', {
          progress_callback: (progress) => {
            const percentage = progress.total > 0 ? (progress.loaded / progress.total * 100).toFixed(2) : 'N/A';
            const message = `Loading: ${progress.file} - ${progress.status} (${percentage}%)`;
            console.log(message);
            setStatusMessage(message);
          }, // dtype: "q8"
        },
          { device: "webgpu" }
        );
        console.log("Pipeline loaded successfully.");
        setStatusMessage("Model loaded! Ready to generate.");

        setGenerator(() => pipelineInstance);
      } catch (error) {
        console.error("Failed to load pipeline:", error);
        setStatusMessage(`Error loading model: ${error.message}`);
      }
      */
    }
    load();
  }, []);
  
  return (
    <>
      <link charset={"utf-8"} crossorigin rel='stylesheet' href='https://css.1ink.us/birdsong.1iss'/>
      <img id={'splash1'} src={'./image/shroud.jpg'} style={{backgroundColor:'rgba(233,233,233,0.0)',display:'block',position:'absolute',height:'100vh',width:'100vw',zIndex:3590}}></img>
      <img id={'splash2'} src={'./image/spinner.gif'} style={{backgroundColor:'rgba(47,47,47,1.0)',display:'block',top:'50%',left:'50%',transform:'translate(-50%,-50%)',position:'absolute',height:'20vh',width:'20vh',zIndex:3591}}></img>
      <main id={'panel'}>
        <div id={'wrap'}>
          <div id={'contain1'}>
          </div>
        </div>
      </main>
    </>
  );
}

export default App;
