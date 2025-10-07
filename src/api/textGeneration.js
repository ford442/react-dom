import { pipeline } from "@huggingface/transformers";

let generator = null;

export const initializeTextGenerator = async (setStatusMessage) => {
  try {
    setStatusMessage("Loading text generation model...");
    generator = await pipeline('text2text-generation', 'Xenova/LaMini-Flan-T5-783M', {
      quantized: true
    });
    setStatusMessage("Text generation model loaded!");
    return generator;
  } catch (error) {
    console.error("Failed to load text generation model:", error);
    setStatusMessage(`Error loading model: ${error.message}`);
    return null;
  }
};

export const generateText = async (prompt, args) => {
  if (!generator) {
    throw new Error("Text generator not initialized.");
  }
  return await generator(prompt, args);
};
