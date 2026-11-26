import { BenchmarkResolutionId } from '../types';

export interface BenchmarkResolutionSpec {
  id: BenchmarkResolutionId;
  label: string;
  shortLabel: string;
  width: number;
  height: number;
  megapixels: number;
  shaderLoadMultiplier: number;
}

export const BENCHMARK_RESOLUTION_LIST: readonly BenchmarkResolutionSpec[] = [
  {
    id: '1080p',
    label: '1080p Full HD (1920×1080)',
    shortLabel: '1080p',
    width: 1920,
    height: 1080,
    megapixels: 2.07,
    shaderLoadMultiplier: 1.0,
  },
  {
    id: '2k',
    label: '2K QHD (2560×1440)',
    shortLabel: '2K',
    width: 2560,
    height: 1440,
    megapixels: 3.69,
    shaderLoadMultiplier: 1.15,
  },
  {
    id: '4k',
    label: '4K UHD (3840×2160)',
    shortLabel: '4K',
    width: 3840,
    height: 2160,
    megapixels: 8.29,
    shaderLoadMultiplier: 1.35,
  },
  {
    id: '8k',
    label: '8K UHD (7680×4320)',
    shortLabel: '8K',
    width: 7680,
    height: 4320,
    megapixels: 33.18,
    shaderLoadMultiplier: 1.75,
  },
] as const;

export function getBenchmarkResolutionSpec(
  id: BenchmarkResolutionId = '1080p'
): BenchmarkResolutionSpec {
  return BENCHMARK_RESOLUTION_LIST.find((r) => r.id === id) || BENCHMARK_RESOLUTION_LIST[0];
}

export interface ComputedRenderBufferTarget {
  spec: BenchmarkResolutionSpec;
  drawWidth: number;
  drawHeight: number;
  cappedByHardware: boolean;
  extraSupersampleSteps: number;
}

/**
 * Computes safe physical WebGL framebuffer dimensions for 1080p / 2K / 4K / 8K
 * while honoring the GPU's MAX_RENDERBUFFER_SIZE and applying real extra shader
 * workload when 8K exceeds a driver's single-buffer limit.
 */
export function computeSafeBenchmarkBufferSize(
  resolutionId: BenchmarkResolutionId,
  scaleFactor = 1.0,
  maxHardwareDim = 8192
): ComputedRenderBufferTarget {
  const spec = getBenchmarkResolutionSpec(resolutionId);
  const clampedScale = Math.max(0.35, Math.min(1.5, scaleFactor));
  const desiredW = Math.max(320, Math.round(spec.width * clampedScale));
  const desiredH = Math.max(180, Math.round(spec.height * clampedScale));
  const safeMax = Math.max(1920, Math.min(8192, Math.floor(maxHardwareDim)));

  let drawW = desiredW;
  let drawH = desiredH;
  let cappedByHardware = false;

  if (drawW > safeMax || drawH > safeMax) {
    const ratio = Math.min(safeMax / drawW, safeMax / drawH);
    drawW = Math.max(320, Math.round(drawW * ratio));
    drawH = Math.max(180, Math.round(drawH * ratio));
    cappedByHardware = true;
  }

  const extraSupersampleSteps =
    resolutionId === '8k' ? (cappedByHardware ? 32 : 16) : resolutionId === '4k' ? 8 : 0;

  return {
    spec,
    drawWidth: drawW,
    drawHeight: drawH,
    cappedByHardware,
    extraSupersampleSteps,
  };
}
