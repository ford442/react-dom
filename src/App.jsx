import { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import Box from '@mui/material/Box';
import Slider from '@mui/material/Slider';
import './App.css';

function App() {
  useLayoutEffect(() => {
    const xhrPath = document.querySelector('#loadPath').innerHTML;
    const xhr = new XMLHttpRequest();
    xhr.open('GET', xhrPath, true);
    xhr.responseType = 'arraybuffer';
    console.log('got react run');

    function decodeUTF32(uint8Array, isLittleEndian = true) {
      const dataView = new DataView(uint8Array.buffer);
      let result = "";
      for (let i = 0; i < uint8Array.length; i += 4) {
        let codePoint;
        if (isLittleEndian) {
          codePoint = dataView.getUint32(i, true);
        } else {
          codePoint = dataView.getUint32(i, false);
        }
        if (codePoint >= 0 && codePoint <= 0x10FFFF) {
          result += String.fromCodePoint(codePoint);
        } else {
          console.warn(`Invalid UTF-32 code point encountered: ${codePoint.toString(16)}`);
          result += '�';
        }
      }
      return result;
    }

    xhr.onload = async function() {
      console.log('got load loader');
      if (xhr.status === 200) {
        const utf32Data = xhr.response;
        const jsCode = decodeUTF32(new Uint8Array(utf32Data), true);

        const blob = new Blob([jsCode], { type: 'application/javascript' });
        const blobUrl = URL.createObjectURL(blob);

        try {
          // Dynamic import: Expects a default export (the Emscripten Module factory)
          const { default: createEmscriptenModule } = await import(blobUrl);

          console.log("Dynamic import of Emscripten module factory finished.");
          console.log("createEmscriptenModule (the factory function):", createEmscriptenModule);

          // Define the Module configuration object.
          // This object is passed to the factory function (createEmscriptenModule).
          const ModuleConfig = {
            // Link your canvas if needed.
            // Ensure '#scanvas' is present in your JSX before this code runs.
            canvas: document.querySelector('#scanvas'),
            locateFile: (path, prefix) => {
                // This callback helps Emscripten find its associated .wasm and .data files.
                // By default, it expects them alongside the .js file. Adjust if yours are elsewhere.
                console.log(`[Emscripten locateFile] path: ${path}, prefix: ${prefix}`);
                // Assuming your .wasm is in the same directory as the loaded .js
                return prefix + path;
            },

            // --- Emscripten Callbacks and Configurations ---
            setStatus: (text) => {
              const statusElement = document.querySelector('#status');
              if (statusElement) statusElement.innerHTML = text;
              console.log('[Emscripten Status] ' + text);
            },
            print: (text) => console.log('[Emscripten stdout] ' + text),
            printErr: (text) => console.error('[Emscripten stderr] ' + text),
            monitorRunDependencies: (left) => {
              console.log(`[Emscripten Deps] Remaining dependencies: ${left}`);
            },
            preRun: [() => {
              console.log("[Emscripten Hook] preRun executed.");
              // For WASMFS=1, you often need to set up the file system in preRun
              // Ensure 'Module' refers to the actual instance here, usually available via 'this'
              // but for Module.FS to be available, the runtime might need to progress further.
              // This is a common point of complexity for WASMFS.
              // Consider if you really need WASMFS, or if your files can be preloaded more simply.
              if (window.Module && typeof window.Module.FS === 'object' && typeof window.Module.FS.mkdir === 'function') {
                 console.log("Setting up WASMFS in preRun...");
                 window.Module.FS.mkdir('/data');
                 window.Module.FS.mount(window.Module.IDBFS, {}, '/data');
                 window.Module.FS.syncfs(true, (err) => {
                     if (err) console.error("FS.syncfs error:", err);
                     else console.log("FS synced from IDBFS.");
                 });
              } else {
                console.warn("Emscripten FS or relevant methods not available in preRun for WASMFS setup.");
              }
            }],
            postRun: [() => {
              console.log("[Emscripten Hook] postRun executed.");
            }],
            onAbort: (what) => {
                console.error('[Emscripten Abort] ' + what);
            },

            // The onRuntimeInitialized callback
            onRuntimeInitialized: function() { // Use 'function' to ensure 'this' refers to the Module instance
              console.log("###################################################");
              console.log("### Emscripten runtime initialized callback FIRED! ###");
              console.log("###################################################");

              const currentModule = this; // Capture the Module instance

              // Now, we can safely call 'callMain' which is now exported and wraps _main
              if (typeof currentModule.callMain === 'function') {
                console.log("Module.callMain is available and being called.");
                currentModule.callMain(); // Call the main C/C++ function via the wrapper
                // Hide splash screens now that the app should be running
                document.querySelector('#splash1').style.display = 'none';
                document.querySelector('#splash2').style.display = 'none';
              } else {
                console.error("Module.callMain is NOT a function after runtime initialization!");
                // Inspect 'currentModule' to see what's actually available
                console.log("Initialized Module:", currentModule);
              }
            }
          };

          // Call the factory function with your configuration.
          // This returns a Promise that resolves to the fully initialized Module instance.
          const initializedModule = await createEmscriptenModule(ModuleConfig);

          // Assign it to window.Module for global access if your C++ code relies on it,
          // or for easier debugging in the console.
          window.Module = initializedModule;

          console.log("Actual Emscripten Module instance resolved:", initializedModule);

        } catch (error) {
          console.error("Failed to load or initialize Emscripten module:", error);
          // If the .wasm fails to load, this catch block should trigger.
        } finally {
          URL.revokeObjectURL(blobUrl);
        }
      } else {
        console.error(`Failed to load Emscripten module: Status ${xhr.status}`);
      }
    };
    xhr.send();
  }, []);

  return (
    <>
      {/* Your existing JSX */}
      <link charset={"utf-8"} crossOrigin='anonymous' rel='stylesheet' href='https://css.1ink.us/sh1.1iss'/>
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
                </Box>
              </div>
            </div>
          </ul>
        </section>
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
        <label htmlFor="fileInput" className="custom-file-upload">Select File</label>
        <div id={'outText'} style={{opacity:0.0,backgroundColor:'green',position:'absolute',top:'50vh',left:'47vw',zIndex:4200}}></div>
        <div id={'outText1'} style={{opacity:0.0,backgroundColor:'green',position:'absolute',top:'52vh',left:'47vw',zIndex:4200}}></div>
        <div id={'outText2'} style={{opacity:0.0,backgroundColor:'green',position:'absolute',top:'54vh',left:'47vw',zIndex:4200}}></div>
        <div className='emscripten' id={'stat'}></div>
        <div className='emscripten' id={'status'}></div>
        <div className='emscripten'>
          <progress value={'0'} max={'100'} id={'progress'}></progress>
        </div>
        <input type={'checkbox'} id={"di"} hidden></input>
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
        <div id={'wrap'}>
          <div id={'contain1'}>
            <canvas className='emscripten' id={'scanvas'} style={{pointerEvents:'auto',display:'block',position:'absolute',zIndex:3000,backgroundColor:'rgba(233,233,233,1.0)',top:'0',height:'100vh',width:'100vh',imageRendering:'auto',transform:'scaleY(1.0)'}}></canvas>
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
        <video hidden muted src={'./video-1456459792.mp4'} loop crossOrigin='anonymous' playsInline id={'ivi'} preload={'auto'} style={{pointerEvents:'none',transform:'scaleY(-1.0)'}}></video>
      </div>
      <div style={{pointerEvents:'none',height:'100vh'}}>
        <video hidden muted crossOrigin='anonymous' playsInline id={'ldv'} preload={'auto'} style={{pointerEvents:'none'}}></video>
      </div>
      <audio crossOrigin='anonymous' id={'track'} preload={'auto'} hidden style={{pointerEvents:'none'}}></audio>
    </>
  );
}

export default App;
