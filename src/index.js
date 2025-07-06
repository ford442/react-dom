import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// This finds the 'root' div in your public/index.html and tells React to render your app inside it.
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
