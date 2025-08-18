import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-wasm';

tf.setBackend('wasm').then(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
