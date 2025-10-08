import { useState, useEffect, useCallback, useRef } from 'react';
import { KokoroTTS } from 'kokoro-js';

const useTTS = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState('');
  const [kokoroTtsInstance, setKokoroTtsInstance] = useState(null);
  const [textToSpeak, setTextToSpeak] = useState("Hello from browser TTS!"); // Add state for the input text
  const synthRef = useRef(null);
  const audioContextRef = useRef(null);

  useEffect(() => {
    const initialize = async () => {
      // Ensure this runs only in a browser environment
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        synthRef.current = window.speechSynthesis;
        const setVoices = () => {
          const voices = synthRef.current.getVoices();
          setAvailableVoices(voices);
          if (voices.length > 0 && !selectedVoiceURI) {
            setSelectedVoiceURI(voices[0].voiceURI);
          }
        };
        setVoices();
        synthRef.current.onvoiceschanged = setVoices;
      }
      
      const kokoro = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX');
      setKokoroTtsInstance(kokoro);
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    };
    initialize();
  }, [selectedVoiceURI]); // Re-run if selectedVoiceURI changes

  const speakWithWebAPI = useCallback((text) => {
    if (!synthRef.current || !text) return;
    const utterance = new SpeechSynthesisUtterance(text);
    const selectedVoice = availableVoices.find(v => v.voiceURI === selectedVoiceURI);
    if (selectedVoice) utterance.voice = selectedVoice;
    synthRef.current.speak(utterance);
  }, [availableVoices, selectedVoiceURI]);

  const speakWithKokoro = useCallback(async (text, voiceId = "en_nova") => {
    if (!kokoroTtsInstance || !text) return;
    setIsSpeaking(true);
    try {
      const output = await kokoroTtsInstance.generate(text, { voice: voiceId });
      const audioData = output.audio;
      const buffer = audioContextRef.current.createBuffer(1, audioData.length, output.sampling_rate);
      buffer.copyToChannel(audioData, 0);
      const source = audioContextRef.current.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContextRef.current.destination);
      source.start();
      source.onended = () => setIsSpeaking(false);
    } catch (error) {
      console.error("Kokoro TTS error:", error);
      setIsSpeaking(false);
    }
  }, [kokoroTtsInstance]);

  return {
    isSpeaking,
    availableVoices,
    selectedVoiceURI,
    setSelectedVoiceURI,
    textToSpeak,
    setTextToSpeak,
    speakWithWebAPI,
    speakWithKokoro,
    ttsReady: !!kokoroTtsInstance
  };
};

export default useTTS;
