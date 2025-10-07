import React, { useState } from 'react';

const ImageCaptioning = ({ onCaption, isCaptioning, caption, disabled }) => {
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleCaptionClick = () => {
    if (imageFile) {
      onCaption(imagePreview);
    }
  };

  return (
    <div className="panel-section">
      <h3>Image Captioning</h3>
      <input type="file" accept="image/*" onChange={handleImageChange} disabled={disabled || isCaptioning} />
      {imagePreview && <img src={imagePreview} alt="Preview" style={{ maxWidth: '100%', height: 'auto', marginTop: '10px' }} />}
      <button onClick={handleCaptionClick} disabled={disabled || isCaptioning || !imageFile}>
        {isCaptioning ? 'Generating...' : 'Generate Caption'}
      </button>
      <div className='generated-output-display'>{caption}</div>
    </div>
  );
};

export default ImageCaptioning;
