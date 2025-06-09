import { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import Box from '@mui/material/Box';
import Slider from '@mui/material/Slider';
import './App.css';

function App() {
  useLayoutEffect(() => {
    const xhrPath = document.querySelector('#loadPath').innerHTML;
    const xhr = new XMLHttpRequest();
    xhr.open('GET', xhrPath, true); // Replace with your filename
    xhr.responseType = 'arraybuffer'; // Get raw binary data
    console.log('got react run');

    // Function to decode UTF-32
    function decodeUTF32(uint8Array, isLittleEndian = true) {
      const dataView = new DataView(uint8Array.buffer);
      let result = "";
      for (let i = 0; i < uint8Array.length; i += 4) {
        let codePoint;
        if (isLittleEndian) {
          codePoint = dataView.getUint32(i, true); // Little-endian
        } else {
          codePoint = dataView.getUint32(i, false); // Big-endian
        }
        // Handle potential invalid code points (e.g., surrogate pairs if data isn't pure UTF-32)
        // This is a basic check; robust decoding might need more
        if (codePoint >= 0 && codePoint <= 0x10FFFF) {
          result += String.fromCodePoint(codePoint);
        } else {
          // You might want to handle errors or replace with a placeholder
          console.warn(`Invalid UTF-32 code point encountered: ${codePoint.toString(16)}`);
          result += '�'; // Replacement character
        }
      }
      return result;
    }

    xhr.onload = function() {
      console.log('got load loader');
      if (xhr.status === 200) {
        const utf32Data = xhr.response;
        const jsCode = decodeUTF32(new Uint8Array(utf32Data), true); // Assuming little-endian

        // IMPORTANT: Execute the Emscripten code directly.
        // Emscripten typically relies on a global 'Module' object.
        // 'eval' is used here because Emscripten's output isn't always a standard ES Module that exports 'Module'.
        // It often modifies the global scope.
        try {
          // Define a global Module object if Emscripten expects it to be pre-defined
          // before its script runs. If Emscripten creates it, this might not be strictly necessary,
          // but it's good for configuring it.
          // Note: If you have an existing 'Module' object from another Emscripten build,
          // this might overwrite it or interact in unexpected ways.
          window.Module = window.Module || {};

          // Execute the Emscripten-generated JavaScript code
          eval(jsCode);

          // Now, the global 'Module' object should be populated by the Emscripten code.
          // You might need a slight delay for Emscripten's initialization to complete,
          // especially if it has a main loop or async setup.
          // However, try without a setTimeout first, as `eval` is synchronous.

          if (window.Module && typeof window.Module.callMain === 'function') {
            console.log("Emscripten Module and callMain found!");
            // Call Emscripten's main function
            window.Module.callMain();
          } else {
            console.warn("Emscripten Module.callMain not found after script execution.");
            // If Emscripten has a post-run hook or similar, you might need to wait for that.
            // For example, if it's based on a `_main` function and not `callMain`,
            // or if it needs to initialize a canvas first.
          }

        } catch (e) {
          console.error("Error executing Emscripten JavaScript code:", e);
        }
      } else {
        console.error(`Failed to load Emscripten module: Status ${xhr.status}`);
      }
    };
    xhr.send();
  }, []); // Empty dependency array means this runs once after initial render

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
