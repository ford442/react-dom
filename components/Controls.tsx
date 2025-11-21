import React from 'react';
import { PlayIcon, StopIcon, UploadIcon, LoopIcon } from './icons';

interface ControlsProps {
  isReady: boolean;
  isPlaying: boolean;
  isModuleLoaded: boolean;
  onFileSelected: (file: File) => void;
  onPlay: () => void;
  onStop: () => void;
  // new prop: media add callback
  onMediaAdd?: (file: File) => void;
  isLooping: boolean;
  onLoopToggle: () => void;
  panValue: number;
  onPanChange: (value: number) => void;
}

export const Controls: React.FC<ControlsProps> = ({
  isReady,
  isPlaying,
  isModuleLoaded,
  onFileSelected,
  onPlay,
  onStop,
  onMediaAdd,
  isLooping,
  onLoopToggle,
  panValue,
  onPanChange,
}) => {
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileSelected(file);
    }
  };

  const handleMediaFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && onMediaAdd) {
      onMediaAdd(file);
    }
  };

  const getPanLabel = (value: number): string => {
    if (value === 0) return 'Center';
    if (value < 0) return `L${Math.abs(Math.round(value * 100))}`;
    return `R${Math.abs(Math.round(value * 100))}`;
  };

  return (
    <section className="bg-gray-800 p-4 rounded-lg shadow-lg mb-6 flex flex-wrap gap-4 items-center">
      <div className="flex items-center gap-2">
        <UploadIcon className="w-5 h-5 text-gray-400" />
        <input
          type="file"
          id="file-input"
          className="text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
          disabled={!isReady}
          onChange={handleFileChange}
          accept=".mod,.s3m,.it,.xm,.mo3"
        />
      </div>

      <div className="flex items-center gap-2">
        <UploadIcon className="w-5 h-5 text-gray-400" />
        <input
          type="file"
          id="media-input"
          className="text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
          onChange={handleMediaFile}
          accept=".png,.jpg,.jpeg,.gif,.mp4"
        />
      </div>

      <div className="flex gap-4 items-center">
        <button
          id="play-button"
          className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
          onClick={onPlay}
          disabled={!isModuleLoaded || isPlaying}
          aria-label="Play"
        >
          <PlayIcon className="w-5 h-5" />
          Play
        </button>

        <button
          id="stop-button"
          className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
          onClick={() => onStop()}
          disabled={!isPlaying}
          aria-label="Stop"
        >
          <StopIcon className="w-5 h-5" />
          Stop
        </button>

        <div className="flex items-center gap-2 px-3 py-2 bg-gray-700/50 rounded-lg">
          <LoopIcon className="w-5 h-5 text-gray-400" />
          <span className="text-sm text-gray-400 mr-2">Loop</span>
          <button
            id="loop-toggle"
            onClick={onLoopToggle}
            disabled={!isModuleLoaded}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed ${
              isLooping ? 'bg-blue-600' : 'bg-gray-600'
            }`}
            aria-label="Toggle Loop"
            role="switch"
            aria-checked={isLooping}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isLooping ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 min-w-[200px]">
        <label htmlFor="pan-slider" className="text-sm text-gray-400 whitespace-nowrap">
          Pan: {getPanLabel(panValue)}
        </label>
        <input
          id="pan-slider"
          type="range"
          min="-1"
          max="1"
          step="0.01"
          value={panValue}
          onChange={(e) => onPanChange(parseFloat(e.target.value))}
          disabled={!isModuleLoaded}
          className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Stereo Panning"
        />
      </div>
    </section>
  );
};
