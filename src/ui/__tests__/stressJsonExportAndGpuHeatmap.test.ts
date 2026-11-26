import { describe, expect, it } from 'vitest';
import { buildStressHistoryJsonPayload } from '../../services/stressExport.service';
import { GPU_SCENE_CATALOG } from '../../services/gpuStress.service';
import { renderStressHistoryPanelHtml } from '../stressHistoryPanel';
import {
  buildGpuSceneHeatmapAnalysis,
  classifyGpuScenePipeline,
  GpuSceneStabilityAccumulator,
  recordGpuSceneStabilitySample,
  resolveStabilityBandId,
} from '../gpuSceneStabilityHeatmap';
import type { DiagnosticLogEntry, GpuSceneMode, StressSessionRecord, SystemSpecs } from '../../types';

const MOCK_SPECS: SystemSpecs = {
  os: 'Windows 11',
  browser: 'Chrome 131',
  platform: 'Win32',
  cpuCores: 16,
  deviceMemory: 32,
  gpuVendor: 'NVIDIA',
  gpuRenderer: 'NVIDIA GeForce RTX 4090',
  webglVersion: 'WebGL 2.0',
  maxTextureSize: 16384,
  screenResolution: '3840x2160',
  viewportSize: '1920x1080',
  colorDepth: 24,
  devicePixelRatio: 1,
  estimatedRefreshRate: 144,
  online: true,
  connectionType: 'ethernet',
  downlink: 1000,
  rtt: 8,
  storageQuotaGB: 512,
  storageUsageMB: 12,
};

const MOCK_SESSIONS: StressSessionRecord[] = [
  {
    id: 'stress-1',
    module: 'GPU 3D',
    startedAt: 1732500000000,
    endedAt: 1732500060000,
    durationSec: 60,
    avgCpuTempC: 68.5,
    avgGpuTempC: 74.2,
    finalStabilityPct: 94.5,
    status: 'OK',
    summaryMetric: 'Raymarch RT · Śr. 142 FPS',
  },
  {
    id: 'stress-2',
    module: 'CPU Stres',
    startedAt: 1732500100000,
    endedAt: 1732500220000,
    durationSec: 120,
    avgCpuTempC: 84.0,
    avgGpuTempC: 86.5,
    finalStabilityPct: 71.2,
    status: 'BŁĄD',
    summaryMetric: 'Torture Test · Throttling',
  },
  {
    id: 'stress-3',
    module: 'GPU 3D',
    startedAt: 1732500300000,
    endedAt: 1732500330000,
    durationSec: 30,
    avgCpuTempC: null,
    avgGpuTempC: null,
    finalStabilityPct: 83.4,
    status: 'UWAGA',
    summaryMetric: 'Blackhole Lensing · Wahania',
  },
];

const MOCK_LOGS: DiagnosticLogEntry[] = [
  {
    id: 1,
    timestamp: 1732500060000,
    isoTime: '2024-11-25T02:01:00.000Z',
    module: 'GPU',
    level: 'OK',
    event: 'Zakończono stres-test GPU',
    metric: 'FPS',
    value: '142 FPS',
    details: 'Scena raymarching',
  },
  {
    id: 2,
    timestamp: 1732500220000,
    isoTime: '2024-11-25T02:03:40.000Z',
    module: 'SYSTEM',
    level: 'ERROR',
    event: 'Spadek stabilności poniżej 75%',
    metric: 'Stabilność',
    value: '71.2%',
    details: 'Thermal throttle wykryty',
  },
];

describe('Dashboard Stress Log History JSON Export', () => {
  it('builds a structured JSON payload with schema, summary, thermal aggregates, module breakdown, and diagnostic logs', () => {
    const fixedDate = new Date('2026-11-26T10:00:00.000Z');
    const payload = buildStressHistoryJsonPayload(MOCK_SESSIONS, {
      specs: MOCK_SPECS,
      diagnosticLogs: MOCK_LOGS,
      exportedAt: fixedDate,
    });

    expect(payload.schemaVersion).toBe('1.0');
    expect(payload.application).toBe('SystemPulse Pro');
    expect(payload.exportType).toBe('stress-log-history');
    expect(payload.exportedAt).toBe('2026-11-26T10:00:00.000Z');
    expect(payload.systemSpecs?.gpuRenderer).toBe('NVIDIA GeForce RTX 4090');
    expect(payload.systemSpecs?.screenResolution).toBe('3840x2160');

    expect(payload.summary.totalSessions).toBe(3);
    expect(payload.summary.totalDiagnosticLogs).toBe(2);
    expect(payload.summary.totalDurationSec).toBe(210);
    expect(payload.summary.minStabilityPct).toBe(71.2);
    expect(payload.summary.maxStabilityPct).toBe(94.5);
    expect(payload.summary.statusCounts).toEqual({ OK: 1, UWAGA: 1, BŁĄD: 1 });

    expect(payload.summary.thermal.cpuSamplesWithSensor).toBe(2);
    expect(payload.summary.thermal.avgCpuTempC).toBe(76.3);
    expect(payload.summary.thermal.maxAvgCpuTempC).toBe(84);
    expect(payload.summary.thermal.gpuSamplesWithSensor).toBe(2);
    expect(payload.summary.thermal.avgGpuTempC).toBeCloseTo(80.35, 1);
    expect(payload.summary.thermal.maxAvgGpuTempC).toBe(86.5);

    const gpuSummary = payload.summary.byModule.find((m) => m.module === 'GPU 3D');
    expect(gpuSummary?.sessionCount).toBe(2);
    expect(gpuSummary?.totalDurationSec).toBe(90);

    // Ordered newest first (reverse of input array)
    expect(payload.sessions.map((s) => s.id)).toEqual(['stress-3', 'stress-2', 'stress-1']);
    expect(payload.sessions[0].stabilityBand).toBe('FLUCTUATION_75_89');
    expect(payload.sessions[1].stabilityBand).toBe('CRITICAL_LT_75');
    expect(payload.sessions[2].stabilityBand).toBe('OPTIMAL_GE_90');
    expect(payload.sessions[0].startedAtIso).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(payload.diagnosticLogs).toHaveLength(2);
  });

  it('renders the Eksport JSON button inside the dashboard stress history panel', () => {
    const htmlWithSessions = renderStressHistoryPanelHtml(MOCK_SESSIONS);
    expect(htmlWithSessions).toContain('id="dash-export-stress-json-btn"');
    expect(htmlWithSessions).toContain('Eksport JSON');
    expect(htmlWithSessions).not.toMatch(/id="dash-export-stress-json-btn"[^>]*disabled/);

    const htmlEmpty = renderStressHistoryPanelHtml([]);
    expect(htmlEmpty).toMatch(/id="dash-export-stress-json-btn"[^>]*disabled/);
  });
});

describe('GPU 3D Scene ID x Stability % 2D Heatmap Analysis', () => {
  it('classifies Ray Tracing scenes separately from Rasterization scenes', () => {
    const raymarch = GPU_SCENE_CATALOG.find((s) => s.id === 'raymarching')!;
    const blackhole = GPU_SCENE_CATALOG.find((s) => s.id === 'blackhole_lensing')!;
    const cornell = GPU_SCENE_CATALOG.find((s) => s.id === 'pathtraced_cornell')!;
    const vortex = GPU_SCENE_CATALOG.find((s) => s.id === 'vortex')!;
    const cyberCity = GPU_SCENE_CATALOG.find((s) => s.id === 'cyber_city')!;

    expect(classifyGpuScenePipeline(raymarch)).toBe('ray_tracing');
    expect(classifyGpuScenePipeline(blackhole)).toBe('ray_tracing');
    expect(classifyGpuScenePipeline(cornell)).toBe('ray_tracing');
    expect(classifyGpuScenePipeline(vortex)).toBe('rasterization');
    expect(classifyGpuScenePipeline(cyberCity)).toBe('rasterization');
  });

  it('maps stability percentages to the 5 heatmap bands accurately', () => {
    expect(resolveStabilityBandId(62.4)).toBe('lt75');
    expect(resolveStabilityBandId(74.9)).toBe('lt75');
    expect(resolveStabilityBandId(75.0)).toBe('b75_84');
    expect(resolveStabilityBandId(84.9)).toBe('b75_84');
    expect(resolveStabilityBandId(85.0)).toBe('b85_89');
    expect(resolveStabilityBandId(90.0)).toBe('b90_94');
    expect(resolveStabilityBandId(95.0)).toBe('b95_100');
    expect(resolveStabilityBandId(100)).toBe('b95_100');
  });

  it('detects Ray Tracing vs Rasterization correlation and sorts unstable scenes first', () => {
    const store = new Map<GpuSceneMode, GpuSceneStabilityAccumulator>();

    // Ray Tracing scene with severe stability drops (<75%)
    recordGpuSceneStabilitySample(store, {
      sceneId: 'raymarching',
      stabilityPct: 68,
      fps: 55,
      frameTimeMs: 18.2,
      thermalThrottle: true,
    });
    recordGpuSceneStabilitySample(store, {
      sceneId: 'raymarching',
      stabilityPct: 72,
      fps: 60,
      frameTimeMs: 16.6,
    });
    recordGpuSceneStabilitySample(store, {
      sceneId: 'pathtraced_cornell',
      stabilityPct: 76,
      fps: 74,
      frameTimeMs: 13.5,
    });

    // Rasterization scenes with strong stability (>95%)
    recordGpuSceneStabilitySample(store, {
      sceneId: 'vortex',
      stabilityPct: 97,
      fps: 320,
      frameTimeMs: 3.1,
    });
    recordGpuSceneStabilitySample(store, {
      sceneId: 'cyber_city',
      stabilityPct: 95,
      fps: 245,
      frameTimeMs: 4.1,
    });

    const analysis = buildGpuSceneHeatmapAnalysis(GPU_SCENE_CATALOG, store, 'all', 'tested');
    expect(analysis.testedCount).toBe(4);
    expect(analysis.rows).toHaveLength(4);
    // Worst scene must be sorted first
    expect(analysis.rows[0].sceneId).toBe('raymarching');
    expect(analysis.rows[0].avgStabilityPct).toBe(70);
    expect(analysis.rows[0].bandSharesPct.lt75).toBe(100);
    expect(analysis.worstScene?.sceneId).toBe('raymarching');
    expect(analysis.bestScene?.sceneId).toBe('vortex');

    const rtStat = analysis.pipelineStats.find((p) => p.pipeline === 'ray_tracing')!;
    const rastStat = analysis.pipelineStats.find((p) => p.pipeline === 'rasterization')!;
    expect(rtStat.testedSceneCount).toBe(2);
    expect(rtStat.avgStabilityPct).toBeLessThan(75);
    expect(rastStat.testedSceneCount).toBe(2);
    expect(rastStat.avgStabilityPct).toBeGreaterThanOrEqual(95);
    expect(analysis.correlationInsight).toContain('Ray Tracing');
    expect(analysis.correlationInsight).toContain('raymarching');

    // Pipeline filtering returns only Ray Tracing scenes
    const rtOnly = buildGpuSceneHeatmapAnalysis(GPU_SCENE_CATALOG, store, 'ray_tracing', 'tested');
    expect(rtOnly.rows.every((r) => r.pipeline === 'ray_tracing')).toBe(true);
    expect(rtOnly.rows.map((r) => r.sceneId)).toEqual(['raymarching', 'pathtraced_cornell']);
  });
});
