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
        const loadEmulatorScripts = async () => {
            try {
                await loadScript("https://unpkg.com/es6-promise@4.2.8/dist/es6-promise.auto.min.js");
                await loadScript("https://unpkg.com/browserfs@1.4.3/dist/browserfs.min.js");
                await loadScript("https://cdn.jsdelivr.net/gh/db48x/emularity@master/loader.js");
                setScriptsLoaded(true);
            } catch (error) {
                console.error("Failed to load emulator scripts:", error);
                if (infoRef.current) {
                    infoRef.current.textContent = "Error: Failed to load required emulator scripts.";
                }
            }
        };

        loadEmulatorScripts();
    }, []); // Empty dependency array ensures this runs only once

    // Effect to initialize the emulator after scripts are loaded
    useEffect(() => {
        if (scriptsLoaded && canvasRef.current) {
            const canvas = canvasRef.current;
            const info = infoRef.current;
            const splash1 = splash1Ref.current;
            const splash2 = splash2Ref.current;

            info.textContent = 'Loading Pac-Man...';

            const loader = new window.MAMELoader(
                window.MAMELoader.driver('pacman'),
                window.MAMELoader.emulatorJS('https://js-dos.com/cdn/emulators/mamepacman.js'),
                window.MAMELoader.mountFile(
                    'pacman.zip',
                    window.MAMELoader.fetchFile('Pac-Man ROM', 'https://js-dos.com/cdn/roms/pacman.zip')
                ),
                window.MAMELoader.mount(
                    '/mame/nvram',
                    'IDBFS'
                )
            );

            const emu = new window.Emulator(canvas, () => {
                // This callback runs after the emulator is ready
                info.textContent = 'Emulator ready! Press 5 for coin, 1 for start.';
                // Hide splash screen
                if (splash1) splash1.style.display = 'none';
                if (splash2) splash2.style.display = 'none';
            }, loader);

            emu.start();
        }
    }, [scriptsLoaded]); // This effect depends on scriptsLoaded state

  
  return (
    <>
      <link charset={"utf-8"} crossorigin rel='stylesheet' href='https://css.1ink.us/birdsong.1iss'/>
      <img id={'splash1'} src={'./image/shroud.jpg'} style={{backgroundColor:'rgba(233,233,233,0.0)',display:'block',position:'absolute',height:'100vh',width:'100vw',zIndex:3590}}></img>
      <img id={'splash2'} src={'./image/spinner.gif'} style={{backgroundColor:'rgba(47,47,47,1.0)',display:'block',top:'50%',left:'50%',transform:'translate(-50%,-50%)',position:'absolute',height:'20vh',width:'20vh',zIndex:3591}}></img>
      <main id={'panel'}>
        <div id={'wrap'}>
          <div id={'contain1'}>
                                      <canvas ref={canvasRef} id="canvas" width="224" height="288" style={{ border: '2px solid #555', imageRendering: 'pixelated' }}></canvas>
                        <p ref={infoRef} style={{ color: '#f0f0f0', marginTop: '1rem' }}>Initializing...</p>
          </div>
        </div>
      </main>
    </>
  );
}

export default App;
