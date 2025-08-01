// --- START: Environment Configuration ---
// This is the crucial fix. We tell transformers.js to load its WebAssembly backend
// directly from the CDN, avoiding local file-path issues with Parcel.
import { env } from '@xenova/transformers';
env.backends.onnx.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/';
// --- END: Environment Configuration ---


import { pipeline, Pipeline } from '@xenova/transformers';

// --- TYPE DEFINITIONS ---
interface AudioOutput { audio: Float32Array; sampling_rate: number; }
interface Note { note: string; octave: number; duration: number; } // For symbolic generation

// --- DOM ELEMENT REFERENCES ---
// Text Generation Elements
const textPromptInput = document.getElementById('text-prompt-input') as HTMLTextAreaElement;
const textGenerateButton = document.getElementById('text-generate-button') as HTMLButtonElement;
const textStatus = document.getElementById('text-status') as HTMLDivElement;
const textOutput = document.getElementById('text-output') as HTMLPreElement;

// Music Generation Elements
const musicPromptInput = document.getElementById('music-prompt-input') as HTMLInputElement;
const musicGenerateButton = document.getElementById('music-generate-button') as HTMLButtonElement;
const musicStatus = document.getElementById('music-status') as HTMLDivElement;
const audioOutput = document.getElementById('audio-output') as HTMLAudioElement;
const saveWavButton = document.getElementById('save-wav-button') as HTMLButtonElement;

// Symbolic Music (XM) Elements
const symbolicPromptInput = document.getElementById('symbolic-prompt-input') as HTMLInputElement;
const symbolicGenerateButton = document.getElementById('symbolic-generate-button') as HTMLButtonElement;
const symbolicStatus = document.getElementById('symbolic-status') as HTMLDivElement;
const symbolicOutput = document.getElementById('symbolic-output') as HTMLPreElement;
const saveXmButton = document.getElementById('save-xm-button') as HTMLButtonElement;

// --- STATE MANAGEMENT ---
let textPipe: Pipeline | null = null;
let musicPipe: Pipeline | null = null;
let lastGeneratedAudio: AudioOutput | null = null;
let lastGeneratedXmBlob: Blob | null = null;

// Disable all buttons initially
textGenerateButton.disabled = true;
musicGenerateButton.disabled = true;
symbolicGenerateButton.disabled = true;

// --- INITIALIZATION ---
initializeApp();
async function initializeApp() {
    const textPromise = loadTextPipeline();
    const musicPromise = loadMusicPipeline();
    await Promise.all([textPromise, musicPromise]);
}

async function loadTextPipeline() {
    try {
        symbolicStatus.textContent = 'Loading text model (distilgpt2)...';
        textStatus.textContent = 'Loading text model (distilgpt2)...';
        textPipe = await pipeline('text-generation', 'Xenova/distilgpt2');
        textStatus.textContent = 'Text model loaded.';
        symbolicStatus.textContent = 'Model loaded. Ready to generate notes.';
        textGenerateButton.disabled = false;
        symbolicGenerateButton.disabled = false;
    } catch (error) {
        console.error('Text pipeline failed to load:', error);
        textStatus.textContent = 'Error loading text model.';
        symbolicStatus.textContent = 'Error loading model.';
    }
}

async function loadMusicPipeline() {
    try {
        musicStatus.textContent = 'Loading music model (musicgen-small). This is a large file (~500MB)...';
        musicPipe = await pipeline('text-to-audio', 'Xenova/musicgen-small');
        musicStatus.textContent = 'Music model loaded. Ready.';
        musicGenerateButton.disabled = false;
    } catch (error) {
        console.error('Music pipeline failed to load:', error);
        musicStatus.textContent = 'Error loading music model.';
    }
}

// --- EVENT HANDLERS ---
textGenerateButton.addEventListener('click', handleTextGeneration);
musicGenerateButton.addEventListener('click', handleMusicGeneration);
saveWavButton.addEventListener('click', handleSaveWav);
symbolicGenerateButton.addEventListener('click', handleSymbolicMusicGeneration);
saveXmButton.addEventListener('click', handleSaveXm);


// --- SYMBOLIC (XM) MUSIC LOGIC ---
async function handleSymbolicMusicGeneration() {
    if (!textPipe || !symbolicPromptInput.value) return;

    symbolicGenerateButton.disabled = true;
    saveXmButton.disabled = true;
    symbolicStatus.textContent = 'Generating note sequence...';
    symbolicOutput.textContent = '';
    lastGeneratedXmBlob = null;

    // Craft a detailed prompt for the LLM
    const metaPrompt = `Generate a simple song melody based on the following prompt: "${symbolicPromptInput.value}".
The song should be a sequence of notes.
Use the format: NOTE,OCTAVE,DURATION;
- NOTE can be C, C#, D, D#, E, F, F#, G, G#, A, A#, B. Use '---' for a rest.
- OCTAVE is a number from 2 to 5.
- DURATION is the number of ticks (rows) the note should play. Use 4, 8, or 16.
- Separate each entry with a semicolon. Do not include any other text or explanation.

Example: C,4,8; E,4,8; G,4,16; F,4,8; D,4,8; ---,0,8;

Now, generate the song:
`;

    try {
        const result = await textPipe(metaPrompt, { max_new_tokens: 150 });
        // The LLM might output more than just the notes, so we try to extract only the note sequence
        const generatedText = result[0].generated_text.substring(metaPrompt.length).trim();
        // Further clean up: sometimes LLMs will add extra text or stop prematurely.
        // We'll take the first line that looks like a note sequence.
        const cleanedGeneratedText = generatedText.split('\n')[0].split(';').filter(s => s.trim().length > 0).join(';') + ';';


        symbolicOutput.textContent = cleanedGeneratedText;
        const notes = parseNoteString(cleanedGeneratedText);

        if (notes.length > 0) {
            lastGeneratedXmBlob = createXmFile(notes);
            symbolicStatus.textContent = 'Note data generated and compiled into XM format!';
            saveXmButton.disabled = false;
        } else {
            symbolicStatus.textContent = 'LLM failed to generate valid note data. Please try again or refine prompt.';
        }

    } catch (error) {
        console.error('Symbolic generation failed:', error);
        symbolicStatus.textContent = 'Error during note generation.';
    } finally {
        symbolicGenerateButton.disabled = false;
    }
}

function handleSaveXm() {
    if (!lastGeneratedXmBlob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(lastGeneratedXmBlob);
    a.download = 'llm-generated-song.xm';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function parseNoteString(noteString: string): Note[] {
    const notes: Note[] = [];
    const noteMap: { [key: string]: number } = {
        'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5,
        'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11
    };
    
    const entries = noteString.split(';');
    for (const entry of entries) {
        const parts = entry.trim().split(',');
        if (parts.length === 3) {
            const [noteName, octaveStr, durationStr] = parts;
            const noteCleaned = noteName.toUpperCase();
            
            const octave = parseInt(octaveStr, 10);
            const duration = parseInt(durationStr, 10);

            // Validate parsed values
            if (
                (noteCleaned === '---' || noteMap[noteCleaned] !== undefined) &&
                !isNaN(octave) && octave >= 0 && octave <= 9 && // Standard MIDI range
                !isNaN(duration) && [4, 8, 16].includes(duration) // Only allow specific durations
            ) {
                 notes.push({
                    note: noteCleaned,
                    octave: octave,
                    duration: duration
                });
            } else {
                console.warn(`Skipping invalid note entry: ${entry}`);
            }
        }
    }
    return notes;
}

function createXmFile(notes: Note[]): Blob {
    const noteMap: { [key: string]: number } = {
        'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5,
        'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11
    };

    // Create a simple sawtooth wave sample
    const sampleLength = 256;
    const sampleData = new Int8Array(sampleLength);
    for(let i=0; i<sampleLength; ++i) {
        sampleData[i] = (i / sampleLength) * 254 - 127; // Signed 8-bit
    }

    const patternRows = 64; // One pattern for simplicity
    // A single channel in this pattern
    let patternData = new Uint8Array(patternRows * 5); // 5 bytes per row: note, instr, vol, fx, fx param
    let currentRow = 0;

    for (const note of notes) {
        if (currentRow >= patternRows) break; // Don't overflow the pattern

        if (note.note === '---') {
            // Rest: Note 0 in XM signifies 'note off' for current instrument
            patternData[currentRow * 5] = 0; // Note off
            patternData[currentRow * 5 + 1] = 0; // No instrument
            patternData[currentRow * 5 + 2] = 0; // No volume
        } else {
            const noteIndex = noteMap[note.note];
            // Convert to Protracker note format (C-0 = 13, C#0 = 14, etc.)
            // XM notes are 1-based, 1=C-0, 120=B-9. Middle C (C-4) = 60.
            patternData[currentRow * 5] = note.octave * 12 + noteIndex + 1; // Note number (1-96, 97 for key-off)
            patternData[currentRow * 5 + 1] = 1; // Instrument 1
            patternData[currentRow * 5 + 2] = 64; // Volume: 64 (max)
        }
        
        // Advance row by note duration
        currentRow += note.duration;
    }

    // Now, build the XM file in an ArrayBuffer
    const headerSize = 276; // Standard XM header size
    const patternHeaderSize = 9; // Size of PHEADER (length, packing_type, num_rows, data_size)
    const instrumentHeaderSize = 29; // Size of IHEADER for 1 instrument
    const sampleHeaderSize = 40; // Size of SHEADER for 1 sample

    const totalFileSize = headerSize +
                          patternHeaderSize + patternData.length + // 1 pattern
                          instrumentHeaderSize + sampleHeaderSize + sampleData.length; // 1 instrument, 1 sample

    const buffer = new ArrayBuffer(totalFileSize);
    const view = new DataView(buffer);
    const textEncoder = new TextEncoder();

    // Helper to write fixed-length strings
    const writeFixedString = (offset: number, str: string, len: number) => {
        const encoded = textEncoder.encode(str);
        for(let i=0; i < len; i++) {
            view.setUint8(offset + i, encoded[i] || 0); // Pad with nulls if shorter
        }
    };

    // --- Main XM Header (0x00 - 0x113) ---
    writeFixedString(0x00, "Extended Module: ", 17); // ID (17 bytes)
    writeFixedString(0x11, "LLM Generated Song", 20); // Song Name (20 bytes)
    view.setUint8(0x25, 0x1A); // 0x1A (1 byte)
    writeFixedString(0x26, "TrackerJS", 20); // Tracker Name (20 bytes)
    view.setUint16(0x3A, 0x0104, true); // Version (2 bytes)
    view.setUint32(0x3C, headerSize - 0x3C, true); // Header Size (4 bytes)
    view.setUint16(0x40, 1, true); // Song Length (2 bytes) - 1 pattern
    view.setUint16(0x42, 0, true); // Restart Position (2 bytes)
    view.setUint16(0x44, 1, true); // Number of Channels (2 bytes)
    view.setUint16(0x46, 1, true); // Number of Patterns (2 bytes)
    view.setUint16(0x48, 1, true); // Number of Instruments (2 bytes)
    view.setUint16(0x4A, 6, true); // Default Speed (2 bytes)
    view.setUint16(0x4C, 125, true); // Default BPM (2 bytes)

    // Pattern order table (0x4E - 0x113)
    view.setUint8(0x4E, 0); // Pattern 0 is first in order table

    let currentOffset = headerSize; // Start after the main header

    // --- Pattern Header (0x114 - ) ---
    view.setUint32(currentOffset, patternHeaderSize - 4, true); // PHEADER Size (4 bytes)
    currentOffset += 4; // Advance past PHEADER size
    view.setUint8(currentOffset, 0); // Packing type (1 byte) - always 0 for 1.04
    view.setUint16(currentOffset + 1, patternRows, true); // Number of rows (2 bytes)
    view.setUint16(currentOffset + 3, patternData.length, true); // Packed data size (2 bytes)
    currentOffset += patternHeaderSize - 4; // Advance past rest of PHEADER

    // --- Pattern Data ---
    new Uint8Array(buffer, currentOffset).set(patternData);
    currentOffset += patternData.length;

    // --- Instrument 1 Header ---
    view.setUint32(currentOffset, instrumentHeaderSize - 4, true); // IHEADER Size (4 bytes)
    currentOffset += 4;
    writeFixedString(currentOffset, "Sawtooth AI", 22); // Instrument Name (22 bytes)
    currentOffset += 22;
    view.setUint8(currentOffset, 1); // Number of samples (1 byte)
    currentOffset += 1;

    // --- Sample 1 Header (within Instrument 1) ---
    view.setUint32(currentOffset, sampleLength, true); // Sample Length (4 bytes)
    currentOffset += 4;
    view.setUint32(currentOffset, 0, true); // Loop Start (4 bytes) - no loop
    currentOffset += 4;
    view.setUint32(currentOffset, 0, true); // Loop Length (4 bytes) - no loop
    currentOffset += 4;
    view.setUint8(currentOffset, 128); // Volume (1 byte)
    currentOffset += 1;
    view.setUint8(currentOffset, 0); // Fine Tune (1 byte)
    currentOffset += 1;
    view.setUint8(currentOffset, 0); // Type (1 byte) - 0 = 8-bit mono
    currentOffset += 1;
    view.setUint8(currentOffset, 0); // Panning (1 byte)
    currentOffset += 1;
    view.setUint8(currentOffset, 0); // Relative Note (1 byte)
    currentOffset += 1;
    writeFixedString(currentOffset, "AI_Saw", 22); // Sample Name (22 bytes)
    currentOffset += 22;

    // --- Sample Data ---
    new Int8Array(buffer, currentOffset, sampleData.length).set(sampleData);
    currentOffset += sampleData.length;
    
    return new Blob([view], { type: 'application/octet-stream' });
}


// --- OTHER GENERATION LOGIC (Text and Audio WAV) ---
async function handleTextGeneration() {
    if (!textPipe || !textPromptInput.value) return;
    textGenerateButton.disabled = true;
    textStatus.textContent = 'Generating text...';
    textOutput.textContent = '';
    try {
        const result = await textPipe(textPromptInput.value, { max_new_tokens: 100 });
        textOutput.textContent = result[0].generated_text;
        textStatus.textContent = 'Generation complete.';
    } catch (error) {
        console.error('Text generation failed:', error);
        textStatus.textContent = 'Error during text generation.';
    } finally {
        textGenerateButton.disabled = false;
    }
}

async function handleMusicGeneration() {
    if (!musicPipe || !musicPromptInput.value) return;
    musicGenerateButton.disabled = true;
    saveWavButton.disabled = true;
    musicStatus.textContent = 'Generating music... this can take some time.';
    audioOutput.src = '';
    lastGeneratedAudio = null;
    try {
        const result = (await musicPipe(musicPromptInput.value)) as AudioOutput;
        lastGeneratedAudio = result;
        const wavBlob = createWavBlob(result.audio, result.sampling_rate);
        const audioUrl = URL.createObjectURL(wavBlob);
        audioOutput.src = audioUrl;
        musicStatus.textContent = 'Music generation complete!';
        saveWavButton.disabled = false;
    } catch (error) {
        console.error('Music generation failed:', error);
        musicStatus.textContent = 'Error during music generation.';
    } finally {
        musicGenerateButton.disabled = false;
    }
}

function handleSaveWav() {
    if (!lastGeneratedAudio) return;
    const wavBlob = createWavBlob(lastGeneratedAudio.audio, lastGeneratedAudio.sampling_rate);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(wavBlob);
    a.download = 'generated-music.wav';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function createWavBlob(audioData: Float32Array, sampleRate: number): Blob {
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataSize = audioData.length * numChannels * (bitsPerSample / 8);
    const chunkSize = 36 + dataSize;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    const writeString = (view: DataView, offset: number, string: string) => {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    };

    writeString(view, 0, 'RIFF');
    view.setUint32(4, chunkSize, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    let offset = 44;
    for (let i = 0; i < audioData.length; i++, offset += 2) {
        const s = Math.max(-1, Math.min(1, audioData[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return new Blob([view], { type: 'audio/wav' });
}
