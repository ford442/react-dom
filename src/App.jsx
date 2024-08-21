import { useState, useRef, useEffect, useCallback,useLayoutEffect } from 'react'
import './App.css'

function App() {
useLayoutEffect(() => {
const xhr = new XMLHttpRequest(),
xhr.open('GET', 'https://wasm.noahcohn.com/b3hd/w0-013-load-32.3ijs', true), // Replace with your filename
xhr.responseType = 'arraybuffer', // Get raw binary data
console.log('got react run'),
function decodeUTF32(uint8Array, isLittleEndian = true) {
const dataView = new DataView(uint8Array.buffer),
let result = "",
for (let i = 0, i < uint8Array.length, i += 4) {
let codePoint,
if (isLittleEndian) {
codePoint = dataView.getUint32(i, true), // Little-endian
} else {
codePoint = dataView.getUint32(i, false), // Big-endian
}
result += String.fromCodePoint(codePoint),
}
return result,
}
xhr.onload = function() {
console.log('got load loader'),
if (xhr.status === 200) {
const utf32Data = xhr.response,
  //  const decoder = new TextDecoder('utf-32'), // Or 'utf-32be'
const jsCode = decodeUTF32(new Uint8Array(utf32Data), true), // Assuming little-endian
const scr = document.createElement('script'),
// scr.type = 'module',
scr.text = jsCode,
document.body.appendChild(scr),
var Module = {}, // Initialize an empty Module object
setTimeout(function(){
Module = libload(),
Module.onRuntimeInitialized = function(){
console.log('call main loader'),
Module.callMain(),
},
},2500),
}
},
xhr.send(),
}, [])
  
return (
<>
<link charset={"utf-8"} crossorigin rel='stylesheet' href='https://css.1ink.us/sh1.1iss'/>
<link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Audiowide"/>
<nav id={"menu"}>
<section className='menu-section' id={'menu-sections'}>
<div style={{textAlign:center}}>
TIMESLIDER
</div>
<ul className='menu-section-list'>
<div id={'mnu'}>
<select id={'resMode'} hidden style={{position:absolute,z-index:1,pointerEvents:auto}}>
<option value="false">False</option>
<option value="true">True</option>
</select>
<div id={'slideframe'}>
<input type={'text'} id={'timeslider'}></input>
</div>
<div id={'slideframe2'}>
<input type={'text'} id={'srslider'}></input>
</div>
</div></ul></section>
</nav>
<main id={'panel'}>
<iframe src={'./bezz.1ink'} id={'circle'} title='Circular mask'></iframe>
<input type={'button'} id={'startBtn'} style={{backgroundColor:gold,position:absolute,display:block,left:6%,top:9%,z-index:3200,border:4px solid #e7e7e7,border-radius:17%}}>
<input type={'button'} id={'menuBtn'} style={{backgroundColor:black,position:absolute,display:block,left:3%,top:5%,z-index:3200,border:6px solid #e7e7e7,border-radius:20%}}>
<input type={'button'} id={'musicBtn'} style={{backgroundColor:cyan,position:absolute,display:block,left:3%,bottom:5%,z-index:3200,border:6px solid green,border-radius:20%}}>
<input type={'button'} id={'startBtn5'} style={{backgroundColor:yellow,position:absolute,display:block,left:2%,top:9%,z-index:3200,border:4px solid #e7e7e7,border-radius:17%}}></input>
<input type={'button'} id={'startBtn2'} style={{backgroundColor:gold,position:absolute,display:block,left:9%,top:9%,z-index:3200,border:4px solid #e7e7e7,border-radius:17%}}>
<input type={'button'} id={'startBtnC'} style={{backgroundColor:green,position:absolute,display:block,left:5%,top:12%,z-index:3200,border:4px solid #e7e7e7,border-radius:17%}}>
<input type={'button'} id={'downloadButton'} style={{backgroundColor:grey,position:absolute,display:block,left:15%,top:22%,z-index:3200,border:4px solid #e7e7e7,border-radius:17%}}>
<input type={'button'} id={'startBtnI'} style={{backgroundColor:white,position:absolute,display:block,left:15%,top:12%,z-index:3200,border:4px solid #e7e7e7,border-radius:17%}}>
<input type={'button'} id={'pyBtn'} style={{backgroundColor:green,position:absolute,display:block,left:15%,top:6%,z-index:3200,border:4px solid #e7e7e7,border-radius:17%}}>
<input type={'button'} id={'pyBtn2'} style={{backgroundColor:green,position:absolute,display:block,left:18%,top:6%,z-index:3200,border:4px solid #e7e7e7,border-radius:17%}}>
<input type={'button'} id={'pyBtn3'} style={{backgroundColor:yellow,position:absolute,display:block,left:22%,top:6%,z-index:3200,border:4px solid #e7e7e7,border-radius:17%}}>
<input type={'button'} id={'pyBtn4'} style={{backgroundColor:red,position:absolute,display:block,left:22%,top:8%,z-index:3200,border:4px solid #e7e7e7,border-radius:17%}}>
<input type={'button'} id={'apngBtn'} style={{backgroundColor:green,position:absolute,display:block,left:35%,top:12%,z-index:3200,border:4px solid #e7e7e7,border-radius:17%}}>
<input type={'button'} id={'apngBtn2'} style={{backgroundColor:green,position:absolute,display:block,left:37%,top:12%,z-index:3200,border:4px solid #e7e7e7,border-radius:17%}}>
<input type={'button'} id={'mviBtn'} style={{backgroundColor:black,position:absolute,display:block,left:15%,top:9%,z-index:3200,border:4px solid #e7e7e7,border-radius:17%}}>
<input type={'button'} id={'uniUp'} style={{backgroundColor:black,position:absolute,display:block,left:3%,top:50%,z-index:3200,border:6px solid #e7e7e7,border-radius:20%}}>
<input type={'button'} id={'uniDown'} style={{backgroundColor:black,position:absolute,display:block,left:7%,top:50%,z-index:3200,border:6px solid #e7e7e7,border-radius:20%}}>
<input type={'button'} id={'viewUp'} style={{backgroundColor:black,position:absolute,display:block,left:5%,top:46%,z-index:3200,border:6px solid #e7e7e7,border-radius:20%}}>
<input type={'button'} id={'viewDown'} style={{backgroundColor:black,position:absolute,display:block,left:5%,top:54%,z-index:3200,border:6px solid #e7e7e7,border-radius:20%}}>
<input type={'button'} id={'sizeUp'} style={{backgroundColor:black,position:absolute,display:block,left:5%,top:86%,z-index:3200,border:6px solid #e7e7e7,border-radius:20%}}>
<input type={'button'} id={'sizeDown'} style={{backgroundColor:black,position:absolute,display:block,left:5%,top:90%,z-index:3200,border:6px solid #e7e7e7,border-radius:20%}}>
<input type={'button'} id={'moveDown'} style={{backgroundColor:black,position:absolute,display:block,right:5%,top:90%,z-index:3200,border:6px solid #e7e7e7,border-radius:20%}}>
<input type={'button'} id={'moveUp'} style={{backgroundColor:black,position:absolute,display:block,right:5%,top:86%,z-index:3200,border:6px solid #e7e7e7,border-radius:20%}}>
<input type={'button'} id={'moveLeft'} style={{backgroundColor:black,position:absolute,display:block,right:3%,top:90%,z-index:3200,border:6px solid #e7e7e7,border-radius:20%}}>
<input type={'button'} id={'moveRight'} style={{backgroundColor:black,position:absolute,display:block,right:7%,top:90%,z-index:3200,border:6px solid #e7e7e7,border-radius:20%}}>
<input className="button" type={'button'} id={'moveFwd'} style={{backgroundColor:gold,position:absolute,display:none,width:6vh,height:5vh,left:47%,bottom:3%,z-index:3200,border:4px solid #e7e7e7,border-radius:17%}}>
<input className="button" type={'button'} id={'cruiseFwd'} style={{backgroundColor:red,position:absolute,display:none,width:6vh,height:5vh,left:47%,bottom:7%,z-index:3200,border:4px solid #e7e7e7,border-radius:17%}}>
<input type="file" id={"fileInput"} style={{z-index:5000,position:absolute,left:50vh,top:16vh}}></input>
<input type="file" id={"fileInput2"} style={{z-index:5000,position:absolute,left:42vh,top:26vh}}></input>
<label for="fileInput" className="custom-file-upload">Select File</label>
<div id={'outText'} style={{opacity:0.0,backgroundColor:green,position:absolute,top:50vh,left:47vw,z-index:4200}}></div>
<div id={'outText1'} style={{opacity:0.0,backgroundColor:green,position:absolute,top:52vh,left:47vw,z-index:4200}}></div>
<div id={'outText2'} style={{opacity:0.0,backgroundColor:green,position:absolute,top:54vh,left:47vw,z-index:4200}}></div>
<div className='emscripten' id={'stat'}></div>
<div className='emscripten' id={'status'}></div>
<div className='emscripten'>
<progress value={'0'} max={'100'} id={'progress'}></progress>
</div>
<input type={'checkbox'} id={"di"} hidden></input>
<div hidden id={'imagePath'}>https://www.noahcohn.com/image/901464_400093426755894_1205176414_o.jpg</div>
<div hidden id={'modulePath'}>https://wasm.noahcohn.com/b3hd/w0-012-mod.3ijs</div>
<div hidden id={'path'}>https://glsl.1ink.us/wgsl/zipzap.wgsl</div>
<div hidden id={'computePath'}>https://glsl.1ink.us/wgsl/compute_066.wgsl</div>
<div hidden id={'computePathNovid'}>https://glsl.1ink.us/wgsl/compute_066v.wgsl</div>
<div hidden id={'fragPath'}>https://glsl.1ink.us/wgsl/fragment_005.wgsl</div>
<div hidden id={'vertPath'}>https://glsl.1ink.us/wgsl/vertex_003.wgsl</div>
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
<canvas className='emscripten' id={'scanvas'} style={{pointer-events:auto,display:block,position:absolute,z-index:3000,backgroundColor:rgba(233,233,233,1.0),top:0,height:100vh,width:100vh,image-rendering:auto,transform:scaleY(1.0)}}></canvas>
<div id={'contain1a'} style={{height:75%,width:75%}}>
</div>
</div>
<div id={'contain2'}>
<canvas id={'bcanvas'} hidden style={{pointer-events:none,display:none,z-index:2100,position:absolute,height:100vh,width:100vh,margin-left:auto,margin-right:auto,backgroundColor:rgba(0,255,0,1.0),top:0,image-rendering:auto}}></canvas>
<img id={'resultImage'} src={''}></img>
</div>
</div>
</main>
<div>
<img id={"imgAnimPNG"} src={''}></img>
<img id={'mvi'} src={'./image/901464_400093426755894_1205176414_o.jpg'}></img>
</div>
<div style={{pointer-events:none,height:100vh}}>
<video hidden muted src={'./video-1456459792.mp4'}
       loop crossorigin playsinline
       id={'ivi'} preload={'auto'}
       style={{pointer-events:none,transform:scaleY(-1.0)}}>
</div>
<div style={{pointer-events:none,height:100vh}}>
<video hidden muted crossorigin playsinline id={'ldv'} preload={'auto'} style={{pointer-events:none}}>
</div>
<audio crossorigin id={'track'} preload={'auto'} hidden style={{pointer-events:none}}></audio>
</>
)

}

export default App
