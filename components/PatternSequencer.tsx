import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { PatternMatrix } from '../types';

interface PatternSequencerProps {
  matrix: PatternMatrix | null;
  currentRow: number; // This is now the "current step"
  totalRows?: number; // Total steps in the whole song
  onSeek?: (stepIndex: number) => void;
  bpm?: number;
  playbackSeconds?: number;
  playbackRowFraction?: number; // This is now the "fractional step"
  rowsPerBeat?: number;
}

interface NoteDuration {
  channel: number;
  startStep: number; // Renamed from startRow
  endStep: number; // Renamed from endRow
  note: string;
}

const CELL_HEIGHT = 16;
const CELL_WIDTH = 28;
const VISIBLE_STEPS = 32; // How many time steps to show at once

const noteToHue = (note: string): number => {
  const map: Record<string, number> = { C: 0, 'C#': 30, D: 60, 'D#': 90, E: 120, F: 150, 'F#': 180, G: 210, 'G#': 240, A: 270, 'A#': 300, B: 330 };
  const match = note.match(/^([A-G]#?)/i);
  return match ? map[match[1].toUpperCase()] ?? 200 : 200;
};

export const PatternSequencer: React.FC<PatternSequencerProps> = ({
                                                                    matrix,
                                                                    currentRow: currentStep,
                                                                    totalRows: _totalRows = 0,
                                                                    onSeek,
                                                                    bpm = 120,
                                                                    playbackSeconds = 0,
                                                                    playbackRowFraction: fractionalStep,
                                                                    rowsPerBeat = 4,
                                                                  }) => {
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const playheadXRef = useRef<number>(0);
  const alphaMapRef = useRef<Map<string, number>>(new Map());
  const lastTimeRef = useRef<number | null>(null);
  const [hoverTip, setHoverTip] = useState<{ x: number; y: number; text: string } | null>(null);

  // durations by channel
  const durationsByChannel = useMemo(() => {
    const map = new Map<number, NoteDuration[]>();
    if (!matrix) return map;
    const { rows, numChannels, numRows: numSteps } = matrix; // numRows is now numSteps
    for (let ch = 0; ch < numChannels; ch++) {
      let active: NoteDuration | null = null;
      const channelDurations: NoteDuration[] = [];
      for (let step = 0; step < numSteps; step++) {
        const cell = rows[step]?.[ch];
        if (!cell) continue;
        const raw = (cell.text || '').trim();
        const isNote = cell.type === 'note' && raw && raw !== '===' && raw !== '---';

        if (isNote) {
          if (!active || active.note !== raw) {
            active = { channel: ch, startStep: step, endStep: step, note: raw };
            channelDurations.push(active);
          } else {
            active.endStep = step;
          }
        } else if (raw === '===' || raw === '---') { // Note-off or cut
          active = null;
        }
      }
      map.set(ch, channelDurations);
    }
    return map;
  }, [matrix]);

  const display = useMemo(() => {
    if (!matrix) return { steps: [], numChannels: 0, start: 0, numSteps: 0 };
    const { rows, numChannels, numRows: numSteps } = matrix;
    let start = Math.max(0, currentStep - Math.floor(VISIBLE_STEPS / 3)); // Keep playhead 1/3 from left
    if (start + VISIBLE_STEPS > numSteps) start = Math.max(0, numSteps - VISIBLE_STEPS);

    return {
      steps: rows.slice(start, start + VISIBLE_STEPS), // 'steps' is a slice of the original 'rows' (time)
      numChannels,
      start, // The starting step index
      numSteps // Total steps in this pattern
    };
  }, [matrix, currentStep]);

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
      const rect = canvas.getBoundingClientRect();
      const cssWidthRaw = rect.width || canvas.clientWidth || 1;
      const cssHeightRaw = rect.height || canvas.clientHeight || 1;
      const MAX_CSS = 8000;
      const w = Math.max(1, Math.min(cssWidthRaw, MAX_CSS));
      const h = Math.max(1, Math.min(cssHeightRaw, MAX_CSS));
      const pixelW = Math.max(1, Math.floor(w * dpr));
      const pixelH = Math.max(1, Math.floor(h * dpr));

      if (canvas.width !== pixelW || canvas.height !== pixelH) {
        canvas.width = pixelW;
        canvas.height = pixelH;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const rows = matrix.numChannels; // Channels are now rows
      const visibleStart = display.start;
      const visibleLen = display.steps.length || VISIBLE_STEPS;
      const cellW = visibleLen > 0 ? w / visibleLen : CELL_WIDTH;
      const cellH = rows > 0 ? h / rows : CELL_HEIGHT;

      const activeKeys = new Set<string>();
      for (const [ch, entries] of durationsByChannel.entries()) {
        for (const d of entries) {
          if (d.endStep < visibleStart || d.startStep >= visibleStart + visibleLen) continue;

          const key = `${ch}-${d.startStep}`;
          activeKeys.add(key);
          const target = currentStep >= d.startStep && currentStep <= d.endStep ? 0.7 : 0.3;
          const current = alphaMap.get(key) ?? 0;
          const alpha = current + (target - current) * alphaBlend;
          alphaMap.set(key, alpha);

          const y = ch * cellH;
          const x0 = (d.startStep - visibleStart) * cellW;
          const x1 = (Math.min(d.endStep, visibleStart + visibleLen - 1) - visibleStart + 1) * cellW;
          const radius = Math.min(6, cellH / 4, (x1 - x0) / 2);

          ctx.beginPath();
          ctx.moveTo(x0 + radius, y);
          ctx.lineTo(x0 + x1 - radius, y);
          ctx.quadraticCurveTo(x0 + x1, y, x0 + x1, y + radius);
          ctx.lineTo(x0 + x1, y + cellH - radius);
          ctx.quadraticCurveTo(x0 + x1, y + cellH, x0 + x1 - radius, y + cellH);
          ctx.lineTo(x0 + radius, y + cellH);
          ctx.quadraticCurveTo(x0, y + cellH, x0, y + cellH - radius);
          ctx.lineTo(x0, y + radius);
          ctx.quadraticCurveTo(x0, y, x0 + radius, y);
          ctx.closePath();

          const hue = noteToHue(d.note);
          const gradient = ctx.createLinearGradient(x0, y, x0 + x1, y + cellH);
          gradient.addColorStop(0, `hsla(${hue},92%,60%,${alpha})`);
          gradient.addColorStop(1, `hsla(${(hue + 30) % 360},78%,48%,${Math.max(0.06, alpha * 0.9)})`);
          ctx.fillStyle = gradient;
          ctx.fill();
        }
      }

      // Fade out old notes
      for (const key of Array.from(alphaMap.keys())) {
        if (!activeKeys.has(key)) {
          const current = alphaMap.get(key) ?? 0;
          const alpha = current + (0 - current) * 0.12;
          if (alpha <= 0.01) alphaMap.delete(key);
          else alphaMap.set(key, alpha);
        }
      }

      // Draw Playhead
      const rowsPerSecond = (bpm / 60) * rowsPerBeat;
      const fallbackStep = rowsPerSecond > 0 ? playbackSeconds * rowsPerSecond : 0;
      const playheadStep = typeof fractionalStep === 'number' ? fractionalStep : fallbackStep;
      const totalStepsInPattern = matrix.numRows || 1; // numRows is steps
      const normalizedStep = (playheadStep % totalStepsInPattern + totalStepsInPattern) % totalStepsInPattern;

      const relative = normalizedStep - visibleStart;
      if (relative >= -1 && relative <= visibleLen + 1) {
        const targetX = (relative + 0.5) * cellW;
        const currentX = playheadXRef.current || targetX;
        const nextX = currentX + (targetX - currentX) * playheadBlend;
        playheadXRef.current = nextX;

        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 2;
        ctx.shadowColor = 'rgba(255,255,255,0.5)';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(nextX, 0);
        ctx.lineTo(nextX, h);
        ctx.stroke();
        ctx.restore();
      }

      requestAnimationFrame(draw);
    };

    requestAnimationFrame(draw);
    return () => { running = false; };
  }, [matrix, display, durationsByChannel, currentStep, bpm, rowsPerBeat, playbackSeconds, fractionalStep]);

  // Mouse hover tooltip
  useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas || !matrix) return;
    const handleMove = (ev: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;

      const rows = matrix.numChannels; // Channels are rows
      const visibleStart = display.start;
      const visibleLen = display.steps.length || VISIBLE_STEPS;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const cellW = visibleLen > 0 ? w / visibleLen : CELL_WIDTH;
      const cellH = rows > 0 ? h / rows : CELL_HEIGHT;

      const channel = Math.floor(y / cellH);
      const stepIndex = Math.floor(x / cellW) + visibleStart;

      const match = (durationsByChannel.get(channel) || []).find(d => stepIndex >= d.startStep && stepIndex <= d.endStep);
      if (match) {
        setHoverTip({ x: ev.clientX + 8, y: ev.clientY - 16, text: `${match.note} • ${match.endStep - match.startStep + 1} steps` });
      } else {
        setHoverTip(null);
      }
    };
    const handleLeave = () => setHoverTip(null);
    canvas.addEventListener('mousemove', handleMove);
    canvas.addEventListener('mouseleave', handleLeave);
    return () => {
      canvas.removeEventListener('mousemove', handleMove);
      canvas.removeEventListener('mouseleave', handleLeave);
    };
  }, [matrix, display, durationsByChannel]);

  const handleSeek = (step: number) => {
    if (!matrix) return;
    const clamped = Math.max(0, Math.min(step, matrix.numRows - 1));
    onSeek?.(clamped);
  };

  const numChannels = display.numChannels || 0;
  const gridHeight = (numChannels + 1) * CELL_HEIGHT + numChannels * 4; // +1 for header, 4px gap

  return (
      <div className="relative" style={{ minHeight: `${gridHeight}px` }}>
        <div
            className="grid gap-1"
            style={{
              gridAutoFlow: "column",
              gridTemplateRows: `repeat(${numChannels + 1}, ${CELL_HEIGHT}px)`,
              gridTemplateColumns: `60px repeat(${display.steps.length}, ${CELL_WIDTH}px)`
            }}
        >
          {/* Row Headers (Channels) */}
          <div className="sticky left-0 z-10 bg-gray-900 pr-2">
            <div className="h-full flex items-center justify-center text-xs text-gray-500 font-bold">STEP</div>
            {Array.from({ length: numChannels }).map((_, ch) => (
                <div
                    key={ch}
                    className="h-full flex items-center justify-end text-xs text-gray-400"
                    style={{ height: `${CELL_HEIGHT}px` }}
                >
                  CH {String(ch + 1).padStart(2, '0')}
                </div>
            ))}
          </div>

          {/* Grid Cells (Steps) */}
          {display.steps.map((stepCells, stepIdx) => {
            const globalStep = display.start + stepIdx;
            const isCurrentStep = globalStep === currentStep;
            return (
                <div key={globalStep} className="relative">
                  {/* Step Header */}
                  <div
                      className={`h-full flex items-center justify-center text-xs ${isCurrentStep ? 'text-yellow-300 font-semibold' : 'text-gray-500'}`}
                      style={{ height: `${CELL_HEIGHT}px` }}
                      onClick={() => handleSeek(globalStep)}
                  >
                    {String(globalStep).padStart(3, '0')}
                  </div>

                  {/* Cells for this step */}
                  {Array.from({ length: numChannels }).map((_, ch) => {
                    const cell = stepCells?.[ch];
                    const raw = (cell?.text || '').trim();
                    const isNote = cell?.type === 'note' && raw && raw !== '===' && raw !== '---';
                    return (
                        <div
                            key={ch}
                            className={`h-full flex items-center justify-center rounded-sm ${isCurrentStep ? 'bg-blue-500/10' : ''}`}
                            style={{ height: `${CELL_HEIGHT}px` }}
                            onClick={() => handleSeek(globalStep)}
                        >
                          {isNote && (
                              <div
                                  className="absolute w-full h-full rounded opacity-70"
                                  style={{
                                    background: `hsl(${noteToHue(raw)}, 92%, 60%)`,
                                    width: `${CELL_WIDTH - 2}px`,
                                    height: `${CELL_HEIGHT - 2}px`,
                                  }}
                              />
                          )}
                          <span className="relative text-[9px] font-mono text-black/80 px-1 py-0.5 rounded-sm" style={{ background: isNote ? 'rgba(255,255,255,0.85)' : 'transparent' }}>
                      {isNote ? raw : (cell?.type === 'empty' ? '·' : '')}
                    </span>
                        </div>
                    );
                  })}
                </div>
            );
          })}
        </div>

        {/* Canvas Overlay for note durations and playhead */}
        <canvas
            ref={overlayRef}
            className="absolute left-[60px] top-0 right-0 bottom-0 pointer-events-auto"
            style={{ marginTop: `${CELL_HEIGHT + 4}px` }} // Align with grid (skip header row + gap)
        />

        {/* Hover Tooltip */}
        {hoverTip && (
            <div
                className="absolute z-50 pointer-events-none bg-black/80 text-white text-xs py-1 px-2 rounded shadow-lg"
                style={{ left: hoverTip.x, top: hoverTip.y }}
            >
              {hoverTip.text}
            </div>
        )}
      </div>
  );
};