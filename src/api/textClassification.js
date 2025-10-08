import { pipeline } from "@huggingface/transformers";

let classifier = null;

/**
 * Initializes the zero-shot text classification pipeline from Hugging Face.
 */
export const initializeTextClassifier = async (setStatusMessage) => {
  try {
    setStatusMessage("Loading gesture analysis model...");
    // We use a lightweight, distilled model for fast performance in the browser.
    classifier = await pipeline('zero-shot-classification', 'Xenova/distilbert-base-zero-shot-mnli');
    setStatusMessage("Gesture analysis model loaded!");
    return classifier;
  } catch (error) {
    console.error("Failed to load text classification model:", error);
    setStatusMessage(`Error loading classifier: ${error.message}`);
    return null;
  }
};

/**
 * Classifies a given text against a list of candidate labels.
 * @param {string} text The text to classify.
 * @param {string[]} candidateLabels An array of labels to test against.
 * @returns {Promise<string>} The label with the highest score.
 */
export const classifyText = async (text, candidateLabels) => {
  if (!classifier) {
    throw new Error("Text classifier not initialized.");
  }
  // The model returns labels sorted by score, so the first one is the best match.
  const output = await classifier(text, candidateLabels);
  return output.labels[0];
};
