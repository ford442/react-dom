import React from 'react';

const ImageCaptioning = ({
  imageToCaption,
  setImageToCaption, // New prop to set the image file/URL
  generatedCaption,
  isCaptioning,
  imageCaptioner, // Image captioning model instance
  handleImageSelection, // Function to handle file input change
  handleImageCaptioning, // Function to trigger captioning
  // setStatusMessage, // If this component needs to set global status
}) => {
  return (
    <div style={{
      // Copied from App.jsx for this section
      // position: 'absolute',
      // zIndex: 7000,
      marginTop: '20px',
      padding: '15px',
      borderTop: '1px solid #ddd',
      backgroundColor: 'rgba(230, 230, 250, 0.9)',
      marginBottom: '20px', // Added for spacing
    }}>
      <h2>Image Captioning (ViT-GPT2)</h2>
      <input
        type="file"
        accept="image/*"
        onChange={handleImageSelection}
        disabled={isCaptioning || !imageCaptioner}
        style={{ marginBottom: '10px', display: 'block', pointerEvents: 'auto', zIndex: 9000 }} // zIndex might be an issue if not managed globally
      />
      {imageToCaption && (
        <img
          src={typeof imageToCaption === 'string' ? imageToCaption : URL.createObjectURL(imageToCaption)}
          alt="Selected for captioning"
          style={{ maxWidth: '100%', maxHeight: '200px', marginBottom: '10px', border: '1px solid #ccc' }}
        />
      )}
      <button
        onClick={handleImageCaptioning}
        disabled={!imageCaptioner || !imageToCaption || isCaptioning}
        style={{ padding: '10px 15px', width: '100%', marginBottom: '10px', pointerEvents: 'auto', zIndex: 9000 }}
      >
        {isCaptioning ? 'Generating Caption...' : 'Generate Caption'}
      </button>
      <h3>Generated Caption:</h3>
      <div style={{
        minHeight: '40px', padding: '10px', border: '1px solid #eee',
        backgroundColor: '#f9f9f9', whiteSpace: 'pre-wrap'
      }}>
        {generatedCaption}
      </div>
    </div>
  );
};

export default ImageCaptioning;
