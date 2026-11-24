import { describe, expect, it } from 'vitest';
import { computeCpuFrequencyStats } from '../cpuFrequencyChart';
import { CpuTelemetryPoint } from '../../types';

const SAMPLE_TELEMETRY: CpuTelemetryPoint[] = [
  { timeSec: 1, loadPct: 35, estClockGHz: 3.42, estTempC: 51, opsPerSec: 420000 },
  { timeSec: 2, loadPct: 98, estClockGHz: 4.15, estTempC: 68, opsPerSec: 1120000 },
  { timeSec: 3, loadPct: 99, estClockGHz: 3.98, estTempC: 75, opsPerSec: 1080000 },
  { timeSec: 4, loadPct: 97, estClockGHz: 3.85, estTempC: 79, opsPerSec: 1020000 },
];

describe('CPU Frequency D3 Chart Statistics', () => {
  it('computes current, average, peak, min GHz and fluctuation delta in MHz accurately', () => {
    const stats = computeCpuFrequencyStats(SAMPLE_TELEMETRY);

    expect(stats.currentGHz).toBe(3.85);
    expect(stats.peakGHz).toBe(4.15);
    expect(stats.minGHz).toBe(3.42);
    expect(stats.avgGHz).toBe(3.85);
    expect(stats.fluctuationMHz).toBe(730);
    expect(stats.sampleCount).toBe(4);
  });

  it('returns clean fallback values when telemetry is empty', () => {
    const stats = computeCpuFrequencyStats([], 3.2);

    expect(stats.currentGHz).toBe(3.2);
    expect(stats.avgGHz).toBe(3.2);
    expect(stats.peakGHz).toBe(3.2);
    expect(stats.minGHz).toBe(3.2);
    expect(stats.fluctuationMHz).toBe(0);
    expect(stats.sampleCount).toBe(0);
  });
});
