import React from 'react';
import { PlayIcon, StopIcon, UploadIcon } from './icons';

interface ControlsProps {
  isReady: boolean;
  isPlaying: boolean;
  isModuleLoaded: boolean;
  onFileSelected: (file: File) => void;
  onPlay: () => void;
  onStop: () => void;
  // new prop: media add callback
  onMediaAdd?: (file: File) => void;
}

export const Controls: React.FC<ControlsProps> = ({
  isReady,
  isPlaying,
  isModuleLoaded,
  onFileSelected,
  onPlay,
  onStop,
  onMediaAdd,
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

  return (
    <section className="bg-gray-800 p-4 rounded-lg shadow-lg mb-6">
      <svg width="100%" height="120" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="playGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#10b981', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: '#059669', stopOpacity: 1 }} />
          </linearGradient>
          <linearGradient id="stopGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#dc2626', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: '#b91c1c', stopOpacity: 1 }} />
          </linearGradient>
          <filter id="buttonShadow">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.3"/>
          </filter>
        </defs>

        {/* File Upload Section */}
        <g transform="translate(20, 20)">
          <UploadIcon className="w-5 h-5 text-gray-400" x="0" y="0" />
          <foreignObject x="30" y="-10" width="250" height="40">
            <input
              type="file"
              id="file-input"
              className="text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
              disabled={!isReady}
              onChange={handleFileChange}
              accept=".mod,.s3m,.it,.xm,.mo3"
            />
          </foreignObject>
        </g>

        {/* Media Upload Section */}
        <g transform="translate(20, 70)">
          <UploadIcon className="w-5 h-5 text-gray-400" x="0" y="0" />
          <foreignObject x="30" y="-10" width="250" height="40">
            <input
              type="file"
              id="media-input"
              className="text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
              onChange={handleMediaFile}
              accept=".png,.jpg,.jpeg,.gif,.mp4"
            />
          </foreignObject>
        </g>

        {/* Play Button */}
        <g 
          transform="translate(350, 30)" 
          style={{ cursor: (!isModuleLoaded || isPlaying) ? 'not-allowed' : 'pointer' }}
          onClick={(!isModuleLoaded || isPlaying) ? undefined : onPlay}
        >
          <rect 
            id="play-button"
            x="0" 
            y="0" 
            width="100" 
            height="40" 
            rx="8" 
            fill={(!isModuleLoaded || isPlaying) ? '#1f2937' : 'url(#playGradient)'} 
            filter="url(#buttonShadow)"
            opacity={(!isModuleLoaded || isPlaying) ? 0.5 : 1}
          />
          <g transform="translate(15, 12)">
            <PlayIcon className="w-5 h-5" style={{ color: 'white', pointerEvents: 'none' }} />
          </g>
          <text x="45" y="25" fill="white" fontSize="14" fontWeight="bold" textAnchor="start" style={{ pointerEvents: 'none' }}>
            Play
          </text>
        </g>

        {/* Stop Button */}
        <g 
          transform="translate(470, 30)" 
          style={{ cursor: !isPlaying ? 'not-allowed' : 'pointer' }}
          onClick={!isPlaying ? undefined : () => onStop()}
        >
          <rect 
            id="stop-button"
            x="0" 
            y="0" 
            width="100" 
            height="40" 
            rx="8" 
            fill={!isPlaying ? '#1f2937' : 'url(#stopGradient)'} 
            filter="url(#buttonShadow)"
            opacity={!isPlaying ? 0.5 : 1}
          />
          <g transform="translate(15, 12)">
            <StopIcon className="w-5 h-5" style={{ color: 'white', pointerEvents: 'none' }} />
          </g>
          <text x="45" y="25" fill="white" fontSize="14" fontWeight="bold" textAnchor="start" style={{ pointerEvents: 'none' }}>
            Stop
          </text>
        </g>
      </svg>
    </section>
  );
};
