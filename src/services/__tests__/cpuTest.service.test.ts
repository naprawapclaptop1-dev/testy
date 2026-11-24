import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CpuTestService,
  computeCpuMetricsSummary,
} from '../cpuTest.service';

describe('computeCpuMetricsSummary', () => {
  it('computes single-core, multi-core, scaling ratio, MFLOPS, stability, and WZOROWY grade accurately', () => {
    // 2200 * 260 = 572_000 single-core ops/s -> singleCoreScore = 2200
    // 11000 * 260 = 2_860_000 multi-core ops/s -> multiCoreScore = 11000
    const summary = computeCpuMetricsSummary({
      avgSingleCoreOps: 572_000,
      multiCoreRates: [2_860_000, 2_860_000, 2_860_000, 2_860_000],
      compressionMBs: 140,
      cryptoSha256MBs: 280,
    });

    expect(summary.singleCoreScore).toBe(2200);
    expect(summary.multiCoreScore).toBe(11000);
    expect(summary.scalingRatio).toBe(5);
    expect(summary.mathMflops).toBe(Math.round(2_860_000 / 1200));
    expect(summary.stabilityPct).toBe(100);
    expect(summary.throttlingPct).toBe(0);
    expect(summary.overallScore).toBe(100);
    expect(summary.grade).toBe('WZOROWY');
  });

  it('detects throttling accurately when multi-core throughput drops across passes', () => {
    const summary = computeCpuMetricsSummary({
      avgSingleCoreOps: 260_000, // SC = 1000
      multiCoreRates: [1_000_000, 900_000, 800_000, 750_000], // min/max = 0.75 -> 75% stability, 25% throttling
      compressionMBs: 70,
      cryptoSha256MBs: 140,
    });

    expect(summary.singleCoreScore).toBe(1000);
    expect(summary.stabilityPct).toBe(75);
    expect(summary.throttlingPct).toBe(25);
    expect(summary.overallScore).toBe(41);
    expect(summary.grade).toBe('NISKI');
  });

  it('enforces minimum score floors (singleCore >= 100, multiCore >= singleCore, overallScore >= 18)', () => {
    const summary = computeCpuMetricsSummary({
      avgSingleCoreOps: 100, // tiny -> clamped to 100
      multiCoreRates: [50], // smaller than SC -> clamped to SC
      compressionMBs: 1,
      cryptoSha256MBs: 1,
    });

    expect(summary.singleCoreScore).toBe(100);
    expect(summary.multiCoreScore).toBe(100);
    expect(summary.scalingRatio).toBe(1);
    expect(summary.overallScore).toBe(18);
    expect(summary.grade).toBe('NISKI');
  });

  it('assigns all four grade tiers accurately across score boundaries', () => {
    const wzorowy = computeCpuMetricsSummary({
      avgSingleCoreOps: 520_000,
      multiCoreRates: [2_600_000],
      compressionMBs: 120,
      cryptoSha256MBs: 240,
    });
    const dobry = computeCpuMetricsSummary({
      avgSingleCoreOps: 364_000, // SC 1400 -> norm 63.6
      multiCoreRates: [1_820_000], // MC 7000 -> norm 63.6
      compressionMBs: 95, // norm 67.8
      cryptoSha256MBs: 190, // norm 67.8
    });
    const sredni = computeCpuMetricsSummary({
      avgSingleCoreOps: 260_000, // SC 1000 -> norm 45.45
      multiCoreRates: [1_300_000], // MC 5000 -> norm 45.45
      compressionMBs: 70, // norm 50
      cryptoSha256MBs: 140, // norm 50
    });
    const niski = computeCpuMetricsSummary({
      avgSingleCoreOps: 100_000,
      multiCoreRates: [400_000],
      compressionMBs: 20,
      cryptoSha256MBs: 30,
    });

    expect(wzorowy.grade).toBe('WZOROWY');
    expect(dobry.grade).toBe('DOBRY');
    expect(sredni.grade).toBe('ŚREDNI');
    expect(niski.grade).toBe('NISKI');
  });

  it('falls back to avgSingleCoreOps when multiCoreRates is empty', () => {
    const summary = computeCpuMetricsSummary({
      avgSingleCoreOps: 260_000,
      multiCoreRates: [],
      compressionMBs: 50,
      cryptoSha256MBs: 100,
    });

    expect(summary.singleCoreScore).toBe(1000);
    expect(summary.multiCoreScore).toBe(1000);
    expect(summary.scalingRatio).toBe(1);
    expect(summary.stabilityPct).toBe(100);
    expect(summary.throttlingPct).toBe(0);
  });
});

describe('CpuTestService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('creates a clean idle initial state with positive logical thread count', () => {
    const service = new CpuTestService();
    const initial = service.createInitialState();

    expect(initial.status).toBe('idle');
    expect(initial.progress).toBe(0);
    expect(initial.coresUsed).toBeGreaterThanOrEqual(2);
    expect(initial.singleCoreScore).toBe(0);
    expect(initial.multiCoreScore).toBe(0);
    expect(initial.telemetry).toEqual([]);
  });

  it('executes runFullBenchmark end-to-end with mocked Web Workers and returns consistent metrics', async () => {
    class MockWorker {
      public onmessage: ((ev: MessageEvent) => void) | null = null;
      public onerror: ((ev: ErrorEvent) => void) | null = null;

      public postMessage(data: { mode: string; durationMs: number }): void {
        queueMicrotask(() => {
          this.onmessage?.({
            data: {
              ops: data.mode === 'math' ? 130_000 : 90_000,
              elapsedMs: 500, // 260_000 ops/sec per worker
              checksum: 42,
            },
          } as MessageEvent);
        });
      }

      public terminate(): void {
        // No-op in mock
      }
    }

    vi.stubGlobal('Worker', MockWorker);
    vi.stubGlobal('navigator', { hardwareConcurrency: 4 });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-cpu-worker');

    const service = new CpuTestService();
    const progressUpdates: number[] = [];

    const result = await service.runFullBenchmark((state) => {
      progressUpdates.push(state.progress);
    });

    expect(result.status).toBe('completed');
    expect(result.progress).toBe(100);
    expect(result.coresUsed).toBe(4);
    expect(result.singleCoreScore).toBe(1000);
    expect(result.multiCoreScore).toBe(4000);
    expect(result.scalingRatio).toBe(4);
    expect(result.stabilityPct).toBe(100);
    expect(result.throttlingPct).toBe(0);
    expect(result.compressionMBs).toBeGreaterThan(0);
    expect(result.cryptoSha256MBs).toBeGreaterThan(0);
    expect(result.telemetry.length).toBeGreaterThanOrEqual(6);
    expect(progressUpdates[progressUpdates.length - 1]).toBe(100);
    expect(service.getCurrentLoadPct()).toBe(10);
  });

  it('resets load to idle baseline on stopStress()', () => {
    const service = new CpuTestService();
    service.stopStress();
    expect(service.getCurrentLoadPct()).toBe(10);
  });
});
