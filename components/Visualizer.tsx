import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  analyserNode: AnalyserNode | null;
  isPlaying: boolean;
}

/**
 * An oscilloscope visualizer component that draws time-domain data.
 */
export const Visualizer: React.FC<VisualizerProps> = ({ analyserNode, isPlaying }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameHandle = useRef<number>(0);
  const dataArrayRef = useRef<Uint8Array | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const canvasCtx = canvas.getContext('2d');
    if (!canvasCtx) return;

    const clearCanvas = () => {
      if (canvasRef.current) {
        // Clear with transparent background
        canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    };

    if (!analyserNode) {
      clearCanvas();
      return;
    }

    // Adjust FFT size for time domain data
    analyserNode.fftSize = 2048;
    const bufferLength = analyserNode.frequencyBinCount; // This is correct, it's fftSize / 2

    if (!dataArrayRef.current || dataArrayRef.current.length !== bufferLength) {
        dataArrayRef.current = new Uint8Array(bufferLength);
    }

    const draw = () => {
      if (!isPlaying || !analyserNode || !dataArrayRef.current || !canvasRef.current) {
        cancelAnimationFrame(animationFrameHandle.current);
        clearCanvas();
        return;
      }

      animationFrameHandle.current = requestAnimationFrame(draw);

      // Get time domain data
      // FIX: Use `as any` to bypass the strict ArrayBuffer vs ArrayBufferLike
      // type definition mismatch in the DOM libraries. This code is
      // functionally correct, but the type definitions are mismatched.
      analyserNode.getByteTimeDomainData(dataArrayRef.current as any);

      const width = canvasRef.current.width;
      const height = canvasRef.current.height;

      // Clear canvas
      canvasCtx.clearRect(0, 0, width, height);

      // Set line style
      canvasCtx.lineWidth = 2;
      canvasCtx.strokeStyle = '#34d399'; // emerald-400

      canvasCtx.beginPath();

      const sliceWidth = width * 1.0 / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArrayRef.current[i] / 128.0; // data is 0-255, center is 128
        const y = v * height / 2;

        if (i === 0) {
          canvasCtx.moveTo(x, y);
        } else {
          canvasCtx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      canvasCtx.lineTo(width, height / 2);
      canvasCtx.stroke();
    };

    if (isPlaying) {
      draw();
    } else {
      clearCanvas();
    }

    return () => {
      cancelAnimationFrame(animationFrameHandle.current);
    };
  }, [analyserNode, isPlaying]);

  return (
    // Canvas is now frameless, meant to be inside another container
    <canvas ref={canvasRef} width="600" height="100" className="w-full h-full"></canvas>
  );
};
