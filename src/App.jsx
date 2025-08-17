import { useState, useRef, useEffect } from 'react';
import './App.css';
import * as mm from '@magenta/image';

function App() {
  const [model, setModel] = useState(null);
  const [styleImg, setStyleImg] = useState(null);
  const [contentImg, setContentImg] = useState(null);
  const [stylizedImg, setStylizedImg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('Loading model...');

  const stylizedImgRef = useRef(null);

  // Load the model on component mount
  useEffect(() => {
    const loadModel = async () => {
      try {
        console.log("Creating ArbitraryStyleTransferNetwork model...");
        const newModel = new mm.ArbitraryStyleTransferNetwork();
        console.log("Model created. Initializing...");
        await newModel.initialize();
        console.log("Model initialized successfully.");
        setModel(newModel);
        setStatus('Model loaded. Ready to stylize.');
      } catch (error) {
        console.error("CRITICAL: Failed to initialize the model.", error);
        setStatus('Error: Could not load the Magenta.js model.');
      } finally {
        setLoading(false);
      }
    };
    loadModel();
  }, []);

  const handleContentImage = (e) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => setContentImg(event.target.result);
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleStyleImage = (e) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => setStyleImg(event.target.result);
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const stylizeImage = async () => {
    // --- Guard Clauses & Initial Logging ---
    console.log("--- Starting Stylization ---");
    if (!model) {
      console.error("Stylize blocked: Model is not loaded.");
      setStatus('Error: Model not loaded.');
      return;
    }
    if (!contentImg || !styleImg) {
      console.error("Stylize blocked: Content or Style image is missing.");
      setStatus('Please select both a content and a style image.');
      return;
    }

    setLoading(true);
    setStatus('Stylizing image...');

    try {
      // 1. Load images into memory
      console.log("Step 1: Loading images into memory.");
      const contentImageElement = new Image();
      const styleImageElement = new Image();

      const contentPromise = new Promise((resolve, reject) => {
        contentImageElement.onload = () => resolve(contentImageElement);
        contentImageElement.onerror = reject;
        contentImageElement.src = contentImg;
      });

      const stylePromise = new Promise((resolve, reject) => {
        styleImageElement.onload = () => resolve(styleImageElement);
        styleImageElement.onerror = reject;
        styleImageElement.src = styleImg;
      });

      const [loadedContentImg, loadedStyleImg] = await Promise.all([contentPromise, stylePromise]);
      console.log("Step 1 Complete: Images loaded.", { loadedContentImg, loadedStyleImg });

      // 2. Resize images
      setStatus('Images loaded. Resizing for GPU compatibility...');
      console.log("Step 2: Resizing images.");
      const MAX_DIMENSION = 1024;
      const resizeImageToCanvas = (image, maxDimension) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        let { width, height } = image;

        if (!width || !height) {
            console.error("Cannot resize image with zero dimensions.", image);
            return null; // Return null if the image is invalid
        }

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(image, 0, 0, width, height);
        return canvas;
      };

      const contentCanvas = resizeImageToCanvas(loadedContentImg, MAX_DIMENSION);
      const styleCanvas = resizeImageToCanvas(loadedStyleImg, MAX_DIMENSION);
      const resultCanvas = stylizedImgRef.current;
      console.log("Step 2 Complete: Canvases prepared.", { contentCanvas, styleCanvas, resultCanvas });

      // --- Pre-Stylize Sanity Checks ---
      if (!contentCanvas || !styleCanvas || !resultCanvas) {
          throw new Error("One of the required canvases (content, style, or result) is invalid.");
      }
      
      setStatus('Applying style...');
      console.log("Step 3: Calling model.stylize()...");

      // 3. Pass the resized canvases to the model
      await model.stylize(contentCanvas, styleCanvas, resultCanvas);
      console.log("Step 3 Complete: model.stylize() finished.");

      setStylizedImg(resultCanvas.toDataURL());
      setStatus('Stylization complete!');
      console.log("--- Stylization Successful ---");

    } catch (error) {
        console.error("Error during stylization:", error);
        setStatus('An error occurred. Check the console for details.');
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="floating-control-panel base-panel">
      <div className="panel-section">
        <h2>Magenta.js Image Style Transfer</h2>
        <p className="status-display">{status}</p>

        <div className="input-group">
          <label htmlFor="content-img-input">Content Image:</label>
          <input id="content-img-input" type="file" onChange={handleContentImage} accept="image/*" />
          {contentImg && <img src={contentImg} alt="Content" width="200" />}
        </div>

        <div className="input-group">
          <label htmlFor="style-img-input">Style Image:</label>
          <input id="style-img-input" type="file" onChange={handleStyleImage} accept="image/*" />
          {styleImg && <img src={styleImg} alt="Style" width="200" />}
        </div>

        <button onClick={stylizeImage} disabled={loading || !contentImg || !styleImg}>
          {loading ? 'Processing...' : 'Stylize'}
        </button>
      </div>

      <div className="panel-section">
        <h3>Result</h3>
        <div className="generated-output-display">
          {stylizedImg ? (
            <img src={stylizedImg} alt="Stylized" style={{ maxWidth: '100%' }} />
          ) : (
            <p>The stylized image will appear here.</p>
          )}
        </div>
        <canvas ref={stylizedImgRef} style={{ display: 'none' }} />
      </div>
    </div>
  );
}

export default App;
