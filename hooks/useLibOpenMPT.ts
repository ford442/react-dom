import { useState, useEffect, useRef, useCallback } from 'react';
import type { LibOpenMPT, ModuleInfo, FormattedPatternRow } from '../types'; // Import FormattedPatternRow
import { ai } from '../lib/gemini';

const SAMPLE_RATE = 48000;
const BUFFER_SIZE = 4096;
const INITIAL_STATUS = "Loading library...";
const INITIAL_MODULE_INFO: ModuleInfo = { title: '...', order: 0, row: 0, bpm: 0, numChannels: 0 };
const DEFAULT_MODULE_URL = 'https://raw.githubusercontent.com/deskjet/chiptunes/master/mods/4mat/4-mat_-_space_debris.mod';


export function useLibOpenMPT() {
  const [status, setStatus] = useState<string>(INITIAL_STATUS);
  const [isReady, setIsReady] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isModuleLoaded, setIsModuleLoaded] = useState<boolean>(false);
  const [moduleInfo, setModuleInfo] = useState<ModuleInfo>(INITIAL_MODULE_INFO);
  // Change patternData state
  const [patternData, setPatternData] = useState<FormattedPatternRow[]>([]);
  const [aiResponse, setAiResponse] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null); // State for visualizer

  const libopenmptRef = useRef<LibOpenMPT | null>(null);
  const currentModulePtr = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scriptNodeRef = useRef<ScriptProcessorNode | null>(null);
  const analyserNodeRef = useRef<AnalyserNode | null>(null); // Ref to create analyser only once
  // Update rowBufferRef type
  const rowBufferRef = useRef<Record<string, string[]>>({});
  const animationFrameHandle = useRef<number>(0);
  const moduleInfoRef = useRef(moduleInfo);
  const isPlayingRef = useRef(isPlaying);

  useEffect(() => {
    moduleInfoRef.current = moduleInfo;
  }, [moduleInfo]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const stopMusic = useCallback((ended = false) => {
    if (!scriptNodeRef.current) return;

    scriptNodeRef.current.disconnect(); // Disconnects from analyser
    scriptNodeRef.current = null;
    setIsPlaying(false);
    cancelAnimationFrame(animationFrameHandle.current);

    if (currentModulePtr.current !== 0 && libopenmptRef.current) {
      try {
        libopenmptRef.current._openmpt_module_set_position_order_row(currentModulePtr.current, 0, 0);
      } catch (e) {
        console.error("Error resetting module position:", e);
      }
    }
    
    // Update pattern data on stop
    setPatternData([]);
    if (ended) {
        setStatus(`Finished playing "${moduleInfoRef.current.title}".`);
    } else {
        setStatus(`Stopped.`);
    }
  }, []);

  const preCachePatternData = useCallback((modPtr: number, lib: LibOpenMPT, title: string) => {
    setStatus("Caching pattern data...");
    rowBufferRef.current = {};
    setTimeout(() => {
        try {
            const numOrders = lib._openmpt_module_get_num_orders(modPtr);
            const numChannels = lib._openmpt_module_get_num_channels(modPtr);
            setModuleInfo(prev => ({ ...prev, numChannels }));

            for (let o = 0; o < numOrders; o++) {
                const pattern = lib._openmpt_module_get_order_pattern(modPtr, o);
                if (pattern >= lib._openmpt_module_get_num_patterns(modPtr)) continue;
                const numRows = lib._openmpt_module_get_pattern_num_rows(modPtr, pattern);
                
                for (let r = 0; r < numRows; r++) {
                    // Store channel strings as an array
                    const rowKey = `${o}-${r}`;
                    rowBufferRef.current[rowKey] = [];
                    for (let c = 0; c < numChannels; c++) {
                        const commandPtr = lib._openmpt_module_format_pattern_row_channel(modPtr, pattern, r, c, 12, 1);
                        const commandStr = lib.UTF8ToString(commandPtr);
                        lib._openmpt_free_string(commandPtr);
                        // Add the formatted string for the channel
                        rowBufferRef.current[rowKey].push(commandStr.replace(/ /g, '\u00A0')); // Use non-breaking space
                    }
                }
            }
            setStatus(`Loaded "${title}". Ready to play.`);
            console.log("Pattern data cached.");
        } catch (e) {
            console.error("Failed to cache pattern data:", e);
            setStatus("Error: Failed to cache patterns. See console.");
        }
    }, 50);
  }, []);

  const processModuleData = useCallback(async (fileData: Uint8Array, fileName: string) => {
    if (!libopenmptRef.current) return;
    
    if (isPlayingRef.current) {
      stopMusic(false);
    }

    if (currentModulePtr.current !== 0) {
        libopenmptRef.current._openmpt_module_destroy(currentModulePtr.current);
        currentModulePtr.current = 0;
    }
    rowBufferRef.current = {};
    setIsModuleLoaded(false);
    setPatternData([]); // Clear pattern data
    setAiResponse('');

    setStatus(`Loading "${fileName}"...`);
    
    try {
        const lib = libopenmptRef.current;
        
        const bufferPtr = lib._malloc(fileData.length);
        lib.HEAPU8.set(fileData, bufferPtr);

        const modPtr = lib._openmpt_module_create_from_memory2(bufferPtr, fileData.length, 0, 0, 0, 0, 0, 0, 0);
        lib._free(bufferPtr);

        if (modPtr === 0) {
            throw new Error(`Failed to load module "${fileName}".`);
        }
        currentModulePtr.current = modPtr;

        const titleKeyPtr = lib.stringToUTF8("title");
        const titleValuePtr = lib._openmpt_module_get_metadata(modPtr, titleKeyPtr);
        const title = lib.UTF8ToString(titleValuePtr) || fileName;
        lib._free(titleKeyPtr);
        lib._openmpt_free_string(titleValuePtr);

        setModuleInfo({ ...INITIAL_MODULE_INFO, title });
        setIsModuleLoaded(true);
        preCachePatternData(modPtr, lib, title);

    } catch (e) {
        console.error("Failed to load module:", e);
        const error = e as Error;
        setStatus(`Error: ${error.message}. See console.`);
        if (error.name === "TypeError") {
            setStatus("Error: libopenmpt.js may be missing required C API functions.");
        }
    }
  }, [stopMusic, preCachePatternData]);

  const loadModule = useCallback(async (file: File) => {
    const fileData = new Uint8Array(await file.arrayBuffer());
    await processModuleData(fileData, file.name);
  }, [processModuleData]);

  const updateUI = useCallback(() => {
    if (!libopenmptRef.current || currentModulePtr.current === 0) return;

    try {
      const lib = libopenmptRef.current;
      const modPtr = currentModulePtr.current;

      const order = lib._openmpt_module_get_current_order(modPtr);
      const row = lib._openmpt_module_get_current_row(modPtr);
      const bpm = lib._openmpt_module_get_current_estimated_bpm(modPtr);

      setModuleInfo(prev => ({ ...prev, order, row, bpm: Math.round(bpm) }));

      const currentPattern = lib._openmpt_module_get_order_pattern(modPtr, order);
      const numRows = lib._openmpt_module_get_pattern_num_rows(modPtr, currentPattern);
      
      const newPatternData: FormattedPatternRow[] = [];
      const contextRows = 8; // Number of rows to show above/below

      for (let r = row - contextRows; r <= row + contextRows; r++) {
        if (r < 0 || r >= numRows) {
          // Add empty row for spacing
          newPatternData.push({ rowNum: r, isCurrent: false, channelStrings: [] });
          continue;
        }
        
        const isCurrentRow = r === row;
        const rowKey = `${order}-${r}`;
        const channelStrings = rowBufferRef.current[rowKey] || [];
        
        newPatternData.push({
          rowNum: r,
          isCurrent: isCurrentRow,
          channelStrings: channelStrings
        });
      }
      
      setPatternData(newPatternData);
    } catch (e) {
      console.error("Error in UI update:", e);
    }
    
    animationFrameHandle.current = requestAnimationFrame(updateUI);
  }, []);

  const play = useCallback(() => {
    if (isPlaying || currentModulePtr.current === 0 || !libopenmptRef.current) return;

    try {
      if (!audioContextRef.current) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioContextRef.current = new AudioContext({ sampleRate: SAMPLE_RATE });
      }
      
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }

      // Create or re-use AnalyserNode
      let analyser: AnalyserNode;
      if (!analyserNodeRef.current) {
        analyserNodeRef.current = audioContextRef.current.createAnalyser();
        analyserNodeRef.current.fftSize = 512; // Frequency bins
      }
      analyser = analyserNodeRef.current;

      const lib = libopenmptRef.current;
      const modPtr = currentModulePtr.current;
      const leftBufferPtr = lib._malloc(BUFFER_SIZE * 4);
      const rightBufferPtr = lib._malloc(BUFFER_SIZE * 4);

      scriptNodeRef.current = audioContextRef.current.createScriptProcessor(BUFFER_SIZE, 0, 2);
      scriptNodeRef.current.onaudioprocess = (e) => {
        try {
          const frames = lib._openmpt_module_read_float_stereo(modPtr, SAMPLE_RATE, BUFFER_SIZE, leftBufferPtr, rightBufferPtr);
          if (frames === 0) {
            setTimeout(() => stopMusic(true), 0);
            return;
          }

          const leftOutput = e.outputBuffer.getChannelData(0);
          const rightOutput = e.outputBuffer.getChannelData(1);
          const leftHeap = new Float32Array(lib.HEAPF32.buffer, leftBufferPtr, frames);
          const rightHeap = new Float32Array(lib.HEAPF32.buffer, rightBufferPtr, frames);
          leftOutput.set(leftHeap);
          rightOutput.set(rightHeap);
        } catch (audioErr) {
          console.error("Error in audio process:", audioErr);
          setTimeout(() => stopMusic(false), 0);
        }
      };

      // Connect graph: ScriptProcessor -> Analyser -> Destination
      scriptNodeRef.current.connect(analyser);
      analyser.connect(audioContextRef.current.destination);

      setAnalyserNode(analyser); // Pass analyser to React state for UI
      setIsPlaying(true);
      setStatus(`Playing "${moduleInfoRef.current.title}"...`);
      animationFrameHandle.current = requestAnimationFrame(updateUI);

    } catch (e) {
      console.error("Failed to start music:", e);
      setStatus("Error: Failed to start playback. See console.");
    }
  }, [isPlaying, stopMusic, updateUI]);

  const askAI = useCallback(async () => {
    const title = moduleInfoRef.current.title;
    if (!title || title === '...') return;

    setIsAiLoading(true);
    setAiResponse('');
    try {
      const prompt = `You are a music expert specializing in old-school tracker music (demoscene, video games).
      A user has loaded a track titled "${title}".
      Provide a brief, interesting summary about this track.
      Consider the following points if you have information:
      - The likely artist or group.
      - The year it was released.
      - The computer system it was famous on (e.g., Amiga, PC).
      - The genre (e.g., Demoscene music, Chiptune, Jungle).
      - Any interesting facts about its composition or use in a demo/game.
      - Suggest 1-2 similar tracks or artists.
      
      Format your response as clean, readable text. If you don't know anything about this specific track, say so and provide general information about the tracker music scene instead.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { role: 'user', parts: [{ text: prompt }] },
        config: {
          thinkingConfig: { thinkingBudget: 0 }
        }
      });
      
      setAiResponse(response.text ?? '');

    } catch (error) {
      console.error("Gemini API error:", error);
      setAiResponse("Sorry, I couldn't fetch information at this time. Please check the console for errors.");
    } finally {
      setIsAiLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      if (!window.libopenmptReady) {
        setStatus("Error: libopenmpt initialization script not found.");
        console.error("window.libopenmptReady promise not found. Check index.html.");
        return;
      }
      try {
        const lib = await window.libopenmptReady as LibOpenMPT;
        
        if (!lib.UTF8ToString) {
          console.warn('Polyfilling libopenmpt.UTF8ToString...');
          lib.UTF8ToString = (ptr) => {
            let str = '';
            if (!ptr) return str;
            const heap = lib.HEAPU8;
            for (let i = 0; heap[ptr + i] !== 0; i++) {
              str += String.fromCharCode(heap[ptr + i]);
            }
            return str;
          };
        }
        if (!lib.stringToUTF8) {
          console.warn('Polyfilling libopenmpt.stringToUTF8...');
          lib.stringToUTF8 = (jsString) => {
            const length = (jsString.length << 2) + 1;
            const ptr = lib._malloc(length);
            const heap = lib.HEAPU8;
            let i = 0, j = 0;
            while (i < jsString.length) {
                heap[ptr + j++] = jsString.charCodeAt(i++);
            }
            heap[ptr + j] = 0;
            return ptr;
          };
        }

        libopenmptRef.current = lib;
        setIsReady(true);
      } catch (err) {
        setStatus("Error: Audio library failed to load. See console.");
        console.error("Error awaiting libopenmptReady:", err);
      }
    };

    init();

    return () => {
      console.log("Cleaning up libopenmpt resources.");
      if (scriptNodeRef.current) {
        scriptNodeRef.current.disconnect();
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      if (currentModulePtr.current !== 0 && libopenmptRef.current) {
        libopenmptRef.current._openmpt_module_destroy(currentModulePtr.current);
      }
      cancelAnimationFrame(animationFrameHandle.current);
    };
  }, []);

  useEffect(() => {
    if (isReady) {
      const loadDefault = async () => {
        const fileName = DEFAULT_MODULE_URL.split('/').pop() || 'default.mod';
        setStatus(`Fetching "${fileName}"...`);
        try {
          const response = await fetch(DEFAULT_MODULE_URL);
          if (!response.ok) throw new Error(`Failed to fetch module: ${response.statusText}`);
          const arrayBuffer = await response.arrayBuffer();
          const fileData = new Uint8Array(arrayBuffer);
          await processModuleData(fileData, fileName);
        } catch (e) {
          console.error("Failed to load default module:", e);
          setStatus(`Error fetching default module. See console.`);
        }
      };
      loadDefault();
    }
  }, [isReady, processModuleData]);

  return { status, isReady, isPlaying, isModuleLoaded, moduleInfo, patternData, aiResponse, isAiLoading, analyserNode, loadModule, play, stopMusic, askAI };
}
