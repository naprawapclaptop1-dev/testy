import { describe, it, expect } from 'vitest';
import type { BatteryHealthState, GpuStressMetrics, GpuTelemetryPoint } from '../../types';
import {
  DEFAULT_CRITICAL_HEALTH_THRESHOLD_PCT,
  estimateBatteryEndurance,
  renderBatteryEnduranceEstimatorPanelHtml,
} from '../batteryEnduranceEstimator';
import {
  DEFAULT_GPU_FRAMETIME_THRESHOLD_MS,
  buildGpuStabilityLogPayload,
  buildGpuStabilityPhaseLog,
  detectGpuPhaseAnomalies,
} from '../../services/gpuStabilityLogExport.service';
import {
  evaluateGpuFrameTimeThreshold,
  renderGpuFrameTimeThresholdBadgeHtml,
} from '../gpuStabilityLogChart';

function makeBatteryState(overrides: Partial<BatteryHealthState> = {}): BatteryHealthState {
  const now = 1_760_000_000_000;
  const day = 86_400_000;
  return {
    apiSupported: true,
    charging: false,
    levelPct: 74,
    nativeChargingTimeSec: Infinity,
    nativeDischargingTimeSec: 12_600,
    designCapacityMWh: 60_000,
    fullChargeCapacityMWh: 51_000,
    wearLevelPct: 15,
    healthPct: 85,
    condition: 'DOBRA',
    estimatedCycles: 180,
    currentLoadPct: 30,
    powerThresholdW: 90,
    soundAlertEnabled: false,
    voltageV: 11.4,
    currentPowerDrawW: 15,
    estTempC: 32,
    estimates: [],
    railHistory: [],
    efficiencyTrend1h: [],
    psu: {
      detected: true,
      model: '750W Gold',
      rating80Plus: '80 PLUS Gold',
      rail12V: 12.02,
      rail5V: 5.01,
      rail3P3V: 3.31,
      rippleMv: 14,
      efficiencyPct: 91,
      estimatedWattage: 185,
      tempC: 38,
      status: 'STABILNY',
    },
    criticalPowerAlert: false,
    railAlertEvents: [],
    history: [
      { timestamp: now - 300_000, timeLabel: '10:00', levelPct: 76, powerW: 14 },
      { timestamp: now - 240_000, timeLabel: '10:01', levelPct: 75.5, powerW: 15 },
      { timestamp: now - 180_000, timeLabel: '10:02', levelPct: 75, powerW: 15 },
      { timestamp: now - 120_000, timeLabel: '10:03', levelPct: 74.5, powerW: 15 },
    ],
    powerCycles: [
      {
        id: 'c1',
        cycleNumber: 20,
        timestamp: now - 180 * day,
        dateLabel: '2026-04-01',
        startPct: 100,
        endPct: 20,
        durationMin: 180,
        avgPowerW: 16,
        designCapacityMWh: 60_000,
        fullChargeCapacityMWh: 58_800,
        degradationFromPrevMWh: 1200,
        cumulativeWearPct: 2,
        source: 'auto',
      },
      {
        id: 'c2',
        cycleNumber: 60,
        timestamp: now - 135 * day,
        dateLabel: '2026-05-15',
        startPct: 100,
        endPct: 20,
        durationMin: 175,
        avgPowerW: 17,
        designCapacityMWh: 60_000,
        fullChargeCapacityMWh: 57_000,
        degradationFromPrevMWh: 1800,
        cumulativeWearPct: 5,
        source: 'auto',
      },
      {
        id: 'c3',
        cycleNumber: 100,
        timestamp: now - 90 * day,
        dateLabel: '2026-07-01',
        startPct: 100,
        endPct: 20,
        durationMin: 170,
        avgPowerW: 18,
        designCapacityMWh: 60_000,
        fullChargeCapacityMWh: 55_200,
        degradationFromPrevMWh: 1800,
        cumulativeWearPct: 8,
        source: 'auto',
      },
      {
        id: 'c4',
        cycleNumber: 140,
        timestamp: now - 45 * day,
        dateLabel: '2026-08-15',
        startPct: 100,
        endPct: 20,
        durationMin: 165,
        avgPowerW: 18,
        designCapacityMWh: 60_000,
        fullChargeCapacityMWh: 53_100,
        degradationFromPrevMWh: 2100,
        cumulativeWearPct: 11.5,
        source: 'auto',
      },
      {
        id: 'c5',
        cycleNumber: 175,
        timestamp: now - 5 * day,
        dateLabel: '2026-09-25',
        startPct: 100,
        endPct: 20,
        durationMin: 160,
        avgPowerW: 19,
        designCapacityMWh: 60_000,
        fullChargeCapacityMWh: 51_300,
        degradationFromPrevMWh: 1800,
        cumulativeWearPct: 14.5,
        source: 'auto',
      },
      {
        id: 'c6',
        cycleNumber: 180,
        timestamp: now - 1 * day,
        dateLabel: '2026-09-29',
        startPct: 100,
        endPct: 20,
        durationMin: 158,
        avgPowerW: 19,
        designCapacityMWh: 60_000,
        fullChargeCapacityMWh: 51_000,
        degradationFromPrevMWh: 300,
        cumulativeWearPct: 15,
        source: 'auto',
      },
    ],
    totalCapacityLostMWh: 9000,
    avgDegradationPerCycleMWh: 50,
    projectedCyclesTo80Pct: 60,
    ...overrides,
  };
}

function makeGpuMetrics(
  telemetry: GpuTelemetryPoint[],
  overrides: Partial<GpuStressMetrics> = {}
): GpuStressMetrics {
  return {
    running: false,
    rendererName: 'AMD Radeon RX 7900 XTX',
    isSoftwareGl: false,
    sceneMode: 'raymarching',
    sceneLabel: 'Raymarching SDF 3D',
    workloadNote: 'Shader ALU / RT',
    preset: 'extreme',
    fpsMode: 'uncapped',
    resolution: '4k',
    instanceCount: 24_000,
    triangles: 4_800_000,
    drawCalls: 120,
    elapsedSec: telemetry.length > 0 ? telemetry[telemetry.length - 1].timeSec : 10,
    fps: 110,
    avgFps: 112,
    minFps: 42,
    maxFps: 144,
    low1PctFps: 48,
    frameTimeMs: 9.1,
    totalFramesRendered: 1120,
    stabilityPct: 86.5,
    overallScore: 94,
    verdict: 'LEKKI SPADEK',
    estTempC: 78,
    peakTempC: 83,
    coreClockMhz: 2350,
    allocatedVramMB: 1024,
    textureVramMB: 512,
    thermalThrottleActive: false,
    thermalThrottleRecent60s: true,
    telemetry,
    ...overrides,
  };
}

describe('Battery Endurance Estimator & D3.js degradation trend', () => {
  it('correlates high/rising power draw with faster degradation and shorter time to critical health (<70%)', () => {
    const now = 1_760_000_000_000;
    const nominalBat = makeBatteryState({ currentPowerDrawW: 14, estTempC: 31 });
    const heavyBat = makeBatteryState({
      currentPowerDrawW: 62,
      estTempC: 44,
      history: [
        { timestamp: now - 300_000, timeLabel: '10:00', levelPct: 76, powerW: 32 },
        { timestamp: now - 240_000, timeLabel: '10:01', levelPct: 75, powerW: 45 },
        { timestamp: now - 180_000, timeLabel: '10:02', levelPct: 74, powerW: 56 },
        { timestamp: now - 120_000, timeLabel: '10:03', levelPct: 73, powerW: 64 },
      ],
    });

    const estNominal = estimateBatteryEndurance(nominalBat, { nowMs: now });
    const estHeavy = estimateBatteryEndurance(heavyBat, { nowMs: now });

    expect(estNominal.criticalHealthThresholdPct).toBe(DEFAULT_CRITICAL_HEALTH_THRESHOLD_PCT);
    expect(estNominal.confidence).toBe('high');
    expect(estHeavy.powerTrendDirection).toBe('rising');
    expect(estHeavy.powerStressFactor).toBeGreaterThan(estNominal.powerStressFactor);
    expect(estHeavy.correlatedMonthlyDegradationPct).toBeGreaterThan(
      estNominal.correlatedMonthlyDegradationPct
    );
    expect(estHeavy.estimatedDaysToCritical).toBeLessThan(estNominal.estimatedDaysToCritical);
    expect(estHeavy.powerTrendImpactDays).toBeLessThan(0);

    // Historical & forecast series continuity
    expect(estNominal.historicalPoints.length).toBeGreaterThanOrEqual(6);
    expect(estNominal.forecastPoints.length).toBe(5);
    expect(estNominal.forecastPoints[estNominal.forecastPoints.length - 1].healthPct).toBe(70);
    expect(estNominal.forecastPoints[estNominal.forecastPoints.length - 1].isCriticalTarget).toBe(
      true
    );
  });

  it('flags alreadyCritical when battery health is at or below threshold and supports custom thresholds', () => {
    const now = 1_760_000_000_000;
    const wornBat = makeBatteryState({
      healthPct: 68.5,
      fullChargeCapacityMWh: 41_100,
      wearLevelPct: 31.5,
    });

    const est70 = estimateBatteryEndurance(wornBat, {
      criticalHealthThresholdPct: 70,
      nowMs: now,
    });
    expect(est70.alreadyCritical).toBe(true);
    expect(est70.urgency).toBe('critical');
    expect(est70.estimatedDaysToCritical).toBe(0);
    expect(est70.estimatedCyclesToCritical).toBe(0);

    const est60 = estimateBatteryEndurance(wornBat, {
      criticalHealthThresholdPct: 60,
      nowMs: now,
    });
    expect(est60.alreadyCritical).toBe(false);
    expect(est60.remainingHealthMarginPct).toBeCloseTo(8.5, 1);
    expect(est60.estimatedDaysToCritical).toBeGreaterThan(0);
    expect(est60.forecastPoints[est60.forecastPoints.length - 1].healthPct).toBe(60);
  });

  it('renders panel HTML with critical threshold controls and D3.js chart container', () => {
    const est = estimateBatteryEndurance(makeBatteryState(), { nowMs: 1_760_000_000_000 });
    const html = renderBatteryEnduranceEstimatorPanelHtml(est);
    expect(html).toContain('id="bat-endurance-estimator-panel"');
    expect(html).toContain('id="bat-endurance-degradation-d3-chart"');
    expect(html).toContain('data-bat-endurance-threshold="60"');
    expect(html).toContain('data-bat-endurance-threshold="70"');
    expect(html).toContain('data-bat-endurance-threshold="75"');
    expect(html).toContain('data-bat-endurance-threshold="80"');
    expect(html).toContain('Battery Endurance Estimator');
  });
});

describe('GPU Stability Log JSON Export & Visual Frame-Time Threshold Indicator', () => {
  const sampleTelemetry: GpuTelemetryPoint[] = [
    {
      timeSec: 1,
      fps: 120,
      frameTimeMs: 8.33,
      stabilityPct: 98,
      estTempC: 64,
      allocatedVramMB: 512,
      textureVramMB: 256,
      coreClockMhz: 2450,
      thermalThrottle: false,
    },
    {
      timeSec: 2,
      fps: 115,
      frameTimeMs: 8.7,
      stabilityPct: 96,
      estTempC: 69,
      allocatedVramMB: 512,
      textureVramMB: 256,
      coreClockMhz: 2440,
      thermalThrottle: false,
    },
    {
      timeSec: 3,
      fps: 42,
      frameTimeMs: 23.8,
      stabilityPct: 79,
      estTempC: 76,
      allocatedVramMB: 512,
      textureVramMB: 256,
      coreClockMhz: 2380,
      thermalThrottle: false,
    },
    {
      timeSec: 4,
      fps: 26,
      frameTimeMs: 38.4,
      stabilityPct: 68,
      estTempC: 83.5,
      allocatedVramMB: 512,
      textureVramMB: 256,
      coreClockMhz: 1920,
      thermalThrottle: true,
    },
    {
      timeSec: 5,
      fps: 108,
      frameTimeMs: 9.26,
      stabilityPct: 91,
      estTempC: 77,
      allocatedVramMB: 512,
      textureVramMB: 256,
      coreClockMhz: 2320,
      thermalThrottle: false,
    },
  ];

  it('captures frame-time spikes (>20ms) and thermal throttling events per phase and builds structured JSON payload', () => {
    const detected = detectGpuPhaseAnomalies(sampleTelemetry, {
      frameTimeThresholdMs: DEFAULT_GPU_FRAMETIME_THRESHOLD_MS,
      phaseStartTimestampMs: 1_760_000_000_000,
    });

    expect(detected.frameTimeSpikes.length).toBe(2);
    expect(detected.frameTimeSpikes[0].frameTimeMs).toBe(23.8);
    expect(detected.frameTimeSpikes[0].excessMs).toBeCloseTo(3.8, 1);
    expect(detected.frameTimeSpikes[1].frameTimeMs).toBe(38.4);
    expect(detected.frameTimeSpikes[1].severity).toBe('stutter');

    expect(detected.thermalThrottlingEvents.length).toBe(2);
    expect(detected.thermalThrottlingEvents[0].gpuTempC).toBe(76);
    expect(detected.thermalThrottlingEvents[0].reason).toContain('FPS dropped');
    expect(detected.thermalThrottlingEvents[1].gpuTempC).toBe(83.5);
    expect(detected.thermalThrottlingEvents[1].reason).toContain('>= 80°C');
    expect(detected.maxFrameTimeMs).toBe(38.4);

    const phase1 = buildGpuStabilityPhaseLog({
      phaseIndex: 1,
      runType: 'auto_suite',
      metrics: makeGpuMetrics(sampleTelemetry),
      sceneName: 'Raymarching SDF 3D',
      targetUnit: 'Shader ALU / RT',
      resolution: '4k',
      frameTimeThresholdMs: 20,
      startedAtMs: 1_760_000_000_000,
      endedAtMs: 1_760_000_005_000,
    });

    const phase2 = buildGpuStabilityPhaseLog({
      phaseIndex: 2,
      runType: 'scheduled_queue',
      metrics: makeGpuMetrics(sampleTelemetry.slice(0, 2), {
        sceneMode: 'fractal_julia4d',
        stabilityPct: 97.2,
        peakTempC: 69,
        thermalThrottleRecent60s: false,
        verdict: 'STABILNY',
      }),
      sceneName: 'Julia 4D Fractal',
      targetUnit: 'FP32 Compute',
      resolution: '2k',
      frameTimeThresholdMs: 20,
      startedAtMs: 1_760_000_010_000,
      endedAtMs: 1_760_000_012_000,
    });

    const payload = buildGpuStabilityLogPayload([phase1, phase2], {
      rendererName: 'AMD Radeon RX 7900 XTX',
      isSoftwareGl: false,
      frameTimeThresholdMs: 20,
    });

    expect(payload.schemaVersion).toBe('1.0.0');
    expect(payload.exportType).toBe('gpu_stability_log');
    expect(payload.summary.totalPhases).toBe(2);
    expect(payload.summary.totalFrameTimeSpikes).toBe(2);
    expect(payload.summary.totalThermalThrottlingEvents).toBe(2);
    expect(payload.summary.phasesWithSpikes).toBe(1);
    expect(payload.summary.phasesWithThrottling).toBe(1);
    expect(payload.summary.maxFrameTimeMs).toBe(38.4);
    expect(payload.phases[0].runType).toBe('auto_suite');
    expect(payload.phases[1].runType).toBe('scheduled_queue');
    expect(payload.phases[0].frameTimeSpikes.length).toBe(2);
    expect(payload.phases[0].thermalThrottlingEvents.length).toBe(2);
  });

  it('transitions visual frame-time threshold indicator between idle, ok, warning, and breach states', () => {
    const idleState = evaluateGpuFrameTimeThreshold([], 20, false);
    expect(idleState.status).toBe('idle');

    const okPoints = sampleTelemetry.slice(0, 2);
    const okState = evaluateGpuFrameTimeThreshold(okPoints, 20, true);
    expect(okState.status).toBe('ok');
    expect(okState.exceededCount).toBe(0);
    expect(renderGpuFrameTimeThresholdBadgeHtml(okState, true)).toContain('is-ok');

    // Warning: one moderate past spike (>20ms), latest sample is back under threshold, <20% breach ratio
    const warningPoints: GpuTelemetryPoint[] = [
      ...Array.from({ length: 8 }, (_, idx) => ({
        timeSec: idx + 1,
        fps: 110,
        frameTimeMs: 9.1,
        stabilityPct: 96,
        estTempC: 68,
        allocatedVramMB: 512,
        textureVramMB: 256,
        coreClockMhz: 2400,
        thermalThrottle: false,
      })),
      {
        timeSec: 9,
        fps: 46,
        frameTimeMs: 21.7,
        stabilityPct: 82,
        estTempC: 72,
        allocatedVramMB: 512,
        textureVramMB: 256,
        coreClockMhz: 2380,
        thermalThrottle: false,
      },
      {
        timeSec: 10,
        fps: 108,
        frameTimeMs: 9.3,
        stabilityPct: 94,
        estTempC: 70,
        allocatedVramMB: 512,
        textureVramMB: 256,
        coreClockMhz: 2400,
        thermalThrottle: false,
      },
    ];
    const warnState = evaluateGpuFrameTimeThreshold(warningPoints, 20, true);
    expect(warnState.status).toBe('warning');
    expect(warnState.exceededCount).toBe(1);
    expect(renderGpuFrameTimeThresholdBadgeHtml(warnState, true)).toContain('is-warning');

    // Breach: current frame time exceeds > 20ms while live
    const breachPoints = sampleTelemetry.slice(0, 4);
    const breachState = evaluateGpuFrameTimeThreshold(breachPoints, 20, true);
    expect(breachState.status).toBe('breach');
    expect(breachState.isCurrentExceeded).toBe(true);
    const badgeHtml = renderGpuFrameTimeThresholdBadgeHtml(breachState, true);
    expect(badgeHtml).toContain('is-breach');
    expect(badgeHtml).toContain('is-live-pulse');
    expect(badgeHtml).toContain('data-gpu-ft-threshold-status="breach"');
  });
});
