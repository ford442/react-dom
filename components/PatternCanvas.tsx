import React, { useEffect, useRef } from 'react';
import { FormattedPatternRow } from '../types';

interface PatternCanvasProps {
  data: FormattedPatternRow[];
  numChannels: number;
}

const FONT_FAMILY = 'monospace';
const FONT_SIZE = 14;
const LINE_HEIGHT = 18;
const ROW_HEADER_WIDTH = 40;
const CHANNEL_WIDTH = 120;
const PADDING = 10;

// Colors
const COLOR_BG = '#111827'; // gray-900
const COLOR_TEXT = '#6b7280'; // gray-500
const COLOR_TEXT_HIGHLIGHT = '#a5b4fc'; // indigo-300
const COLOR_CURRENT_ROW_BG = '#1e293b'; // slate-800
const COLOR_CURRENT_ROW_TEXT = '#fde047'; // yellow-300

export const PatternCanvas: React.FC<PatternCanvasProps> = ({ data, numChannels }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data || data.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const canvasHeight = data.length * LINE_HEIGHT + PADDING * 2;
    const canvasWidth = ROW_HEADER_WIDTH + (numChannels * CHANNEL_WIDTH) + PADDING * 2;

    // Resize canvas (this also clears it)
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    
    // Set base font style
    ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;
    ctx.textBaseline = 'top';

    // Draw background
    ctx.fillStyle = COLOR_BG;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // Draw each row
    data.forEach((row, rowIndex) => {
      const y = PADDING + rowIndex * LINE_HEIGHT;

      // Draw current row background
      if (row.isCurrent) {
        ctx.fillStyle = COLOR_CURRENT_ROW_BG;
        ctx.fillRect(0, y, canvasWidth, LINE_HEIGHT);
      }

      // Draw row number
      ctx.fillStyle = row.isCurrent ? COLOR_CURRENT_ROW_TEXT : COLOR_TEXT;
      const rowNumStr = String(row.rowNum).padStart(3, '0');
      ctx.fillText(rowNumStr, PADDING, y + 2); // +2 for font alignment

      // Draw channels
      let x = PADDING + ROW_HEADER_WIDTH;
      row.channelStrings.forEach((channelStr) => {
        ctx.fillStyle = row.isCurrent ? COLOR_CURRENT_ROW_TEXT : COLOR_TEXT_HIGHLIGHT;
        ctx.fillText(channelStr, x, y + 2);
        x += CHANNEL_WIDTH;
      });
    });

  }, [data, numChannels]); // Redraw when data changes

  return (
    <section 
      className="bg-gray-800 p-4 rounded-lg shadow-lg mb-6 border border-gray-600/50 overflow-auto pattern-scrollbar"
      style={{ height: '350px' }} // Fixed height container to scroll canvas
    >
      <canvas ref={canvasRef} className="w-auto h-auto" />
    </section>
  );
};
