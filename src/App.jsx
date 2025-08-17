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
    if (!model || !contentImgRef.current || !styleImgRef.current) {
      setStatus('Please select both a content and a style image.');
      return;
    }

    setStatus('Stylizing image...');
    setLoading(true);

    try {
      const canvas = stylizedImgRef.current;

      // Pass the canvas as the third argument. The model will draw the
      // stylized image directly onto it.
      await model.stylize(contentImgRef.current, styleImgRef.current, canvas);

      // Now that the image is drawn on the canvas, get its data URL for display.
      setStylizedImg(canvas.toDataURL());
      setStatus('Stylization complete!');

    } catch (error) {
        console.error("Error during stylization:", error);
        setStatus('An error occurred during stylization.');
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
