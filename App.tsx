import React, { useCallback, useState } from 'react';
import { useLibOpenMPT } from './hooks/useLibOpenMPT';
import { Header } from './components/Header';
import { Controls } from './components/Controls';
import { InfoDisplay } from './components/InfoDisplay';
import { PatternSequencer } from './components/PatternSequencer';
import { AiInfoCard } from './components/AiInfoCard';
import { GithubIcon } from './components/icons';
import { MediaPanel } from './components/MediaPanel';
import { MediaOverlay } from './components/MediaOverlay';
import type { MediaItem } from './types';
import AudioPlayer from './components/AudioPlayer';

export default function App() {
  const {
    status,
    isReady,
    isPlaying,
    isModuleLoaded,
    moduleInfo,
    aiResponse,
    isAiLoading,
    loadModule,
    play,
    stopMusic,
    askAI,
    sequencerMatrix,
    sequencerCurrentRow,
    totalPatternRows,
    seekToStep,
    playbackSeconds,
    playbackRowFraction,
  } = useLibOpenMPT();

  const [media, setMedia] = useState<MediaItem[]>([]);
  const [activeMediaId, setActiveMediaId] = useState<string | undefined>(undefined);
  const [overlayVisible, setOverlayVisible] = useState<boolean>(false);

  const addMediaFile = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    const kind: MediaItem['kind'] = file.type === 'video/mp4' || file.type.startsWith('video/') ? 'video' : (file.type === 'image/gif' ? 'gif' : 'image');
    const item: MediaItem = {
      id: String(Date.now()),
      url,
      fileName: file.name,
      mimeType: file.type,
      kind,
      loop: kind === 'gif',
      muted: true,
      fit: 'contain',
      createdAt: Date.now(),
      isObjectUrl: true,
    };
    setMedia(prev => [item, ...prev]);
    setActiveMediaId(item.id);
    setOverlayVisible(true);
  }, []);

  const removeMedia = useCallback((id: string) => {
    setMedia(prev => {
      const found = prev.find(m => m.id === id);
      if (found && found.isObjectUrl) {
        try { URL.revokeObjectURL(found.url); } catch (e) { /* ignore */ }
      }
      return prev.filter(m => m.id !== id);
    });
    if (activeMediaId === id) {
      setActiveMediaId(undefined);
      setOverlayVisible(false);
    }
  }, [activeMediaId]);

  const activeMedia = media.find(m => m.id === activeMediaId);

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col">
      <main className="max-w-7xl mx-auto w-full flex-grow">
        <Header status={status} />

        <Controls
          isReady={isReady}
          isPlaying={isPlaying}
          isModuleLoaded={isModuleLoaded}
          onFileSelected={loadModule}
          onPlay={play}
          onStop={stopMusic}
          onMediaAdd={addMediaFile}
        />

        {/* Beautified audio player for preview and controls */}
        <div className="mt-6">
          <AudioPlayer src={undefined} />
        </div>

        {isModuleLoaded && (
          <>
            <InfoDisplay moduleInfo={moduleInfo} />
            <div className="my-6 flex justify-center">
              <button
                onClick={askAI}
                disabled={isAiLoading || !isModuleLoaded}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-900 disabled:text-gray-400 text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
              >
                {isAiLoading ? 'Thinking...' : `Ask Gemini about "${moduleInfo.title}"`}
              </button>
            </div>
            <AiInfoCard response={aiResponse} isLoading={isAiLoading} />
            <PatternSequencer matrix={sequencerMatrix ?? null} currentRow={sequencerCurrentRow} totalRows={totalPatternRows} onSeek={seekToStep} bpm={moduleInfo.bpm} playbackSeconds={playbackSeconds} playbackRowFraction={playbackRowFraction} />

            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <MediaPanel media={media} activeMediaId={activeMediaId} onSelect={(id) => { setActiveMediaId(id); setOverlayVisible(!!id); }} onRemove={removeMedia} />
            </div>

            <MediaOverlay item={activeMedia} visible={overlayVisible} onClose={() => setOverlayVisible(false)} onUpdate={(partial) => { if (!activeMedia) return; setMedia(prev => prev.map(m => m.id === activeMedia.id ? { ...m, ...partial } : m)); }} />
          </>
        )}

        {!isModuleLoaded && (
           <div className="mt-6 bg-gray-800 p-6 rounded-lg shadow-lg text-center text-gray-400">
             <h2 className="text-xl font-semibold text-white mb-2">Welcome!</h2>
             <p>Load a tracker module file (e.g., .mod, .it, .s3m, .xm) to begin.</p>
           </div>
        )}
      </main>
      <footer className="text-center text-gray-500 mt-8 text-sm">
        <p>Powered by React, libopenmpt, and Gemini API.</p>
        <a href="https://github.com/L-F-S/gemini-prototyping-showcase" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 hover:text-white transition-colors">
          <GithubIcon className="w-4 h-4" />
          View on GitHub
        </a>
      </footer>
    </div>
  );
}
