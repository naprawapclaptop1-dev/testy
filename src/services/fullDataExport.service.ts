import {
  BatteryHealthState,
  CpuTestResult,
  DiagnosticLogEntry,
  DiskTestResult,
  FanCurveConfig,
  FanTestState,
  GameBenchMetrics,
  GpuSceneMode,
  GpuStressMetrics,
  NetworkTestResult,
  RamTestResult,
  ScheduledTestItem,
  SchedulerSummaryReport,
  StressSessionRecord,
  SuiteScores,
  SystemSpecs,
  ThemeMode,
  ThermalHeatMapSnapshot,
} from '../types';
import { HardwareScanSnapshot } from './hardwareScanner.service';

export interface GpuSuiteSceneSummary {
  sceneId: GpuSceneMode;
  name: string;
  targetUnit: string;
  avgFps: number;
  low1PctFps: number;
  triangles: number;
  stabilityPct: number;
  score: number;
}

export interface FullDiagnosticExportInput {
  systemSpecs: SystemSpecs | null;
  suiteScores: SuiteScores;
  cpuState: CpuTestResult;
  ramState: RamTestResult;
  diskState: DiskTestResult;
  gpuState: GpuStressMetrics;
  gpuSuiteResults: GpuSuiteSceneSummary[];
  gameState: GameBenchMetrics;
  batteryState: BatteryHealthState;
  thermalState: ThermalHeatMapSnapshot;
  networkState: NetworkTestResult;
  fanState: FanTestState;
  fanCurve: FanCurveConfig;
  hardwareScan: HardwareScanSnapshot | null;
  stressHistory: StressSessionRecord[];
  schedulerQueue: ScheduledTestItem[];
  lastSchedulerReport: SchedulerSummaryReport | null;
  diagnosticLogs: DiagnosticLogEntry[];
  metadata: {
    lastSuiteTimestamp: number | null;
    lastSavedAt: number | null;
    theme: ThemeMode;
    soundNotificationsEnabled: boolean;
  };
}

export interface FullDiagnosticExportPayload {
  application: string;
  exportType: 'full-diagnostic-data';
  schemaVersion: string;
  exportedAt: string;
  systemSpecs: SystemSpecs | null;
  suiteScores: SuiteScores;
  diagnosticStates: {
    cpu: CpuTestResult;
    ram: RamTestResult;
    disk: DiskTestResult;
    gpu: GpuStressMetrics;
    gpuSuiteResults: GpuSuiteSceneSummary[];
    gameBenchmark: GameBenchMetrics;
    battery: BatteryHealthState;
    thermal: ThermalHeatMapSnapshot;
    network: NetworkTestResult;
    fanAndCooling: {
      state: FanTestState;
      customFanCurve: FanCurveConfig;
    };
    hardwareScan: HardwareScanSnapshot | null;
    stressHistory: StressSessionRecord[];
    scheduler: {
      queue: ScheduledTestItem[];
      lastReport: SchedulerSummaryReport | null;
    };
  };
  diagnosticLogs: DiagnosticLogEntry[];
  metadata: {
    lastSuiteTimestamp: number | null;
    lastSavedAt: number | null;
    theme: ThemeMode;
    soundNotificationsEnabled: boolean;
    totalLoggedEvents: number;
    totalStressSessions: number;
  };
}

export function buildFullDiagnosticExportPayload(
  input: FullDiagnosticExportInput,
  now = new Date()
): FullDiagnosticExportPayload {
  return {
    application: 'SystemPulse Pro',
    exportType: 'full-diagnostic-data',
    schemaVersion: '1.0',
    exportedAt: now.toISOString(),
    systemSpecs: input.systemSpecs,
    suiteScores: input.suiteScores,
    diagnosticStates: {
      cpu: input.cpuState,
      ram: input.ramState,
      disk: input.diskState,
      gpu: input.gpuState,
      gpuSuiteResults: [...input.gpuSuiteResults],
      gameBenchmark: input.gameState,
      battery: input.batteryState,
      thermal: input.thermalState,
      network: input.networkState,
      fanAndCooling: {
        state: input.fanState,
        customFanCurve: {
          ...input.fanCurve,
          points: [...input.fanCurve.points],
        },
      },
      hardwareScan: input.hardwareScan,
      stressHistory: [...input.stressHistory],
      scheduler: {
        queue: [...input.schedulerQueue],
        lastReport: input.lastSchedulerReport,
      },
    },
    diagnosticLogs: [...input.diagnosticLogs],
    metadata: {
      ...input.metadata,
      totalLoggedEvents: input.diagnosticLogs.length,
      totalStressSessions: input.stressHistory.length,
    },
  };
}

export function downloadFullDiagnosticDataJson(
  input: FullDiagnosticExportInput
): { filename: string; byteSize: number; payload: FullDiagnosticExportPayload } {
  const now = new Date();
  const stamp = `${now.toISOString().slice(0, 10)}_${now.toTimeString().slice(0, 8).replace(/:/g, '-')}`;
  const filename = `systempulse-all-data-${stamp}.json`;
  const payload = buildFullDiagnosticExportPayload(input, now);
  const serialized = JSON.stringify(payload, null, 2);

  const blob = new Blob([serialized], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);

  return { filename, byteSize: serialized.length, payload };
}
