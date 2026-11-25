import { describe, expect, it } from 'vitest';
import {
  HEAVY_FRAGMENT_SCENES,
  computeAdaptiveRaymarchSteps,
  computeAdaptiveRenderScale,
  computeSafeInitialRenderScale,
  renderGpuOsdHtml,
} from '../gpuStress.service';
import type { GpuStressMetrics } from '../../types';

function makeMetrics(overrides: Partial<GpuStressMetrics> = {}): GpuStressMetrics {
  return {
    running: true,
    sceneMode: 'raymarching',
    sceneLabel: 'Raytracing / Mandelbulb 3D (256 kroków)',
    workloadNote: 'FP32 Shader ALU',
    preset: 'ultra',
    fpsMode: 'uncapped',
    instanceCount: 256,
    triangles: 2,
    drawCalls: 1,
    fps: 64,
    avgFps: 61,
    minFps: 48,
    maxFps: 72,
    low1PctFps: 50,
    totalFramesRendered: 1420,
    frameTimeMs: 15.6,
    stabilityPct: 96.4,
    estTempC: 72.5,
    peakTempC: 74.1,
    elapsedSec: 65,
    isSoftwareGl: false,
    rendererName: 'NVIDIA GeForce RTX 4080',
    renderWidth: 1600,
    renderHeight: 900,
    renderScalePct: 75,
    adaptiveThrottleActive: true,
    allocatedVramMB: 16384,
    textureVramMB: 9216,
    coreClockMhz: 2550,
    thermalThrottleActive: false,
    thermalThrottleRecent60s: false,
    telemetry: [],
    overallScore: 92,
    estFp32Tflops: 28.4,
    vramFillrateGBs: 295.2,
    verdict: 'STABILNY',
    ...overrides,
  };
}

describe('GPU Stress Anti-Freeze & Live Fullscreen OSD', () => {
  it('identifies Mandelbulb and heavy raymarching shaders as heavy fragment scenes', () => {
    expect(HEAVY_FRAGMENT_SCENES.has('raymarching')).toBe(true);
    expect(HEAVY_FRAGMENT_SCENES.has('menger_sponge')).toBe(true);
    expect(HEAVY_FRAGMENT_SCENES.has('blackhole_lensing')).toBe(true);
    expect(HEAVY_FRAGMENT_SCENES.has('vortex')).toBe(false);
  });

  it('caps initial fullscreen 4K raymarching render scale safely to prevent frame-1 freeze', () => {
    const scale4k = computeSafeInitialRenderScale(3840, 2160, 2, true, false);
    expect(scale4k).toBeGreaterThanOrEqual(0.45);
    expect(scale4k).toBeLessThanOrEqual(0.55);

    const scale720p = computeSafeInitialRenderScale(960, 540, 1, true, false);
    expect(scale720p).toBe(1);

    const scaleSoftware = computeSafeInitialRenderScale(1920, 1080, 1, true, true);
    expect(scaleSoftware).toBeLessThanOrEqual(0.45);
  });

  it('immediately steps down render scale on severe GPU stall and recovers when GPU is fast', () => {
    const stall = computeAdaptiveRenderScale(1.0, 165, true, 0, 0);
    expect(stall.nextScale).toBeLessThan(0.8);
    expect(stall.throttled).toBe(true);

    // 2 consecutive slow frames trigger step-down
    const slow1 = computeAdaptiveRenderScale(0.9, 62, true, 0, 0);
    expect(slow1.nextScale).toBe(0.9);
    expect(slow1.slowFrames).toBe(1);
    const slow2 = computeAdaptiveRenderScale(slow1.nextScale, 64, true, slow1.slowFrames, slow1.fastFrames);
    expect(slow2.nextScale).toBeLessThan(0.9);
    expect(slow2.slowFrames).toBe(0);

    // 8 consecutive fast frames recover scale upward
    let state = { nextScale: 0.65, slowFrames: 0, fastFrames: 0, throttled: true };
    for (let i = 0; i < 8; i++) {
      state = computeAdaptiveRenderScale(state.nextScale, 12, true, state.slowFrames, state.fastFrames);
    }
    expect(state.nextScale).toBeGreaterThan(0.65);

    // Never drops below floor
    let floored = { nextScale: 0.4, slowFrames: 0, fastFrames: 0, throttled: true };
    for (let i = 0; i < 6; i++) {
      floored = computeAdaptiveRenderScale(floored.nextScale, 220, true, floored.slowFrames, floored.fastFrames);
    }
    expect(floored.nextScale).toBe(0.38);
  });

  it('renders complete fullscreen FPS, frametime sparkline, temperature, clock, VRAM, and resolution OSD', () => {
    const html = renderGpuOsdHtml(
      makeMetrics(),
      68.4,
      [14.2, 15.1, 16.0, 15.4, 15.8],
      true
    );

    expect(html).toContain('Raytracing / Mandelbulb 3D (256 kroków)');
    expect(html).toContain('>64<');
    expect(html).toContain('FPS');
    expect(html).toContain('WYNIK GPU');
    expect(html).toContain('>92<');
    expect(html).toContain('/100');
    expect(html).toContain('15.6 ms');
    expect(html).toContain('61 / 72 FPS');
    expect(html).toContain('48 / 50 FPS');
    expect(html).toContain('GPU Temp (LIVE)');
    expect(html).toContain('68.4 °C');
    expect(html).toContain('2550 MHz');
    expect(html).toContain('1600×900 · Auto 75%');
    expect(html).toContain('16.0/9.0 GB');
    expect(html).toContain('28.4 TF · 96.4%');
    expect(html).toContain('01:05');
    expect(html).toContain('ESC wyjście');
    expect(html).toContain('<path d="M');
  });

  it('scales raymarching shader step counts smoothly when renderScale drops while respecting safety floors', () => {
    expect(computeAdaptiveRaymarchSteps(256, 1.0, 64)).toBe(256);
    expect(computeAdaptiveRaymarchSteps(256, 0.7, 64)).toBe(200);
    expect(computeAdaptiveRaymarchSteps(256, 0.5, 64)).toBe(154);
    expect(computeAdaptiveRaymarchSteps(48, 0.45, 24)).toBe(29);
    expect(computeAdaptiveRaymarchSteps(28, 0.4, 24)).toBe(24);
  });
});
