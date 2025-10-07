import { useState, useEffect, useCallback } from 'react';
import { initializeTextGenerator, generateText } from '../api/textGeneration';
import { initializeImageCaptioner, captionImage } from '../api/imageCaptioning';

const useAI = () => {
  const [generator, setGenerator] = useState(null);
  const [imageCaptioner, setImageCaptioner] = useState(null);
  const [statusMessage, setStatusMessage] = useState('Initializing...');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCaptioning, setIsCaptioning] = useState(false);
  const [generatedOutput, setGeneratedOutput] = useState('');
  const [generatedCaption, setGeneratedCaption] = useState('');
  const [modelsLoaded, setModelsLoaded] = useState(false); // New state to control loading overlay

  useEffect(() => {
    const loadModels = async () => {
      const textGen = await initializeTextGenerator(setStatusMessage);
      setGenerator(() => textGen);
      const imgCap = await initializeImageCaptioner(setStatusMessage);
      setImageCaptioner(() => imgCap);

      if (textGen && imgCap) {
        setStatusMessage("All models loaded!");
        setModelsLoaded(true); // Set to true on success
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
    setGeneratedCaption("Generating caption..."); // Give immediate feedback
    try {
      const captions = await captionImage(imageSrc);
      // FIX: Add validation to ensure the caption exists before trying to access it
      if (captions && captions.length > 0 && captions[0].generated_text) {
        setGeneratedCaption(captions[0].generated_text);
      } else {
        throw new Error("Received an invalid response from the captioning model.");
      }
    } catch (error) {
      console.error("Error captioning image:", error);
      // FIX: Set a user-facing error message in the UI
      setGeneratedCaption(`Error: ${error.message}`);
    } finally {
      setIsCaptioning(false);
    }
  }, [imageCaptioner]);

  return {
    statusMessage,
    isGenerating,
    isCaptioning,
    generatedOutput,
    generatedCaption,
    handleGenerateText,
    handleImageCaptioning,
    modelsLoaded // Expose this for the loading screen
  };
};

export default useAI;
