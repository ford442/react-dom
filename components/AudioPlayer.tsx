import React, { useCallback, useEffect, useRef, useState } from 'react';

// A compact, dependency-free audio player with a styled progress bar, waveform canvas placeholder,
// keyboard shortcuts and accessible attributes. Uses Tailwind classes to fit the repo styling.

export default function AudioPlayer({ src, onTimeUpdate }: { src?: string, onTimeUpdate?: (t:number) => void }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sliderRef = useRef<HTMLDivElement | null>(null);
  const waveRef = useRef<HTMLCanvasElement | null>(null);

  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffer, setBuffer] = useState(0);
  const [volume, setVolume] = useState(0.9);
  const [dragging, setDragging] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    if (!audioRef.current) return;
    const a = audioRef.current;
    const onLoaded = () => setDuration(a.duration || 0);
    const onTime = () => {
      const t = a.currentTime || 0;
      setTime(t);
      try { onTimeUpdate?.(t); } catch (e) { /* ignore callback errors */ }
    };
    const onProgress = () => {
      try {
        if (!a.buffered.length) return setBuffer(0);
        const end = a.buffered.end(a.buffered.length - 1);
        setBuffer(((end) / (a.duration || 1)) * 100);
      } catch {
        setBuffer(0);
      }
    };
    a.addEventListener('loadedmetadata', onLoaded);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('progress', onProgress);
    return () => {
      a.removeEventListener('loadedmetadata', onLoaded);
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('progress', onProgress);
    };
  }, [src, onTimeUpdate]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    // draw a simple placeholder waveform once
    const c = waveRef.current;
    if (!c) return;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const w = Math.max(2, Math.floor(c.clientWidth * dpr));
    const h = Math.max(2, Math.floor(c.clientHeight * dpr));
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    const bars = 64;
    const barW = w / bars;
    ctx.fillStyle = theme === 'dark' ? 'rgba(124,92,255,0.12)' : 'rgba(108,99,255,0.12)';
    for (let i = 0; i < bars; i++) {
      const noise = 0.2 + Math.abs(Math.sin((i / bars) * Math.PI * 2)) * 0.8;
      const bh = noise * h * 0.9;
      ctx.fillRect(i * barW + barW * 0.15, (h - bh) / 2, barW * 0.7, bh);
    }
  }, [theme]);

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play(); setPlaying(true); }
  }, [playing]);

  const fmt = (t: number) => {
    if (!isFinite(t) || t <= 0) return '0:00';
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const seekTo = (clientX: number) => {
    const s = sliderRef.current;
    const a = audioRef.current;
    if (!s || !a || duration === 0) return;
    const rect = s.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    a.currentTime = p * duration;
    setTime(a.currentTime);
    try { onTimeUpdate?.(a.currentTime || 0); } catch (e) { /* ignore */ }
  };

  const onPointerDown: React.PointerEventHandler = (e) => {
    setDragging(true);
    (e.target as Element).setPointerCapture?.(e.pointerId);
    seekTo(e.clientX);
  };
  const onPointerMove: React.PointerEventHandler = (e) => {
    if (!dragging) return;
    seekTo(e.clientX);
  };
  const onPointerUp: React.PointerEventHandler = (e) => {
    setDragging(false);
  };

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const tag = (ev.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || (ev.target as HTMLElement)?.isContentEditable) return;
      if (ev.code === 'Space') { ev.preventDefault(); toggle(); }
      if (ev.code === 'ArrowRight') { if (audioRef.current) audioRef.current.currentTime = Math.min(duration, (audioRef.current.currentTime || 0) + 5); }
      if (ev.code === 'ArrowLeft') { if (audioRef.current) audioRef.current.currentTime = Math.max(0, (audioRef.current.currentTime || 0) - 5); }
      if (ev.code === 'ArrowUp') { setVolume(v => Math.min(1, +(v + 0.05).toFixed(2))); }
      if (ev.code === 'ArrowDown') { setVolume(v => Math.max(0, +(v - 0.05).toFixed(2))); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle, duration]);

  const progressPercent = duration ? (time / duration) * 100 : 0;

  return (
    <div className={`w-full max-w-3xl mx-auto p-4 rounded-lg shadow-md ${theme === 'dark' ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-800'}`} role="region" aria-label="Audio player">
      <div className="mb-3">
        <canvas ref={waveRef} className="w-full h-16 rounded-md bg-gradient-to-r from-transparent to-transparent" aria-hidden />
      </div>

      <div className="flex items-center gap-3">
        <button aria-label={playing ? 'Pause' : 'Play'} onClick={toggle} className="w-11 h-11 rounded-lg bg-gradient-to-b from-white/3 to-transparent flex items-center justify-center shadow hover:translate-y-[-2px] transition-transform">
          {playing ? (
            <svg width="18" height="18" viewBox="0 0 24 24" className="text-current fill-current"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" className="text-current fill-current"><path d="M5 3v18l15-9L5 3z" /></svg>
          )}
        </button>

        <div className="flex items-center gap-2 flex-1">
          <div className="text-sm text-gray-400 w-14 text-center">{fmt(time)}</div>
          <div ref={sliderRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
               role="slider" aria-label="Seek" aria-valuemin={0} aria-valuemax={duration} aria-valuenow={time}
               className="relative h-3 flex-1 rounded-full bg-black/10 cursor-pointer">
            <div className="absolute left-0 top-0 bottom-0 bg-black/5 rounded-full" style={{ width: `${buffer}%` }} />
            <div className="absolute left-0 top-0 bottom-0 rounded-full" style={{ width: `${progressPercent}%`, background: 'linear-gradient(90deg,#7C5CFF,#6C63FFCC)' }} />
            <div className="absolute top-1/2 transform -translate-y-1/2 bg-white rounded-full" style={{ left: `${progressPercent}%`, width: 12, height: 12, translate: '-50% 0', border: '2px solid rgba(124,92,255,0.95)' }} />
          </div>
          <div className="text-sm text-gray-400 w-14 text-center">{fmt(duration)}</div>
        </div>

        <div className="flex items-center gap-2 ml-2">
          <button onClick={() => { if (audioRef.current) audioRef.current.currentTime = Math.max(0, (audioRef.current.currentTime || 0) - 10); }} aria-label="Skip back 10s" className="text-gray-400 hover:text-gray-100">
            <svg width="18" height="18" viewBox="0 0 24 24" className="fill-current"><path d="M18 5V19L7 12l11-7zM4 5v14h2V5H4z" /></svg>
          </button>
          <button onClick={() => { if (audioRef.current) audioRef.current.currentTime = Math.min(duration, (audioRef.current.currentTime || 0) + 10); }} aria-label="Skip forward 10s" className="text-gray-400 hover:text-gray-100">
            <svg width="18" height="18" viewBox="0 0 24 24" className="fill-current"><path d="M6 5v14l11-7L6 5zM18 5v14h2V5h-2z" /></svg>
          </button>

          <input aria-label="Volume" type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="w-24" />

          <button onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme" className="ml-2 text-gray-400 hover:text-gray-100">
            <svg width="16" height="16" viewBox="0 0 24 24" className="fill-current"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" /></svg>
          </button>
        </div>
      </div>

      <audio ref={audioRef} src={src} preload="metadata" />
    </div>
  );
}
