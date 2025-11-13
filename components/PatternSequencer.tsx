import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { PatternMatrix } from '../types';

interface PatternSequencerProps {
  matrix: PatternMatrix | null;
  currentRow: number;
}

export const PatternSequencer: React.FC<PatternSequencerProps> = ({ matrix, currentRow }) => {
  const [cellSize, setCellSize] = useState<number>(14); // px
  const [visibleRows, setVisibleRows] = useState<number>(16);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playheadRef = useRef<HTMLDivElement | null>(null);
  const scrollAnimRef = useRef<number | null>(null);

  // derive display matrix slice
  const display = useMemo(() => {
    if (!matrix) return { rows: [], numChannels: 0, numRows: 0, order: 0 };
    const { rows, numChannels, numRows, order } = matrix;
    // center currentRow in visibleRows
    let start = Math.max(0, currentRow - Math.floor(visibleRows / 2));
    if (start + visibleRows > numRows) start = Math.max(0, numRows - visibleRows);
    const slice = rows.slice(start, start + visibleRows);
    return { rows: slice, numChannels, numRows, order, start };
  }, [matrix, currentRow, visibleRows]);

  // when currentRow changes, smoothly center the playhead
  useEffect(() => {
    if (!containerRef.current) return;

    // compute positions
    const gap = 2; // same as grid gap
    const headerOffset = cellSize + gap; // header row height
    const start = display.start ?? 0;
    const idx = currentRow - start;

    if (idx < 0 || !Number.isFinite(idx) || idx >= (display.rows?.length ?? 0)) {
      // current row is outside the displayed slice; still try to smooth-scroll so row moves into view
      // targetScroll = (currentRow - Math.floor(visibleRows/2))*(cellSize+gap)
      const idealStart = Math.max(0, currentRow - Math.floor(visibleRows / 2));
      const targetScroll = Math.max(0, idealStart * (cellSize + gap));
      smoothScrollTo(containerRef.current, targetScroll, 300);
      // hide playhead if outside
      if (playheadRef.current) playheadRef.current.style.opacity = '0';
      return;
    }

    // visible index within sliced rows
    const targetTop = headerOffset + idx * (cellSize + gap);

    // move playhead via CSS transform for smoothness
    if (playheadRef.current) {
      playheadRef.current.style.transform = `translateY(${targetTop}px)`;
      playheadRef.current.style.opacity = '1';
    }

    // smooth-center the container so the playhead stays roughly centered
    const container = containerRef.current;
    const centerOffset = Math.max(0, Math.floor(visibleRows / 2) * (cellSize + gap));
    // Try to center on the current row
    const playPosInContainer = targetTop - centerOffset;
    const targetScroll = Math.max(0, playPosInContainer);

    smoothScrollTo(container, targetScroll, 300);

    return () => {
      if (scrollAnimRef.current) {
        cancelAnimationFrame(scrollAnimRef.current);
        scrollAnimRef.current = null;
      }
    };
  }, [currentRow, cellSize, visibleRows, display.start, display.rows]);

  // helper: smooth scroll a container to a target position
  const smoothScrollTo = (container: HTMLElement, target: number, duration = 300) => {
    if (!container) return;
    if (scrollAnimRef.current) cancelAnimationFrame(scrollAnimRef.current);
    const start = container.scrollTop;
    const change = target - start;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      // easeInOutQuad
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      container.scrollTop = start + change * eased;
      if (t < 1) {
        scrollAnimRef.current = requestAnimationFrame(animate);
      } else {
        scrollAnimRef.current = null;
      }
    };
    scrollAnimRef.current = requestAnimationFrame(animate);
  };

  if (!matrix) {
    return (
      <section className="bg-gray-900 p-3 rounded-lg mb-4 text-sm text-gray-400">No pattern data available.</section>
    );
  }

  const columns = matrix.numChannels;

  // helper to map cell type to color
  const colorFor = (type: string, ci: number) => {
    const hue = Math.floor((ci / Math.max(1, columns)) * 360);
    switch (type) {
      case 'note':
        return `hsl(${(hue + 320) % 360}deg 85% 55%)`; // pink/magenta range
      case 'effect':
        return `hsl(${(hue + 180) % 360}deg 80% 55%)`; // cyan/teal range
      case 'instrument':
        return `hsl(${(hue + 30) % 360}deg 90% 50%)`; // orange/yellow range
      default:
        return 'transparent';
    }
  };

  return (
    <section className="bg-black p-3 rounded-lg shadow-inner mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-gray-300">Pattern Sequencer — Order {matrix.order} • Rows {matrix.numRows} • Ch {columns}</div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-400">Rows</label>
          <select value={visibleRows} onChange={(e) => setVisibleRows(Number(e.target.value))} className="text-sm bg-gray-800 text-white p-1 rounded">
            <option value={8}>8</option>
            <option value={16}>16</option>
            <option value={32}>32</option>
            <option value={64}>64</option>
            <option value={matrix.numRows}>Full</option>
          </select>
          <label className="text-xs text-gray-400">Size</label>
          <input type="range" min={8} max={28} value={cellSize} onChange={(e) => setCellSize(Number(e.target.value))} />
        </div>
      </div>

      <div className="flex gap-3 items-center mb-2">
        <div className="flex items-center gap-2 text-xs text-gray-300">
          <span className="inline-block w-3 h-3 rounded" style={{ background: 'linear-gradient(90deg,#ff4dff,#ff66cc)' }} /> <span>Note</span>
          <span className="inline-block w-3 h-3 rounded ml-2" style={{ background: 'linear-gradient(90deg,#32d6ff,#2ad6c6)' }} /> <span>Effect</span>
          <span className="inline-block w-3 h-3 rounded ml-2" style={{ background: 'linear-gradient(90deg,#ff9f1c,#ffd27a)' }} /> <span>Instrument</span>
        </div>
      </div>

      <div ref={containerRef} style={{ maxHeight: visibleRows * (cellSize + 4) + 24, overflow: 'auto', position: 'relative' }}>
        {/* playhead overlay */}
        <div ref={playheadRef} style={{ position: 'absolute', left: 0, right: 0, height: cellSize + 2, pointerEvents: 'none', transform: 'translateY(0px)', transition: 'transform 220ms cubic-bezier(.22,.9,.3,1), opacity 180ms ease-out', opacity: 0 }}>
          <div style={{ height: '100%', width: '100%', background: 'linear-gradient(90deg, rgba(255,255,0,0.06), rgba(255,255,0,0.02))', borderRadius: 6 }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns + 1}, ${cellSize}px)`, gap: 2 }}>
          {/* header first blank cell */}
          <div style={{ width: cellSize, height: cellSize }} />
          {Array.from({ length: columns }).map((_, ci) => (
            <div key={ci} className="text-center text-xs text-gray-400" style={{ width: cellSize }}>{`C${ci + 1}`}</div>
          ))}

          {display.rows.map((row, ri) => {
            const globalRow = (display.start ?? 0) + ri;
            const isPlay = globalRow === currentRow;
            return (
              <React.Fragment key={ri}>
                <div style={{ width: cellSize, height: cellSize, display: 'flex', alignItems: 'center', justifyContent: 'center' }} className={`text-xs ${isPlay ? 'text-yellow-300 font-bold' : 'text-gray-400'}`}>{String(globalRow).padStart(2, '0')}</div>
                {row.map((cell, ci) => {
                  const bg = colorFor(cell.type, ci);
                  const boxShadow = cell.type !== 'empty' ? `0 0 8px ${bg}66` : 'none';
                  const border = cell.type === 'empty' ? '1px solid rgba(255,255,255,0.03)' : 'none';
                  const opacity = isPlay ? 1 : 0.9;
                  return (
                    <div key={ci} title={`ch ${ci + 1} r ${globalRow} — ${cell.text || 'empty'}`} style={{ width: cellSize, height: cellSize, background: bg, border, boxShadow, borderRadius: 4, opacity }} />
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </section>
  );
};
