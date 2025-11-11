
import React from 'react';
import { SparklesIcon } from './icons';

interface AiInfoCardProps {
  response: string;
  isLoading: boolean;
}

export const AiInfoCard: React.FC<AiInfoCardProps> = ({ response, isLoading }) => {
  if (!response && !isLoading) {
    return null;
  }

  return (
    <section className="bg-gray-800/50 border border-purple-500/30 p-4 rounded-lg shadow-lg mb-6">
      <h3 className="text-lg font-semibold text-purple-300 mb-3 flex items-center gap-2">
        <SparklesIcon className="w-5 h-5" />
        Gemini's Insights
      </h3>
      {isLoading ? (
        <div className="flex items-center justify-center p-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400"></div>
        </div>
      ) : (
        <div className="text-gray-300 whitespace-pre-wrap prose prose-invert prose-sm max-w-none">
          {response}
        </div>
      )}
    </section>
  );
};
