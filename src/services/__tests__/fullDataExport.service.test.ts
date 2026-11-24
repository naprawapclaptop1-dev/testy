import { describe, expect, it } from 'vitest';
import { buildFullDiagnosticExportPayload } from '../fullDataExport.service';
import { cpuTestService } from '../cpuTest.service';
import { ramTestService } from '../ramTest.service';
import { diskTestService } from '../diskTest.service';
import { gpuStressEngine } from '../gpuStress.service';
import { gameBenchService } from '../gameBench.service';
import { batteryHealthService } from '../batteryHealth.service';
import { thermalMonitorService } from '../thermalMonitor.service';
import { networkTestService } from '../networkTest.service';
import { fanTestService } from '../fanTest.service';

describe('fullDataExport.service', () => {
  it('packages all diagnostic test states, system specifications, scores, fan curve, and logs into a valid JSON payload', () => {
    const fixedDate = new Date('2026-11-23T12:00:00.000Z');
    const payload = buildFullDiagnosticExportPayload(
      {
        systemSpecs: {
          os: 'Windows 11',
          browser: 'Google Chrome',
          platform: 'Win32',
          cpuCores: 16,
          deviceMemory: 32,
          gpuVendor: 'AMD',
          gpuRenderer: 'AMD Radeon RX 7900 XTX',
          webglVersion: 'WebGL 2.0',
          maxTextureSize: 16384,
          screenResolution: '2560 x 1440',
          viewportSize: '1920 x 1080',
          colorDepth: 24,
          devicePixelRatio: 1,
          estimatedRefreshRate: 165,
          online: true,
          connectionType: 'ethernet',
          downlink: 100,
          rtt: 12,
          storageQuotaGB: 500,
          storageUsageMB: 12.5,
        },
        suiteScores: {
          overall: 92,
          cpu: 95,
          ram: 91,
          disk: 88,
          gpu: 98,
          battery: 90,
          grade: 'A+',
          timestamp: fixedDate.getTime(),
        },
        cpuState: cpuTestService.createInitialState(),
        ramState: ramTestService.createInitialState(256),
        diskState: diskTestService.createInitialState(),
        gpuState: gpuStressEngine.createInitialMetrics(),
        gpuSuiteResults: [],
        gameState: gameBenchService.createInitialMetrics(),
        batteryState: batteryHealthService.getState(),
        thermalState: thermalMonitorService.getSnapshot(),
        networkState: networkTestService.createInitialState(),
        fanState: fanTestService.createInitialState(),
        fanCurve: fanTestService.getFanCurve(),
        hardwareScan: null,
        stressHistory: [
          {
            id: 's1',
            module: 'CPU Stres',
            startedAt: fixedDate.getTime() - 60_000,
            endedAt: fixedDate.getTime(),
            durationSec: 60,
            avgCpuTempC: 68.4,
            avgGpuTempC: 54.2,
            finalStabilityPct: 99.1,
            summaryMetric: '16 wątków · 99.1%',
            status: 'OK',
          },
        ],
        schedulerQueue: [],
        lastSchedulerReport: null,
        diagnosticLogs: [
          {
            id: 1,
            timestamp: fixedDate.getTime(),
            isoTime: fixedDate.toISOString(),
            module: 'CPU',
            level: 'OK',
            event: 'Benchmark completed',
            metric: 'Score',
            value: '95/100',
            details: 'All passes stable',
          },
        ],
        metadata: {
          lastSuiteTimestamp: fixedDate.getTime(),
          lastSavedAt: fixedDate.getTime(),
          theme: 'dark',
          soundNotificationsEnabled: true,
        },
      },
      fixedDate
    );

    expect(payload.application).toBe('SystemPulse Pro');
    expect(payload.exportType).toBe('full-diagnostic-data');
    expect(payload.exportedAt).toBe('2026-11-23T12:00:00.000Z');
    expect(payload.systemSpecs?.gpuRenderer).toBe('AMD Radeon RX 7900 XTX');
    expect(payload.suiteScores.overall).toBe(92);

    // Every diagnostic subsystem is present
    expect(payload.diagnosticStates.cpu).toBeDefined();
    expect(payload.diagnosticStates.ram).toBeDefined();
    expect(payload.diagnosticStates.disk).toBeDefined();
    expect(payload.diagnosticStates.gpu).toBeDefined();
    expect(payload.diagnosticStates.gameBenchmark).toBeDefined();
    expect(payload.diagnosticStates.battery).toBeDefined();
    expect(payload.diagnosticStates.thermal).toBeDefined();
    expect(payload.diagnosticStates.network).toBeDefined();
    expect(payload.diagnosticStates.fanAndCooling.customFanCurve.points.length).toBeGreaterThanOrEqual(3);
    expect(payload.diagnosticStates.stressHistory).toHaveLength(1);
    expect(payload.diagnosticLogs).toHaveLength(1);
    expect(payload.metadata.totalLoggedEvents).toBe(1);
    expect(payload.metadata.totalStressSessions).toBe(1);

    // Must serialize cleanly to JSON without circular references
    const json = JSON.stringify(payload);
    const reparsed = JSON.parse(json) as typeof payload;
    expect(reparsed.systemSpecs?.cpuCores).toBe(16);
    expect(reparsed.diagnosticStates.stressHistory[0].finalStabilityPct).toBe(99.1);
  });
});
