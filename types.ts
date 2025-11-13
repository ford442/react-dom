export interface ModuleInfo {
  title: string;
  order: number;
  row: number;
  bpm: number;
  numChannels: number;
}

// Media types for images/GIFs/videos used by the UI
export type MediaKind = 'image' | 'gif' | 'video';

export interface MediaItem {
  /** stable id for the item (uuid or timestamp string) */
  id: string;
  /** Object URL or remote URL to the media resource */
  url: string;
  /** Original file name or URL filename for display */
  fileName?: string;
  /** MIME type (e.g. image/png, image/gif, video/mp4) */
  mimeType?: string;
  /** Derived kind: 'image' | 'gif' | 'video' */
  kind: MediaKind;
  /** Rendering prefs */
  loop?: boolean; // defaults: false for images, true for gifs, false for video
  muted?: boolean; // sensible default: true for autoplay overlays
  fit?: 'contain' | 'cover';
  /** Creation timestamp */
  createdAt?: number;
  /** Whether this url was created from a local File via URL.createObjectURL */
  isObjectUrl?: boolean;
}

export interface MediaState {
  media: MediaItem[];
  activeMediaId?: string;
}

// A best-effort typing for the Emscripten module object
export interface LibOpenMPT {
  onRuntimeInitialized: () => void;
  HEAPU8: Uint8Array;
  HEAPF32: Float32Array;
  _malloc: (size: number) => number;
  _free: (ptr: number) => void;
  UTF8ToString: (ptr: number) => string;
  stringToUTF8: (str: string) => number;
  _openmpt_module_create_from_memory2: (
    bufferPtr: number,
    fileDataLength: number,
    logfunc: number,
    loguser: number,
    errfunc: number,
    erruser: number,
    error: number,
    error_message: number,
    ctls: number
  ) => number; // returns modulePtr
  _openmpt_module_destroy: (modulePtr: number) => void;
  _openmpt_free_string: (strPtr: number) => void;
  _openmpt_module_get_metadata: (modulePtr: number, keyPtr: number) => number; // returns valuePtr
  _openmpt_module_get_num_orders: (modulePtr: number) => number;
  _openmpt_module_get_num_channels: (modulePtr: number) => number;
  _openmpt_module_get_order_pattern: (modulePtr: number, order: number) => number;
  _openmpt_module_get_num_patterns: (modulePtr: number) => number;
  _openmpt_module_get_pattern_num_rows: (modulePtr: number, pattern: number) => number;
  _openmpt_module_format_pattern_row_channel: (
    modulePtr: number,
    pattern: number,
    row: number,
    channel: number,
    width: number,
    padded: number
  ) => number; // returns strPtr
  _openmpt_module_read_float_stereo: (
    modulePtr: number,
    sampleRate: number,
    count: number,
    leftBufferPtr: number,
    rightBufferPtr: number
  ) => number; // returns frames rendered
  _openmpt_module_set_position_order_row: (modulePtr: number, order: number, row: number) => void;
  _openmpt_module_get_current_order: (modulePtr: number) => number;
  _openmpt_module_get_current_row: (modulePtr: number) => number;
  _openmpt_module_get_current_estimated_bpm: (modulePtr: number) => number;
}

// For the global window object
declare global {
  interface Window {
    libopenmpt: Partial<LibOpenMPT>;
    AudioContext: typeof AudioContext;
    webkitAudioContext: typeof AudioContext;
    GEMINI_API_KEY?: string;
    // FIX: Add promise for robust initialization
    libopenmptReady: Promise<Partial<LibOpenMPT>>;
  }
}
