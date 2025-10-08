import { useState, useEffect, useCallback } from 'react';
import { initializeTextGenerator, generateText } from '../api/textGeneration';
import { initializeImageCaptioner, captionImage } from '../api/imageCaptioning';
// 1. IMPORT our new classifier functions
import { initializeTextClassifier, classifyText } from '../api/textClassification';

// 2. DEFINE our gesture labels and the mapping to animation names
// These labels are what the AI will classify text into.
const GESTURE_LABELS = ['greeting', 'agreement', 'disagreement', 'question', 'farewell'];
// This map translates the AI label to a specific animation your avatar can perform.
const GESTURE_MAP = {
  greeting: 'wave',
  farewell: 'wave',
  agreement: 'nod',
  disagreement: 'shake_head',
  question: 'think', // You'll need a 'think' animation in your model
};

const useAI = () => {
  const [generator, setGenerator] = useState(null);
  const [imageCaptioner, setImageCaptioner] = useState(null);
  const [classifier, setClassifier] = useState(null); // 3. ADD state for the new model
  const [statusMessage, setStatusMessage] = useState('Initializing...');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCaptioning, setIsCaptioning] = useState(false);
  const [generatedOutput, setGeneratedOutput] = useState('');
  const [generatedCaption, setGeneratedCaption] = useState('');
  const [modelsLoaded, setModelsLoaded] = useState(false);

  useEffect(() => {
    const loadModels = async () => {
      // Load all three models in parallel for efficiency
      const [textGen, imgCap, textClassifier] = await Promise.all([
        initializeTextGenerator(setStatusMessage),
        initializeImageCaptioner(setStatusMessage),
        initializeTextClassifier(setStatusMessage) // 4. INITIALIZE the new model
      ]);

      setGenerator(() => textGen);
      setImageCaptioner(() => imgCap);
      setClassifier(() => textClassifier); // 5. SET the new model in state

      if (textGen && imgCap && textClassifier) { // 6. CHECK that all models loaded
        setStatusMessage("All models loaded!");
        setModelsLoaded(true);
      } else {
        setStatusMessage("A model failed to load. Check the console for errors.");
      }
    };
    loadModels();
  }, []);

  const handleGenerateText = useCallback(async (prompt) => {
    if (!generator) return;
    setIsGenerating(true);
    setGeneratedOutput('');
    try {
      const output = await generateText(prompt, { max_new_tokens: 128 });
      setGeneratedOutput(output[0].generated_text.replace(prompt, '').trim());
    } catch (error) {
      console.error("Error generating text:", error);
      setGeneratedOutput("Sorry, an error occurred while generating text.");
    } finally {
      setIsGenerating(false);
    }
  }, [generator]);

  const handleImageCaptioning = useCallback(async (imageSrc) => {
    if (!imageCaptioner) return;
    setIsCaptioning(true);
    setGeneratedCaption("Generating caption...");
    try {
      const captions = await captionImage(imageSrc);
      if (captions && captions.length > 0 && captions[0].generated_text) {
        setGeneratedCaption(captions[0].generated_text);
      } else {
        throw new Error("Received an invalid response from the captioning model.");
      }
    } catch (error) {
      console.error("Error captioning image:", error);
      setGeneratedCaption(`Error: ${error.message}`);
    } finally {
      setIsCaptioning(false);
    }
  }, [imageCaptioner]);

  // 7. CREATE a new function to get a gesture for a piece of text
  const getGestureForText = useCallback(async (text) => {
    if (!classifier) return 'idle'; // Default to 'idle' if the model isn't ready
    try {
      const bestLabel = await classifyText(text, GESTURE_LABELS);
      // Look up the animation in our map, or default to 'idle' if no specific gesture fits
      return GESTURE_MAP[bestLabel] || 'idle';
    } catch (error) {
      console.error("Error classifying gesture:", error);
      return 'idle'; // Default on error
    }
  }, [classifier]);

  return {
    statusMessage,
    isGenerating,
    isCaptioning,
    generatedOutput,
    generatedCaption,
    handleGenerateText,
    handleImageCaptioning,
    modelsLoaded,
    getGestureForText // 8. EXPOSE the new function from the hook
  };
};

export default useAI;
