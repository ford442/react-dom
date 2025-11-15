// hooks/useLibOpenMPT.ts

import { useState, useRef, useCallback, useEffect } from 'react';
import {
    ModuleInfo,
    NoteData,
    PatternData,
    SongPosition,
} from '../types';

// The path to our new worklet wrapper
const workletURL = '/openmpt-processor.js';

export const useLibOpenMPT = () => {
    const [isReady, setIsReady] = useState(false);
    const [moduleInfo, setModuleInfo] = useState<ModuleInfo | null>(null);
    const [songPosition, setSongPosition] = useState<SongPosition | null>(null);
    const [currentPattern, setCurrentPattern] = useState<PatternData | null>(null);
    const [currentNote, setCurrentNote] = useState<NoteData | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    // Refs for audio context and worklet node
    const audioContextRef = useRef<AudioContext | null>(null);
    const workletNodeRef = useRef<AudioWorkletNode | null>(null);

    // Effect to initialize the AudioWorklet
    useEffect(() => {
        const initAudioWorklet = async () => {
            try {
                const context = new (window.AudioContext ||
                    (window as any).webkitAudioContext)();
                audioContextRef.current = context;

                await context.audioWorklet.addModule(workletURL);

                const workletNode = new AudioWorkletNode(
                    context,
                    'openmpt-processor',
                );
                workletNode.connect(context.destination);
                workletNodeRef.current = workletNode;

                // Set up listener for messages FROM the worklet
                workletNode.port.onmessage = (event) => {
                    const { type, data } = event.data;
                    switch (type) {
                        case 'ready':
                            setIsReady(true);
                            break;
                        case 'metadata':
                            setModuleInfo(data);
                            break;
                        case 'update':
                            setSongPosition(data.position);
                            setCurrentPattern(data.pattern);
                            // You can derive currentNote from pattern data if needed
                            // For simplicity, this example just passes the main data
                            break;
                        case 'error':
                            console.error('AudioWorklet Error:', data);
                            // Handle error state in React
                            break;
                    }
                };
            } catch (e) {
                console.error('Failed to initialize AudioWorklet:', e);
            }
        };

        initAudioWorklet();

        // Cleanup
        return () => {
            audioContextRef.current?.close();
        };
    }, []);

    // Function to send commands TO the worklet
    const postWorkletMessage = (type: string, data?: any) => {
        if (!workletNodeRef.current) return;

        // For 'load', we need to transfer the ArrayBuffer
        if (type === 'load' && data instanceof ArrayBuffer) {
            workletNodeRef.current.port.postMessage({ type, data }, [data]);
        } else {
            workletNodeRef.current.port.postMessage({ type, data });
        }
    };

    const loadModule = useCallback(async (file: File) => {
        if (!isReady || !workletNodeRef.current) return;

        try {
            const arrayBuffer = await file.arrayBuffer();
            // Send the ArrayBuffer to the worklet to be loaded
            postWorkletMessage('load', arrayBuffer);
            setIsPlaying(false);
        } catch (e) {
            console.error(e);
        }
    }, [isReady]);

    const play = useCallback(() => {
        if (!moduleInfo || !audioContextRef.current) return;

        // Browsers require user interaction to start audio
        audioContextRef.current.resume();

        postWorkletMessage('play');
        setIsPlaying(true);
    }, [moduleInfo]);

    const pause = useCallback(() => {
        if (!moduleInfo) return;
        postWorkletMessage('pause');
        setIsPlaying(false);
    }, [moduleInfo]);

    const stop = useCallback(() => {
        if (!moduleInfo) return;
        postWorkletMessage('stop');
        setIsPlaying(false);
    }, [moduleInfo]);

    const seek = useCallback((position: number) => {
        if (!moduleInfo) return;
        postWorkletMessage('seek', position);
    }, [moduleInfo]);

    // This is no longer needed, as updates are pushed from the worklet
    // const startUpdating = () => { ... }
    // const stopUpdating = () => { ... }

    return {
        isReady,
        moduleInfo,
        songPosition,
        currentPattern,
        currentNote,
        isPlaying,
        loadModule,
        play,
        pause,
        stop,
        seek,
    };
};