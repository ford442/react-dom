// src/hooks/useSpeech.js
import { useState, useRef, useCallback } from 'react';

export const useSpeech = (playAudio, kokoroTtsInstance, ttsPipelineInstance, speakerEmbeddings, setIsTtsSpeaking) => {
    const [isListening, setIsListening] = useState(false);
    const [sttError, setSttError] = useState('');
    const recognitionRef = useRef(null);

    const setupSpeechRecognition = useCallback((onResult) => {
        const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognitionAPI) {
            setSttError("Your browser doesn't support Speech Recognition.");
            return;
        }
        const recognitionInstance = new SpeechRecognitionAPI();
        recognitionInstance.continuous = false;
        recognitionInstance.interimResults = false;
        recognitionInstance.lang = 'en-US';
        recognitionInstance.onresult = (event) => {
            const transcript = event.results[event.results.length - 1][0].transcript.trim();
            onResult(transcript);
        };
        recognitionInstance.onerror = (event) => {
            setSttError(`Speech Error: ${event.error}`);
            setIsListening(false);
        };
        recognitionInstance.onend = () => setIsListening(false);
        recognitionRef.current = recognitionInstance;
    }, []);

    const toggleListen = useCallback(() => {
        if (!recognitionRef.current) return;
        if (isListening) {
            recognitionRef.current.stop();
        } else {
            recognitionRef.current.start();
            setIsListening(true);
            setSttError('');
        }
    }, [isListening]);

    const synthesizeAndPlayText = useCallback(async (text, engine, personalityKey) => {
        if (!text || !text.trim()) return false;
        setIsTtsSpeaking(true);
        let success = false;
       try {
            if (engine === 'kokoro' && kokoroTtsInstance) {
                const output = await kokoroTtsInstance.generate(text.trim(), { voice: "af_heart" });
                playAudio(output.audio, output.sampling_rate, personalityKey);
                success = true;
            } else if (engine === 'speechT5' && ttsPipelineInstance && speakerEmbeddings) {
                const output = await ttsPipelineInstance(text.trim(), { speaker_embeddings: speakerEmbeddings });
                playAudio(output.audio, output.sampling_rate, personalityKey);
                success = true;
            }
        } catch (error) {
            console.error(`${engine} TTS Error:`, error);
            success = false;
        }
        setIsTtsSpeaking(false);
        return success;
    }, [playAudio, kokoroTtsInstance, ttsPipelineInstance, speakerEmbeddings, setIsTtsSpeaking]);

    return {
        isListening,
        sttError,
        setupSpeechRecognition,
        toggleListen,
        synthesizeAndPlayText,
    };
};
