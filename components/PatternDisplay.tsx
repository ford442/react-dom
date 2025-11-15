import React, { useEffect, useRef } from 'react';
import type { PatternMatrix } from '../types';

interface PatternDisplayProps {
  matrix: PatternMatrix | null;
  playheadRow: number; // current row to highlight
  cellWidth?: number;
  cellHeight?: number;
}

export const PatternDisplay: React.FC<PatternDisplayProps> = ({ matrix, playheadRow, cellWidth = 18, cellHeight = 14 }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const deviceRef = useRef<GPUDevice | null>(null);
  const contextRef = useRef<GPUCanvasContext | null>(null);
  const pipelineRef = useRef<GPURenderPipeline | null>(null);
  const cellsBufferRef = useRef<GPUBuffer | null>(null);
  const uniformBufferRef = useRef<GPUBuffer | null>(null);
  const bindGroupRef = useRef<GPUBindGroup | null>(null);
  const animationRef = useRef<number | null>(null);

  // Helper: build packed buffer from matrix
  const buildCellsBuffer = (device: GPUDevice) => {
    if (!matrix) return;
    const { rows, numChannels, numRows } = matrix;
    const totalCells = numRows * numChannels;
    const packed = new Uint32Array(totalCells * 2); // two u32 per cell

    for (let r = 0; r < numRows; r++) {
      const rowCells = rows[r] || [];
      for (let c = 0; c < numChannels; c++) {
        const idx = (r * numChannels + c) * 2;
        const cell = rowCells[c];
        if (!cell) {
          packed[idx] = 0; // a
          packed[idx + 1] = 0; // b
          continue;
        }
        // For now parse first up to 3 chars of cell.text as note, instrument from last numeric part
        const text = cell.text || '';
        const notePart = text.slice(0, 3).padEnd(3, '\u0000');
        let instByte = 0;
        const instMatch = text.match(/(\d{1,2})$/);
        if (instMatch) instByte = Math.min(255, parseInt(instMatch[1], 10));
        const n0 = notePart.charCodeAt(0) & 0xff;
        const n1 = notePart.charCodeAt(1) & 0xff;
        const n2 = notePart.charCodeAt(2) & 0xff;
        const a = (n0 << 24) | (n1 << 16) | (n2 << 8) | instByte;
        // Effects unused -> zero; flag future usage if needed
        const b = 0;
        packed[idx] = a >>> 0;
        packed[idx + 1] = b >>> 0;
      }
    }

    if (cellsBufferRef.current) cellsBufferRef.current.destroy();
    const cellsBuffer = device.createBuffer({
      size: packed.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    const map = new Uint8Array(cellsBuffer.getMappedRange());
    map.set(new Uint8Array(packed.buffer));
    cellsBuffer.unmap();
    cellsBufferRef.current = cellsBuffer;
  };

  // Update uniforms
  const writeUniforms = (device: GPUDevice) => {
    if (!uniformBufferRef.current) return;
    const numRows = matrix?.numRows || 0;
    const numChannels = matrix?.numChannels || 0;
    const canvas = canvasRef.current!;
    const dataF32 = new Float32Array([
      numRows, // will reinterpret later
      numChannels,
      playheadRow,
      0,
      cellWidth,
      cellHeight,
      canvas.width,
      canvas.height,
    ]);
    // We need u32 for first four but layout: treat as raw bytes
    device.queue.writeBuffer(uniformBufferRef.current, 0, dataF32.buffer);
  };

  const render = () => {
    const device = deviceRef.current;
    const context = contextRef.current;
    const pipeline = pipelineRef.current;
    if (!device || !context || !pipeline || !uniformBufferRef.current || !cellsBufferRef.current) return;

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        loadOp: 'clear',
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        storeOp: 'store'
      }]
    });

    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroupRef.current!);
    const totalInstances = (matrix?.numRows || 0) * (matrix?.numChannels || 0);
    pass.draw(6, totalInstances, 0, 0);
    pass.end();

    device.queue.submit([encoder.finish()]);
  };

  // Initialization
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!('gpu' in navigator)) return;

    const init = async () => {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) return;
      const device = await adapter.requestDevice();
      deviceRef.current = device;
      const context = canvas.getContext('webgpu') as GPUCanvasContext;
      contextRef.current = context;
      const format = navigator.gpu.getPreferredCanvasFormat();
      context.configure({ device, format });

      const shaderCode = await fetch('/shaders/patternShader.wgsl').then(r => r.text());
      const module = device.createShaderModule({ code: shaderCode });

      const bindGroupLayout = device.createBindGroupLayout({
        entries: [
          { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
          { binding: 1, visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
        ]
      });

      const pipeline = device.createRenderPipeline({
        layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
        vertex: { module, entryPoint: 'vs' },
        fragment: { module, entryPoint: 'fs', targets: [{ format }] },
        primitive: { topology: 'triangle-list' },
      });
      pipelineRef.current = pipeline;

      // Create uniform buffer
      const uniformBuffer = device.createBuffer({
        size: 32, // 8 * 4 bytes
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      uniformBufferRef.current = uniformBuffer;

      if (matrix) buildCellsBuffer(device);

      const bindGroup = device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: cellsBufferRef.current!, size: cellsBufferRef.current!.size } },
          { binding: 1, resource: { buffer: uniformBuffer } },
        ]
      });
      bindGroupRef.current = bindGroup;

      writeUniforms(device);
      render();
    };

    init();
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rebuild cells when matrix changes
  useEffect(() => {
    const device = deviceRef.current;
    if (!device || !matrix) return;
    buildCellsBuffer(device);
    // Recreate bind group with new buffer
    if (pipelineRef.current && uniformBufferRef.current && cellsBufferRef.current) {
      const layout = pipelineRef.current.getBindGroupLayout(0);
      bindGroupRef.current = device.createBindGroup({
        layout,
        entries: [
          { binding: 0, resource: { buffer: cellsBufferRef.current!, size: cellsBufferRef.current!.size } },
          { binding: 1, resource: { buffer: uniformBufferRef.current! } },
        ]
      });
    }
    writeUniforms(device);
    render();
  }, [matrix]);

  // Update playhead highlight
  useEffect(() => {
    const device = deviceRef.current;
    if (!device) return;
    writeUniforms(device);
    render();
  }, [playheadRow, cellWidth, cellHeight]);

  const numChannels = matrix?.numChannels || 0;
  const numRows = matrix?.numRows || 0;

  return (
    <section className="bg-black p-2 rounded-lg shadow-inner overflow-hidden">
      <div className="flex text-xs text-gray-400 mb-1 font-mono">
        <span className="mr-2">Rows: {numRows}</span>
        <span>Channels: {numChannels}</span>
        <span className="ml-auto">Playhead: {playheadRow}</span>
      </div>
      <canvas ref={canvasRef} width={numChannels * cellWidth} height={Math.max(1, numRows) * cellHeight} />
      {!('gpu' in navigator) && (
        <div className="text-red-400 text-xs mt-2">WebGPU not supported – pattern grid unavailable.</div>
      )}
    </section>
  );
};
