import { useState, useEffect } from 'react';

export function useTexture(url) {
  const [texture, setTexture] = useState(null);

  useEffect(() => {
    if (!url) return;

    const img = new Image();
    img.crossOrigin = 'Anonymous'; // Important for using images from other domains
    img.src = url;

    img.onload = () => {
      // The image is now fully loaded, update our state
      setTexture(img);
    };

    img.onerror = () => {
      console.error(`Failed to load texture: ${url}`);
    };

  }, [url]); // This effect re-runs if the URL changes

  return texture;
}
