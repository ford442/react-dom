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
  rowsPerBeat?: number;
}

interface NoteDuration {
  channel: number;
  startRow: number;
  endRow: number;
  note: string;
}

const CELL_SIZE = 14;
const VISIBLE_ROWS = 16;

const noteToHue = (note: string): number => {
  const map: Record<string, number> = { C: 0, 'C#': 30, D: 60, 'D#': 90, E: 120, F: 150, 'F#': 180, G: 210, 'G#': 240, A: 270, 'A#': 300, B: 330 };
  const match = note.match(/^([A-G]#?)/i);
  return match ? map[match[1].toUpperCase()] ?? 200 : 200;
};

export const PatternSequencer: React.FC<PatternSequencerProps> = ({
  matrix,
  currentRow,
  totalRows: _totalRows = 0,
  onSeek,
  bpm = 120,
  playbackSeconds = 0,
  playbackRowFraction,
  rowsPerBeat = 4,
}) => {
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const playheadYRef = useRef<number>(0);
  const alphaMapRef = useRef<Map<string, number>>(new Map());
  const lastTimeRef = useRef<number | null>(null);
  const [hoverTip, setHoverTip] = useState<{ x: number; y: number; text: string } | null>(null);

  // durations by channel
  const durationsByChannel = useMemo(() => {
    const map = new Map<number, NoteDuration[]>();
    if (!matrix) return map;
    const { rows, numChannels, numRows } = matrix;
    for (let ch = 0; ch < numChannels; ch++) {
      let active: NoteDuration | null = null;
      const channelRows: NoteDuration[] = [];
      for (let r = 0; r < numRows; r++) {
        const raw = (rows[r][ch].text || '').trim();
        const isNote = rows[r][ch].type === 'note' && raw && raw !== '===' && raw !== '---';
        if (isNote) {
          if (!active || active.note !== raw) {
            active = { channel: ch, startRow: r, endRow: r, note: raw };
            channelRows.push(active);
          } else {
            active.endRow = r;
          }
        } else if (raw === '===' || raw === '---') {
          active = null;
        }
      }
      map.set(ch, channelRows);
    }
    return map;
  }, [matrix]);

  const display = useMemo(() => {
    if (!matrix) return { rows: [], numChannels: 0, start: 0, numRows: 0 };
    const { rows, numChannels, numRows } = matrix;
    let start = Math.max(0, currentRow - Math.floor(VISIBLE_ROWS / 2));
    if (start + VISIBLE_ROWS > numRows) start = Math.max(0, numRows - VISIBLE_ROWS);
    return { rows: rows.slice(start, start + VISIBLE_ROWS), numChannels, start, numRows };
  }, [matrix, currentRow]);

  useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas || !matrix) return;

    let running = true;
    const alphaMap = alphaMapRef.current;

    const draw = (time: number) => {
      if (!running) return;
      const now = typeof time === 'number' ? time : performance.now();
      const last = lastTimeRef.current ?? now - 16;
      const dt = Math.max(1, Math.min(1000, now - last));
      lastTimeRef.current = now;

      const alphaBlend = 1 - Math.exp(-dt / 80);
      const playheadBlend = 1 - Math.exp(-dt / 120);

      const ctx = canvas.getContext('2d');
      if (!ctx) { requestAnimationFrame(draw); return; }
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, canvas.clientWidth);
      const h = Math.max(1, canvas.clientHeight);
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const cols = matrix.numChannels;
      const visibleStart = display.start;
      const visibleLen = display.rows.length || VISIBLE_ROWS;
      const cellW = cols > 0 ? w / cols : w;
      const cellH = visibleLen > 0 ? h / visibleLen : CELL_SIZE;

      const activeKeys = new Set<string>();
      for (const [ch, entries] of durationsByChannel.entries()) {
        for (const d of entries) {
          if (d.endRow < visibleStart || d.startRow >= visibleStart + visibleLen) continue;
          const key = `${ch}-${d.startRow}`;
          activeKeys.add(key);
          const target = currentRow >= d.startRow && currentRow <= d.endRow ? 0.7 : 0.3;
          const current = alphaMap.get(key) ?? 0;
          const alpha = current + (target - current) * alphaBlend;
          alphaMap.set(key, alpha);

          const x = ch * cellW;
          const y0 = (d.startRow - visibleStart) * cellH;
          const y1 = (Math.min(d.endRow, visibleStart + visibleLen - 1) - visibleStart + 1) * cellH;
          const radius = Math.min(6, cellW / 4, y1 / 2);

          ctx.beginPath();
          ctx.moveTo(x + radius, y0);
          ctx.lineTo(x + cellW - radius, y0);
          ctx.quadraticCurveTo(x + cellW, y0, x + cellW, y0 + radius);
          ctx.lineTo(x + cellW, y0 + y1 - radius);
          ctx.quadraticCurveTo(x + cellW, y0 + y1, x + cellW - radius, y0 + y1);
          ctx.lineTo(x + radius, y0 + y1);
          ctx.quadraticCurveTo(x, y0 + y1, x, y0 + y1 - radius);
          ctx.lineTo(x, y0 + radius);
          ctx.quadraticCurveTo(x, y0, x + radius, y0);
          ctx.closePath();

          const hue = noteToHue(d.note);
          const gradient = ctx.createLinearGradient(x, y0, x + cellW, y0 + y1);
          gradient.addColorStop(0, `hsla(${hue},92%,60%,${alpha})`);
          gradient.addColorStop(1, `hsla(${(hue + 30) % 360},78%,48%,${Math.max(0.06, alpha * 0.9)})`);
          ctx.fillStyle = gradient;
          ctx.fill();
        }
      }

      for (const key of Array.from(alphaMap.keys())) {
        if (!activeKeys.has(key)) {
          const current = alphaMap.get(key) ?? 0;
          const alpha = current + (0 - current) * 0.12;
          if (alpha <= 0.01) alphaMap.delete(key);
          else alphaMap.set(key, alpha);
        }
      }

      const rowsPerSecond = (bpm / 60) * rowsPerBeat;
      const fallbackRow = rowsPerSecond > 0 ? playbackSeconds * rowsPerSecond : 0;
      const playheadRow = typeof playbackRowFraction === 'number' ? playbackRowFraction : fallbackRow;
      const totalRowsInModule = matrix.numRows || 1;
      const normalizedRow = (playheadRow % totalRowsInModule + totalRowsInModule) % totalRowsInModule;
      const relative = normalizedRow - visibleStart;
      if (relative >= -1 && relative <= visibleLen + 1) {
        const targetY = (relative + 0.5) * cellH;
        const currentY = playheadYRef.current || targetY;
        const nextY = currentY + (targetY - currentY) * playheadBlend;
        playheadYRef.current = nextY;
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = Math.max(1, Math.min(2, h * 0.0015));
        ctx.beginPath();
        ctx.moveTo(0, nextY);
        ctx.lineTo(w, nextY);
        ctx.stroke();
        ctx.restore();
      }

      requestAnimationFrame(draw);
    };

    requestAnimationFrame(draw);
    return () => { running = false; };
  }, [matrix, display, durationsByChannel, currentRow, bpm, rowsPerBeat, playbackSeconds, playbackRowFraction]);

  useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas || !matrix) return;
    const handleMove = (ev: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;
      const cols = matrix.numChannels;
      const visibleStart = display.start;
      const visibleLen = display.rows.length || VISIBLE_ROWS;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const cellW = cols > 0 ? w / cols : w;
      const cellH = visibleLen > 0 ? h / visibleLen : CELL_SIZE;
      const channel = Math.floor(x / cellW);
      const rowIndex = Math.floor(y / cellH) + visibleStart;
      const match = (durationsByChannel.get(channel) || []).find(d => rowIndex >= d.startRow && rowIndex <= d.endRow);
      if (match) setHoverTip({ x: ev.clientX + 8, y: ev.clientY + 8, text: `${match.note} • ${match.endRow - match.startRow + 1} rows` });
      else setHoverTip(null);
    };
    const handleLeave = () => setHoverTip(null);
    canvas.addEventListener('mousemove', handleMove);
    canvas.addEventListener('mouseleave', handleLeave);
    return () => {
      canvas.removeEventListener('mousemove', handleMove);
      canvas.removeEventListener('mouseleave', handleLeave);
    };
  }, [matrix, display, durationsByChannel]);

  const handleSeek = (row: number) => {
    if (!matrix) return;
    const clamped = Math.max(0, Math.min(row, matrix.numRows - 1));
    onSeek?.(clamped);
  };

  return (
    <div className="relative" style={{ paddingTop: CELL_SIZE, paddingBottom: CELL_SIZE }}>
      <div className="grid" style={{ gridTemplateColumns: `repeat(${display.numChannels}, minmax(0, 1fr))` }}>
        {Array.from({ length: display.numChannels }).map((_, ch) => (
          <div key={ch} className="relative">
            {display.rows.map((row, rowIdx) => {
              const cell = row[ch];
              const raw = (cell?.text || '').trim();
              const isNote = cell?.type === 'note' && raw && raw !== '===' && raw !== '---';
              const isSelected = currentRow === rowIdx + display.start;
              return (
                <div
                  key={`${rowIdx}-${ch}`}
                  className={`h-[${CELL_SIZE}px] flex items-center justify-center ${isSelected ? 'bg-blue-500/30' : ''}`}
                  onClick={() => handleSeek(rowIdx + display.start)}
                >
                  {isNote && (
                    <div className="absolute inset-0 rounded" style={{ background: `conic-gradient(hsl(${noteToHue(raw)} 92% 60%), transparent)`, opacity: 0.7 }} />
                  )}
                  <span className="pointer-events-none text-xs">{isNote ? raw : ''}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <canvas ref={overlayRef} className="absolute inset-0 pointer-events-auto" />
      {hoverTip && (
        <div className="absolute pointer-events-none bg-black/80 text-white text-xs py-1 px-2 rounded" style={{ left: hoverTip.x, top: hoverTip.y, transform: 'translate(-50%, -100%)' }}>
          {hoverTip.text}
        </div>
      )}
    </div>
  );
};
