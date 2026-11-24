import { describe, expect, it } from 'vitest';
import { buildResultsAndSpecsCsv, escapeCsvCell } from '../resultsCsvExport.service';
import { cpuTestService } from '../cpuTest.service';
import { ramTestService } from '../ramTest.service';
import { diskTestService } from '../diskTest.service';
import { gpuStressEngine } from '../gpuStress.service';
import { gameBenchService } from '../gameBench.service';
import { batteryHealthService } from '../batteryHealth.service';
import { networkTestService } from '../networkTest.service';

describe('Results & Hardware Specs CSV Export', () => {
  it('escapes commas, double quotes, and newlines per RFC 4180', () => {
    expect(escapeCsvCell('plain')).toBe('plain');
    expect(escapeCsvCell('AMD, Radeon RX 7900 XTX')).toBe('"AMD, Radeon RX 7900 XTX"');
    expect(escapeCsvCell('Screen "Pro" 27')).toBe('"Screen ""Pro"" 27"');
    expect(escapeCsvCell('line1\nline2')).toBe('"line1\nline2"');
  });

  it('builds a UTF-8 BOM CSV containing current test scores and hardware specifications', () => {
    const cpuState = {
      ...cpuTestService.createInitialState(),
      singleCoreScore: 1850,
      multiCoreScore: 12400,
      overallScore: 91,
      avgClockGHz: 4.12,
      peakClockGHz: 4.45,
      grade: 'WZOROWY' as const,
    };

    const csv = buildResultsAndSpecsCsv(
      {
        systemSpecs: {
          os: 'Windows 11',
          platform: 'Win32',
          browser: 'Chrome 131',
          cpuCores: 16,
          deviceMemory: 32,
          gpuVendor: 'AMD',
          gpuRenderer: 'ANGLE (AMD, AMD Radeon RX 7900 XTX)',
          webglVersion: 'WebGL 2.0',
          maxTextureSize: 16384,
          screenResolution: '2560 × 1440',
          viewportSize: '1920 × 1080',
          colorDepth: 24,
          devicePixelRatio: 1,
          estimatedRefreshRate: 165,
          online: true,
          connectionType: '4g',
          downlink: 100,
          rtt: 18,
          storageQuotaGB: 512,
          storageUsageMB: 12,
        },
        hardwareScan: null,
        suiteScores: {
          cpu: 91,
          ram: 86,
          disk: 88,
          gpu: 94,
          battery: 92,
          overall: 90,
          grade: 'S',
          timestamp: Date.now(),
        },
        cpuState,
        ramState: ramTestService.createInitialState(256),
        diskState: diskTestService.createInitialState(),
        gpuState: gpuStressEngine.createInitialMetrics(),
        gameState: gameBenchService.createInitialMetrics(),
        batteryState: batteryHealthService.getState(),
        networkState: networkTestService.createInitialState(),
      },
      new Date('2026-11-23T12:00:00.000Z')
    );

    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('Sekcja,Parametr,Wartość,Jednostka,Status / Szczegóły');
    expect(csv).toContain('Ogólny indeks systemu,90,/ 100,Ocena: S');
    expect(csv).toContain('CPU — Multi-Core,12400,pkt');
    expect(csv).toContain('"ANGLE (AMD, AMD Radeon RX 7900 XTX)"');
    expect(csv).toContain('Windows 11');
    expect(csv).toContain('2560 × 1440 @ 165 Hz');
  });
});
