import { pipeline } from "@huggingface/transformers";

let captioner = null;

export const initializeImageCaptioner = async (setStatusMessage) => {
  try {
    setStatusMessage("Loading image captioning model...");
    captioner = await pipeline('image-to-text', 'Xenova/vit-gpt2-image-captioning');
    setStatusMessage("Image captioning model loaded!");
    return captioner;
  } catch (error) {
    console.error("Failed to load image captioning model:", error);
    setStatusMessage(`Error loading captioner: ${error.message}`);
    return null;
  }
};

export const captionImage = async (imageSrc) => {
  if (!captioner) {
    throw new Error("Image captioner not initialized.");
  }
  return await captioner(imageSrc, { max_new_tokens: 256 });
};
