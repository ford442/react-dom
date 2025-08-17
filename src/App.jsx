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

  const contentImgRef = useRef(null);
  const styleImgRef = useRef(null);
  const stylizedImgRef = useRef(null);

  // Load the model on component mount
  useEffect(() => {

      
    const loadModel = async () => {
      try {
        const newModel = new mm.ArbitraryStyleTransferNetwork();
        await newModel.initialize();
        setModel(newModel);
        setLoading(false);
        setStatus('Model loaded. Ready to stylize.');
      } catch (error) {
        console.error("Error loading model:", error);
        setStatus('Error loading model. Please try refreshing.');
      }
    };
    loadModel();
  }, []);

  const handleContentImage = (e) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setContentImg(event.target.result);
      }
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleStyleImage = (e) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setStyleImg(event.target.result);
      }
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const stylizeImage = async () => {
    if (!model || !contentImg || !styleImg) {
      setStatus('Please select both a content and a style image.');
      return;
    }

    setStatus('Stylizing image...');
    setLoading(true);

    try {
      // 1. Create Image elements in memory to ensure they are fully loaded
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

      setStatus('Images loaded. Preparing data...');

      // 2. Create in-memory canvases to draw the images onto
      const contentCanvas = document.createElement('canvas');
      const styleCanvas = document.createElement('canvas');
      const contentCtx = contentCanvas.getContext('2d');
      const styleCtx = styleCanvas.getContext('2d');

      // 3. Set canvas dimensions and draw the loaded images
      contentCanvas.width = loadedContentImg.width;
      contentCanvas.height = loadedContentImg.height;
      contentCtx.drawImage(loadedContentImg, 0, 0);

      styleCanvas.width = loadedStyleImg.width;
      styleCanvas.height = loadedStyleImg.height;
      styleCtx.drawImage(loadedStyleImg, 0, 0);

      const resultCanvas = stylizedImgRef.current;

      setStatus('Applying style...');

      // 4. Pass the CANVASES to the model instead of the image elements
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
          {contentImg && <img ref={contentImgRef} src={contentImg} alt="Content" width="200" />}
        </div>

        <div className="input-group">
          <label htmlFor="style-img-input">Style Image:</label>
          <input id="style-img-input" type="file" onChange={handleStyleImage} accept="image/*" />
          {styleImg && <img ref={styleImgRef} src={styleImg} alt="Style" width="200" />}
        </div>

        <button onClick={stylizeImage} disabled={loading || !contentImg || !styleImg}>
          {loading ? 'Processing...' : 'Stylize'}
        </button>
      </div>

      <div className="panel-section">
        <h3>Result</h3>
        <div className="generated-output-display">
            {stylizedImg ? (
                <img src={stylizedImg} alt="Stylized" style={{maxWidth: '100%'}}/>
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
