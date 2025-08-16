import { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { AutoProcessor, AutoModelForDepthEstimation, RawImage } from "@huggingface/transformers";
import './App.css';

function App() {

// Load model and processor
const depth = await AutoModelForDepthEstimation.from_pretrained("onnx-community/DepthPro-ONNX", { dtype: "q4" });
const processor = await AutoProcessor.from_pretrained("onnx-community/DepthPro-ONNX");

// Read and prepare image
const image = await RawImage.read("https://raw.githubusercontent.com/huggingface/transformers.js-examples/main/depth-pro-node/assets/image.jpg");
const inputs = await processor(image);

// Run depth estimation model
const { predicted_depth, focallength_px } = await depth(inputs);

// Normalize the depth map to [0, 1]
const depth_map_data = predicted_depth.data;
let minDepth = Infinity;
let maxDepth = -Infinity;
for (let i = 0; i < depth_map_data.length; ++i) {
  minDepth = Math.min(minDepth, depth_map_data[i]);
  maxDepth = Math.max(maxDepth, depth_map_data[i]);
}
const depth_tensor = predicted_depth
  .sub_(minDepth)
  .div_(-(maxDepth - minDepth)) // Flip for visualization purposes
  .add_(1)
  .clamp_(0, 1)
  .mul_(255)
  .round_()
  .to("uint8");

// Save the depth map
const depth_image = RawImage.fromTensor(depth_tensor);
depth_image.save("depth.png");


  return (
    <>
      <link charset={"utf-8"} crossorigin rel='stylesheet' href='https://css.1ink.us/1ink.1iss'/>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Audiowide"/>
      <img id={'splash1'} src={'./image/shroud.jpg'} style={{backgroundColor:'rgba(233,233,233,0.0)',display:'block',position:'absolute',height:'100vh',width:'100vw',zIndex:3590}}></img>
      <img id={'splash2'} src={'./image/spinner.gif'} style={{backgroundColor:'rgba(47,47,47,1.0)',display:'block',top:'50%',left:'50%',transform:'translate(-50%,-50%)',position:'absolute',height:'20vh',width:'20vh',zIndex:3591}}></img>
      {/* ... (rest of your JSX for nav, panel, canvas, etc. remains the same) ... */}

      <main id={'panel'}>
        {/* ... (all your existing JSX for iframes, buttons, etc.) ... */}

        <div id={'wrap'}>
          <div id={'contain1'} style={{ pointerEvents: 'none', position: 'relative', height: '100vh', width: '100vw' }}> {/* Added relative positioning and dimensions for contained elements */}

            {/* Canvas should be positioned next to or behind the panels */}
            <canvas className='emscripten' id={'scanvas'} style={{
              pointerEvents: 'auto', // Enable interaction with canvas if needed
              display: 'block',
              position: 'absolute',
              top: '0',
              left: '400px', // Position it to the right of the fixed panels
              height: '100vh',
              width: 'calc(100vw - 400px - 20px)', // Adjust width to fill remaining space, minus margin
              zIndex: 3000,
              backgroundColor: 'rgba(233,233,233,1.0)',
              imageRendering: 'auto',
              transform: 'scaleY(1.0)'
            }}></canvas>

            {/* Other elements like 'imgAnimPNG', 'mvi', 'ldv', 'track' etc. would need positioning adjustments */}
            {/* For simplicity, they are omitted here, but you'd place them correctly within the main container */}

          </div>
          {/* Other contain divs */}
          <div id={'contain2'}>
            <canvas id={'bcanvas'} hidden style={{ pointerEvents: 'none', display: 'none', zIndex: 2100, position: 'absolute', height: '100vh', width: '100vh', marginLeft: 'auto', marginRight: 'auto', backgroundColor: 'rgba(0,255,0,1.0)', top: '0', imageRendering: 'auto' }}></canvas>
            <img id={'resultImage'} src={''} alt="" ></img>
          </div>
        </div>
      </main>

      {/* Hidden elements etc. */}
      <img id={"imgAnimPNG"} src={''} alt=""></img>
      <img id={'mvi'} src={'./image/901464_400093426755894_1205176414_o.jpg'} alt=""></img>
      <div style={{ pointerEvents: 'none', height: '100vh' }}>
        <video hidden muted src={'./video-1456459792.mp4'} loop crossorigin playsinline id={'ivi'} preload={'auto'} style={{ pointerEvents: 'none', transform: 'scaleY(-1.0)' }}></video>
      </div>
      <div style={{ pointerEvents: 'none', height: '100vh' }}>
        <video hidden muted crossorigin playsinline id={'ldv'} preload={'auto'} style={{ pointerEvents: 'none' }}></video>
      </div>
      <audio crossorigin id={'track'} preload={'auto'} hidden style={{ pointerEvents: 'none' }}></audio>

      {/* Status Messages Display */}
      <div style={{
        position: 'fixed',
        bottom: '10px',
        left: '10px',
        right: '10px',
        textAlign: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        color: 'white',
        padding: '5px 10px',
        borderRadius: '5px',
        zIndex: 9999, // Very high zIndex to be on top
      }}>
        {statusMessage}
      </div>
    </>
  );
}

export default App;
