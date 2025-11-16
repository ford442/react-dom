import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ChannelShadowState, PatternMatrix } from '../types';

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
  channels?: ChannelShadowState[];
  beatPhase?: number;
  grooveAmount?: number;
  kickTrigger?: number;
  activeChannels?: number;
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

export const PatternDisplay: React.FC<PatternDisplayProps> = ({ matrix, playheadRow, cellWidth = 18, cellHeight = 14, shaderFile = 'patternv0.12.wgsl', bpm = 120, timeSec = 0, tickOffset = 0, grooveAmount = 0, kickTrigger = 0, activeChannels = 0 }) => {
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
              { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
              { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
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

        // Override for patternShaderv0.12.wgsl to ensure sampler and texture bindings
        if (shaderFile === 'patternShaderv0.12.wgsl') {
          useExtendedRef.current = true;
          bindGroupLayout = device.createBindGroupLayout({
            entries: [
              { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
              { binding: 1, visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
              { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
              { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
            ],
          });
        }

        let entryVert = 'vs';
        let entryFrag = 'fs';
        try {
          pipelineRef.current = device.createRenderPipeline({
            layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
            vertex: { module, entryPoint: entryVert },
            fragment: { module, entryPoint: entryFrag, targets: [{ format }] },
            primitive: { topology: 'triangle-list' },
          });
        } catch {
          pipelineRef.current = device.createRenderPipeline({
            layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
            vertex: { module, entryPoint: 'vertex_main' },
            fragment: { module, entryPoint: 'fragment_main', targets: [{ format }] },
            primitive: { topology: 'triangle-list' },
          });
        }

        // Adjust uniform buffer size to match the updated Uniforms struct in the shader
        const uniformSize = shaderFile === 'patternShaderv0.12.wgsl' ? 1024 : 64;
        const uniformBuffer = device.createBuffer({ size: uniformSize, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });

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

        // Load texture and sampler for patternShaderv0.12.wgsl and create bind group
        if (shaderFile === 'patternShaderv0.12.wgsl') {
          const img = new Image();
          img.src = './public/unlit-buttons.png';
          await img.decode();

          const bitmap = await createImageBitmap(img);
          const texture = device.createTexture({
            size: [bitmap.width, bitmap.height, 1],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
          });
          device.queue.copyExternalImageToTexture(
            { source: bitmap },
            { texture: texture },
            [bitmap.width, bitmap.height, 1]
          );

          const sampler = device.createSampler({
            magFilter: 'linear',
            minFilter: 'linear',
          });

          bindGroupRef.current = device.createBindGroup({
            layout: bindGroupLayout,
            entries: [
              { binding: 0, resource: { buffer: cellsBufferRef.current! } },
              { binding: 1, resource: { buffer: uniformBufferRef.current! } },
              { binding: 2, resource: sampler },
              { binding: 3, resource: texture.createView() },
            ],
          });
        } else {
          refreshBindGroup(device);
        }

        setGpuReady(true);
      } catch (error) {
        console.error('Failed to initialize WebGPU pattern display', error);
        if (!cancelled) setWebgpuAvailable(false);
      }
    };

    init();

    return () => {
      cancelled = true;
      setWebgpuAvailable(true);
      setGpuReady(false);
    };
  }, [matrix, shaderFile]);

  // Update buffers and re-render when matrix or playheadRow changes
  useEffect(() => {
    const device = deviceRef.current;
    if (!device || !gpuReady) return;

    // Update cells buffer
    if (matrix) {
      if (cellsBufferRef.current) {
        cellsBufferRef.current.destroy();
      }
      cellsBufferRef.current = createBufferWithData(device, packPatternMatrix(matrix), GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
      refreshBindGroup(device);
    } else if (!cellsBufferRef.current) {
      cellsBufferRef.current = createBufferWithData(device, MIN_STORAGE, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
      refreshBindGroup(device);
    }

    // Update uniform buffer with playhead and timing information
    if (uniformBufferRef.current) {
      const numRows = matrix?.numRows ?? 1;
      const tick = clampPlayhead(playheadRow + tickOffset, numRows);
      const timeFrac = numRows > 0 ? (tick + 1) / numRows : 0;
      const beat = Math.floor(tick / 4) % 4;
      const groove = Math.min(1, Math.max(0, (beat + grooveAmount) / 4));
      const kick = (beat === 0 && grooveAmount > 0) ? 1 : 0;

      // Pack uniforms into a Float32Array
      const uniforms = new Float32Array([
        timeSec, timeFrac, bpm, activeChannels,    // time and tempo
        tick, beat, groove, kick,     // tick and beat information
        0, 0, 0, 0,                   // padding
      ]);

      device.queue.writeBuffer(uniformBufferRef.current, 0, uniforms.buffer, uniforms.byteOffset, uniforms.byteLength);
    }

    render();
  }, [matrix, playheadRow, timeSec, bpm, tickOffset, grooveAmount, kickTrigger, activeChannels, gpuReady]);

  return (
    <div className="pattern-display">
      <canvas ref={canvasRef} width={canvasMetrics.width} height={canvasMetrics.height} />
      {!webgpuAvailable && <div className="error">WebGPU not available in this browser.</div>}
    </div>
  );
};
