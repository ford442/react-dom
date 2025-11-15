import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { PatternMatrix } from '../types';

interface PatternDisplayProps {
  matrix: PatternMatrix | null;
  playheadRow: number;
  cellWidth?: number;
  cellHeight?: number;
}

const MIN_STORAGE = new Uint32Array([0, 0]);

const clampPlayhead = (value: number, numRows: number) => {
  if (numRows <= 0) return 0;
  return Math.min(Math.max(Math.floor(value), 0), numRows - 1);
};

const packPatternMatrix = (matrix: PatternMatrix | null): Uint32Array => {
  if (!matrix || matrix.numRows <= 0 || matrix.numChannels <= 0) {
    return MIN_STORAGE.slice();
  }

  const { numRows, numChannels, rows } = matrix;
  const packed = new Uint32Array(numRows * numChannels * 2);

  for (let r = 0; r < numRows; r++) {
    const rowCells = rows[r] || [];
    for (let c = 0; c < numChannels; c++) {
      const offset = (r * numChannels + c) * 2;
      const cell = rowCells[c];
      if (!cell || !cell.text) {
        packed[offset] = 0;
        packed[offset + 1] = 0;
        continue;
      }

      const text = cell.text.trim();
      const upper = text.toUpperCase();
      const notePart = upper.slice(0, 3).padEnd(3, '\u0000');
      const instMatch = text.match(/(\d{1,2})$/);
      const instByte = instMatch ? Math.min(255, parseInt(instMatch[1], 10)) : 0;

      const n0 = notePart.charCodeAt(0) & 0xff;
      const n1 = notePart.charCodeAt(1) & 0xff;
      const n2 = notePart.charCodeAt(2) & 0xff;

      packed[offset] = (n0 << 24) | (n1 << 16) | (n2 << 8) | instByte;
      packed[offset + 1] = 0;
    }
  }

  return packed;
};

const createBufferWithData = (device: GPUDevice, data: Uint32Array): GPUBuffer => {
  const buffer = device.createBuffer({
    size: Math.max(16, data.byteLength),
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  new Uint8Array(buffer.getMappedRange()).set(new Uint8Array(data.buffer));
  buffer.unmap();
  return buffer;
};

const writeUniforms = (
  device: GPUDevice,
  uniformBuffer: GPUBuffer,
  canvas: HTMLCanvasElement,
  matrix: PatternMatrix | null,
  playheadRow: number,
  cellWidth: number,
  cellHeight: number,
) => {
  const numRows = matrix?.numRows ?? 0;
  const numChannels = matrix?.numChannels ?? 0;
  const clampedRow = clampPlayhead(playheadRow, numRows);

  const data = new ArrayBuffer(32);
  const view = new DataView(data);
  view.setUint32(0, numRows, true);
  view.setUint32(4, numChannels, true);
  view.setUint32(8, clampedRow, true);
  view.setUint32(12, 0, true);
  view.setFloat32(16, cellWidth, true);
  view.setFloat32(20, cellHeight, true);
  view.setFloat32(24, canvas.width, true);
  view.setFloat32(28, canvas.height, true);

  device.queue.writeBuffer(uniformBuffer, 0, data);
};

export const PatternDisplay: React.FC<PatternDisplayProps> = ({ matrix, playheadRow, cellWidth = 18, cellHeight = 14 }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const deviceRef = useRef<GPUDevice | null>(null);
  const contextRef = useRef<GPUCanvasContext | null>(null);
  const pipelineRef = useRef<GPURenderPipeline | null>(null);
  const cellsBufferRef = useRef<GPUBuffer | null>(null);
  const uniformBufferRef = useRef<GPUBuffer | null>(null);
  const bindGroupRef = useRef<GPUBindGroup | null>(null);

  const [webgpuAvailable, setWebgpuAvailable] = useState(true);
  const [gpuReady, setGpuReady] = useState(false);

  const canvasMetrics = useMemo(() => {
    const channels = Math.max(1, matrix?.numChannels ?? 1);
    const rows = Math.max(1, matrix?.numRows ?? 1);
    return {
      width: Math.ceil(channels * cellWidth),
      height: Math.ceil(rows * cellHeight),
    };
  }, [matrix, cellWidth, cellHeight]);

  const render = () => {
    const device = deviceRef.current;
    const context = contextRef.current;
    const pipeline = pipelineRef.current;
    const bindGroup = bindGroupRef.current;
    if (!device || !context || !pipeline || !bindGroup || !uniformBufferRef.current || !cellsBufferRef.current) return;

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          loadOp: 'clear',
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          storeOp: 'store',
        },
      ],
    });

    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    const totalInstances = (matrix?.numRows ?? 0) * (matrix?.numChannels ?? 0);
    if (totalInstances > 0) {
      pass.draw(6, totalInstances, 0, 0);
    }
    pass.end();

    device.queue.submit([encoder.finish()]);
  };

  const refreshBindGroup = (device: GPUDevice) => {
    if (!pipelineRef.current || !cellsBufferRef.current || !uniformBufferRef.current) return;
    const layout = pipelineRef.current.getBindGroupLayout(0);
    bindGroupRef.current = device.createBindGroup({
      layout,
      entries: [
        { binding: 0, resource: { buffer: cellsBufferRef.current!, size: cellsBufferRef.current!.size } },
        { binding: 1, resource: { buffer: uniformBufferRef.current! } },
      ],
    });
  };

  // GPU initialization
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!('gpu' in navigator)) {
      setWebgpuAvailable(false);
      return;
    }

    let cancelled = false;

    const init = async () => {
      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter || cancelled) {
          setWebgpuAvailable(false);
          return;
        }

        const device = await adapter.requestDevice();
        if (!device || cancelled) {
          setWebgpuAvailable(false);
          return;
        }

        const context = canvas.getContext('webgpu') as GPUCanvasContext;
        const format = navigator.gpu.getPreferredCanvasFormat();
        context.configure({ device, format });

        const shaderSource = await fetch('./shaders/patternShader.wgsl').then(res => res.text());
        if (cancelled) return;
        const module = device.createShaderModule({ code: shaderSource });

        const bindGroupLayout = device.createBindGroupLayout({
          entries: [
            { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
            { binding: 1, visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
          ],
        });

        const pipeline = device.createRenderPipeline({
          layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
          vertex: { module, entryPoint: 'vs' },
          fragment: { module, entryPoint: 'fs', targets: [{ format }] },
          primitive: { topology: 'triangle-list' },
        });

        const uniformBuffer = device.createBuffer({
          size: 32,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        deviceRef.current = device;
        contextRef.current = context;
        pipelineRef.current = pipeline;
        uniformBufferRef.current = uniformBuffer;
        cellsBufferRef.current = createBufferWithData(device, MIN_STORAGE);
        refreshBindGroup(device);
        setGpuReady(true);
      } catch (error) {
        console.error('Failed to initialize WebGPU pattern display', error);
        if (!cancelled) setWebgpuAvailable(false);
      }
    };

    init();

    return () => {
      cancelled = true;
      bindGroupRef.current = null;
      pipelineRef.current = null;
      contextRef.current = null;
      if (cellsBufferRef.current) {
        cellsBufferRef.current.destroy();
        cellsBufferRef.current = null;
      }
      if (uniformBufferRef.current) {
        uniformBufferRef.current.destroy();
        uniformBufferRef.current = null;
      }
    };
  }, []);

  // Upload packed pattern data whenever matrix changes
  useEffect(() => {
    if (!gpuReady) return;
    const device = deviceRef.current;
    if (!device) return;

    const packed = packPatternMatrix(matrix);
    if (cellsBufferRef.current) {
      cellsBufferRef.current.destroy();
    }
    cellsBufferRef.current = createBufferWithData(device, packed);
    refreshBindGroup(device);
  }, [matrix, gpuReady]);

  // Update uniforms + render when visual parameters change
  useEffect(() => {
    if (!gpuReady) return;
    const device = deviceRef.current;
    const canvas = canvasRef.current;
    if (!device || !canvas || !uniformBufferRef.current) return;

    writeUniforms(device, uniformBufferRef.current, canvas, matrix, playheadRow, cellWidth, cellHeight);
    render();
  }, [playheadRow, cellWidth, cellHeight, matrix, gpuReady]);

  return (
    <section className="bg-black/70 p-4 rounded-xl border border-white/5 shadow-lg">
      <div className="flex items-center justify-between text-xs text-gray-400 font-mono mb-2">
        <span>Rows: {matrix?.numRows ?? 0}</span>
        <span>Channels: {matrix?.numChannels ?? 0}</span>
        <span>Playhead: {playheadRow}</span>
      </div>
      <div className="relative bg-black border border-white/10 rounded-lg overflow-auto">
        <canvas
          ref={canvasRef}
          width={canvasMetrics.width}
          height={canvasMetrics.height}
          className="block min-w-full"
          style={{ imageRendering: 'pixelated' }}
        />
      </div>
      {!matrix && (
        <div className="text-xs text-gray-500 mt-3">Load a module to view its pattern grid.</div>
      )}
      {!webgpuAvailable && (
        <div className="text-xs text-red-400 mt-2">WebGPU is not supported in this browser. Switch to the HTML view.</div>
      )}
    </section>
  );
};
