import React from 'react';
import { useLibOpenMPT } from './hooks/useLibOpenMPT';
import { Header } from './components/Header';
import { Controls } from './components/Controls';
import { LcdDisplay } from './components/LcdDisplay'; // Import new LCD
import { Visualizer } from './components/Visualizer';
import { PatternCanvas } from './components/PatternCanvas'; // Import new Canvas
import { AiInfoCard } from './components/AiInfoCard';
import { GithubIcon } from './components/icons';

export default function App() {
  const {
    status,
    isReady,
    isPlaying,
    isModuleLoaded,
    moduleInfo,
    patternData,
    aiResponse,
    isAiLoading,
    analyserNode,
    loadModule,
    play,
    stopMusic,
    askAI,
  } = useLibOpenMPT();

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
        />

        {isModuleLoaded && (
          // This div is the "faux hardware" container
          <div className="bg-gray-900 border-4 border-gray-700 p-4 md:p-6 rounded-2xl shadow-2xl">
            {/* 1. LCD Display Section */}
            <LcdDisplay moduleInfo={moduleInfo} />
            
            {/* 2. Visualizer Section */}
            <div className="bg-gray-800 p-4 rounded-lg shadow-lg mb-6 border border-gray-600/50 h-32">
              <Visualizer analyserNode={analyserNode} isPlaying={isPlaying} />
            </div>

            {/* 3. AI Button */}
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

            {/* 4. Pattern Canvas Section */}
            <PatternCanvas data={patternData} numChannels={moduleInfo.numChannels} />
          </div>
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
