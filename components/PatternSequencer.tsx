import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { PatternMatrix } from '../types';

interface PatternSequencerProps {
  matrix: PatternMatrix | null;
  currentRow: number;
  globalRow?: number;
  totalRows?: number;
  onSeek?: (stepIndex: number) => void;
  bpm?: number;
}

export const PatternSequencer: React.FC<PatternSequencerProps> = ({ matrix, currentRow, globalRow = 0, totalRows: _totalRows = 0, onSeek, bpm: _bpm = 120 }) => {
  // 1. Defined all hooks unconditionally at the top
  const [cellSize] = useState<number>(14); // px
  const [visibleRows] = useState<number>(16);
  const [repeatCount] = useState<number>(2);
  const [layout] = useState<'4x32' | '8x16' | '2x64'>('4x32');
  const [autoFollow] = useState<boolean>(true);
  const [manualBank] = useState<number>(0);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const playheadRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);

  // 2. Always run useMemo, even if matrix is null (return safe defaults inside)
  const display = useMemo(() => {
    if (!matrix) return { rows: [], numChannels: 0, numRows: 0, order: 0, start: 0 };
    const { rows, numChannels, numRows, order } = matrix;
    let start = Math.max(0, currentRow - Math.floor(visibleRows / 2));
    if (start + visibleRows > numRows) start = Math.max(0, numRows - visibleRows);
    const slice = rows.slice(start, start + visibleRows);
    return { rows: slice, numChannels, numRows, order, start };
  }, [matrix, currentRow, visibleRows]);

  // 3. Always run useEffect
  useEffect(() => {
    if (!containerRef.current) return;

    const gap = 6;
    const headerOffset = cellSize + gap;
    const start = display.start ?? 0;
    const stepsPerRepeat = display.rows?.length ?? 0;

    if (stepsPerRepeat === 0) return;

    const visibleIndex = ((currentRow - start) % stepsPerRepeat + stepsPerRepeat) % stepsPerRepeat;
    const middleRepeat = Math.floor(repeatCount / 2);
    const targetIndex = visibleIndex + middleRepeat * stepsPerRepeat;

    const stepSpan = cellSize + gap;
    const targetLeft = headerOffset + targetIndex * stepSpan;

    if (playheadRef.current) {
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

  // Helpers (not hooks)
  const columns = matrix?.numChannels ?? 0;
  const patternLen = matrix?.numRows ?? 64;
  const stepCount = Math.max(64, patternLen);

  let rowsLayout = 4, colsLayout = 32;
  if (layout === '8x16') { rowsLayout = 8; colsLayout = 16; }
  if (layout === '2x64') { rowsLayout = 2; colsLayout = 64; }

  const gridCapacity = colsLayout * rowsLayout;
  const totalBanks = Math.max(1, Math.ceil(stepCount / gridCapacity));
  const followBank = Math.floor((currentRow % Math.max(1, patternLen)) / gridCapacity);
  const bank = autoFollow ? followBank : Math.min(totalBanks - 1, Math.max(0, manualBank));
  // BPM calculation removed; per-channel display uses smooth CSS transitions

  const noteToHue = (note: string): number => {
    const noteMap: Record<string, number> = {
      'C': 0, 'C#': 30, 'D': 60, 'D#': 90, 'E': 120, 'F': 150,
      'F#': 180, 'G': 210, 'G#': 240, 'A': 270, 'A#': 300, 'B': 330
    };
    const match = (note || '').match(/^([A-G]#?)-?(\d)?/i);
    if (!match) return 0;
    const noteName = match[1];
    return noteMap[noteName.toUpperCase()] ?? 0;
  };

  const octaveToLightness = (note: string): number => {
    const match = (note || '').match(/-(\d)/);
    if (!match) return 50;
    const octave = parseInt(match[1], 10);
    return 35 + (octave * 8);
  };

  // 4. Always run this useMemo too
  const patternTiles = useMemo(() => {
    if (!matrix) return null;

    let rLayout = 4, cLayout = 32;
    if (layout === '8x16') { rLayout = 8; cLayout = 16; }
    if (layout === '2x64') { rLayout = 2; cLayout = 64; }

    const displayBanks = [] as number[];
    if (bank - 1 >= 0) displayBanks.push(bank - 1);
    displayBanks.push(bank);
    if (bank + 1 < totalBanks) displayBanks.push(bank + 1);
    const colsForRender = cLayout * displayBanks.length;

    const patternRows = matrix.rows || Array.from({ length: patternLen }, () => Array.from({ length: columns }, () => ({ type: 'empty', text: '' })));

    return { displayBanks, colsForRender, rLayout, cLayout, patternRows };
  }, [matrix, layout, bank, totalBanks, patternLen, columns]);

  // 5. Finally, conditional rendering logic at the very end
  if (!matrix || !patternTiles) {
    return (
        <section className="bg-gradient-to-br from-gray-900 to-black p-4 rounded-xl mb-4 text-sm text-gray-400 border border-white/4 shadow-lg">
          No pattern data available.
        </section>
    );
  }

  const cellWidth = 16;
  const cellHeight = 20;
  const cellGap = 2;
  const labelWidth = 60;
  const headerHeight = 40;
  const channelHeight = cellHeight + 8;
  const totalHeight = headerHeight + (columns * channelHeight) + 80;

  return (
      <section className="bg-gradient-to-b from-black/60 via-gray-900/60 to-black/40 p-4 rounded-xl mb-4 border border-white/5 shadow-2xl">
        <style>{`
        @keyframes neonPulse {
          0% { transform: scale(1); filter: drop-shadow(0 0 6px rgba(255,255,255,0.06)); }
          50% { transform: scale(1.12); filter: drop-shadow(0 0 22px rgba(255,255,255,0.14)); }
          100% { transform: scale(1); filter: drop-shadow(0 0 6px rgba(255,255,255,0.06)); }
        }
        .svg-pattern-container {
          overflow-x: auto;
          overflow-y: auto;
          max-height: 60vh;
        }
      `}</style>
        <div className="mb-4 flex flex-col gap-3 relative">
          {/* SVG-based per-channel sequencer display */}
          <svg width="100%" height={totalHeight} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${labelWidth + patternLen * (cellWidth + cellGap) + 100} ${totalHeight}`} preserveAspectRatio="xMidYMin meet">
            <defs>
              <filter id="neonGlow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
              <linearGradient id="playheadGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style={{ stopColor: 'rgba(255,230,120,0.8)', stopOpacity: 1 }} />
                <stop offset="100%" style={{ stopColor: 'rgba(255,230,120,0.3)', stopOpacity: 1 }} />
              </linearGradient>
            </defs>

            {/* Header */}
            <text x="10" y="20" fill="#9ca3af" fontSize="12">
              Multi-Channel Pattern Sequencer — {columns} Channels × {patternLen} Steps
            </text>
            <text x={labelWidth + patternLen * (cellWidth + cellGap) + 80} y="20" fill="#6b7280" fontSize="12" textAnchor="end">
              Row {currentRow + 1}/{patternLen}
            </text>

            {/* Channel strips */}
            <g transform={`translate(0, ${headerHeight})`}>
              {Array.from({ length: columns }).map((_, chIdx) => {
                const { patternRows } = patternTiles;
                const yPos = chIdx * channelHeight;

                return (
                  <g key={chIdx} transform={`translate(0, ${yPos})`}>
                    {/* Channel label */}
                    <text 
                      x={labelWidth - 10} 
                      y={cellHeight / 2 + 4} 
                      fill="#9ca3af" 
                      fontSize="11" 
                      fontFamily="monospace"
                      textAnchor="end"
                    >
                      CH {(chIdx + 1).toString().padStart(2, '0')}
                    </text>

                    {/* Step cells */}
                    {Array.from({ length: patternLen }).map((_, stepIdx) => {
                      const cells = patternRows[stepIdx] || Array.from({ length: columns }, () => ({ type: 'empty', text: '' }));
                      const cell = cells[chIdx];
                      const cellNote = cell && /[A-G]#?-/i.test(cell.text || '') ? cell.text : '';
                      const isActive = stepIdx === (currentRow % patternLen);
                      const xPos = labelWidth + stepIdx * (cellWidth + cellGap);

                      let cellColor = 'rgba(60,60,70,0.3)';
                      let opacity = 0.3;
                      let glowFilter = '';

                      if (cellNote) {
                        const hue = noteToHue(cellNote);
                        const light = octaveToLightness(cellNote);
                        cellColor = `hsl(${hue} 85% ${light}%)`;
                        opacity = isActive ? 1 : 0.75;
                        glowFilter = isActive ? 'url(#neonGlow)' : '';
                      } else if (isActive) {
                        cellColor = 'rgba(255,255,255,0.15)';
                        opacity = 0.6;
                      }

                      const scaleY = isActive ? 1.3 : 1;
                      const adjustedHeight = cellHeight * scaleY;
                      const yOffset = (cellHeight - adjustedHeight) / 2;

                      return (
                        <rect
                          key={stepIdx}
                          x={xPos}
                          y={yOffset}
                          width={cellWidth}
                          height={adjustedHeight}
                          rx="2"
                          fill={cellColor}
                          opacity={opacity}
                          filter={glowFilter}
                          style={{ cursor: 'pointer', transition: 'all 75ms ease-out' }}
                          onClick={() => {
                            const baseGlobal = (globalRow ?? 0) - currentRow;
                            const targetGlobal = baseGlobal + stepIdx;
                            onSeek?.(targetGlobal);
                          }}
                        >
                          <title>{cellNote ? `${cellNote} @ row ${stepIdx + 1}` : `Empty @ row ${stepIdx + 1}`}</title>
                        </rect>
                      );
                    })}
                  </g>
                );
              })}

              {/* Playhead sweep line */}
              <line
                x1={labelWidth + ((currentRow % patternLen) * (cellWidth + cellGap)) + cellWidth / 2}
                y1="0"
                x2={labelWidth + ((currentRow % patternLen) * (cellWidth + cellGap)) + cellWidth / 2}
                y2={columns * channelHeight}
                stroke="url(#playheadGradient)"
                strokeWidth="2"
                style={{ 
                  pointerEvents: 'none',
                  filter: 'drop-shadow(0 0 8px rgba(255,230,120,0.6))',
                  transition: 'all 80ms ease-out'
                }}
              />
            </g>
          </svg>
        </div>

        {/* Position slider using SVG */}
        <svg width="100%" height="40" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 40" preserveAspectRatio="none">
          <text x="10" y="20" fill="#9ca3af" fontSize="12">Pos</text>
          <foreignObject x="60" y="5" width="850" height="30">
            <input
              type="range"
              min={0}
              max={Math.max(0, (_totalRows || 0) - 1)}
              value={Math.min(globalRow, Math.max(0, (_totalRows || 0) - 1))}
              onChange={e => onSeek?.(Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </foreignObject>
          <text x="920" y="20" fill="#d1d5db" fontSize="12">
            {globalRow}/{_totalRows}
          </text>
        </svg>
      </section>
  );
};