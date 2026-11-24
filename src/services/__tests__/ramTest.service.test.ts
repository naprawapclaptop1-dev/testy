import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  RamTestService,
  computeRamSummaryMetrics,
} from '../ramTest.service';

describe('computeRamSummaryMetrics', () => {
  it('computes WZOROWY grade and maximum score for high bandwidth, low latency, and 0 errors', () => {
    const summary = computeRamSummaryMetrics({
      bandwidthReadMBs: 10_000,
      bandwidthWriteMBs: 9_500,
      latencyNs: 10,
      errorsFound: 0,
    });

    expect(summary.overallScore).toBe(100);
    expect(summary.healthGrade).toBe('WZOROWY');
    expect(summary.summaryMessage).toContain('0 błędów');
  });

  it('assigns DOBRY grade when 0 errors are found but throughput/latency produce score below 60', () => {
    // avgBw = 1800 -> bwScore = 20 (*0.6 = 12)
    // latencyNs = 65 -> latScore = 24 (*0.4 = 9.6) -> overall = 22
    const summary = computeRamSummaryMetrics({
      bandwidthReadMBs: 2000,
      bandwidthWriteMBs: 1600,
      latencyNs: 65,
      errorsFound: 0,
    });

    expect(summary.overallScore).toBe(22);
    expect(summary.healthGrade).toBe('DOBRY');
  });

  it('applies error penalty and assigns UWAGA grade for 1 to 4 memory errors', () => {
    // bwScore = 100, latScore = 100 -> base = 100
    // 2 errors -> penalty = 25 + 2*5 = 35 -> overall = 65
    const summary = computeRamSummaryMetrics({
      bandwidthReadMBs: 9500,
      bandwidthWriteMBs: 9500,
      latencyNs: 10,
      errorsFound: 2,
    });

    expect(summary.overallScore).toBe(65);
    expect(summary.healthGrade).toBe('UWAGA');
    expect(summary.summaryMessage).toContain('pojedyncze błędy');
  });

  it('caps error penalty at 75, clamps score to >= 10, and assigns KRYTYCZNY for >= 5 errors', () => {
    const highPerfManyErrors = computeRamSummaryMetrics({
      bandwidthReadMBs: 12_000,
      bandwidthWriteMBs: 12_000,
      latencyNs: 5,
      errorsFound: 50,
    });
    // base 100 - max penalty 75 = 25
    expect(highPerfManyErrors.overallScore).toBe(25);
    expect(highPerfManyErrors.healthGrade).toBe('KRYTYCZNY');

    const lowPerfManyErrors = computeRamSummaryMetrics({
      bandwidthReadMBs: 500,
      bandwidthWriteMBs: 500,
      latencyNs: 90,
      errorsFound: 10,
    });
    expect(lowPerfManyErrors.overallScore).toBe(10);
    expect(lowPerfManyErrors.healthGrade).toBe('KRYTYCZNY');
  });
});

describe('RamTestService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates an idle initial state matching the requested allocation size', () => {
    const service = new RamTestService();
    const state = service.createInitialState(512);

    expect(state.status).toBe('idle');
    expect(state.allocatedMB).toBe(512);
    expect(state.errorsFound).toBe(0);
    expect(state.overallScore).toBe(0);
    expect(state.patternTestPassed).toBe(false);
    expect(state.randomTestPassed).toBe(false);
    expect(state.walkingBitsPassed).toBe(false);
  });

  it('passes all 4 integrity stages (Checkerboard, Xorshift32 PRNG, Walking 1s/0s, Bandwidth/Latency) with 0 errors', async () => {
    const service = new RamTestService();
    vi.spyOn(service as unknown as { sleep: (ms: number) => Promise<void> }, 'sleep').mockResolvedValue(undefined);

    const progressMarks: number[] = [];
    const result = await service.runTest(32, (snap) => {
      progressMarks.push(snap.progress);
    });

    expect(result.status).toBe('completed');
    expect(result.progress).toBe(100);
    expect(result.allocatedMB).toBe(32);
    expect(result.errorsFound).toBe(0);
    expect(result.patternErrors).toBe(0);
    expect(result.randomErrors).toBe(0);
    expect(result.walkingBitErrors).toBe(0);
    expect(result.patternTestPassed).toBe(true);
    expect(result.randomTestPassed).toBe(true);
    expect(result.walkingBitsPassed).toBe(true);
    expect(result.bandwidthWriteMBs).toBeGreaterThan(0);
    expect(result.bandwidthReadMBs).toBeGreaterThan(0);
    expect(result.latencyNs).toBeGreaterThanOrEqual(5);
    expect(result.overallScore).toBeGreaterThanOrEqual(10);
    expect(result.overallScore).toBeLessThanOrEqual(100);
    expect(['WZOROWY', 'DOBRY']).toContain(result.healthGrade);
    expect(progressMarks[progressMarks.length - 1]).toBe(100);
  });

  it('rejects concurrent runTest calls while a test is already running', async () => {
    const service = new RamTestService();
    let releaseFirst!: () => void;
    const sleepGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const sleepSpy = vi
      .spyOn(service as unknown as { sleep: (ms: number) => Promise<void> }, 'sleep')
      .mockImplementationOnce(() => sleepGate)
      .mockResolvedValue(undefined);

    const firstRun = service.runTest(32, () => {});
    await expect(service.runTest(32, () => {})).rejects.toThrow('Test pamięci RAM jest już w toku.');

    releaseFirst();
    const res = await firstRun;
    expect(res.status).toBe('completed');
    expect(sleepSpy).toHaveBeenCalled();
  });

  it('handles allocation failure gracefully by setting KRYTYCZNY status', async () => {
    const service = new RamTestService();
    vi.spyOn(service as unknown as { sleep: (ms: number) => Promise<void> }, 'sleep').mockResolvedValue(undefined);

    const OriginalUint32Array = globalThis.Uint32Array;
    vi.spyOn(globalThis, 'Uint32Array').mockImplementation(function () {
      throw new RangeError('Out of memory');
    } as unknown as typeof Uint32Array);

    try {
      const result = await service.runTest(32, () => {});
      expect(result.status).toBe('failed');
      expect(result.healthGrade).toBe('KRYTYCZNY');
      expect(result.testLog.some((line) => line.includes('[Błąd]'))).toBe(true);
    } finally {
      globalThis.Uint32Array = OriginalUint32Array;
    }
  });
});
