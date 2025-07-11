// src/components/ImageCaptioning.jsx
import React from 'react';

const ImageCaptioning = ({
    handleImageSelection,
    handleImageCaptioning,
    isCaptioning,
    imageCaptioner,
    imageToCaption,
    generatedCaption
}) => {
    return (
        <div className="panel-section">
            <h2>Image Captioning (ViT-GPT2)</h2>
            <div className="input-group">
                <label htmlFor="image-caption-input">Upload an image:</label>
                <input
                    id="image-caption-input"
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelection}
                    disabled={isCaptioning || !imageCaptioner}
                />
            </div>
            {imageToCaption && (
                <img
                    src={typeof imageToCaption === 'string' ? imageToCaption : URL.createObjectURL(imageToCaption)}
                    alt="Selected for captioning"
                    style={{ maxWidth: '100%', maxHeight: '200px', margin: '10px 0', border: '1px solid #ccc' }}
                />
            )}
            <button
                onClick={handleImageCaptioning}
                disabled={!imageCaptioner || !imageToCaption || isCaptioning}
            >
                {isCaptioning ? 'Generating Caption...' : 'Generate Caption'}
            </button>
            <h3>Generated Caption:</h3>
            <div className="generated-output-display">
                {generatedCaption}
            </div>
        </div>
    );
};

export default ImageCaptioning;
