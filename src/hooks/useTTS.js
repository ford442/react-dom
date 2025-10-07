import { useState, useEffect, useCallback, useRef } from 'react';
import { KokoroTTS } from 'kokoro-js';

const useTTS = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState('');
  const [kokoroTtsInstance, setKokoroTtsInstance] = useState(null);
  const synthRef = useRef(null);
  const audioContextRef = useRef(null);

  useEffect(() => {
    const initialize = async () => {
      synthRef.current = window.speechSynthesis;
      const voices = synthRef.current.getVoices();
      setAvailableVoices(voices);
      if (voices.length > 0) {
        setSelectedVoiceURI(voices[0].voiceURI);
      }
      synthRef.current.onvoiceschanged = () => {
        setAvailableVoices(synthRef.current.getVoices());
      };

      const kokoro = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX');
      setKokoroTtsInstance(kokoro);
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    };
    initialize();
  }, []);

  const speakWithWebAPI = useCallback((text) => {
    if (!synthRef.current || !text) return;
    const utterance = new SpeechSynthesisUtterance(text);
    const selectedVoice = availableVoices.find(v => v.voiceURI === selectedVoiceURI);
    if (selectedVoice) utterance.voice = selectedVoice;
    synthRef.current.speak(utterance);
  }, [availableVoices, selectedVoiceURI]);

  const speakWithKokoro = useCallback(async (text, voiceId = "en_sam") => {
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
    speakWithWebAPI,
    speakWithKokoro,
    ttsReady: !!kokoroTtsInstance
  };
};

export default useTTS;
