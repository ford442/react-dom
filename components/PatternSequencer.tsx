import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { PatternMatrix } from '../types';

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
  const [layout, setLayout] = useState<'4x32' | '8x16' | '2x64'>('4x32');
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

  // compute layout grid (rows x cols) for step display
  const patternLen = matrix.numRows || 64;
  const stepCount = Math.max(64, patternLen);
  let rowsLayout = 4, colsLayout = 32;
  if (layout === '8x16') { rowsLayout = 8; colsLayout = 16; }
  if (layout === '2x64') { rowsLayout = 2; colsLayout = 64; }
  const computedCols = colsLayout;
  const computedRows = rowsLayout;

  // (no per-channel color helper needed here; expressive readout uses token colors)

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
      {/* compact step readout mapped to module pattern length (at least 64) */}
      <div className="mb-3 flex flex-col gap-2">
        <div className="text-xs text-gray-400">Pattern Steps ({stepCount})</div>
        {
          (() => {
            // compute layout rows/cols
            // compute layout rows/cols
            let rowsLayout = 4, colsLayout = 32;
            if (layout === '8x16') { rowsLayout = 8; colsLayout = 16; }
            if (layout === '2x64') { rowsLayout = 2; colsLayout = 64; }
            // ensure colsLayout matches stepCount when patternLen > colsLayout*rowsLayout
            const computedCols = colsLayout;
            return (
              <div className="grid gap-1 py-2 px-2 bg-black/40 rounded-lg" style={{ gridTemplateColumns: `repeat(${computedCols}, minmax(0, 1fr))` }}>
                {Array.from({ length: Math.max(stepCount, rowsLayout * colsLayout) }).map((_, i) => {
                  const rowIndex = i % patternLen;
                  const patternRows = matrix.rows || Array.from({ length: patternLen }, () => Array.from({ length: columns }, () => ({ type: 'empty', text: '' })));
                  const cells = patternRows[rowIndex] || Array.from({ length: columns }, () => ({ type: 'empty', text: '' }));
                  const hasNote = cells.some(c => c.type === 'note');
                  const hasEffect = cells.some(c => c.type === 'effect');
                  const hasInstr = cells.some(c => c.type === 'instrument');
                  const isActive = rowIndex === (currentRow % patternLen);
                  const neonColor = hasNote ? 'rgba(255,77,255,0.95)' : hasEffect ? 'rgba(50,214,255,0.95)' : hasInstr ? 'rgba(255,159,28,0.95)' : null;
                  const glowStyle = neonColor ? { boxShadow: `0 0 12px ${neonColor}, 0 0 28px ${neonColor.replace('0.95', '0.25')}` } : { boxShadow: 'none' };
                  const handleClick = () => { const baseGlobal = (globalRow ?? 0) - currentRow; const targetGlobal = baseGlobal + rowIndex; onSeek?.(targetGlobal); };
                  return (
                    <button
                      key={i}
                      onClick={handleClick}
                      title={`Step ${rowIndex + 1}`}
                      className={`w-full aspect-square rounded flex flex-col items-center justify-center text-[9px] font-mono ${isActive ? 'opacity-100' : 'opacity-80'} hover:opacity-100 transition-all duration-150`}
                      style={{ background: neonColor || 'rgba(60,60,60,0.3)', border: isActive ? `2px solid rgba(255,230,120,0.8)` : '1px solid rgba(255,255,255,0.08)', ...(neonColor ? glowStyle : {}), animation: isActive ? 'neonPulse 900ms ease-in-out infinite' : undefined }}
                    >
                      <span style={{ color: '#fff', fontWeight: isActive ? 700 : 400, fontSize: '8px', opacity: 0.7 }}>{(rowIndex + 1).toString().padStart(2, '0')}</span>
                      <div className="w-3/4 h-0.5 mt-0.5" style={{ background: neonColor ? `linear-gradient(90deg, ${neonColor}, ${neonColor.replace('0.95', '0.6')})` : 'transparent', borderRadius: 1 }} />
                    </button>
                  );
                })}
              </div>
            );
          })()
        }
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
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400">Layout</label>
            <select value={layout} onChange={(e) => setLayout(e.target.value as any)} className="text-sm bg-gray-800 text-white p-1 rounded">
              <option value="4x32">4 × 32</option>
              <option value="8x16">8 × 16</option>
              <option value="2x64">2 × 64</option>
            </select>
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

      <div className="mt-4 p-3 bg-black/30 rounded-lg">
        <div className="text-sm text-gray-300 mb-2">Expressive Readout</div>
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${computedCols}, minmax(0, 1fr))` }}>
          {(() => {
            const patternRows = matrix.rows || Array.from({ length: patternLen }, () => Array.from({ length: columns }, () => ({ type: 'empty', text: '' })));

            // hashing helper to pick a color for a string
            const colorForString = (s: string) => {
              let h = 0;
              for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
              const hue = Math.abs(h) % 360;
              return `hsl(${hue} 85% 60%)`;
            };

            // render tiles equal to grid capacity (rows * cols) or the stepCount, whichever is larger
            const tiles = Math.max(stepCount, computedRows * computedCols);
            return Array.from({ length: tiles }).map((_, i) => {
              const rowIndex = i % patternLen;
              const cells = patternRows[rowIndex] || [];
              // collect unique non-empty token texts (notes/instruments/effects)
              const tokens = Array.from(new Set(cells.map(c => (c.text || '').trim()).filter(t => t && t !== '.' && t !== '-'))).slice(0, 8);
              const isActive = (rowIndex === (currentRow % patternLen));

              return (
                <div key={i} className={`flex flex-col items-center justify-start p-1 rounded ${isActive ? 'ring-2 ring-yellow-300' : ''}`}>
                  <div className="flex gap-1 items-center justify-center" style={{ minHeight: 12 }}>
                    {tokens.length === 0 ? (
                      <div className="w-3 h-3 rounded bg-black/40 border border-white/10" />
                    ) : tokens.map((t, idx) => (
                      <div key={idx} title={t} className="w-3 h-3 rounded-full" style={{ background: colorForString(t), boxShadow: `0 0 6px ${colorForString(t)}66` }} />
                    ))}
                  </div>
                  <div className="text-[9px] text-gray-300 mt-1">{(rowIndex + 1).toString().padStart(2, '0')}</div>
                </div>
              );
            });
          })()}
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
