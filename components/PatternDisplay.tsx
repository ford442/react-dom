
import React from 'react';

interface PatternDisplayProps {
  data: string;
  numChannels: number;
}

export const PatternDisplay: React.FC<PatternDisplayProps> = ({ data, numChannels }) => {
  const channelHeaders = Array.from({ length: numChannels }, (_, i) => `CH ${String(i + 1).padStart(2, '0')}`);

  return (
    <section className="bg-black p-4 rounded-lg shadow-inner overflow-hidden">
      <div 
        className="font-mono text-xs text-gray-400 overflow-x-auto pattern-scrollbar whitespace-pre"
        style={{ columnWidth: '130px' }}
      >
        <div className="sticky top-0 bg-black z-10 pb-2">
          <span className="text-yellow-300">ROW | {channelHeaders.map(h => `${h.padEnd(13, ' ')}|`).join(' ')}</span>
        </div>
        <pre 
          id="pattern-display" 
          className="font-mono text-sm text-green-400 h-96"
          dangerouslySetInnerHTML={{ __html: data }}
        />
      </div>
    </section>
  );
};
