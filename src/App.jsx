import { useState, useRef, useEffect, useCallback } from 'react'

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
console.log('got load');
if (xhr.status === 200) {
console.log('got script');
const utf32Data = xhr.response;
  //  const decoder = new TextDecoder('utf-32'); // Or 'utf-32be'
const jsCode = decodeUTF32(new Uint8Array(utf32Data), true); // Assuming little-endian
const scr = document.createElement('script');
scr.type = 'module';
scr.text = jsCode;
document.body.append(scr);
var Module = {}; // Initialize an empty Module object
setTimeout(function(){
Module = libload();
Module.onRuntimeInitialized = function(){
Module.callMain();
console.log('call main');
};
},5000);
}
};
xhr.send();
}, [])
  
return (
<>
<div id='modulePath'></div>
<div id='vsiz'></div>
<div id='shut'></div>
<div id='circle'></div>
<div id='pmhig'></div>
<div id='ihig'></div>
<div id='scanvas'></div>
<div id='bcanvas'></div>
<div id='di'></div>
<div id='status'></div>
<div id='infoBtn'></div>
<div id='srsiz'></div>
<div id='tim'></div>
<div id='menuBtn'></div>
<div id='slideframe'></div>
<div id='slideframe2'></div>
<div id='panel'></div>
<div id='menu'></div>
</>
)

}

export default App
