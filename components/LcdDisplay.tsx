import React from 'react';
import { ModuleInfo } from '../types';

interface InfoDisplayProps {
  moduleInfo: ModuleInfo;
}

/**
 * A "faux hardware" LCD-style display for module info.
 */
export const LcdDisplay: React.FC<InfoDisplayProps> = ({ moduleInfo }) => {
  
  const LcdItem = ({ label, value }: { label: string, value: string | number }) => (
    <div className="bg-gray-900/50 p-3 rounded border border-black/30 shadow-inner">
      <div className="text-xs text-emerald-400/70 mb-1 tracking-wide">{label}</div>
      <div className="font-mono text-2xl text-emerald-300 tracking-wider" style={{ textShadow: '0 0 5px #34d399' }}>
        {value}
      </div>
    </div>
  );

  return (
    <section className="bg-gray-700/50 p-4 rounded-lg shadow-lg mb-6 border border-gray-600/50">
      <div className="mb-3">
        <div className="text-xs text-emerald-400/70 mb-1 tracking-wide">TITLE</div>
        <div 
          className="font-mono text-lg text-emerald-300 bg-gray-900/50 p-2 rounded border border-black/30 shadow-inner truncate" 
          style={{ textShadow: '0 0 5px #34d399' }}
        >
          {moduleInfo.title}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <LcdItem label="ORDER" value={String(moduleInfo.order).padStart(2, '0')} />
        <LcdItem label="ROW" value={String(moduleInfo.row).padStart(2, '0')} />
        <LcdItem label="BPM" value={String(moduleInfo.bpm).padStart(3, '0')} />
      </div>
    </section>
  );
};
