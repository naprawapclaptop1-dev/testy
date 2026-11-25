import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type {
  CpuTestResult,
  DiskTestResult,
  GameBenchMetrics,
  GpuStressMetrics,
  RamTestResult,
  SystemSpecs,
} from '../../types';
import {
  computeHardwarePowerIndex,
  evaluateGamePlayabilitySummary,
  hasAnyBenchmarkResults,
  predictPlayableGames,
  renderPcSuitabilityAndGamesReport,
  type PcSuitabilityInputContext,
} from '../pcSuitabilityAndGamesReport';

function makeContext(overrides?: {
  gpuRenderer?: string;
  cpuCores?: number;
  deviceMemory?: number;
  cpu?: Partial<CpuTestResult>;
  ram?: Partial<RamTestResult>;
  disk?: Partial<DiskTestResult>;
  gpu?: Partial<GpuStressMetrics>;
  game?: Partial<GameBenchMetrics>;
}): PcSuitabilityInputContext {
  const specs: SystemSpecs = {
    os: 'Windows 11',
    platform: 'Win32',
    browser: 'Chrome',
    cpuCores: overrides?.cpuCores ?? 32,
    deviceMemory: overrides?.deviceMemory ?? 16,
    gpuVendor: 'AMD',
    gpuRenderer:
      overrides?.gpuRenderer ??
      'ANGLE (AMD, AMD Radeon RX 7900 XTX (0x0000744C) Direct3D11 vs_5_0 ps_5_0, D3D11)',
    webglVersion: 'WebGL2',
    maxTextureSize: 16384,
    screenResolution: '2560x1440',
    viewportSize: '2560x1400',
    colorDepth: 24,
    devicePixelRatio: 1,
    estimatedRefreshRate: 144,
    online: true,
    connectionType: '4g',
    downlink: 10,
    rtt: 25,
    storageQuotaGB: 500,
    storageUsageMB: 20,
  };

  return {
    specs,
    cpu: {
      multiCoreScore: 0,
      overallScore: 0,
      coresUsed: specs.cpuCores,
      ...(overrides?.cpu ?? {}),
    } as CpuTestResult,
    ram: {
      overallScore: 0,
      bandwidthReadMBs: 0,
      ...(overrides?.ram ?? {}),
    } as RamTestResult,
    disk: {
      overallScore: 0,
      seqReadMBs: 0,
      ...(overrides?.disk ?? {}),
    } as DiskTestResult,
    gpu: {
      avgFps: 0,
      fps: 0,
      overallScore: 0,
      stabilityPct: 95,
      fpsMode: 'uncapped',
      rendererName: specs.gpuRenderer,
      ...(overrides?.gpu ?? {}),
    } as GpuStressMetrics,
    game: {
      avgFps: 0,
      fps: 0,
      overallScore: 0,
      stabilityPct: 95,
      fpsMode: 'uncapped',
      ...(overrides?.game ?? {}),
    } as GameBenchMetrics,
  };
}

describe('pcSuitabilityAndGamesReport calibration, verdicts, and CSS integrity', () => {
  it('shows pre-test prompt when no benchmarks have been executed yet', () => {
    const emptyCtx = makeContext();
    expect(hasAnyBenchmarkResults(emptyCtx)).toBe(false);
    const html = renderPcSuitabilityAndGamesReport(emptyCtx);
    expect(html).toContain('Wymagany pomiar');
    expect(html).toContain('data-run-full-suite="true"');
    expect(html).not.toContain('sp-games-chart-grid');
  });

  it('changes predicted FPS significantly between partial/pre-GPU baseline and real benchmark results on the same RX 7900 XTX', () => {
    const cpuOnlyCtx = makeContext({
      cpu: { multiCoreScore: 9200, overallScore: 84 },
    });
    const fullFlagshipCtx = makeContext({
      cpu: { multiCoreScore: 13800, overallScore: 98 },
      ram: { overallScore: 94, bandwidthReadMBs: 2800 },
      disk: { overallScore: 95, seqReadMBs: 1600 },
      gpu: { avgFps: 195, overallScore: 98, stabilityPct: 97, fpsMode: 'uncapped' },
    });
    const throttledSameGpuCtx = makeContext({
      cpu: { multiCoreScore: 4200, overallScore: 45 },
      ram: { overallScore: 52, bandwidthReadMBs: 900 },
      disk: { overallScore: 55, seqReadMBs: 400 },
      gpu: { avgFps: 38, overallScore: 34, stabilityPct: 58, fpsMode: 'uncapped' },
    });

    const hwCpuOnly = computeHardwarePowerIndex(cpuOnlyCtx);
    const hwFull = computeHardwarePowerIndex(fullFlagshipCtx);
    const hwThrottled = computeHardwarePowerIndex(throttledSameGpuCtx);

    expect(hwCpuOnly.gpuTested).toBe(false);
    expect(hwFull.gpuTested).toBe(true);
    expect(hwFull.testedCount).toBe(4);
    expect(hwFull.gpuScore).toBeGreaterThan(hwCpuOnly.gpuScore + 15);
    expect(hwThrottled.gpuScore).toBeLessThan(hwCpuOnly.gpuScore - 15);

    const gamesCpuOnly = predictPlayableGames(cpuOnlyCtx);
    const gamesFull = predictPlayableGames(fullFlagshipCtx);
    const gamesThrottled = predictPlayableGames(throttledSameGpuCtx);

    const cs2CpuOnly = gamesCpuOnly.find((g) => g.id === 'cs2')!;
    const cs2Full = gamesFull.find((g) => g.id === 'cs2')!;
    const cs2Throttled = gamesThrottled.find((g) => g.id === 'cs2')!;

    expect(cs2Full.fps1080pNative).toBeGreaterThan(cs2CpuOnly.fps1080pNative + 40);
    expect(cs2Throttled.fps1080pNative).toBeLessThan(cs2CpuOnly.fps1080pNative - 40);
  });

  it('distinguishes weak iGPU laptops (flags heavy RT games as low/unplayable + VRAM warnings) from flagship PCs', () => {
    const weakLaptopCtx = makeContext({
      gpuRenderer: 'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11)',
      cpuCores: 4,
      deviceMemory: 8,
      cpu: { multiCoreScore: 2200, overallScore: 35 },
      ram: { overallScore: 48, bandwidthReadMBs: 700 },
      disk: { overallScore: 55, seqReadMBs: 420 },
      gpu: { avgFps: 24, overallScore: 26, stabilityPct: 72, fpsMode: 'uncapped' },
    });

    const weakGames = predictPlayableGames(weakLaptopCtx);
    const weakSummary = evaluateGamePlayabilitySummary(weakGames);
    const alanWakeWeak = weakGames.find((g) => g.id === 'alanwake2_pt')!;

    expect(alanWakeWeak.tier).toBe('low');
    expect(alanWakeWeak.vramWarning).toContain('VRAM');
    expect(weakSummary.lowCount).toBeGreaterThanOrEqual(4);
    expect(weakSummary.ultraCount).toBe(0);

    const strongPcCtx = makeContext({
      cpu: { multiCoreScore: 14000, overallScore: 99 },
      ram: { overallScore: 95, bandwidthReadMBs: 2900 },
      disk: { overallScore: 96, seqReadMBs: 1700 },
      gpu: { avgFps: 210, overallScore: 99, stabilityPct: 98, fpsMode: 'uncapped' },
    });

    const strongGames = predictPlayableGames(strongPcCtx);
    const strongSummary = evaluateGamePlayabilitySummary(strongGames);
    expect(strongSummary.smoothOrBetterCount).toBe(strongSummary.total);
    expect(strongSummary.lowCount).toBe(0);
    expect(strongSummary.ultraCount).toBeGreaterThanOrEqual(6);
  });

  it('defines every .sp-* CSS class rendered by renderPcSuitabilityAndGamesReport inside src/index.css', () => {
    const ctx = makeContext({
      cpu: { multiCoreScore: 11000, overallScore: 92 },
      gpu: { avgFps: 165, overallScore: 91, stabilityPct: 94, fpsMode: 'uncapped' },
      ram: { overallScore: 88, bandwidthReadMBs: 2300 },
      disk: { overallScore: 90, seqReadMBs: 1300 },
    });
    const html = renderPcSuitabilityAndGamesReport(ctx);
    const css = fs.readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf8');
    const definedClasses = new Set([...css.matchAll(/\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g)].map((m) => m[1]));

    const usedSpClasses = new Set<string>();
    for (const match of html.matchAll(/class="([^"]+)"/g)) {
      for (const cls of match[1].split(/\s+/)) {
        if (cls.startsWith('sp-')) usedSpClasses.add(cls);
      }
    }

    const missing = [...usedSpClasses].filter((cls) => !definedClasses.has(cls));
    expect(missing).toEqual([]);
  });
});
