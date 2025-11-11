export interface ModuleInfo {
  title: string;
  order: number;
  row: number;
  bpm: number;
  numChannels: number;
}

export interface FormattedPatternRow {
  rowNum: number;
  isCurrent: boolean;
  channelStrings: string[];
}

// A best-effort typing for the Emscripten module object
export interface LibOpenMPT {
// ... existing code ...
  _openmpt_module_get_current_estimated_bpm: (modulePtr: number) => number;
}

// For the global window object
// ... existing code ...
