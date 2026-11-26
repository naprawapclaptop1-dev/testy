import type {
  BenchmarkResolutionId,
  GpuFpsMode,
  GpuLoadPreset,
  GpuSceneMode,
  GpuStressMetrics,
  GpuTelemetryPoint,
  SystemSpecs,
} from '../types';

export const DEFAULT_GPU_FRAMETIME_THRESHOLD_MS = 20;
export const GPU_FRAMETIME_THRESHOLD_PRESETS_MS = [16, 20, 25, 33] as const;
const GPU_FRAMETIME_THRESHOLD_STORAGE_KEY = 'systempulse_gpu_ft_threshold_ms_v1';

export type GpuTestPhaseRunType = 'single' | 'auto_suite' | 'scheduled_queue';

export interface GpuFrameTimeSpikeEvent {
  timestamp: number;
  isoTime: string;
  elapsedSec: number;
  frameTimeMs: number;
  thresholdMs: number;
  excessMs: number;
  rollingAvgFrameTimeMs: number;
  spikeMultiplier: number;
  fpsAtSpike: number;
  stabilityPctAtSpike: number;
  severity: 'threshold_breach' | 'severe' | 'stutter';
}

export interface GpuThermalThrottlingEvent {
  timestamp: number;
  isoTime: string;
  elapsedSec: number;
  gpuTempC: number;
  tempSource: 'hardware_live' | 'estimated';
  coreClockMhz: number;
  fpsAtEvent: number;
  baselineFps: number;
  fpsDropPct: number;
  frameTimeMs: number;
  reason: string;
}

export interface GpuStabilityTelemetrySample {
  timeSec: number;
  fps: number;
  frameTimeMs: number;
  stabilityPct: number;
  gpuTempC: number;
  coreClockMhz: number;
  thermalThrottle: boolean;
  exceedsFrameTimeThreshold: boolean;
}

export interface GpuStabilityPhaseLog {
  phaseIndex: number;
  phaseId: string;
  runType: GpuTestPhaseRunType;
  sceneId: GpuSceneMode;
  sceneName: string;
  targetUnit: string;
  resolution: BenchmarkResolutionId;
  preset: GpuLoadPreset;
  fpsMode: GpuFpsMode;
  startedAt: string;
  endedAt: string;
  durationSec: number;
  frameTimeThresholdMs: number;
  metrics: {
    avgFps: number;
    minFps: number;
    maxFps: number;
    low1PctFps: number;
    stabilityPct: number;
    overallScore: number;
    verdict: GpuStressMetrics['verdict'];
    totalFramesRendered: number;
    avgFrameTimeMs: number;
    p95FrameTimeMs: number;
    p99FrameTimeMs: number;
    maxFrameTimeMs: number;
    peakGpuTempC: number;
    avgGpuTempC: number;
    minCoreClockMhz: number;
    maxCoreClockMhz: number;
  };
  frameTimeSpikeCount: number;
  thermalThrottlingCount: number;
  frameTimeSpikes: GpuFrameTimeSpikeEvent[];
  thermalThrottlingEvents: GpuThermalThrottlingEvent[];
  telemetrySamples: GpuStabilityTelemetrySample[];
}

export interface GpuStabilityLogExportPayload {
  schemaVersion: '1.0.0';
  application: 'SystemPulse Pro';
  exportType: 'gpu_stability_log';
  exportedAt: string;
  frameTimeThresholdMs: number;
  gpuInfo: {
    rendererName: string;
    isSoftwareGl: boolean;
    os?: string;
    browser?: string;
    cpuCores?: number;
    deviceMemoryGB?: number | null;
  };
  summary: {
    totalPhases: number;
    totalDurationSec: number;
    totalFrameTimeSpikes: number;
    severeSpikeCount: number;
    totalThermalThrottlingEvents: number;
    avgStabilityPct: number;
    minStabilityPct: number;
    maxFrameTimeMs: number;
    peakGpuTempC: number;
    phasesWithSpikes: number;
    phasesWithThrottling: number;
  };
  phases: GpuStabilityPhaseLog[];
}

export interface DetectGpuAnomaliesOptions {
  frameTimeThresholdMs?: number;
  phaseStartTimestampMs?: number;
  tempSource?: 'hardware_live' | 'estimated';
}

export interface DetectedGpuPhaseAnomalies {
  frameTimeSpikes: GpuFrameTimeSpikeEvent[];
  thermalThrottlingEvents: GpuThermalThrottlingEvent[];
  avgFrameTimeMs: number;
  p95FrameTimeMs: number;
  p99FrameTimeMs: number;
  maxFrameTimeMs: number;
  peakGpuTempC: number;
  avgGpuTempC: number;
  minCoreClockMhz: number;
  maxCoreClockMhz: number;
  telemetrySamples: GpuStabilityTelemetrySample[];
}

export function clampGpuFrameTimeThresholdMs(ms: number): number {
  if (!Number.isFinite(ms)) return DEFAULT_GPU_FRAMETIME_THRESHOLD_MS;
  return Number(Math.max(8, Math.min(100, ms)).toFixed(1));
}

export function loadGpuFrameTimeThresholdMs(): number {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(GPU_FRAMETIME_THRESHOLD_STORAGE_KEY);
      if (raw !== null) {
        const parsed = Number(raw);
        if (Number.isFinite(parsed)) {
          return clampGpuFrameTimeThresholdMs(parsed);
        }
      }
    }
  } catch {
    // ignore storage errors
  }
  return DEFAULT_GPU_FRAMETIME_THRESHOLD_MS;
}

export function saveGpuFrameTimeThresholdMs(ms: number): number {
  const clamped = clampGpuFrameTimeThresholdMs(ms);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(GPU_FRAMETIME_THRESHOLD_STORAGE_KEY, String(clamped));
    }
  } catch {
    // ignore storage errors
  }
  return clamped;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)));
  return sorted[idx];
}

export function detectGpuPhaseAnomalies(
  telemetry: GpuTelemetryPoint[],
  options: DetectGpuAnomaliesOptions = {}
): DetectedGpuPhaseAnomalies {
  const thresholdMs = clampGpuFrameTimeThresholdMs(
    options.frameTimeThresholdMs ?? DEFAULT_GPU_FRAMETIME_THRESHOLD_MS
  );
  const startMs = options.phaseStartTimestampMs ?? Date.now();
  const tempSource = options.tempSource ?? 'estimated';

  const frameTimeSpikes: GpuFrameTimeSpikeEvent[] = [];
  const thermalThrottlingEvents: GpuThermalThrottlingEvent[] = [];
  const telemetrySamples: GpuStabilityTelemetrySample[] = [];

  if (!telemetry || telemetry.length === 0) {
    return {
      frameTimeSpikes,
      thermalThrottlingEvents,
      avgFrameTimeMs: 0,
      p95FrameTimeMs: 0,
      p99FrameTimeMs: 0,
      maxFrameTimeMs: 0,
      peakGpuTempC: 0,
      avgGpuTempC: 0,
      minCoreClockMhz: 0,
      maxCoreClockMhz: 0,
      telemetrySamples,
    };
  }

  const windowFt: number[] = [];
  const allFt: number[] = [];
  const allTemps: number[] = [];
  const allClocks: number[] = [];

  // Baseline FPS from first 3 non-zero samples
  const warmupFps = telemetry
    .slice(0, 4)
    .map((p) => p.fps)
    .filter((f) => Number.isFinite(f) && f > 0);
  const baselineFps =
    warmupFps.length > 0
      ? Math.round(warmupFps.reduce((a, b) => a + b, 0) / warmupFps.length)
      : 0;

  for (const pt of telemetry) {
    const ft = Number.isFinite(pt.frameTimeMs) && pt.frameTimeMs >= 0 ? Number(pt.frameTimeMs.toFixed(2)) : 0;
    const temp = Number.isFinite(pt.estTempC) ? Number(pt.estTempC.toFixed(1)) : 0;
    const clock = Number.isFinite(pt.coreClockMhz) ? Math.round(pt.coreClockMhz) : 0;
    const fps = Number.isFinite(pt.fps) ? Math.round(pt.fps) : 0;
    const stab =
      typeof pt.stabilityPct === 'number' && Number.isFinite(pt.stabilityPct)
        ? Number(pt.stabilityPct.toFixed(1))
        : 100;
    const elapsedSec = Number.isFinite(pt.timeSec) ? Number(pt.timeSec.toFixed(2)) : 0;
    const sampleTs = Math.round(startMs + elapsedSec * 1000);
    const isoTime = new Date(sampleTs).toISOString();

    const rollingAvg =
      windowFt.length > 0
        ? windowFt.reduce((a, b) => a + b, 0) / windowFt.length
        : ft || 16.7;

    const exceedsThreshold = ft > thresholdMs;
    const spikeMultiplier = Number((ft / Math.max(1, rollingAvg)).toFixed(2));
    const isRelativeSpike = windowFt.length >= 2 && ft >= rollingAvg * 1.55 && ft >= 14;

    if (exceedsThreshold || isRelativeSpike) {
      const severity: GpuFrameTimeSpikeEvent['severity'] =
        ft >= Math.max(thresholdMs * 2.2, 50) || spikeMultiplier >= 2.6
          ? 'stutter'
          : ft >= Math.max(thresholdMs * 1.45, 33.3) || spikeMultiplier >= 1.9
            ? 'severe'
            : 'threshold_breach';

      frameTimeSpikes.push({
        timestamp: sampleTs,
        isoTime,
        elapsedSec,
        frameTimeMs: ft,
        thresholdMs,
        excessMs: Number(Math.max(0, ft - thresholdMs).toFixed(2)),
        rollingAvgFrameTimeMs: Number(rollingAvg.toFixed(2)),
        spikeMultiplier,
        fpsAtSpike: fps,
        stabilityPctAtSpike: stab,
        severity,
      });
    }

    const fpsDropPct =
      baselineFps > 15 && fps > 0
        ? Number(Math.max(0, ((baselineFps - fps) / baselineFps) * 100).toFixed(1))
        : 0;
    const clockThrottled = clock > 0 && clock < 2000 && temp >= 75;
    const fpsThermalDrop = temp >= 76 && fpsDropPct >= 18;
    const isThermalThrottle = Boolean(pt.thermalThrottle) || temp >= 80 || clockThrottled || fpsThermalDrop;

    if (isThermalThrottle) {
      const reasons: string[] = [];
      if (temp >= 80) reasons.push(`GPU temp ${temp.toFixed(1)}°C >= 80°C`);
      if (clockThrottled) reasons.push(`core clock reduced to ${clock} MHz`);
      if (fpsThermalDrop) reasons.push(`FPS dropped ${fpsDropPct}% from ${baselineFps} FPS baseline`);
      if (reasons.length === 0) reasons.push('GPU thermal throttling flag active');

      thermalThrottlingEvents.push({
        timestamp: sampleTs,
        isoTime,
        elapsedSec,
        gpuTempC: temp,
        tempSource,
        coreClockMhz: clock,
        fpsAtEvent: fps,
        baselineFps,
        fpsDropPct,
        frameTimeMs: ft,
        reason: reasons.join('; '),
      });
    }

    telemetrySamples.push({
      timeSec: elapsedSec,
      fps,
      frameTimeMs: ft,
      stabilityPct: stab,
      gpuTempC: temp,
      coreClockMhz: clock,
      thermalThrottle: isThermalThrottle,
      exceedsFrameTimeThreshold: exceedsThreshold,
    });

    windowFt.push(ft);
    if (windowFt.length > 8) windowFt.shift();
    if (ft > 0) allFt.push(ft);
    if (temp > 0) allTemps.push(temp);
    if (clock > 0) allClocks.push(clock);
  }

  const sortedFt = [...allFt].sort((a, b) => a - b);
  return {
    frameTimeSpikes,
    thermalThrottlingEvents,
    avgFrameTimeMs:
      allFt.length > 0
        ? Number((allFt.reduce((a, b) => a + b, 0) / allFt.length).toFixed(2))
        : 0,
    p95FrameTimeMs: Number(percentile(sortedFt, 0.95).toFixed(2)),
    p99FrameTimeMs: Number(percentile(sortedFt, 0.99).toFixed(2)),
    maxFrameTimeMs: sortedFt.length > 0 ? Number(sortedFt[sortedFt.length - 1].toFixed(2)) : 0,
    peakGpuTempC: allTemps.length > 0 ? Number(Math.max(...allTemps).toFixed(1)) : 0,
    avgGpuTempC:
      allTemps.length > 0
        ? Number((allTemps.reduce((a, b) => a + b, 0) / allTemps.length).toFixed(1))
        : 0,
    minCoreClockMhz: allClocks.length > 0 ? Math.min(...allClocks) : 0,
    maxCoreClockMhz: allClocks.length > 0 ? Math.max(...allClocks) : 0,
    telemetrySamples,
  };
}

export interface BuildGpuStabilityPhaseInput {
  phaseIndex: number;
  runType: GpuTestPhaseRunType;
  metrics: GpuStressMetrics;
  sceneName: string;
  targetUnit: string;
  resolution: BenchmarkResolutionId;
  frameTimeThresholdMs?: number;
  startedAtMs?: number;
  endedAtMs?: number;
  liveGpuTempPeakC?: number | null;
}

export function buildGpuStabilityPhaseLog(
  input: BuildGpuStabilityPhaseInput
): GpuStabilityPhaseLog {
  const m = input.metrics;
  const endedAtMs = input.endedAtMs ?? Date.now();
  const durationSec = Number(
    Math.max(0.1, m.elapsedSec || (input.startedAtMs ? (endedAtMs - input.startedAtMs) / 1000 : 0.1)).toFixed(1)
  );
  const startedAtMs = input.startedAtMs ?? Math.round(endedAtMs - durationSec * 1000);
  const thresholdMs = clampGpuFrameTimeThresholdMs(
    input.frameTimeThresholdMs ?? DEFAULT_GPU_FRAMETIME_THRESHOLD_MS
  );

  // If telemetry is empty (e.g., very brief run), synthesize a single snapshot from metrics
  const sourceTelemetry: GpuTelemetryPoint[] =
    m.telemetry && m.telemetry.length > 0
      ? m.telemetry
      : [
          {
            timeSec: durationSec,
            fps: m.avgFps || m.fps || 0,
            frameTimeMs: m.frameTimeMs || 0,
            stabilityPct: m.stabilityPct || 0,
            estTempC: input.liveGpuTempPeakC ?? m.peakTempC ?? m.estTempC ?? 0,
            allocatedVramMB: m.allocatedVramMB || 0,
            textureVramMB: m.textureVramMB || 0,
            coreClockMhz: m.coreClockMhz || 0,
            thermalThrottle: Boolean(m.thermalThrottleActive || m.thermalThrottleRecent60s),
          },
        ];

  const detected = detectGpuPhaseAnomalies(sourceTelemetry, {
    frameTimeThresholdMs: thresholdMs,
    phaseStartTimestampMs: startedAtMs,
    tempSource: input.liveGpuTempPeakC !== null && input.liveGpuTempPeakC !== undefined
      ? 'hardware_live'
      : 'estimated',
  });

  const peakTemp = Math.max(
    detected.peakGpuTempC,
    m.peakTempC || 0,
    input.liveGpuTempPeakC ?? 0
  );

  return {
    phaseIndex: input.phaseIndex,
    phaseId: `gpu_phase_${input.phaseIndex}_${m.sceneMode}_${startedAtMs}`,
    runType: input.runType,
    sceneId: m.sceneMode,
    sceneName: input.sceneName,
    targetUnit: input.targetUnit,
    resolution: input.resolution,
    preset: m.preset,
    fpsMode: m.fpsMode,
    startedAt: new Date(startedAtMs).toISOString(),
    endedAt: new Date(endedAtMs).toISOString(),
    durationSec,
    frameTimeThresholdMs: thresholdMs,
    metrics: {
      avgFps: m.avgFps,
      minFps: m.minFps,
      maxFps: m.maxFps,
      low1PctFps: m.low1PctFps,
      stabilityPct: m.stabilityPct,
      overallScore: m.overallScore,
      verdict: m.verdict,
      totalFramesRendered: m.totalFramesRendered,
      avgFrameTimeMs: detected.avgFrameTimeMs || m.frameTimeMs,
      p95FrameTimeMs: detected.p95FrameTimeMs || m.frameTimeMs,
      p99FrameTimeMs: detected.p99FrameTimeMs || m.frameTimeMs,
      maxFrameTimeMs: detected.maxFrameTimeMs || m.frameTimeMs,
      peakGpuTempC: Number(peakTemp.toFixed(1)),
      avgGpuTempC: detected.avgGpuTempC || m.estTempC,
      minCoreClockMhz: detected.minCoreClockMhz || m.coreClockMhz,
      maxCoreClockMhz: detected.maxCoreClockMhz || m.coreClockMhz,
    },
    frameTimeSpikeCount: detected.frameTimeSpikes.length,
    thermalThrottlingCount: detected.thermalThrottlingEvents.length,
    frameTimeSpikes: detected.frameTimeSpikes,
    thermalThrottlingEvents: detected.thermalThrottlingEvents,
    telemetrySamples: detected.telemetrySamples,
  };
}

export function buildGpuStabilityLogPayload(
  phases: GpuStabilityPhaseLog[],
  context: {
    rendererName: string;
    isSoftwareGl: boolean;
    frameTimeThresholdMs?: number;
    specs?: SystemSpecs | null;
    exportedAt?: Date;
  }
): GpuStabilityLogExportPayload {
  const exportedDate = context.exportedAt ?? new Date();
  const thresholdMs = clampGpuFrameTimeThresholdMs(
    context.frameTimeThresholdMs ?? DEFAULT_GPU_FRAMETIME_THRESHOLD_MS
  );

  const totalDurationSec = Number(
    phases.reduce((sum, p) => sum + p.durationSec, 0).toFixed(1)
  );
  const totalFrameTimeSpikes = phases.reduce((sum, p) => sum + p.frameTimeSpikeCount, 0);
  const severeSpikeCount = phases.reduce(
    (sum, p) =>
      sum + p.frameTimeSpikes.filter((s) => s.severity === 'severe' || s.severity === 'stutter').length,
    0
  );
  const totalThermalThrottlingEvents = phases.reduce(
    (sum, p) => sum + p.thermalThrottlingCount,
    0
  );
  const avgStabilityPct =
    phases.length > 0
      ? Number(
          (
            phases.reduce((sum, p) => sum + p.metrics.stabilityPct, 0) / phases.length
          ).toFixed(1)
        )
      : 0;
  const minStabilityPct =
    phases.length > 0
      ? Number(Math.min(...phases.map((p) => p.metrics.stabilityPct)).toFixed(1))
      : 0;
  const maxFrameTimeMs =
    phases.length > 0
      ? Number(Math.max(...phases.map((p) => p.metrics.maxFrameTimeMs)).toFixed(2))
      : 0;
  const peakGpuTempC =
    phases.length > 0
      ? Number(Math.max(...phases.map((p) => p.metrics.peakGpuTempC)).toFixed(1))
      : 0;

  return {
    schemaVersion: '1.0.0',
    application: 'SystemPulse Pro',
    exportType: 'gpu_stability_log',
    exportedAt: exportedDate.toISOString(),
    frameTimeThresholdMs: thresholdMs,
    gpuInfo: {
      rendererName: context.rendererName || 'WebGL2 GPU',
      isSoftwareGl: Boolean(context.isSoftwareGl),
      os: context.specs?.os,
      browser: context.specs?.browser,
      cpuCores: context.specs?.cpuCores,
      deviceMemoryGB:
        typeof context.specs?.deviceMemory === 'number' ? context.specs.deviceMemory : null,
    },
    summary: {
      totalPhases: phases.length,
      totalDurationSec,
      totalFrameTimeSpikes,
      severeSpikeCount,
      totalThermalThrottlingEvents,
      avgStabilityPct,
      minStabilityPct,
      maxFrameTimeMs,
      peakGpuTempC,
      phasesWithSpikes: phases.filter((p) => p.frameTimeSpikeCount > 0).length,
      phasesWithThrottling: phases.filter((p) => p.thermalThrottlingCount > 0).length,
    },
    phases: phases.map((p, idx) => ({ ...p, phaseIndex: idx + 1 })),
  };
}

export function exportGpuStabilityLogToJson(
  phases: GpuStabilityPhaseLog[],
  context: {
    rendererName: string;
    isSoftwareGl: boolean;
    frameTimeThresholdMs?: number;
    specs?: SystemSpecs | null;
  }
): {
  filename: string;
  phaseCount: number;
  spikeCount: number;
  throttleCount: number;
  byteSize: number;
  payload: GpuStabilityLogExportPayload;
} {
  const now = new Date();
  const payload = buildGpuStabilityLogPayload(phases, { ...context, exportedAt: now });
  const jsonText = JSON.stringify(payload, null, 2);

  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    '-',
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');
  const filename = `systempulse-gpu-stability-log-${stamp}.json`;

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const blob = new Blob([jsonText], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  return {
    filename,
    phaseCount: payload.summary.totalPhases,
    spikeCount: payload.summary.totalFrameTimeSpikes,
    throttleCount: payload.summary.totalThermalThrottlingEvents,
    byteSize: new TextEncoder().encode(jsonText).length,
    payload,
  };
}
