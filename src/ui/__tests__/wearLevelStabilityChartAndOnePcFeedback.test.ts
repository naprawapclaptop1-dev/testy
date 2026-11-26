import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildBatteryWearLevelTrendSeries } from '../charts';
import {
  computeFrameTimeSeriesDiagnostics,
  evaluateGpuFrameTimeThreshold,
  flattenStabilityPhasesToTelemetry,
  renderGpuFrameTimeColorAlertBarHtml,
  renderGpuFrameTimeThresholdBadgeHtml,
} from '../gpuStabilityLogChart';
import {
  addFeedbackEntry,
  computePcHardwareFingerprint,
  hasCurrentPcSubmittedFeedback,
  hasCurrentPcSubmittedRating,
  loadAppRatingState,
  loadFeedbackEntries,
  renderCopyrightAndFeedbackSectionHtml,
  saveUserAppRating,
} from '../copyrightAndFeedbackPanel';
import type { BatteryPowerCycleEntry, GpuTelemetryPoint } from '../../types';
import {
  GPU_FRAMETIME_THRESHOLD_PRESETS_MS,
  loadGpuFrameTimeThresholdMs,
  saveGpuFrameTimeThresholdMs,
  type GpuStabilityPhaseLog,
} from '../../services/gpuStabilityLogExport.service';

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? (store.get(key) as string) : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };
}

function makePowerCycle(
  cycleNumber: number,
  daysAgo: number,
  fullChargeCapacityMWh: number,
  cumulativeWearPct: number,
  designCapacityMWh = 56000
): BatteryPowerCycleEntry {
  const ts = Date.now() - daysAgo * 86_400_000;
  return {
    id: `cyc_${cycleNumber}`,
    cycleNumber,
    timestamp: ts,
    dateLabel: new Date(ts).toLocaleDateString('pl-PL'),
    startPct: 20,
    endPct: 95,
    durationMin: 68,
    avgPowerW: 18,
    fullChargeCapacityMWh,
    designCapacityMWh,
    degradationFromPrevMWh: -140,
    cumulativeWearPct,
    source: 'auto',
  };
}

function makeTelemetryPoint(
  timeSec: number,
  frameTimeMs: number,
  estTempC = 66,
  thermalThrottle = false
): GpuTelemetryPoint {
  return {
    timeSec,
    fps: frameTimeMs > 0 ? Number((1000 / frameTimeMs).toFixed(1)) : 60,
    frameTimeMs,
    stabilityPct: frameTimeMs > 20 ? 72 : 96,
    estTempC,
    allocatedVramMB: 4096,
    textureVramMB: 2100,
    coreClockMhz: thermalThrottle ? 1420 : 2150,
    thermalThrottle,
  };
}

describe('Battery Wear Level Trend Chart (powerCycles)', () => {
  it('handles empty powerCycles gracefully', () => {
    const summary = buildBatteryWearLevelTrendSeries([]);
    expect(summary.points).toHaveLength(0);
    expect(summary.firstWearPct).toBe(0);
    expect(summary.latestWearPct).toBe(0);
    expect(summary.wearIncreasePct).toBe(0);
    expect(summary.wearRatePctPerMonth).toBe(0);
  });

  it('sorts powerCycles chronologically and computes wear increase, health%, and OLS monthly rate', () => {
    // Deliberately pass out-of-order entries spanning 90 days (wear grows from 4% to 13%)
    const cycles: BatteryPowerCycleEntry[] = [
      makePowerCycle(65, 30, 50400, 10.0),
      makePowerCycle(20, 90, 53760, 4.0),
      makePowerCycle(90, 0, 48720, 13.0),
      makePowerCycle(45, 60, 52080, 7.0),
    ];

    const summary = buildBatteryWearLevelTrendSeries(cycles);
    expect(summary.points.map((p) => p.cycleNumber)).toEqual([20, 45, 65, 90]);
    expect(summary.firstWearPct).toBe(4.0);
    expect(summary.latestWearPct).toBe(13.0);
    expect(summary.wearIncreasePct).toBe(9.0);
    expect(summary.points[0].healthPct).toBe(96.0);
    expect(summary.points[3].healthPct).toBe(87.0);
    expect(summary.spanDays).toBeGreaterThanOrEqual(89);
    // ~9% over 90 days => ~3.04% per month
    expect(summary.wearRatePctPerMonth).toBeGreaterThan(2.5);
    expect(summary.wearRatePctPerMonth).toBeLessThan(3.5);
    expect(summary.trendEndWearPct).toBeGreaterThan(summary.trendStartWearPct);
  });

  it('derives wearLevelPct from design/full capacity when cumulativeWearPct is missing or negative', () => {
    const cycle = makePowerCycle(10, 10, 44800, -1, 56000);
    const summary = buildBatteryWearLevelTrendSeries([cycle]);
    expect(summary.points).toHaveLength(1);
    expect(summary.points[0].wearLevelPct).toBe(20);
    expect(summary.points[0].healthPct).toBe(80);
  });
});

describe('GPU Stability Log D3.js Frame-Time Line Chart Diagnostics', () => {
  it('computes rolling averages and identifies stutter spikes and thermal throttling', () => {
    const pts: GpuTelemetryPoint[] = [
      makeTelemetryPoint(1, 10.0),
      makeTelemetryPoint(2, 10.2),
      makeTelemetryPoint(3, 10.1),
      makeTelemetryPoint(4, 28.5, 84, true), // > 1.55x rolling avg (~10.1ms) AND > 20ms threshold AND thermal throttle
      makeTelemetryPoint(5, 10.4),
      makeTelemetryPoint(6, 10.3),
    ];

    const diags = computeFrameTimeSeriesDiagnostics(pts, 20);
    expect(diags).toHaveLength(6);
    expect(diags[3].exceedsThreshold).toBe(true);
    expect(diags[3].isStutter).toBe(true);
    expect(diags[3].isThermalThrottle).toBe(true);
    expect(diags[3].spikeMultiplier).toBeGreaterThan(2.5);

    const status = evaluateGpuFrameTimeThreshold(pts, 20, true);
    expect(status.exceededCount).toBe(1);
    expect(status.stutterCount).toBe(1);
    expect(status.thermalThrottleCount).toBe(1);
    expect(status.p99FrameTimeMs).toBeGreaterThanOrEqual(10.4);
    expect(status.status).toBe('warning');
    expect(renderGpuFrameTimeThresholdBadgeHtml(status, true)).toContain('data-gpu-ft-stutter-count="1"');
  });

  it('flattens multiple Stability Log phases into continuous timeline with vertical phase boundaries', () => {
    const phases: GpuStabilityPhaseLog[] = [
      {
        phaseIndex: 1,
        phaseId: 'phase_1',
        sceneId: 'vortex',
        sceneName: 'Vortex 3D',
        targetUnit: 'Shader Core',
        resolution: '2k',
        preset: 'high',
        fpsMode: 'uncapped',
        runType: 'auto_suite',
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        durationSec: 4,
        metrics: {
          avgFps: 90,
          minFps: 75,
          maxFps: 100,
          low1PctFps: 78,
          avgFrameTimeMs: 11.1,
          p95FrameTimeMs: 13.5,
          p99FrameTimeMs: 14.0,
          maxFrameTimeMs: 14.0,
          stabilityPct: 95,
          overallScore: 95,
          verdict: 'STABILNY',
          totalFramesRendered: 360,
          peakGpuTempC: 70,
          avgGpuTempC: 69,
          minCoreClockMhz: 2100,
          maxCoreClockMhz: 2200,
        },
        frameTimeThresholdMs: 20,
        frameTimeSpikeCount: 0,
        frameTimeSpikes: [],
        thermalThrottlingCount: 0,
        thermalThrottlingEvents: [],
        telemetrySamples: [
          { timeSec: 1, fps: 95, frameTimeMs: 10.5, stabilityPct: 97, gpuTempC: 68, coreClockMhz: 2150, thermalThrottle: false, exceedsFrameTimeThreshold: false },
          { timeSec: 3, fps: 90, frameTimeMs: 11.1, stabilityPct: 96, gpuTempC: 70, coreClockMhz: 2140, thermalThrottle: false, exceedsFrameTimeThreshold: false },
        ],
      },
      {
        phaseIndex: 2,
        phaseId: 'phase_2',
        sceneId: 'raymarching',
        sceneName: 'Raymarch RT',
        targetUnit: 'Ray Tracing',
        resolution: '4k',
        preset: 'extreme',
        fpsMode: 'uncapped',
        runType: 'auto_suite',
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        durationSec: 4,
        metrics: {
          avgFps: 45,
          minFps: 24,
          maxFps: 60,
          low1PctFps: 26,
          avgFrameTimeMs: 22.0,
          p95FrameTimeMs: 38.0,
          p99FrameTimeMs: 41.2,
          maxFrameTimeMs: 41.2,
          stabilityPct: 71,
          overallScore: 72,
          verdict: 'THROTTLING / PRZECIĄŻENIE',
          totalFramesRendered: 180,
          peakGpuTempC: 85,
          avgGpuTempC: 81.5,
          minCoreClockMhz: 1450,
          maxCoreClockMhz: 2100,
        },
        frameTimeThresholdMs: 20,
        frameTimeSpikeCount: 1,
        frameTimeSpikes: [],
        thermalThrottlingCount: 1,
        thermalThrottlingEvents: [],
        telemetrySamples: [
          { timeSec: 1, fps: 55, frameTimeMs: 18.2, stabilityPct: 86, gpuTempC: 78, coreClockMhz: 2050, thermalThrottle: false, exceedsFrameTimeThreshold: false },
          { timeSec: 3, fps: 24, frameTimeMs: 41.2, stabilityPct: 68, gpuTempC: 85, coreClockMhz: 1450, thermalThrottle: true, exceedsFrameTimeThreshold: true },
        ],
      },
    ];

    const flattened = flattenStabilityPhasesToTelemetry(phases);
    expect(flattened.points).toHaveLength(4);
    expect(flattened.phaseBoundaries).toHaveLength(1);
    expect(flattened.phaseBoundaries[0].label).toContain('Faza #2');
    expect(flattened.points[3].timeSec).toBeGreaterThan(flattened.points[1].timeSec);

    const status = evaluateGpuFrameTimeThreshold(flattened.points, 20, false);
    expect(status.status).toBe('breach');
    expect(status.exceededCount).toBe(1);
    expect(status.stutterCount).toBeGreaterThanOrEqual(1);
    expect(status.thermalThrottleCount).toBe(1);
  });
});

describe('1-PC-1-Opinion & 1-PC-1-Rating Enforcement', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('computes deterministic PC hardware fingerprints for identical seeds and distinct ones for different PCs', () => {
    const fpA1 = computePcHardwareFingerprint({
      gpuRenderer: 'AMD Radeon RX 7900 XTX',
      os: 'Windows 11',
      cpuCores: 32,
    });
    const fpA2 = computePcHardwareFingerprint({
      gpuRenderer: 'AMD Radeon RX 7900 XTX',
      os: 'Windows 11',
      cpuCores: 32,
    });
    const fpB = computePcHardwareFingerprint({
      gpuRenderer: 'NVIDIA GeForce RTX 4090',
      os: 'Windows 11',
      cpuCores: 24,
    });

    expect(fpA1).toMatch(/^PC-[0-9A-F]{8}$/);
    expect(fpA1).toBe(fpA2);
    expect(fpA1).not.toBe(fpB);
  });

  it('allows only one feedback opinion per PC fingerprint and blocks duplicates', () => {
    const pcA = 'PC-AAAA1111';
    const pcB = 'PC-BBBB2222';

    expect(hasCurrentPcSubmittedFeedback(pcA)).toBe(false);

    const first = addFeedbackEntry('feature', 'Świetne testy 3D i stabilności!', 'Marek', 5, pcA);
    expect(first.ok).toBe(true);
    expect(first.alreadySubmitted).toBe(false);
    expect(hasCurrentPcSubmittedFeedback(pcA)).toBe(true);
    expect(loadFeedbackEntries()).toHaveLength(1);

    // Second attempt from the same PC MUST be rejected
    const duplicate = addFeedbackEntry('bug', 'Druga opinia z tego samego PC', 'Marek2', 4, pcA);
    expect(duplicate.ok).toBe(false);
    expect(duplicate.alreadySubmitted).toBe(true);
    expect(duplicate.existingRecord?.message).toBe('Świetne testy 3D i stabilności!');
    expect(loadFeedbackEntries()).toHaveLength(1);

    // A different PC fingerprint IS allowed to add its own single opinion
    const secondPc = addFeedbackEntry('game', 'Dodajcie więcej scen RT 8K', 'Anna', 5, pcB);
    expect(secondPc.ok).toBe(true);
    expect(loadFeedbackEntries()).toHaveLength(2);
  });

  it('allows only one star rating vote per PC fingerprint', () => {
    const pcA = 'PC-CCCC3333';
    const before = loadAppRatingState();
    expect(hasCurrentPcSubmittedRating(pcA)).toBe(false);

    const firstVote = saveUserAppRating(5, pcA);
    expect(firstVote.ok).toBe(true);
    expect(firstVote.state.totalVotes).toBe(before.totalVotes + 1);
    expect(hasCurrentPcSubmittedRating(pcA)).toBe(true);

    const duplicateVote = saveUserAppRating(2, pcA);
    expect(duplicateVote.ok).toBe(false);
    expect(duplicateVote.alreadySubmitted).toBe(true);
    expect(duplicateVote.state.totalVotes).toBe(before.totalVotes + 1);
  });

  it('renders locked feedback form with PC lock banner after current PC submits an opinion', () => {
    const pcA = 'PC-DDDD4444';

    const unlockedHtml = renderCopyrightAndFeedbackSectionHtml(pcA);
    expect(unlockedHtml).toContain('data-feedback-pc-locked="false"');
    expect(unlockedHtml).not.toContain('sp-feedback-pc-lock-banner');
    expect(unlockedHtml).toContain('Wyślij i zapisz opinię / zgłoszenie');

    addFeedbackEntry('measurement', 'Dokładne odczyty baterii', 'Krzysztof', 5, pcA);

    const lockedHtml = renderCopyrightAndFeedbackSectionHtml(pcA);
    expect(lockedHtml).toContain('data-feedback-pc-locked="true"');
    expect(lockedHtml).toContain('sp-feedback-pc-lock-banner');
    expect(lockedHtml).toContain(pcA);
    expect(lockedHtml).toContain('Opinia z tego PC już dodana (limit 1/PC)');
  });
});

describe('Custom GPU Frame-Time Threshold & Approaching-Limit Pulse Indicator', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('persists custom frame-time thresholds and includes 16ms, 20ms, 33ms presets', () => {
    expect(GPU_FRAMETIME_THRESHOLD_PRESETS_MS).toContain(16);
    expect(GPU_FRAMETIME_THRESHOLD_PRESETS_MS).toContain(20);
    expect(GPU_FRAMETIME_THRESHOLD_PRESETS_MS).toContain(33);

    expect(loadGpuFrameTimeThresholdMs()).toBe(20);
    saveGpuFrameTimeThresholdMs(16);
    expect(loadGpuFrameTimeThresholdMs()).toBe(16);
    saveGpuFrameTimeThresholdMs(33);
    expect(loadGpuFrameTimeThresholdMs()).toBe(33);
    // Clamps out-of-range inputs cleanly
    expect(saveGpuFrameTimeThresholdMs(2)).toBe(8);
    expect(saveGpuFrameTimeThresholdMs(250)).toBe(100);
  });

  it('triggers approaching-limit pulse animation when current frame time is 80%-100% of custom threshold and switches severity by threshold', () => {
    const pts: GpuTelemetryPoint[] = [
      makeTelemetryPoint(1, 14.0),
      makeTelemetryPoint(2, 15.5),
      makeTelemetryPoint(3, 18.5),
    ];

    // Against 16ms threshold -> 18.5ms is a breach
    const at16 = evaluateGpuFrameTimeThreshold(pts, 16, true);
    expect(at16.status).toBe('breach');
    expect(at16.isCurrentExceeded).toBe(true);
    expect(renderGpuFrameTimeThresholdBadgeHtml(at16, true)).toContain('is-live-pulse');

    // Against 20ms threshold -> 18.5ms is 92.5% (>= 80% = 16.0ms) -> approaching-limit pulse!
    const at20 = evaluateGpuFrameTimeThreshold(pts, 20, true);
    expect(at20.status).toBe('approaching');
    expect(at20.isApproachingLimit).toBe(true);
    expect(at20.approachingThresholdMs).toBe(16);
    expect(at20.proximityPct).toBe(93);

    const badgeHtml = renderGpuFrameTimeThresholdBadgeHtml(at20, true);
    expect(badgeHtml).toContain('is-approaching');
    expect(badgeHtml).toContain('is-approaching-pulse');
    expect(badgeHtml).toContain('data-gpu-ft-approaching="true"');

    const alertBarHtml = renderGpuFrameTimeColorAlertBarHtml(at20, true);
    expect(alertBarHtml).toContain('data-gpu-ft-color-alert="approaching"');
    expect(alertBarHtml).toContain('is-approaching-pulse');

    // Against 33ms threshold -> 18.5ms is 56% -> OK (not approaching, not breached)
    const at33 = evaluateGpuFrameTimeThreshold(pts, 33, true);
    expect(at33.status).toBe('ok');
    expect(at33.isApproachingLimit).toBe(false);
    expect(renderGpuFrameTimeThresholdBadgeHtml(at33, true)).not.toContain('is-approaching-pulse');
  });
});

