import { useState, useEffect, useRef, useCallback } from 'react';
import type { LibOpenMPT, ModuleInfo, PatternMatrix, PatternCell } from '../types';
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
  const [patternData, setPatternData] = useState<string>('... Waiting for module to play ...');
  const [aiResponse, setAiResponse] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [sequencerMatrix, setSequencerMatrix] = useState<PatternMatrix | null>(null);
  const [sequencerCurrentRow, setSequencerCurrentRow] = useState<number>(0);
  const [sequencerGlobalRow, setSequencerGlobalRow] = useState<number>(0);
  const [totalPatternRows, setTotalPatternRows] = useState<number>(0);
  const [playbackSeconds, setPlaybackSeconds] = useState<number>(0);
  const [playbackRowFraction, setPlaybackRowFraction] = useState<number>(0);

  const libopenmptRef = useRef<LibOpenMPT | null>(null);
  const currentModulePtr = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scriptNodeRef = useRef<ScriptProcessorNode | null>(null);
  const rowBufferRef = useRef<Record<string, string>>({});
  const patternMatricesRef = useRef<Record<number, PatternMatrix>>({});
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

    scriptNodeRef.current.disconnect();
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
    
    setPatternData(ended ? '... Song Ended ...' : '... Stopped ...');
    if (ended) {
        setStatus(`Finished playing "${moduleInfoRef.current.title}".`);
    }
  }, []);

  const preCachePatternData = useCallback((modPtr: number, lib: LibOpenMPT, title: string) => {
    setStatus("Caching pattern data...");
    rowBufferRef.current = {};
    patternMatricesRef.current = {};
    setTimeout(() => {
        try {
            const numOrders = lib._openmpt_module_get_num_orders(modPtr);
            const numChannels = lib._openmpt_module_get_num_channels(modPtr);
            setModuleInfo(prev => ({ ...prev, numChannels }));

            for (let o = 0; o < numOrders; o++) {
                const pattern = lib._openmpt_module_get_order_pattern(modPtr, o);
                if (pattern >= lib._openmpt_module_get_num_patterns(modPtr)) continue;
                const numRows = lib._openmpt_module_get_pattern_num_rows(modPtr, pattern);

                // initialize matrix rows
                const matrixRows: PatternCell[][] = Array.from({ length: numRows }, () =>
                    Array.from({ length: numChannels }, () => ({ type: 'empty', text: '' }))
                );

                for (let r = 0; r < numRows; r++) {
                     let line = "";
                     for (let c = 0; c < numChannels; c++) {
                         const commandPtr = lib._openmpt_module_format_pattern_row_channel(modPtr, pattern, r, c, 12, 1);
                         const commandStr = lib.UTF8ToString(commandPtr);
                         lib._openmpt_free_string(commandPtr);
                         line += " " + commandStr.replace(/ /g, '&nbsp;') + " |";

                        // Parse commandStr into a PatternCell (simple heuristics)
                        const raw = (commandStr || '').trim();
                        let cellType: 'note' | 'effect' | 'instrument' | 'empty' = 'empty';
                        if (!raw || /^[-\.\s]+$/.test(raw)) {
                            cellType = 'empty';
                        } else if (/[A-Ga-g][#b]?\d/.test(raw)) {
                            // e.g., C-4, A#3
                            cellType = 'note';
                        } else if (/^\d{1,3}$/.test(raw) || /^i\d+/i.test(raw)) {
                            // pure numeric instrument ids
                            cellType = 'instrument';
                        } else if (/^[0-9A-Fa-f]{1,4}$/.test(raw) || /[A-Za-z]+=/.test(raw) || /[0-9A-Fa-f]{1,2}/.test(raw)) {
                            cellType = 'effect';
                        } else {
                            // default to effect for other non-empty commands
                            cellType = 'effect';
                        }

                        matrixRows[r][c] = { type: cellType, text: raw };
                     }
                     rowBufferRef.current[`${o}-${r}`] = line;
                 }

                patternMatricesRef.current[o] = {
                     order: o,
                     patternIndex: pattern,
                     numRows,
                     numChannels,
                     rows: matrixRows,
                 };
             }
             // compute total rows across orders
             {
               let total = 0;
               const keys = Object.keys(patternMatricesRef.current);
               for (let idx = 0; idx < keys.length; idx++) {
                 const k = Number(keys[idx]);
                 const m = patternMatricesRef.current[k];
                 if (m) total += m.numRows;
               }
               setTotalPatternRows(total);
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
    patternMatricesRef.current = {};
    setIsModuleLoaded(false);
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
      const positionSeconds = lib._openmpt_module_get_position_seconds(modPtr);
      const bpm = lib._openmpt_module_get_current_estimated_bpm(modPtr);

      setModuleInfo(prev => ({ ...prev, order, row, bpm: Math.round(bpm) }));
      setPlaybackSeconds(positionSeconds);

      const rowsPerSecond = bpm > 0 ? (bpm / 60) * 4 : 0; // default rows/beat = 4
      const fractionalRow = rowsPerSecond > 0 ? positionSeconds * rowsPerSecond : row;
      setPlaybackRowFraction(fractionalRow);

      // update sequencer state from cached matrices
      const matrix = patternMatricesRef.current[order] ?? null;
      if (matrix) {
        setSequencerMatrix(matrix);
      } else {
        setSequencerMatrix(null);
      }
      setSequencerCurrentRow(row);

      // compute global row index (sum of rows in earlier orders + current row)
      let global = 0;
      for (let i = 0; i < order; i++) {
        const m = patternMatricesRef.current[i];
        if (m) global += m.numRows;
      }
      global += row;
      setSequencerGlobalRow(global);

      const currentPattern = lib._openmpt_module_get_order_pattern(modPtr, order);
      const numRows = lib._openmpt_module_get_pattern_num_rows(modPtr, currentPattern);
      let patternHtml = "";
      const contextRows = 8;

      for (let r = row - contextRows; r <= row + contextRows; r++) {
        if (r < 0 || r >= numRows) {
          patternHtml += "\n";
          continue;
        }
        
        const isCurrentRow = r === row;
        const highlightClass = isCurrentRow ? 'text-yellow-300 bg-gray-700/50' : '';
        let line = `<span class="${highlightClass}">`;
        line += isCurrentRow ? "> " : "  ";
        line += String(r).padStart(3, '0') + " |";
        
        const rowKey = `${order}-${r}`;
        if (rowBufferRef.current[rowKey]) {
          line += rowBufferRef.current[rowKey];
        }
        line += `</span>\n`;
        patternHtml += line;
      }
      
      setPatternData(patternHtml);
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

      scriptNodeRef.current.connect(audioContextRef.current.destination);
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

  const seekToStep = (stepIndex: number) => {
    const lib = libopenmptRef.current;
    const modPtr = currentModulePtr.current;
    if (!lib || modPtr === 0) return;

    // find order and row for the given stepIndex
    let acc = 0;
    let targetOrder = 0;
    let targetRow = 0;
    const numOrders = lib._openmpt_module_get_num_orders(modPtr);
    for (let o = 0; o < numOrders; o++) {
      const m = patternMatricesRef.current[o];
      const rows = m ? m.numRows : lib._openmpt_module_get_pattern_num_rows(modPtr, lib._openmpt_module_get_order_pattern(modPtr, o));
      if (stepIndex < acc + rows) {
        targetOrder = o;
        targetRow = stepIndex - acc;
        break;
      }
      acc += rows;
    }

    try {
      lib._openmpt_module_set_position_order_row(modPtr, targetOrder, targetRow);
      // update UI state immediately
      setModuleInfo(prev => ({ ...prev, order: targetOrder, row: targetRow }));
      setSequencerCurrentRow(targetRow);
      setSequencerGlobalRow(stepIndex);
    } catch (e) {
      console.error('Failed to seek:', e);
    }
  };

  return { status, isReady, isPlaying, isModuleLoaded, moduleInfo, patternData, aiResponse, isAiLoading, loadModule, play, stopMusic, askAI, sequencerMatrix, sequencerCurrentRow, sequencerGlobalRow, totalPatternRows, playbackSeconds, playbackRowFraction, seekToStep };
}
