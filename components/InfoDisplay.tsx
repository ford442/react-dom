
import React from 'react';
import { ModuleInfo } from '../types';

interface InfoDisplayProps {
  moduleInfo: ModuleInfo;
}

export const InfoDisplay: React.FC<InfoDisplayProps> = ({ moduleInfo }) => {
  return (
    <section className="bg-gray-800 p-4 rounded-lg shadow-lg mb-6 text-sm">
      <svg width="100%" height="60" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 60" preserveAspectRatio="none">
        <defs>
          <linearGradient id="infoBackground" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style={{ stopColor: '#1f2937', stopOpacity: 0.8 }} />
            <stop offset="50%" style={{ stopColor: '#374151', stopOpacity: 0.6 }} />
            <stop offset="100%" style={{ stopColor: '#1f2937', stopOpacity: 0.8 }} />
          </linearGradient>
        </defs>

        {/* Background rectangles for each section */}
        <rect x="0" y="0" width="320" height="50" rx="6" fill="url(#infoBackground)" opacity="0.5" />
        <rect x="340" y="0" width="320" height="50" rx="6" fill="url(#infoBackground)" opacity="0.5" />
        <rect x="680" y="0" width="310" height="50" rx="6" fill="url(#infoBackground)" opacity="0.5" />

        {/* Title Section */}
        <text x="20" y="20" fill="#9ca3af" fontSize="13" fontWeight="bold">Title:</text>
        <text id="song-title" x="20" y="40" fill="#e5e7eb" fontSize="14">{moduleInfo.title}</text>

        {/* Position Section */}
        <text x="350" y="20" fill="#9ca3af" fontSize="13" fontWeight="bold">Position:</text>
        <g transform="translate(350, 35)">
          <text x="0" y="0" fill="#e5e7eb" fontSize="14">Order: </text>
          <text id="current-order" x="60" y="0" fill="white" fontSize="14" fontWeight="600">
            {String(moduleInfo.order).padStart(2, '0')}
          </text>
          <text x="100" y="0" fill="#e5e7eb" fontSize="14">Row: </text>
          <text id="current-row" x="140" y="0" fill="white" fontSize="14" fontWeight="600">
            {String(moduleInfo.row).padStart(2, '0')}
          </text>
        </g>

        {/* Tempo Section */}
        <text x="690" y="20" fill="#9ca3af" fontSize="13" fontWeight="bold">Tempo:</text>
        <g transform="translate(690, 35)">
          <text id="current-bpm" x="0" y="0" fill="white" fontSize="14" fontWeight="600">
            {moduleInfo.bpm}
          </text>
          <text x="35" y="0" fill="#e5e7eb" fontSize="14"> BPM</text>
        </g>
      </svg>
    </section>
  );
};
