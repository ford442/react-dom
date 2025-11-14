import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { PatternMatrix } from '../types';

interface PatternSequencerProps {
  matrix: PatternMatrix | null;
  currentRow: number;
  totalRows?: number;
  onSeek?: (stepIndex: number) => void;
  bpm?: number;
  playbackSeconds?: number;
  playbackRowFraction?: number;
  rowsPerBeat?: number; // configurable approximation, default 4
}

interface NoteDuration {
  channel: number;
  startRow: number;
  endRow: number;
  note: string;
}

export const PatternSequencer: React.FC<PatternSequencerProps> = ({ matrix, currentRow, totalRows: _totalRows = 0, onSeek, bpm: _bpm = 120, playbackSeconds = 0, playbackRowFraction, rowsPerBeat = 4 }) => {
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
  // single overlay canvas for visible rows
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const barAlphaRef = useRef<Map<string, number>>(new Map());
  const playheadXRef = useRef<number>(0);
  const idleTimeoutRef = useRef<number | null>(null);
  const lastRowRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const isVisibleRef = useRef<boolean>(true);
  const [hoverTip, setHoverTip] = useState<{x:number,y:number,text:string}|null>(null);

  // Calculate note durations
  const noteDurations = useMemo(() => {
    if (!matrix) return [];
    const durations: NoteDuration[] = [];
    const { rows, numChannels, numRows } = matrix;
    for (let ch = 0; ch < numChannels; ch++) {
      let currentNote: string | null = null;
      let startRow = -1;
      for (let r = 0; r < numRows; r++) {
        const cell = rows[r][ch];
        const raw = (cell.text || '').trim();
        if (cell.type === 'note' && raw && raw !== '===' && raw !== '---') {
          if (currentNote && startRow !== -1) {
            durations.push({ channel: ch, startRow, endRow: r - 1, note: currentNote });
          }
          currentNote = raw;
          startRow = r;
        } else if (raw === '===' || raw === '---') {
          // Note-off
          if (currentNote && startRow !== -1) {
            durations.push({ channel: ch, startRow, endRow: r - 1, note: currentNote });
            currentNote = null;
            startRow = -1;
          }
        }
      }
      if (currentNote && startRow !== -1) {
        durations.push({ channel: ch, startRow, endRow: numRows - 1, note: currentNote });
      }
    }
    return durations;
  }, [matrix]);

  // Precompute durations grouped by channel to avoid per-frame filtering
  const durationsByChannel = useMemo(() => {
    const map = new Map<number, NoteDuration[]>();
    for (const d of noteDurations as NoteDuration[]) {
      const arr = map.get(d.channel) || [];
      arr.push(d);
      map.set(d.channel, arr);
    }
    return map;
  }, [noteDurations]);

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

  // Animated draw loop for note duration bars (smooth opacity interpolation, rounded bars, playhead)
  useEffect(() => {
    let running = true;
    let raf = 0;
    const alphaMap = barAlphaRef.current;

    // Resize handling
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { /* trigger redraw on resize via rAF */ }) : null;
    let overlay = overlayCanvasRef.current;
    if (overlay && ro) ro.observe(overlay);

    // Visibility handling: pause when not visible
    const io = typeof IntersectionObserver !== 'undefined' && overlay ? new IntersectionObserver((entries) => {
      for (const e of entries) { isVisibleRef.current = e.isIntersecting; }
    }, { threshold: 0.05 }) : null;
    if (overlay && io) io.observe(overlay);

    const step = (time?: number) => {
      if (!running) return;
      if (typeof document !== 'undefined' && (document.hidden || !isVisibleRef.current)) { raf = requestAnimationFrame(step); return; }

      const now = typeof time === 'number' ? time : (performance.now ? performance.now() : Date.now());
      const last = lastTimeRef.current ?? now - 16;
      const dt = Math.max(1, Math.min(1000, now - last));
      lastTimeRef.current = now;

      // compute frame-independent smoothing factors
      const alphaSmoothing = 1 - Math.exp(-dt / 80); // faster smoothing for alphas
      const playheadSmoothing = 1 - Math.exp(-dt / 120);

      // draw duration bars per channel, clipped to visible rows
      const activeKeys = new Set<string>();
      for (const [ch, durations] of durationsByChannel.entries()) {
        for (let i = 0; i < durations.length; i++) {
          const d = durations[i];
          // skip if not overlapping with visible slice
          if (d.endRow < display.start || d.startRow >= display.start + display.rows.length) continue;
          const key = `${ch}-${d.startRow}`;
          activeKeys.add(key);
          const target = (currentRow >= d.startRow && currentRow <= d.endRow) ? 0.65 : 0.28;
          const cur = alphaMap.get(key) ?? 0;
          const next = cur + (target - cur) * alphaSmoothing;
          alphaMap.set(key, next);

          const x = ch * cellSize;
          const y0 = Math.max(0, d.startRow - display.start) * cellSize;
          const y1 = Math.min(d.endRow, display.start + display.rows.length - 1) - display.start + 1;
          const heightPx = Math.max(cellSize, y1 * cellSize);

          const radius = Math.min(6, cellSize / 4, heightPx / 2);
          ctx.beginPath();
          ctx.moveTo(x + radius, y0);
          ctx.lineTo(x + cellSize - radius, y0);
          ctx.quadraticCurveTo(x + cellSize, y0, x + cellSize, y0 + radius);
          ctx.lineTo(x + cellSize, y0 + heightPx - radius);
          ctx.quadraticCurveTo(x + cellSize, y0 + heightPx, x + cellSize - radius, y0 + heightPx);
          ctx.lineTo(x + radius, y0 + heightPx);
          ctx.quadraticCurveTo(x, y0 + heightPx, x, y0 + heightPx - radius);
          ctx.lineTo(x, y0 + radius);
          ctx.quadraticCurveTo(x, y0, x + radius, y0);
          ctx.closePath();

          const hue = noteToHue(d.note);
          const grad = ctx.createLinearGradient(x, y0, x + cellSize, y0 + heightPx);
          grad.addColorStop(0, `hsla(${hue},92%,60%,${next})`);
          grad.addColorStop(1, `hsla(${(hue+30)%360},78%,48%,${Math.max(0.06, next*0.9)})`);
          ctx.fillStyle = grad;
          if (next > 0.5) {
            ctx.save();
            ctx.shadowBlur = Math.min(16, Math.max(4, Math.min(cellSize, heightPx) * 0.06));
            ctx.shadowColor = `hsla(${hue},90%,60%,${Math.min(0.6, next*0.9)})`;
            ctx.fill();
            ctx.restore();
          } else {
            ctx.fill();
          }
        }
      }

      // fade out and cleanup removed keys (draw small faded markers)
      for (const key of Array.from(alphaMap.keys())) {
        if (!activeKeys.has(key)) {
          const cur = alphaMap.get(key) ?? 0;
          const next = cur + (0 - cur) * 0.12;
          if (next <= 0.01) {
            alphaMap.delete(key);
          } else {
            alphaMap.set(key, next);
            const parts = key.split('-');
            const ch = Number(parts[0]);
            const start = Number(parts[1]);
            if (start >= display.start && start < display.start + display.rows.length) {
              const x = ch * cellSize;
              const y0 = (start - display.start) * cellSize;
              ctx.fillStyle = `hsla(200,30%,50%,${next*0.12})`;
              ctx.fillRect(x + cellSize*0.2, y0 + cellSize*0.2, cellSize*0.6, Math.max(1, cellSize*0.6));
            }
          }
        }
      }

      // compute playhead row from playbackTimeSeconds and bpm (approximate)
      const bpm = _bpm || 120;
      const rowsPerSecond = (bpm / 60) * rowsPerBeat; // approximate conversion
      const fallbackRow = rowsPerSecond > 0 ? playbackSeconds * rowsPerSecond : 0;
      const playheadRowFloat = typeof playbackRowFraction === 'number' ? playbackRowFraction : fallbackRow;
      // clamp/wrap into module rows
      const totalRowsInModule = matrix?.numRows ?? 1;
      const normalizedRow = totalRowsInModule > 0 ? (playheadRowFloat % totalRowsInModule + totalRowsInModule) % totalRowsInModule : 0;
      // render smooth playhead line at fractional row position relative to visible start
      const rel = normalizedRow - display.start;
      if (rel >= -1 && rel < display.rows.length + 1) {
        const targetY = (rel + 0.5) * cellSize;
        const curY = playheadXRef.current ?? targetY;
        const nextY = curY + (targetY - curY) * playheadSmoothing;
        playheadXRef.current = nextY;
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.92)';
        ctx.lineWidth = Math.max(1, Math.min(2, h * 0.0015));
        ctx.beginPath();
        ctx.moveTo(0, nextY);
        ctx.lineTo(w, nextY);
        ctx.stroke();
        ctx.restore();
      }

      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      lastTimeRef.current = null;
      if (idleTimeoutRef.current) { clearTimeout(idleTimeoutRef.current); idleTimeoutRef.current = null; }
      if (ro) ro.disconnect();
      if (io) io.disconnect();
    };
  }, [noteDurations, matrix, currentRow, noteToHue, durationsByChannel, _bpm, playbackSeconds, rowsPerBeat]);

  // mouse handlers for tooltip
  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const onMove = (ev: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;
      const cols = matrix?.numChannels ?? 0;
      const visibleStart = display.start ?? 0;
      const visibleLen = display.rows?.length ?? 0;
      const w = Math.max(1, canvas.clientWidth);
      const h = Math.max(1, canvas.clientHeight);
      const cellW = cols > 0 ? w / cols : w;
      const cellH = visibleLen > 0 ? h / visibleLen : cellSize;
      const ch = Math.floor(x / cellW);
      const rowIdx = Math.floor(y / cellH) + visibleStart;
      const durations = durationsByChannel.get(ch) || [];
      const found = durations.find(d => rowIdx >= d.startRow && rowIdx <= d.endRow);
      if (found) {
        setHoverTip({ x: ev.clientX + 8, y: ev.clientY + 8, text: `${found.note} • ${found.endRow - found.startRow + 1} rows` });
      } else {
        setHoverTip(null);
      }
    };
    const onLeave = () => setHoverTip(null);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseleave', onLeave);
    return () => {
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mouseleave', onLeave);
    };
  }, [durationsByChannel, matrix, display, cellSize]);

  const handleSeek = (stepIndex: number) => {
    if (!matrix) return;
    const { numRows } = matrix;
    const clampedIndex = Math.max(0, Math.min(stepIndex, numRows - 1));
    if (clampedIndex !== currentRow) {
      onSeek?.(clampedIndex);
    }
  };

  // Render
  const { rows, numChannels, numRows, order, start } = display;
  const totalSteps = Math.ceil((totalRows || 0) / visibleRows) * visibleRows;

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden"
      style={{ paddingTop: `${cellSize}px`, paddingBottom: `${cellSize}px` }}
    >
      <div
        ref={playheadRef}
        className="absolute left-0 top-0 w-full pointer-events-none"
        style={{ height: `${cellSize}px`, transform: 'translateY(0)', opacity: 0 }}
      >
        <div className="w-full h-[2px] bg-white/80" />
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(40px,1fr))] gap-0.5">
        {Array.from({ length: numChannels }).map((_, ch) => (
          <div key={ch} className="relative">
            {rows.map((row, r) => {
              const cell = row[ch];
              const raw = (cell.text || '').trim();
              const isNote = cell.type === 'note' && raw && raw !== '===' && raw !== '---';
              const isRest = raw === '---';
              const isSelected = currentRow === r + start;
              const isActive = isSelected || (isNote && currentRow > r + start);
              const isOff = !isNote && !isSelected && !isActive;

              return (
                <div
                  key={r}
                  className={`
                    h-[${cellSize}px] flex items-center justify-center
                    ${isSelected ? 'bg-blue-500/20' : ''}
                    ${isActive ? 'bg-green-500/20' : ''}
                    ${isOff ? 'opacity-50' : ''}
                  `}
                  style={{ pointerEvents: isOff ? 'none' : 'auto' }}
                  onClick={() => {
                    if (isNote) {
                      // TODO: Edit note
                    } else {
                      handleSeek(r + start);
                    }
                  }}
                >
                  {isNote && (
                    <div
                      className="absolute inset-0 rounded"
                      style={{
                        background: `conic-gradient(
                          ${noteToHue(raw)}, 0deg, 90deg, transparent 90deg, transparent 180deg, ${noteToHue(raw)} 180deg, ${noteToHue(raw)} 270deg, transparent 270deg, transparent 360deg
                        )`,
                        opacity: 0.7,
                      }}
                    />
                  )}
                  <div className="pointer-events-none">
                    {isNote ? raw : isRest ? '—' : ''}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {/* overlay canvas sits above the grid for drawing duration bars and playhead */}
      <canvas ref={overlayCanvasRef} className="absolute inset-0 pointer-events-auto" />
      {totalRows > visibleRows && (
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute left-0 top-0 w-full h-full"
            style={{
              background:
                'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.8) 100%)',
            }}
          />
          <div
            className="absolute right-0 top-0 w-2 h-full"
            style={{
              background:
                'linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,0.8) 100%)',
            }}
          />
        </div>
      )}
      {hoverTip && (
        <div
          className="absolute pointer-events-none rounded bg-black/80 text-white text-xs py-1 px-2"
          style={{ left: hoverTip.x, top: hoverTip.y, transform: 'translate(-50%, -100%)' }}
        >
          {hoverTip.text}
        </div>
      )}
    </div>
  );
};
