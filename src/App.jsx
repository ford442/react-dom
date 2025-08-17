import { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import './App.css';

// Helper function to load scripts sequentially
const loadScript = (src) => {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.type = 'text/javascript';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
};

function App() {
    const canvasRef = useRef(null);
    const infoRef = useRef(null);
    const splash1Ref = useRef(null);
    const splash2Ref = useRef(null);

    const [scriptsLoaded, setScriptsLoaded] = useState(false);

    // Effect to load external emulator scripts in order
    useEffect(() => {
        const loadScripts = async () => {
            try {
                await loadScript("https://sdk.scdn.co/spotify-player.js");
                await loadScript("https://cdn.tailwindcss.com");
                setScriptsLoaded(true);
            } catch (error) {
                console.error("Failed to load emulator scripts:", error);
                if (infoRef.current) {
                    infoRef.current.textContent = "Error: Failed to load required emulator scripts.";
                }
            }
        };

        loadScripts();
    }, []); 

    useEffect(() => {
        if (scriptsLoaded && canvasRef.current) {
            const canvas = canvasRef.current;
            const info = infoRef.current;
            const splash1 = splash1Ref.current;
            const splash2 = splash2Ref.current;

        }
    }, [scriptsLoaded]); // This effect depends on scriptsLoaded state

  
  return (
    <>
      <link charset={"utf-8"} crossorigin rel='stylesheet' href='https://css.1ink.us/mamejs.1iss'/>
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
