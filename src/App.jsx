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
      // Create new Image objects to guarantee they are fully loaded
      const contentImageElement = new Image();
      const styleImageElement = new Image();

      // Create promises that will resolve once the images' src has been loaded
      const contentPromise = new Promise((resolve, reject) => {
        contentImageElement.onload = resolve;
        contentImageElement.onerror = reject;
        contentImageElement.src = contentImg;
      });

      const stylePromise = new Promise((resolve, reject) => {
        styleImageElement.onload = resolve;
        styleImageElement.onerror = reject;
        styleImageElement.src = styleImg;
      });

      // Wait for both images to be fully loaded before proceeding
      await Promise.all([contentPromise, stylePromise]);

      setStatus('Images loaded. Applying style...');
      const canvas = stylizedImgRef.current;

      // Now we can safely pass the fully loaded image elements to the model
      await model.stylize(contentImageElement, styleImageElement, canvas);

      setStylizedImg(canvas.toDataURL());
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
