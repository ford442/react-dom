import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { PatternMatrix } from '../types';

interface PatternDisplayProps {
  matrix: PatternMatrix | null;
  playheadRow: number;
  cellWidth?: number;
  cellHeight?: number;
  shaderFile?: string;
  // Live playback uniforms
  isPlaying?: boolean;
  bpm?: number;
  timeSec?: number;
  tickOffset?: number; // 0..1 fractional progress between rows
}

const MIN_STORAGE = new Uint32Array([0, 0]);

const clampPlayhead = (value: number, numRows: number) => {
  if (numRows <= 0) return 0;
  return Math.min(Math.max(Math.floor(value), 0), numRows - 1);
};

// Parse helpers
const parsePackedB = (text: string) => {
  // volType: 1=volume, 2=pan, 0=none
  let volType = 0, volValue = 0;
  let effCode = 0, effParam = 0;
  // volume: vNN (decimal) 0..64 or 0..127; pan: pNN 0..64
  const volMatch = text.match(/v(\d{1,3})/i);
  if (volMatch) {
    volType = 1;
    const v = Math.min(255, Math.round((parseInt(volMatch[1], 10) / 64) * 255));
    volValue = isFinite(v) ? v : 0;
  }
  const panMatch = text.match(/p(\d{1,3})/i);
  if (panMatch) {
    volType = 2;
    const p = Math.min(255, Math.round((parseInt(panMatch[1], 10) / 64) * 255));
    volValue = isFinite(p) ? p : 0;
  }
  // effect like XYY or C80, letter + two hex digits
  const effMatch = text.match(/([A-Za-z])[ ]*([0-9A-Fa-f]{2})/);
  if (effMatch) {
    effCode = effMatch[1].toUpperCase().charCodeAt(0) & 0xff;
    effParam = parseInt(effMatch[2], 16) & 0xff;
  } else {
    // numeric effect code like 1xx style
    const effNum = text.match(/([0-9])[ ]*([0-9A-Fa-f]{2})/);
    if (effNum) {
      effCode = ('0'.charCodeAt(0) + (parseInt(effNum[1], 10) & 0xf)) & 0xff;
      effParam = parseInt(effNum[2], 16) & 0xff;
    }
  }
  return ((volType & 0xff) << 24) | ((volValue & 0xff) << 16) | ((effCode & 0xff) << 8) | (effParam & 0xff);
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
      const instMatch = text.match(/(\d{1,3})$/);
      const instByte = instMatch ? Math.min(255, parseInt(instMatch[1], 10)) : 0;

      const n0 = notePart.charCodeAt(0) & 0xff;
      const n1 = notePart.charCodeAt(1) & 0xff;
      const n2 = notePart.charCodeAt(2) & 0xff;

      packed[offset] = (n0 << 24) | (n1 << 16) | (n2 << 8) | instByte;
      packed[offset + 1] = parsePackedB(text) >>> 0;
    }
  }

  return packed;
};

const createBufferWithData = (device: GPUDevice, data: ArrayBufferView, usage: GPUBufferUsageFlags): GPUBuffer => {
  const buffer = device.createBuffer({
    size: Math.max(16, data.byteLength),
    usage,
    mappedAtCreation: true,
  });
  new Uint8Array(buffer.getMappedRange()).set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
  buffer.unmap();
  return buffer;
};

const buildRowFlags = (numRows: number): Uint32Array => {
  const flags = new Uint32Array(numRows);
  for (let r = 0; r < numRows; r++) {
    let f = 0;
    if (r % 4 === 0) f |= 1;      // beat every 4th
    if (r % 16 === 0) f |= 2;     // measure every 16th
    flags[r] = f;
  }
  return flags;
};

const noteNameToFreq = (note: string): number => {
  const m = note.toUpperCase().match(/^([A-G])(#|B)?-?(\d)/);
  if (!m) return 0;
  const name = m[1] + (m[2] || '');
  const octave = parseInt(m[3], 10);
  const semitones: Record<string, number> = { C: 0, 'C#': 1, DB: 1, D: 2, 'D#': 3, EB: 3, E: 4, F: 5, 'F#': 6, GB: 6, G: 7, 'G#': 8, AB: 8, A: 9, 'A#': 10, BB: 10, B: 11 };
  const n = (octave + 1) * 12 + (semitones[name] ?? 0); // MIDI note number
  return 440 * Math.pow(2, (n - 69) / 12);
};

const extractNoteStr = (text: string): string => {
  const m = text.match(/[A-Ga-g][#bB-]?\d/);
  return m ? m[0] : '';
};

export const PatternDisplay: React.FC<PatternDisplayProps> = ({ matrix, playheadRow, cellWidth = 18, cellHeight = 14, shaderFile = 'patternv0.12.wgsl', isPlaying = false, bpm = 120, timeSec = 0, tickOffset = 0 }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const deviceRef = useRef<GPUDevice | null>(null);
  const contextRef = useRef<GPUCanvasContext | null>(null);
  const pipelineRef = useRef<GPURenderPipeline | null>(null);
  const cellsBufferRef = useRef<GPUBuffer | null>(null);
  const uniformBufferRef = useRef<GPUBuffer | null>(null);
  const rowFlagsBufferRef = useRef<GPUBuffer | null>(null);
  const channelsBufferRef = useRef<GPUBuffer | null>(null);
  const bindGroupRef = useRef<GPUBindGroup | null>(null);
  const useExtendedRef = useRef<boolean>(true);

  const [webgpuAvailable, setWebgpuAvailable] = useState(true);
  const [gpuReady, setGpuReady] = useState(false);

  const isHorizontal = shaderFile.includes('v0.12');

  const canvasMetrics = useMemo(() => {
    const channels = Math.max(1, matrix?.numChannels ?? 1);
    const rows = Math.max(1, matrix?.numRows ?? 1);
    return isHorizontal
      ? { width: Math.ceil(rows * cellWidth), height: Math.ceil(channels * cellHeight) }
      : { width: Math.ceil(channels * cellWidth), height: Math.ceil(rows * cellHeight) };
  }, [matrix, cellWidth, cellHeight, isHorizontal]);

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
    if (totalInstances > 0) pass.draw(6, totalInstances, 0, 0);
    pass.end();

    device.queue.submit([encoder.finish()]);
  };

  const refreshBindGroup = (device: GPUDevice) => {
    if (!pipelineRef.current || !cellsBufferRef.current || !uniformBufferRef.current) return;
    const layout = pipelineRef.current.getBindGroupLayout(0);
    const entries: GPUBindGroupEntry[] = [
      { binding: 0, resource: { buffer: cellsBufferRef.current!, size: cellsBufferRef.current!.size } },
      { binding: 1, resource: { buffer: uniformBufferRef.current! } },
    ];
    if (useExtendedRef.current && rowFlagsBufferRef.current && channelsBufferRef.current) {
      entries.push(
        { binding: 2, resource: { buffer: rowFlagsBufferRef.current! } },
        { binding: 3, resource: { buffer: channelsBufferRef.current! } },
      );
    }
    bindGroupRef.current = device.createBindGroup({ layout, entries });
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
        if (!adapter || cancelled) { setWebgpuAvailable(false); return; }
        const device = await adapter.requestDevice();
        if (!device || cancelled) { setWebgpuAvailable(false); return; }

        const context = canvas.getContext('webgpu') as GPUCanvasContext;
        const format = navigator.gpu.getPreferredCanvasFormat();
        context.configure({ device, format });

        const shaderSource = await fetch(`./shaders/${shaderFile}`).then(res => res.text());
        if (cancelled) return;
        const module = device.createShaderModule({ code: shaderSource });

        // Try extended layout first
        let bindGroupLayout: GPUBindGroupLayout;
        useExtendedRef.current = true;
        try {
          bindGroupLayout = device.createBindGroupLayout({
            entries: [
              { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
              { binding: 1, visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
              { binding: 2, visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
              { binding: 3, visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
            ],
          });
        } catch {
          // Fallback to simple two-binding shader
          useExtendedRef.current = false;
          bindGroupLayout = device.createBindGroupLayout({
            entries: [
              { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
              { binding: 1, visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
            ],
          });
        }

        let entryVert = 'vs';
        let entryFrag = 'fs';
        // Optional fallback for older shaders
        try {
          // create pipeline to validate entry points
          const pipeline = device.createRenderPipeline({
            layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
            vertex: { module, entryPoint: entryVert },
            fragment: { module, entryPoint: entryFrag, targets: [{ format }] },
            primitive: { topology: 'triangle-list' },
          });
          pipelineRef.current = pipeline;
        } catch (e) {
          // fallback names
          const pipeline = device.createRenderPipeline({
            layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
            vertex: { module, entryPoint: 'vertex_main' },
            fragment: { module, entryPoint: 'fragment_main', targets: [{ format }] },
            primitive: { topology: 'triangle-list' },
          });
          pipelineRef.current = pipeline;
        }

        // Uniform buffer: 48 bytes (multiple of 16)
        const uniformBuffer = device.createBuffer({ size: 48, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });

        deviceRef.current = device;
        contextRef.current = context;
        uniformBufferRef.current = uniformBuffer;

        // Initialize storage buffers
        cellsBufferRef.current = createBufferWithData(device, MIN_STORAGE, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
        if (useExtendedRef.current) {
          const numRows = matrix?.numRows ?? 1;
          rowFlagsBufferRef.current = createBufferWithData(device, buildRowFlags(numRows), GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
          // channels buffer will be created after we know numChannels
          const channelsCount = Math.max(1, matrix?.numChannels ?? 1);
          const channelsAB = new ArrayBuffer(channelsCount * 16);
          channelsBufferRef.current = createBufferWithData(device, new Uint8Array(channelsAB), GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
        }

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
      if (cellsBufferRef.current) { cellsBufferRef.current.destroy(); cellsBufferRef.current = null; }
      if (uniformBufferRef.current) { uniformBufferRef.current.destroy(); uniformBufferRef.current = null; }
      if (rowFlagsBufferRef.current) { rowFlagsBufferRef.current.destroy(); rowFlagsBufferRef.current = null; }
      if (channelsBufferRef.current) { channelsBufferRef.current.destroy(); channelsBufferRef.current = null; }
    };
  }, [shaderFile, matrix?.numRows, matrix?.numChannels]);

  // Upload packed pattern data whenever matrix changes
  useEffect(() => {
    if (!gpuReady) return;
    const device = deviceRef.current;
    if (!device) return;

    const packed = packPatternMatrix(matrix);
    if (cellsBufferRef.current) cellsBufferRef.current.destroy();
    cellsBufferRef.current = createBufferWithData(device, packed, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);

    if (useExtendedRef.current) {
      const numRows = matrix?.numRows ?? 1;
      if (rowFlagsBufferRef.current) rowFlagsBufferRef.current.destroy();
      rowFlagsBufferRef.current = createBufferWithData(device, buildRowFlags(numRows), GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);

      const channelsCount = Math.max(1, matrix?.numChannels ?? 1);
      if (channelsBufferRef.current) channelsBufferRef.current.destroy();
      const channelsAB = new ArrayBuffer(channelsCount * 16);
      channelsBufferRef.current = createBufferWithData(device, new Uint8Array(channelsAB), GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
    }

    refreshBindGroup(device);
    render();
  }, [matrix, gpuReady]);

  const writeUniforms = () => {
    const device = deviceRef.current;
    if (!device || !uniformBufferRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const numRows = matrix?.numRows ?? 0;
    const numChannels = matrix?.numChannels ?? 0;
    const clampedRow = clampPlayhead(playheadRow, numRows);

    const data = new ArrayBuffer(48);
    const view = new DataView(data);
    view.setUint32(0, numRows, true);
    view.setUint32(4, numChannels, true);
    view.setUint32(8, clampedRow, true);
    view.setUint32(12, isPlaying ? 1 : 0, true);
    view.setFloat32(16, cellWidth, true);
    view.setFloat32(20, cellHeight, true);
    view.setFloat32(24, canvas.width, true);
    view.setFloat32(28, canvas.height, true);
    view.setFloat32(32, Math.max(0, Math.min(1, tickOffset ?? 0)), true);
    view.setFloat32(36, bpm ?? 0, true);
    view.setFloat32(40, timeSec ?? 0, true);
    view.setFloat32(44, 0, true);

    device.queue.writeBuffer(uniformBufferRef.current, 0, data);
  };

  // Update per-channel buffer each frame using current row data (approximation)
  useEffect(() => {
    if (!gpuReady || !matrix || !channelsBufferRef.current) return;
    const numChannels = matrix.numChannels;
    const rowIdx = clampPlayhead(playheadRow, matrix.numRows);
    const ab = new ArrayBuffer(numChannels * 16);
    const dv = new DataView(ab);

    for (let c = 0; c < numChannels; c++) {
      const cell = matrix.rows[rowIdx]?.[c];
      let vol = 1.0, pan = 0.0, freq = 0.0, trigger = 0;
      if (cell && cell.text) {
        const b = parsePackedB(cell.text);
        const volType = (b >>> 24) & 0xff;
        const volValue = (b >>> 16) & 0xff;
        if (volType === 1) vol = volValue / 255.0; // volume
        if (volType === 2) pan = (volValue / 255.0) * 2 - 1; // -1..1
        const noteStr = extractNoteStr(cell.text);
        if (noteStr) { freq = noteNameToFreq(noteStr); trigger = 1; }
      }
      const offset = c * 16;
      dv.setFloat32(offset + 0, vol, true);
      dv.setFloat32(offset + 4, pan, true);
      dv.setFloat32(offset + 8, freq, true);
      dv.setUint32(offset + 12, trigger, true);
    }

    deviceRef.current!.queue.writeBuffer(channelsBufferRef.current, 0, ab);
    // also uniforms
    writeUniforms();
    render();
  }, [matrix, playheadRow, gpuReady]);

  // Update uniforms + render when visual parameters change
  useEffect(() => {
    if (!gpuReady) return;
    writeUniforms();
    render();
  }, [tickOffset, bpm, timeSec, isPlaying, cellWidth, cellHeight, gpuReady, canvasMetrics.width, canvasMetrics.height]);

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
