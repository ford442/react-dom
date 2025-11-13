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

export const PatternSequencer: React.FC<PatternSequencerProps> = ({ matrix, currentRow, globalRow = 0, totalRows: _totalRows = 0, onSeek, bpm = 120 }) => {
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
  const msPer16th = bpm > 0 ? (60000 / bpm) / 4 : 125;
  const pulseDuration = `${Math.max(80, Math.round(msPer16th))}ms`;

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

  return (
      <section className="bg-gradient-to-b from-black/60 via-gray-900/60 to-black/40 p-4 rounded-xl mb-4 border border-white/5 shadow-2xl">
        <style>{`
        @keyframes neonPulse {
          0% { transform: scale(1); filter: drop-shadow(0 0 6px rgba(255,255,255,0.06)); }
          50% { transform: scale(1.12); filter: drop-shadow(0 0 22px rgba(255,255,255,0.14)); }
          100% { transform: scale(1); filter: drop-shadow(0 0 6px rgba(255,255,255,0.06)); }
        }
      `}</style>
        <div className="mb-3 flex flex-col gap-2">
          <div className="text-xs text-gray-400">Pattern Steps ({stepCount})</div>
          {
            (() => {
              const { displayBanks, colsForRender, rLayout, cLayout, patternRows } = patternTiles;

              return (
                  <div className="grid gap-1 py-2 px-2 bg-black/40 rounded-lg" style={{ gridTemplateColumns: `repeat(${colsForRender}, minmax(0, 1fr))` }}>
                    {displayBanks.flatMap((b) => Array.from({ length: rLayout * cLayout }).map((_, idx) => {
                      const rowIndex = b * (rLayout * cLayout) + idx;
                      const disabled = rowIndex >= patternLen;
                      const safeRow = ((rowIndex % Math.max(1, patternLen)) + Math.max(1, patternLen)) % Math.max(1, patternLen);
                      const cells = disabled ? Array.from({ length: columns }, () => ({ type: 'empty', text: '' })) : (patternRows[safeRow] || Array.from({ length: columns }, () => ({ type: 'empty', text: '' })));
                      const hasEffect = cells.some(c => c.type === 'effect');
                      const hasInstr = cells.some(c => c.type === 'instrument');
                      const isActive = !disabled && (safeRow === (currentRow % patternLen));

                      const firstNote = cells.find(c => /[A-G]#?-\d/.test(c.text || ''))?.text || '';
                      const noteHue = firstNote ? noteToHue(firstNote) : null;
                      const noteLight = firstNote ? octaveToLightness(firstNote) : 50;
                      const neonColor = noteHue != null ? `hsl(${noteHue} 85% ${noteLight}%)` : hasEffect ? 'rgba(50,214,255,0.95)' : hasInstr ? 'rgba(255,159,28,0.95)' : null;
                      const glowStyle = neonColor ? { boxShadow: `0 0 12px ${neonColor}66, 0 0 28px ${neonColor}33` } : { boxShadow: 'none' };

                      const handleClick = () => { if (disabled) return; const baseGlobal = (globalRow ?? 0) - currentRow; const targetGlobal = baseGlobal + safeRow; onSeek?.(targetGlobal); };

                      return (
                          <button
                              key={`${b}-${idx}`}
                              data-row={disabled ? -1 : safeRow}
                              onClick={handleClick}
                              title={disabled ? '—' : `Row ${safeRow + 1}`}
                              className={`w-full aspect-square rounded flex flex-col items-center justify-center text-[9px] font-mono ${disabled ? 'opacity-40' : (isActive ? 'opacity-100' : 'opacity-80')} hover:opacity-100 transition-all duration-150`}
                              style={{
                                background: disabled ? 'rgba(30,30,30,0.3)' : (neonColor ? `linear-gradient(180deg, ${neonColor}, rgba(10,10,10,0.12))` : 'rgba(60,60,60,0.3)'),
                                border: isActive ? `2px solid rgba(255,230,120,0.8)` : '1px solid rgba(255,255,255,0.08)',
                                ...(neonColor && !disabled ? glowStyle : {}),
                                animation: isActive ? `neonPulse ${pulseDuration} ease-in-out infinite` : undefined
                              }}
                          >
                            <span style={{ color: '#fff', fontWeight: isActive ? 700 : 400, fontSize: '8px', opacity: 0.7 }}>{disabled ? '—' : (safeRow + 1).toString().padStart(2, '0')}</span>
                            <div className="w-3/4 h-0.5 mt-0.5" style={{ background: neonColor ? `linear-gradient(90deg, ${neonColor}, ${neonColor.replace(/\)0.95/g, '0.6')})` : 'transparent', borderRadius: 1 }} />
                          </button>
                      );
                    }))}
                  </div>
              );
            })()
          }
        </div>
        <div style={{ position: 'relative' }} ref={containerRef}>
          <div
              ref={playheadRef}
              style={{
                position: 'absolute',
                pointerEvents: 'none',
                transition: 'none',
                transform: 'translate(0px,0px)',
                zIndex: 60,
                opacity: 0,
                borderRadius: 6,
                boxShadow: '0 8px 30px rgba(255,200,60,0.06)',
                border: '2px solid rgba(255,230,120,0.2)',
                background: 'transparent'
              }}
          />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="text-xs text-gray-400">Pos</div>
          <input
              type="range"
              min={0}
              max={Math.max(0, (_totalRows || 0) - 1)}
              value={Math.min(globalRow, Math.max(0, (_totalRows || 0) - 1))}
              onChange={e => onSeek?.(Number(e.target.value))}
              className="w-full"
          />
          <div className="text-xs text-gray-300">{globalRow}/{_totalRows}</div>
        </div>
      </section>
  );
};