import { useState, useRef, useEffect, useCallback } from 'react'

function App() {
  
useEffect(() => {
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
<div className=''>
Testing React load 3ijs...
</div>
)

}

export default App
