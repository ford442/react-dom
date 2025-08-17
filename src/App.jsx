import { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import './App.css';
import * as mm from '@magenta/image';

function App() {



    async function load() {
              document.querySelector('#splash2').style.display='none';
         setTimeout(function() {
        document.querySelector('#splash1').style.display='none';
           document.querySelector('#contain1').style.pointerEvents='auto';
         }, 1500);
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
          </div>
      </main>
    </>
  );
}

export default App;
