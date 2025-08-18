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
    if (!model || !contentImg || !styleImg) {
      setStatus('Please select both a content and a style image.');
      return;
    }

    setLoading(true);
    setStatus('Stylizing image...');

    try {
      // 1. Load images into memory
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

      // 2. Resize images to prevent GPU errors
      setStatus('Images loaded. Resizing...');
      const MAX_DIMENSION = 1024;
      const resizeImageToCanvas = (image, maxDimension) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        let { width, height } = image;

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
      
      // 3. THE FIX: Set the result canvas dimensions
      const resultCanvas = stylizedImgRef.current;
      resultCanvas.width = contentCanvas.width;
      resultCanvas.height = contentCanvas.height;

      // 4. Stylize the image
      setStatus('Applying style...');
      await model.stylize(contentCanvas, styleCanvas, resultCanvas);

      setStylizedImg(resultCanvas.toDataURL());
      setStatus('Stylization complete!');

    } catch (error) {
        console.error("Error during stylization:", error);
        setStatus('An error occurred during stylization. Please check the console for details.');
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
