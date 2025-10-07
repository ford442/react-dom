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

  useEffect(() => {
    const loadModels = async () => {
      const textGen = await initializeTextGenerator(setStatusMessage);
      setGenerator(() => textGen);
      const imgCap = await initializeImageCaptioner(setStatusMessage);
      setImageCaptioner(() => imgCap);
      setStatusMessage("All models loaded!");
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
    } finally {
      setIsGenerating(false);
    }
  }, [generator]);

  const handleImageCaptioning = useCallback(async (imageSrc) => {
    if (!imageCaptioner) return;
    setIsCaptioning(true);
    setGeneratedCaption('');
    try {
      const captions = await captionImage(imageSrc);
      setGeneratedCaption(captions[0].generated_text);
    } catch (error) {
      console.error("Error captioning image:", error);
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
    modelsLoaded: !!generator && !!imageCaptioner
  };
};

export default useAI;
