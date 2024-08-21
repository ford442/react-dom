import { useState, useRef, useEffect, useCallback,useLayoutEffect } from 'react'
import './App.css'

function App() {
useLayoutEffect(() => {
const xhr = new XMLHttpRequest();
xhr.open('GET', 'https://wasm.noahcohn.com/b3hd/w0-012-load-32.3ijs', true); // Replace with your filename
xhr.responseType = 'arraybuffer'; // Get raw binary data
console.log('got react run');
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
result += String.fromCodePoint(codePoint);
}
return result;
}
xhr.onload = function() {
console.log('got load loader');
if (xhr.status === 200) {
const utf32Data = xhr.response;
  //  const decoder = new TextDecoder('utf-32'); // Or 'utf-32be'
const jsCode = decodeUTF32(new Uint8Array(utf32Data), true); // Assuming little-endian
const scr = document.createElement('script');
// scr.type = 'module';
scr.text = jsCode;
document.body.appendChild(scr);
var Module = {}; // Initialize an empty Module object
setTimeout(function(){
Module = libload();
Module.onRuntimeInitialized = function(){
console.log('call main loader');
Module.callMain();
};
},2500);
}
};
xhr.send();
}, [])
  
return (
<>
<link charset={"utf-8"} crossorigin rel='stylesheet' href='https://css.1ink.us/sh1.1iss'/>
<link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Audiowide">
<nav id=menu>
<section class=menu-section id=menu-sections>
<br>
<div style='text-align:center;'>
TIMESLIDER<br>(Seconds between video changes)</div>
<br><br>
<ul class=menu-section-list>
<div id=mnu>
<br><br>
<select id=resMode hidden style='position:absolute;z-index:1;pointer-events:auto;'>
<option value="false">False</option>
<option value="true">True</option>
</select>
<div id=slideframe>
<input type=text id=timeslider>
</div>
<div id=slideframe2>
<input type=text id=srslider>
</div>
</div></ul></section>
<br />
<br />
</nav>
<main id=panel>
<iframe src=./bezz.1ink id=circle title='Circular mask'></iframe>
<input type=button id=startBtn style='background-color:gold;position:absolute;display:block;left:6%;top:9%;z-index:3200;border:4px solid #e7e7e7;border-radius:17%;' />
<input type=button id=menuBtn style='background-color:black;position:absolute;display:block;left:3%;top:5%;z-index:3200;border:6px solid #e7e7e7;border-radius:20%;' />
<input type=button id=musicBtn style='background-color:cyan;position:absolute;display:block;left:3%;bottom:5%;z-index:3200;border:6px solid green;border-radius:20%;' />
<input type=button id=startBtn5 style='background-color:yellow;position:absolute;display:block;left:2%;top:9%;z-index:3200;border:4px solid #e7e7e7;border-radius:17%;'></input>
<input type=button id=startBtn2 style='background-color:gold;position:absolute;display:block;left:9%;top:9%;z-index:3200;border:4px solid #e7e7e7;border-radius:17%;' />
<input type=button id=startBtnC style='background-color:green;position:absolute;display:block;left:5%;top:12%;z-index:3200;border:4px solid #e7e7e7;border-radius:17%;' />
<input type=button id=downloadButton style='background-color:grey;position:absolute;display:block;left:15%;top:22%;z-index:3200;border:4px solid #e7e7e7;border-radius:17%;' />
<input type=button id=startBtnI style='background-color:white;position:absolute;display:block;left:15%;top:12%;z-index:3200;border:4px solid #e7e7e7;border-radius:17%;' />
<input type=button id=pyBtn style='background-color:green;position:absolute;display:block;left:15%;top:6%;z-index:3200;border:4px solid #e7e7e7;border-radius:17%;' />
<input type=button id=pyBtn2 style='background-color:green;position:absolute;display:block;left:18%;top:6%;z-index:3200;border:4px solid #e7e7e7;border-radius:17%;' />
<input type=button id=pyBtn3 style='background-color:yellow;position:absolute;display:block;left:22%;top:6%;z-index:3200;border:4px solid #e7e7e7;border-radius:17%;' />
<input type=button id=pyBtn4 style='background-color:red;position:absolute;display:block;left:22%;top:8%;z-index:3200;border:4px solid #e7e7e7;border-radius:17%;' />
<input type=button id=apngBtn style='background-color:green;position:absolute;display:block;left:35%;top:12%;z-index:3200;border:4px solid #e7e7e7;border-radius:17%;' />
<input type=button id=apngBtn2 style='background-color:green;position:absolute;display:block;left:37%;top:12%;z-index:3200;border:4px solid #e7e7e7;border-radius:17%;' />
<input type=button id=mviBtn style='background-color:black;position:absolute;display:block;left:15%;top:9%;z-index:3200;border:4px solid #e7e7e7;border-radius:17%;' />
<input type=button id=uniUp style='background-color:black;position:absolute;display:block;left:3%;top:50%;z-index:3200;border:6px solid #e7e7e7;border-radius:20%;' />
<input type=button id=uniDown style='background-color:black;position:absolute;display:block;left:7%;top:50%;z-index:3200;border:6px solid #e7e7e7;border-radius:20%;' />
<input type=button id=viewUp style='background-color:black;position:absolute;display:block;left:5%;top:46%;z-index:3200;border:6px solid #e7e7e7;border-radius:20%;' />
<input type=button id=viewDown style='background-color:black;position:absolute;display:block;left:5%;top:54%;z-index:3200;border:6px solid #e7e7e7;border-radius:20%;' />
<input type=button id=sizeUp style='background-color:black;position:absolute;display:block;left:5%;top:86%;z-index:3200;border:6px solid #e7e7e7;border-radius:20%;' />
<input type=button id=sizeDown style='background-color:black;position:absolute;display:block;left:5%;top:90%;z-index:3200;border:6px solid #e7e7e7;border-radius:20%;' />
<input type=button id=moveDown style='background-color:black;position:absolute;display:block;right:5%;top:90%;z-index:3200;border:6px solid #e7e7e7;border-radius:20%;' />
<input type=button id=moveUp style='background-color:black;position:absolute;display:block;right:5%;top:86%;z-index:3200;border:6px solid #e7e7e7;border-radius:20%;' />
<input type=button id=moveLeft style='background-color:black;position:absolute;display:block;right:3%;top:90%;z-index:3200;border:6px solid #e7e7e7;border-radius:20%;' />
<input type=button id=moveRight style='background-color:black;position:absolute;display:block;right:7%;top:90%;z-index:3200;border:6px solid #e7e7e7;border-radius:20%;' />
<input class="button" type=button id=moveFwd style='background-color:gold;position:absolute;display:none;width:6vh;height:5vh;left:47%;bottom:3%;z-index:3200;border:4px solid #e7e7e7;border-radius:17%;' />
<input class="button" type=button id=cruiseFwd style='background-color:red;position:absolute;display:none;width:6vh;height:5vh;left:47%;bottom:7%;z-index:3200;border:4px solid #e7e7e7;border-radius:17%;' />
<input type="file" id="fileInput" style="z-index:5000;position:absolute;left:50vh;top:16vh;">
<input type="file" id="fileInput2" style="z-index:5000;position:absolute;left:42vh;top:26vh;">
<label for="fileInput" class="custom-file-upload">Select File</label>
<div id=outText style="opacity:0.0;background-color:green;position:absolute;top:50vh;left:47vw;z-index:4200;"></div>
<div id=outText1 style="opacity:0.0;background-color:green;position:absolute;top:52vh;left:47vw;z-index:4200;"></div>
<div id=outText2 style="opacity:0.0;background-color:green;position:absolute;top:54vh;left:47vw;z-index:4200;"></div>
<div class=emscripten id=stat></div>
<div class=emscripten id=status></div>
<div class=emscripten>
<progress value=0 max=100 id=progress></progress>
</div>
<input type=checkbox id="di" hidden />
<div hidden id=imagePath>https://www.noahcohn.com/image/901464_400093426755894_1205176414_o.jpg</div>
<div hidden id=modulePath>https://wasm.noahcohn.com/b3hd/w0-012-mod.3ijs</div>
<div hidden id=path>https://glsl.1ink.us/wgsl/zipzap.wgsl</div>
<div hidden id=computePath>https://glsl.1ink.us/wgsl/compute_066.wgsl</div>
<div hidden id=computePathNovid>https://glsl.1ink.us/wgsl/compute_066v.wgsl</div>
<div hidden id=fragPath>https://glsl.1ink.us/wgsl/fragment_005.wgsl</div>
<div hidden id=vertPath>https://glsl.1ink.us/wgsl/vertex_003.wgsl</div>
//   //   //   //
<div id=srsiz hidden>1000</div>
<div id=ffire hidden>0</div>
<div id=iwid hidden>0</div>
<div id=ihig hidden>0</div>
<div id=pmhig hidden>0</div>
<div id=canvasSize hidden>0</div>
<div id=floatHigh hidden>1</div>
<div id=wid hidden>0</div>
<div id=hig hidden>0</div>
<div id=tileNum hidden>0</div>
<div id=vsiz hidden>0</div>
<div id=lwid hidden>0</div>
<div id=lhig hidden>0</div>
<div id=ihid hidden>0</div>
<div id=tim hidden>2500</div>
<div id=shut hidden>2</div>
<div id=isrc hidden>./intro.mp4</div>
<div id=idur hidden>0</div>
<div id=itim hidden>0</div>
<div id=smd hidden>110.10</div>
// //  //
<div id=wrap>
<div id=contain1>
<canvas class=emscripten id=scanvas style='pointer-events:auto;display:block;position:absolute;z-index:3000;background-color:rgba(233,233,233,1.0);top:0;height:100vh;width:100vh;image-rendering:auto;transform:scaleY(1.0);'></canvas>
<div id=contain1a style='height:75%;width:75%;'>
</div>
</div>
<div id=contain2>
<canvas id=bcanvas hidden style='pointer-events:none;display:none;z-index:2100;position:absolute;height:100vh;width:100vh;margin-left:auto;margin-right:auto;background-color:rgba(0,255,0,1.0);top:0;image-rendering:auto;'></canvas>
<img id=resultImage src=""></img>
</div>
</div>
</main>
<div>
<img id="imgAnimPNG" src=""></img>
<img id=mvi src=./image/901464_400093426755894_1205176414_o.jpg></img>
</div>
<div style='pointer-events:none;height:100vh;'>
<video hidden muted src=./video-1456459792.mp4
       loop crossorigin playsinline
       id=ivi preload=auto
       style='pointer-events:none;transform:scaleY(-1.0);' />
</div>
<div style='pointer-events:none;height:100vh;'>
<video hidden muted crossorigin playsinline id=ldv preload=auto style='pointer-events:none;' />
</div>
<audio crossorigin id=track preload=none hidden style='pointer-events:none;'></audio>

<script type='module' src="https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js"></script>

<script>
const pyChannel = new BroadcastChannel('py_channel');
const imageChannel = new BroadcastChannel('imageChannel');
  const imgOut = document.getElementById('mvi');
  const pyBtn3 = document.getElementById('pyBtn3');
  const pyBtn4 = document.getElementById('pyBtn4');
  const fileInput = document.getElementById('fileInput'); // Replace 'fileInput' with your input's ID
  const fileInput2 = document.getElementById('fileInput2'); // Replace 'fileInput' with your input's ID

  // Add event listener for file selection
fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageDataURL = e.target.result;
        window.open('./depth.1ink');
        setTimeout(function(){
          imageChannel.postMessage({ imageDataURL });
        },4500);      };
      reader.readAsDataURL(file);
    }
});

pyBtn4.onclick = () => {
const divElement = document.querySelector('#imagePath'); // Replace 'myDiv' with your div's ID
const mtext = navigator.clipboard.readText(); // Read text from clipboard
divElement.textContent = mtext; // Set the div's text content
document.getElementById("pyBtn").click();
}

pyBtn3.onclick = () => {
      const canvas = document.createElement('canvas');
      canvas.width = imgOut.width;
      canvas.height = imgOut.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(imgOut, 0, 0);
      const imageDataURL = canvas.toDataURL();
    window.open('./depth.1ink');
      //  window.open('./depth/index.html');
      setTimeout(function () {
        imageChannel.postMessage({imageDataURL});
      }, 3500);
};

pyChannel.addEventListener('message', (event) => {
const message = event.data;
console.log('got postmessage');
  });

document.getElementById("pyBtn").addEventListener('click', () => {
    const pth = document.querySelector('#imagePath').innerHTML;
    processImageFromURL(pth);
  });
  // Add an event listener to your file input element
fileInput2.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageDataURL = e.target.result;
        processImage(imageDataURL);
      };
      reader.readAsDataURL(file);
    }
});

async function processImage(imageDataURL) {
let result;
let base64String;
base64String = imageDataURL.split(',')[1];
const img = new Image();
img.src = imageDataURL;
const maxWidth = 1024; // Set your desired maximum width
const maxHeight = 1024; // Set your desired maximum height
let newWidth = img.width;
let newHeight = img.height;
/*
    // Resize if necessary
    if (img.width > maxWidth || img.height > maxHeight) {
      const aspectRatio = img.width / img.height;
      if (img.width > img.height) {
        newWidth = maxWidth;
        newHeight = maxWidth / aspectRatio;
      } else {
        newHeight = maxHeight;
        newWidth = maxHeight * aspectRatio;
      }

      // Create a canvas to resize the image
      const canvas = document.createElement('canvas');
      canvas.width = newWidth;
      canvas.height = newHeight;
      const ctx = canvas.getContext('2d',{alpha:true});
      ctx.drawImage(img, 0, 0, newWidth, newHeight);
      base64String = canvas.toDataURL();
    }
    */
      //  const base64String = _arrayBufferToBase64(imageData);

async function main() {
let pyodide = await loadPyodide();
pyodide.globals.set("imageDataPy", imageDataURL);
await pyodide.loadPackage("micropip");
await pyodide.runPythonAsync(`
import micropip
await micropip.install('numpy')
await micropip.install('scikit-image')
await micropip.install('cython')
await micropip.install('opencv-python')
import pyximport
pyximport.install()
import js
import io
import base64
from PIL import Image
from io import BytesIO
import matplotlib
import matplotlib.pyplot as plt
import numpy as np
from skimage import data, img_as_float
from skimage import exposure
from skimage.filters import unsharp_mask
from skimage import filters, transform
import skimage.color as color
matplotlib.rcParams['font.size'] = 8
img_data:bytes = base64.b64decode('${base64String}')
img: Image.Image = Image.open(io.BytesIO(img_data))
img_array: np.ndarray = np.array(img)
p2: float
p98: float
p2, p98 = np.percentile(img_array, (2, 98))
js.console.log('got image PIL')
img_rescale: np.ndarray = exposure.rescale_intensity(img_array, in_range=(p2, p98))
js.console.log('rescale_intensity image SKI')
img_eq: np.ndarray = exposure.equalize_hist(img_array)
js.console.log('equalize_hist image SKI')
resize4x: np.ndarray = transform.rescale(img_eq, 2)
js.console.log('2x resize SKI')
result_1: np.ndarray = unsharp_mask(resize4x, radius=1, amount=1)
js.console.log('unsharp mask SKI')
resize2x: np.ndarray = transform.pyramid_reduce(result_1,2)
js.console.log('1x downscale SKI')
img_eq_pil: Image.Image = Image.fromarray((resize2x * 255).astype(np.uint8))
buf: io.BytesIO = io.BytesIO()
img_eq_pil.save(buf, format='JPEG')
buf.seek(0)
img_str:str = base64.b64encode(buf.read()).decode('utf-8')
buf.close()
img_str
`).then(result => {
        const imgElement = document.getElementById('mvi');
        imgElement.src = "data:image/png;base64," + result;
        const downloadButton = document.getElementById('downloadButton'); // Assuming you have a button with this ID
        // document.querySelector('#scanvas').style.transform='scaleY(-1.0)';
        document.querySelector('#startBtnC').click();
        downloadButton.addEventListener('click', () => {
          downloadImage(result, 'histogram_eq_image.jpg');
        });
      });
    }
main();
}

function _arrayBufferToBase64(buffer) {
      let binary = '';
      const bytes = new Uint8Array(buffer);
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return window.btoa(binary);

}

function downloadImage(base64String, filename) {
      const link = document.createElement('a');
      link.href = "data:image/jpeg;base64," + base64String;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
}

function processImageFromURL(pth) {
    const xhr = new XMLHttpRequest();
    document.querySelector('#mvi').src = pth;
    xhr.open('GET', pth, true);
    xhr.responseType = 'arraybuffer';
    console.log('got py image');
    xhr.onload = function() {
      const imageData = xhr.response;
      processImage(imageData); // Reuse the processImage function
    };
    xhr.send();
}

document.getElementById("pyBtn2").addEventListener('click',function() {
document.querySelector('#scanvas').style.transform='scaleY(-1.0)';
const imageDataUrl = document.getElementById('scanvas').toDataURL('image/jpeg'); // You can change the format if needed
  document.getElementById('mvi').src=imageDataUrl
  document.querySelector('#mvi').style.transform='scaleY(-1.0)';
  document.querySelector('#mvi').style.transform='scaleX(-1.0)';
});
</script>

<script type="module">
document.getElementById("startBtn").addEventListener('click',function(){
document.getElementById('mvi').play();
});
document.getElementById("mviBtn").addEventListener('click',function(){
document.getElementById('mvi').play();
});
document.getElementById("apngBtn2").addEventListener('click',function(){
  const xhr = new XMLHttpRequest();
  xhr.open('GET', 'https://wasm.noahcohn.com/b3hd/w0-012-apng.3ijs', true); // Replace with your filename
  xhr.responseType = 'arraybuffer'; // Get raw binary data
  console.log('got run');
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
      result += String.fromCodePoint(codePoint);
    }
    return result;
  }
  xhr.onload = function() {
    console.log('got load');
    if (xhr.status === 200) {
      console.log('got script');
      const utf32Data = xhr.response;
      //  const decoder = new TextDecoder('utf-32'); // Or 'utf-32be'
      const jsCode = decodeUTF32(new Uint8Array(utf32Data), true); // Assuming little-endian
      const scr = document.createElement('script');
      //  scr.type = 'module';
      scr.text = jsCode;
      //    scr.dataset.moduleUrl = 'https://wasm.noahcohn.com/b3hd/'; // Base URL for module's relative paths
      document.body.appendChild(scr);
      setTimeout(function(){
        var Module = libapng();
        Module.onRuntimeInitialized = function(){
Module.callMain();
console.log('call main');
        };
      },2500);
    }
  };
  xhr.send();
});

setTimeout(function(){
document.querySelector('#splash2').style.zIndex=3000;
document.querySelector('#splash2').style.display='none';
},4200);
setTimeout(function(){
document.querySelector('#splash1').style.zIndex=3000;
document.querySelector('#splash1').style.display='none';
},4500);

setTimeout(function(){
document.getElementById('vsiz').innerHTML=parseInt(window.innerHeight,10);
},500);

setTimeout(function(){
window.scrollTo({
  top: 0,
  left: 0,
  behavior: "smooth",
  });
},1500);

</script>


</>
)

}

export default App
