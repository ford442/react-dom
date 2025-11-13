import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { PatternMatrix, PatternCell } from '../types';

interface PatternSequencerProps {
  matrix: PatternMatrix | null;
  currentRow: number;
  globalRow?: number;
  totalRows?: number;
  onSeek?: (stepIndex: number) => void;
}

export const PatternSequencer: React.FC<PatternSequencerProps> = ({ matrix, currentRow, globalRow = 0, totalRows = 0, onSeek }) => {
  const [cellSize, setCellSize] = useState<number>(14); // px
  const [visibleRows, setVisibleRows] = useState<number>(16);
  const [repeatCount, setRepeatCount] = useState<number>(2);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playheadRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const seekTimeout = useRef<number | null>(null);

  // derive display matrix slice
  const display = useMemo(() => {
    if (!matrix) return { rows: [], numChannels: 0, numRows: 0, order: 0 };
    const { rows, numChannels, numRows, order } = matrix;
    // For horizontal display, we render a slice of steps (rows) and allow repeating across X axis
    let start = Math.max(0, currentRow - Math.floor(visibleRows / 2));
    if (start + visibleRows > numRows) start = Math.max(0, numRows - visibleRows);
    const slice = rows.slice(start, start + visibleRows);
    return { rows: slice, numChannels, numRows, order, start };
  }, [matrix, currentRow, visibleRows]);

  // when currentRow changes, move playhead horizontally and optionally center view (no vertical scroll)
  useEffect(() => {
    if (!containerRef.current) return;

    const gap = 6; // larger gaps for breathing room in horizontal layout
    const headerOffset = cellSize + gap; // left labels column width
    const start = display.start ?? 0;

    // total steps rendered per repeat
    const stepsPerRepeat = display.rows?.length ?? 0;
    if (stepsPerRepeat === 0) return;

    // compute visible index within the repeated sequence
    const visibleIndex = ((currentRow - start) % stepsPerRepeat + stepsPerRepeat) % stepsPerRepeat; // 0..stepsPerRepeat-1
    // choose the middle repeat instance so playhead stays near center visually
    const middleRepeat = Math.floor(repeatCount / 2);
    const targetIndex = visibleIndex + middleRepeat * stepsPerRepeat;

    const stepSpan = cellSize + gap;
    const targetLeft = headerOffset + targetIndex * stepSpan;

    if (playheadRef.current) {
      // apply smooth transform; CSS transition handles animation
      playheadRef.current.style.transform = `translateX(${targetLeft}px)`;
      playheadRef.current.style.opacity = '1';
    }

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [currentRow, cellSize, visibleRows, display.start, display.rows, repeatCount]);

  if (!matrix) {
    return (
      <section className="bg-gradient-to-br from-gray-900 to-black p-4 rounded-xl mb-4 text-sm text-gray-400 border border-white/4 shadow-lg">
        No pattern data available.
      </section>
    );
  }

  const columns = matrix.numChannels;

  // prepare steps repeated across X
  const steps = (display.rows || []) as PatternCell[][];
  const repeatedSteps: PatternCell[][] = [];
  for (let r = 0; r < repeatCount; r++) {
    for (let i = 0; i < steps.length; i++) repeatedSteps.push(steps[i] as PatternCell[]);
  }

  // helper to map cell type to color (returns CSS color string)
  const colorFor = (type: string, ci: number) => {
    const hue = Math.floor((ci / Math.max(1, columns)) * 360);
    switch (type) {
      case 'note':
        return `linear-gradient(180deg, hsl(${(hue + 320) % 360}deg 85% 60%), hsl(${(hue + 300) % 360}deg 85% 45%))`;
      case 'effect':
        return `linear-gradient(180deg, hsl(${(hue + 180) % 360}deg 80% 60%), hsl(${(hue + 160) % 360}deg 80% 45%))`;
      case 'instrument':
        return `linear-gradient(180deg, hsl(${(hue + 30) % 360}deg 90% 60%), hsl(${(hue + 10) % 360}deg 90% 45%))`;
      default:
        return 'transparent';
    }
  };

  return (
    <section className="bg-gradient-to-b from-black/60 via-gray-900/60 to-black/40 p-4 rounded-xl mb-4 border border-white/5 shadow-2xl">
      {/* Inject small CSS for neon pulse animation scoped to this component */}
      <style>{`
        @keyframes neonPulse {
          0% { transform: scale(1); filter: drop-shadow(0 0 6px rgba(255,255,255,0.06)); }
          50% { transform: scale(1.12); filter: drop-shadow(0 0 22px rgba(255,255,255,0.14)); }
          100% { transform: scale(1); filter: drop-shadow(0 0 6px rgba(255,255,255,0.06)); }
        }
      `}</style>
       {/* 64-step compact button readout */}
       <div className="mb-3 flex items-center gap-2">
         <div className="text-xs text-gray-400 mr-2">Steps</div>
         <div className="flex gap-2 overflow-x-auto py-1 px-1" style={{ maxWidth: '100%' }}>
           {Array.from({ length: 64 }).map((_, i) => {
             const patRows = display.rows || [];
             const patLen = patRows.length || matrix.numRows || 64;
             const rowIndex = i < patLen ? i % patLen : i % Math.max(1, patLen);
             const cells = patRows[rowIndex] || Array.from({ length: columns }, () => ({ type: 'empty', text: '' }));
             const hasNote = cells.some(c => c.type === 'note');
             const hasEffect = cells.some(c => c.type === 'effect');
             const hasInstr = cells.some(c => c.type === 'instrument');
             const isActive = i === ((currentRow) % 64); // visual active per pattern
             // neon colors
             const neonColor = hasNote ? 'rgba(255,77,255,0.95)' : hasEffect ? 'rgba(50,214,255,0.95)' : hasInstr ? 'rgba(255,159,28,0.95)' : null;
             const glowStyle = neonColor ? { boxShadow: `0 0 12px ${neonColor}, 0 0 28px ${neonColor.replace('0.95', '0.25')}` } : { boxShadow: 'none' };
             const disabled = i >= patLen;
             const handleClick = () => {
               if (disabled) return;
               // map to global: baseGlobal = globalRow - currentRow
               const baseGlobal = (globalRow ?? 0) - currentRow;
               const targetGlobal = baseGlobal + rowIndex;
               onSeek?.(targetGlobal);
             };

             return (
               <button
                 key={i}
                 onClick={handleClick}
                 disabled={disabled}
                 title={`Step ${i}${disabled ? ' (inactive)' : ''}`}
                 className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-mono ${disabled ? 'opacity-30' : 'opacity-100'}`}
                 style={{
                   background: disabled ? 'rgba(255,255,255,0.03)' : undefined,
                   border: isActive ? `1px solid rgba(255,230,120,0.6)` : undefined,
                   ...(neonColor && !disabled ? glowStyle : {}),
                   animation: isActive ? 'neonPulse 900ms ease-in-out infinite' : undefined,
                 }}
               >
                 <span style={{ color: disabled ? 'rgba(255,255,255,0.5)' : '#fff', fontWeight: isActive ? 700 : 500 }}>{i + 1}</span>
               </button>
             );
           })}
         </div>
       </div>
     <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-gray-300 font-semibold">Pattern Sequencer — Order {matrix.order} • Rows {matrix.numRows} • Ch {columns}</div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400">Rows</label>
            <select value={visibleRows} onChange={(e) => setVisibleRows(Number(e.target.value))} className="text-sm bg-gray-800 text-white p-1 rounded">
              <option value={8}>8</option>
              <option value={16}>16</option>
              <option value={32}>32</option>
              <option value={64}>64</option>
              <option value={matrix.numRows}>Full</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400">Repeats</label>
            <select value={repeatCount} onChange={(e) => setRepeatCount(Number(e.target.value))} className="text-sm bg-gray-800 text-white p-1 rounded">
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400">Size</label>
            <input type="range" min={8} max={28} value={cellSize} onChange={(e) => setCellSize(Number(e.target.value))} className="accent-purple-500" />
          </div>
        </div>
      </div>

      <div className="flex gap-3 items-center mb-3">
        <div className="flex items-center gap-3 text-xs text-gray-300">
          <span className="inline-block w-3 h-3 rounded-full" style={{ background: 'linear-gradient(90deg,#ff4dff,#ff66cc)' }} /> <span>Note</span>
          <span className="inline-block w-3 h-3 rounded-full ml-2" style={{ background: 'linear-gradient(90deg,#32d6ff,#2ad6c6)' }} /> <span>Effect</span>
          <span className="inline-block w-3 h-3 rounded-full ml-2" style={{ background: 'linear-gradient(90deg,#ff9f1c,#ffd27a)' }} /> <span>Instrument</span>
        </div>
      </div>

      <div ref={containerRef} style={{ overflow: 'hidden', position: 'relative' }}>
        {/* playhead overlay (horizontal) */}
        <div
          ref={playheadRef}
          style={{
            position: 'absolute',
            top: 6,
            height: columns * (cellSize + 6) + 8,
            pointerEvents: 'none',
            transform: 'translateX(0px)',
            transition: 'transform 220ms cubic-bezier(.22,.9,.3,1), opacity 160ms ease-out',
            opacity: 0,
            filter: 'drop-shadow(0 6px 18px rgba(255,200,60,0.06))',
            zIndex: 30,
          }}
        >
          <div style={{ height: '100%', width: '100%', background: 'linear-gradient(180deg, rgba(255,200,60,0.06), rgba(255,200,60,0.02))', borderRadius: 8, backdropFilter: 'blur(2px)' }} />
        </div>

        <div style={{ display: 'grid', gridAutoFlow: 'column', gridTemplateRows: `repeat(${columns + 1}, ${cellSize}px)`, gap: 6 }}>
          {/* first column: channel labels (occupies first column slot) */}
          <div style={{ display: 'grid', gridRow: `1 / span ${columns + 1}`, gap: 6 }}>
            <div style={{ width: cellSize, height: cellSize }} />
            {Array.from({ length: columns }).map((_, ci) => (
              <div
                key={ci}
                className="text-center text-xs text-gray-300 bg-gray-900/40 rounded-md flex items-center justify-center"
                style={{ width: cellSize, height: cellSize }}
              >
                {`C${ci + 1}`}
              </div>
            ))}
          </div>

          {/* steps as columns */}
          {repeatedSteps.map((row, stepIdx) => {
            const stepNumber = (display.start ?? 0) + (stepIdx % (display.rows.length || 1));
            const isPlay = (stepNumber === currentRow);
            return (
              <div key={stepIdx} style={{ display: 'grid', gridTemplateRows: `repeat(${columns + 1}, ${cellSize}px)`, gap: 6 }}>
                <div
                  style={{ width: cellSize, height: cellSize, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  className={`text-xs ${isPlay ? 'text-yellow-300 font-semibold' : 'text-gray-400'}`}
                >
                  <div className="px-1 py-[1px] rounded bg-black/40">{String(stepNumber).padStart(2, '0')}</div>
                </div>
                {row.map((cell, ci) => {
                  const bg = colorFor(cell.type, ci);
                  const boxShadow = cell.type !== 'empty' ? `0 6px 18px ${bg === 'transparent' ? 'rgba(0,0,0,0.0)' : 'rgba(0,0,0,0.08)'}` : 'none';
                  const border = cell.type === 'empty' ? '1px solid rgba(255,255,255,0.03)' : 'none';
                  const opacity = isPlay ? 1 : 0.95;
                  return (
                    <div
                      key={ci}
                      title={`ch ${ci + 1} r ${stepNumber} — ${cell.text || 'empty'}`}
                      style={{
                        width: cellSize,
                        height: cellSize,
                        background: bg,
                        border,
                        boxShadow,
                        borderRadius: 6,
                        opacity,
                        transition: 'transform 140ms ease, box-shadow 140ms ease, opacity 140ms ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: cell.type === 'empty' ? 'default' : 'pointer',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.06)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 10px 30px rgba(0,0,0,0.18)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; (e.currentTarget as HTMLElement).style.boxShadow = boxShadow as any; }}
                    >
                      {/* small indicator for note/effect */}
                      {cell.type !== 'empty' && (
                        <div className="text-[9px] font-mono text-black/80" style={{ padding: '0 2px', background: 'rgba(255,255,255,0.85)', borderRadius: 2 }}>
                          {cell.text || ''}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      {/* song position slider */}
      <div className="mt-3 flex items-center gap-3">
        <div className="text-xs text-gray-400">Pos</div>
        <input
          type="range"
          min={0}
          max={Math.max(0, totalRows - 1)}
          value={Math.min(globalRow, Math.max(0, totalRows - 1))}
          onChange={(e) => {
            const val = Number(e.target.value);
            if (seekTimeout.current) {
              window.clearTimeout(seekTimeout.current);
            }
            // debounce seek: 150ms
            seekTimeout.current = window.setTimeout(() => {
              onSeek?.(val);
              seekTimeout.current = null;
            }, 150);
          }}
          className="w-full"
        />
        <div className="text-xs text-gray-300">{globalRow}/{totalRows}</div>
      </div>
    </section>
  );
};
