import React, { useEffect, useRef } from 'react';

interface PatternDisplayProps {
  data: string;
  numChannels: number;
}

export const PatternDisplay: React.FC<PatternDisplayProps> = ({ data, numChannels }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const initWebGPU = async () => {
      if (!('gpu' in navigator)) {
        console.error('WebGPU not supported on this browser.');
        return;
      }

      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        console.error('Failed to get GPU adapter.');
        return;
      }

      const device = await adapter.requestDevice();
      const context = canvas.getContext('webgpu');

      const format = navigator.gpu.getPreferredCanvasFormat();
      context.configure({ device, format });

      const shaderModule = device.createShaderModule({
        code: await fetch('/shaders/patternShader.wgsl').then(res => res.text())
      });

      const pipeline = device.createRenderPipeline({
        vertex: {
          module: shaderModule,
          entryPoint: 'vertex_main',
        },
        fragment: {
          module: shaderModule,
          entryPoint: 'fragment_main',
          targets: [{ format }],
        },
        primitive: {
          topology: 'triangle-list',
        },
        layout: 'auto',
      });

      const commandEncoder = device.createCommandEncoder();
      const textureView = context.getCurrentTexture().createView();
      const renderPass = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: textureView,
            loadOp: 'clear',
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
            storeOp: 'store',
          },
        ],
      });

      renderPass.setPipeline(pipeline);
      renderPass.draw(3);
      renderPass.end();

      device.queue.submit([commandEncoder.finish()]);
    };

    initWebGPU();
  }, []);

  const channelHeaders = Array.from({ length: numChannels }, (_, i) => `CH ${String(i + 1).padStart(2, '0')}`);

  return (
    <section className="bg-black p-4 rounded-lg shadow-inner overflow-hidden">
      <div className="sticky top-0 bg-black z-10 pb-2">
        <span className="text-yellow-300">ROW | {channelHeaders.map(h => `${h.padEnd(13, ' ')}|`).join(' ')}</span>
      </div>
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className="font-mono text-sm text-green-400 h-96"
      />
    </section>
  );
};
