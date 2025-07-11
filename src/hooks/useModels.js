import { useState, useEffect } from 'react';
import { pipeline, env, Tensor } from "@huggingface/transformers";
import { KokoroTTS } from 'kokoro-js';

export const useModels = () => {
    const [generator, setGenerator] = useState(null);
    const [statusMessage, setStatusMessage] = useState('Initializing...');
    const [ttsPipelineInstance, setTtsPipelineInstance] = useState(null);
    const [speakerEmbeddings, setSpeakerEmbeddings] = useState(null);
    const [kokoroTtsInstance, setKokoroTtsInstance] = useState(null);
    const [imageCaptioner, setImageCaptioner] = useState(null);

    useEffect(() => {
        const loadModels = async () => {
            try {
                setStatusMessage('Loading models, please wait...');
                
                // Load Text Generation Model
                const generatorInstance = await pipeline('text2text-generation', 'Xenova/LaMini-Flan-T5-77M');
                setGenerator(() => generatorInstance);
                setStatusMessage("Text generation model loaded.");

                // Load SpeechT5 Model
                // This is the section with the likely error.
                // 1. First, we create the pipeline and wait for it to finish.
                const ttsPipe = await pipeline('text-to-speech', 'Xenova/speecht5_tts');
                // 2. THEN, we use the created 'ttsPipe' to set the state.
                setTtsPipelineInstance(() => ttsPipe);
                setStatusMessage("SpeechT5 model loaded.");

                // Load Speaker Embeddings
                const speakerEmbeddingsUrl = 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/speaker_embeddings.bin';
                const response = await fetch(speakerEmbeddingsUrl);
                const speakerEmb = new Float32Array(await response.arrayBuffer());
                setSpeakerEmbeddings(new Tensor('float32', speakerEmb, [1, 512]));
                setStatusMessage("Speaker embeddings loaded.");

                // Load Kokoro TTS Model
                const kokoroInstance = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX');
                setKokoroTtsInstance(() => kokoroInstance);
                setStatusMessage("Kokoro TTS model loaded.");

                // Load Image Captioning Model
                const captionerInstance = await pipeline('image-to-text', 'Xenova/vit-gpt2-image-captioning');
                setImageCaptioner(() => captionerInstance);
                setStatusMessage("All models loaded successfully!");

            } catch (error) {
                console.error("Failed to load a model:", error);
                setStatusMessage(`Error loading models: ${error.message}`);
            }
        };

        loadModels();
    }, []);

    return {
        generator,
        statusMessage,
        ttsPipelineInstance,
        speakerEmbeddings,
        kokoroTtsInstance,
        imageCaptioner,
    };
};
