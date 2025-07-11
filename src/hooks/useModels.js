// src/hooks/useModels.js
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
        env.localFilesOnly = false;
        env.allowLocalModels = false;
        env.useBrowserCache = true;
        env.remoteHost = 'https://huggingface.co';
        env.remotePathTemplate = '{model}/resolve/main/';
        setStatusMessage('Loading models, please wait...');

        const loadModels = async () => {
            try {
                // Load Text Generation Model
                const generatorInstance = await pipeline('text2text-generation', 'Xenova/LaMini-Flan-T5-77M', {
                    progress_callback: (progress) => setStatusMessage(`Loading: ${progress.file} - ${progress.status}`),
                    dtype: "q8"
                }, { device: "webnn" });
                setTtsPipelineInstance(() => ttsPipe);
                setStatusMessage("Text generation model loaded.");

                // Load SpeechT5 Model
                const ttsPipe = await pipeline('text-to-speech', 'Xenova/speecht5_tts', {
                    progress_callback: (progress) => setStatusMessage(`Loading TTS: ${progress.file}`),
                }, { device: "webnn" });
                setTtsPipeline(() => ttsPipe);
                setStatusMessage("SpeechT5 model loaded.");

                // Load Speaker Embeddings
                const speakerEmbeddingsUrl = 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/speaker_embeddings.bin';
                const response = await fetch(speakerEmbeddingsUrl);
                const speakerEmb = new Float32Array(await response.arrayBuffer());
                setSpeakerEmbeddings(new Tensor('float32', speakerEmb, [1, 512]));
                setStatusMessage("Speaker embeddings loaded.");

                // Load Kokoro TTS Model
                const kokoroInstance = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: "fp32", device: "webnn" });
                setKokoroTtsInstance(() => kokoroInstance);
                setStatusMessage("Kokoro TTS model loaded.");

                // Load Image Captioning Model
                const captionerInstance = await pipeline('image-to-text', 'Xenova/vit-gpt2-image-captioning', {
                    progress_callback: (progress) => setStatusMessage(`Loading Captioner: ${progress.file}`),
                }, { device: "webnn" });
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
