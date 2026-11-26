import * as XLSX from 'xlsx';
import { DiagnosticLogEntry, StressSessionRecord, SystemSpecs } from '../types';

export type StressStabilityBand = 'OPTIMAL_GE_90' | 'FLUCTUATION_75_89' | 'CRITICAL_LT_75';

export interface StressHistoryModuleSummary {
  module: StressSessionRecord['module'];
  sessionCount: number;
  totalDurationSec: number;
  avgStabilityPct: number;
  minStabilityPct: number;
  avgCpuTempC: number | null;
  avgGpuTempC: number | null;
}

export interface StressHistoryJsonSessionEntry {
  index: number;
  id: string;
  module: StressSessionRecord['module'];
  status: StressSessionRecord['status'];
  startedAt: number;
  startedAtIso: string;
  endedAt: number;
  endedAtIso: string;
  durationSec: number;
  finalStabilityPct: number;
  stabilityBand: StressStabilityBand;
  avgCpuTempC: number | null;
  avgGpuTempC: number | null;
  summaryMetric: string;
}

export interface StressHistoryJsonExportPayload {
  schemaVersion: '1.0';
  application: 'SystemPulse Pro';
  exportType: 'stress-log-history';
  exportedAt: string;
  exportedAtLocal: string;
  systemSpecs: {
    gpuRenderer: string;
    cpuCores: number;
    ramGB: number | null;
    os: string;
    screenResolution: string;
  } | null;
  summary: {
    totalSessions: number;
    totalDiagnosticLogs: number;
    totalDurationSec: number;
    avgStabilityPct: number;
    minStabilityPct: number | null;
    maxStabilityPct: number | null;
    statusCounts: {
      OK: number;
      UWAGA: number;
      BŁĄD: number;
    };
    thermal: {
      cpuSamplesWithSensor: number;
      avgCpuTempC: number | null;
      maxAvgCpuTempC: number | null;
      gpuSamplesWithSensor: number;
      avgGpuTempC: number | null;
      maxAvgGpuTempC: number | null;
    };
    byModule: StressHistoryModuleSummary[];
  };
  sessions: StressHistoryJsonSessionEntry[];
  diagnosticLogs: DiagnosticLogEntry[];
}

export interface StressHistoryJsonExportOptions {
  specs?: SystemSpecs | null;
  diagnosticLogs?: DiagnosticLogEntry[];
  exportedAt?: Date;
}

export interface StressHistoryJsonExportResult {
  sessionCount: number;
  logCount: number;
  filename: string;
  byteSize: number;
}

function classifyStabilityBand(pct: number): StressStabilityBand {
  if (pct >= 90) return 'OPTIMAL_GE_90';
  if (pct >= 75) return 'FLUCTUATION_75_89';
  return 'CRITICAL_LT_75';
}

function csvEscape(val: string | number | null | undefined): string {
  const s = val === null || val === undefined ? '' : String(val);
  if (/[",\n\r;]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('pl-PL', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function makeFileStamp(date = new Date()): string {
  return `${date.toISOString().slice(0, 10)}_${date.toTimeString().slice(0, 8).replace(/:/g, '-')}`;
}

export function buildStressHistoryJsonPayload(
  history: StressSessionRecord[],
  options: StressHistoryJsonExportOptions = {}
): StressHistoryJsonExportPayload {
  const now = options.exportedAt ?? new Date();
  const ordered = [...history].reverse();
  const diagnosticLogs = options.diagnosticLogs ? [...options.diagnosticLogs] : [];

  const statusCounts = { OK: 0, UWAGA: 0, BŁĄD: 0 };
  const moduleGroups = new Map<StressSessionRecord['module'], StressSessionRecord[]>();

  for (const rec of ordered) {
    statusCounts[rec.status] = (statusCounts[rec.status] ?? 0) + 1;
    const arr = moduleGroups.get(rec.module) ?? [];
    arr.push(rec);
    moduleGroups.set(rec.module, arr);
  }

  const count = ordered.length;
  const totalDurationSec = Number(ordered.reduce((s, r) => s + r.durationSec, 0).toFixed(1));
  const avgStabilityPct =
    count > 0
      ? Number((ordered.reduce((s, r) => s + r.finalStabilityPct, 0) / count).toFixed(1))
      : 0;
  const minStabilityPct =
    count > 0 ? Number(Math.min(...ordered.map((r) => r.finalStabilityPct)).toFixed(1)) : null;
  const maxStabilityPct =
    count > 0 ? Number(Math.max(...ordered.map((r) => r.finalStabilityPct)).toFixed(1)) : null;

  const cpuTemps = ordered.map((r) => r.avgCpuTempC).filter((v): v is number => v !== null);
  const gpuTemps = ordered.map((r) => r.avgGpuTempC).filter((v): v is number => v !== null);

  const byModule: StressHistoryModuleSummary[] = Array.from(moduleGroups.entries()).map(
    ([module, recs]) => {
      const mCpu = recs.map((r) => r.avgCpuTempC).filter((v): v is number => v !== null);
      const mGpu = recs.map((r) => r.avgGpuTempC).filter((v): v is number => v !== null);
      return {
        module,
        sessionCount: recs.length,
        totalDurationSec: Number(recs.reduce((s, r) => s + r.durationSec, 0).toFixed(1)),
        avgStabilityPct: Number(
          (recs.reduce((s, r) => s + r.finalStabilityPct, 0) / recs.length).toFixed(1)
        ),
        minStabilityPct: Number(Math.min(...recs.map((r) => r.finalStabilityPct)).toFixed(1)),
        avgCpuTempC:
          mCpu.length > 0
            ? Number((mCpu.reduce((s, v) => s + v, 0) / mCpu.length).toFixed(1))
            : null,
        avgGpuTempC:
          mGpu.length > 0
            ? Number((mGpu.reduce((s, v) => s + v, 0) / mGpu.length).toFixed(1))
            : null,
      };
    }
  );

  const sessions: StressHistoryJsonSessionEntry[] = ordered.map((rec, idx) => ({
    index: idx + 1,
    id: rec.id,
    module: rec.module,
    status: rec.status,
    startedAt: rec.startedAt,
    startedAtIso: new Date(rec.startedAt).toISOString(),
    endedAt: rec.endedAt,
    endedAtIso: new Date(rec.endedAt).toISOString(),
    durationSec: Number(rec.durationSec.toFixed(1)),
    finalStabilityPct: Number(rec.finalStabilityPct.toFixed(1)),
    stabilityBand: classifyStabilityBand(rec.finalStabilityPct),
    avgCpuTempC: rec.avgCpuTempC !== null ? Number(rec.avgCpuTempC.toFixed(1)) : null,
    avgGpuTempC: rec.avgGpuTempC !== null ? Number(rec.avgGpuTempC.toFixed(1)) : null,
    summaryMetric: rec.summaryMetric,
  }));

  const specs = options.specs ?? null;
  return {
    schemaVersion: '1.0',
    application: 'SystemPulse Pro',
    exportType: 'stress-log-history',
    exportedAt: now.toISOString(),
    exportedAtLocal: now.toLocaleString('pl-PL'),
    systemSpecs: specs
      ? {
          gpuRenderer: specs.gpuRenderer,
          cpuCores: specs.cpuCores,
          ramGB: typeof specs.deviceMemory === 'number' ? specs.deviceMemory : null,
          os: specs.os,
          screenResolution: specs.screenResolution,
        }
      : null,
    summary: {
      totalSessions: count,
      totalDiagnosticLogs: diagnosticLogs.length,
      totalDurationSec,
      avgStabilityPct,
      minStabilityPct,
      maxStabilityPct,
      statusCounts,
      thermal: {
        cpuSamplesWithSensor: cpuTemps.length,
        avgCpuTempC:
          cpuTemps.length > 0
            ? Number((cpuTemps.reduce((s, v) => s + v, 0) / cpuTemps.length).toFixed(1))
            : null,
        maxAvgCpuTempC: cpuTemps.length > 0 ? Number(Math.max(...cpuTemps).toFixed(1)) : null,
        gpuSamplesWithSensor: gpuTemps.length,
        avgGpuTempC:
          gpuTemps.length > 0
            ? Number((gpuTemps.reduce((s, v) => s + v, 0) / gpuTemps.length).toFixed(1))
            : null,
        maxAvgGpuTempC: gpuTemps.length > 0 ? Number(Math.max(...gpuTemps).toFixed(1)) : null,
      },
      byModule,
    },
    sessions,
    diagnosticLogs,
  };
}

export function exportStressHistoryToJson(
  history: StressSessionRecord[],
  options: StressHistoryJsonExportOptions = {}
): StressHistoryJsonExportResult {
  const now = options.exportedAt ?? new Date();
  const payload = buildStressHistoryJsonPayload(history, { ...options, exportedAt: now });
  const jsonText = JSON.stringify(payload, null, 2);
  const filename = `systempulse-stress-log-history-${makeFileStamp(now)}.json`;
  const blob = new Blob([jsonText], { type: 'application/json;charset=utf-8;' });

  if (typeof document !== 'undefined' && typeof URL !== 'undefined') {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return {
    sessionCount: payload.sessions.length,
    logCount: payload.diagnosticLogs.length,
    filename,
    byteSize: new TextEncoder().encode(jsonText).byteLength,
  };
}

export function exportStressHistoryToXlsx(history: StressSessionRecord[]): number {
  const ordered = [...history].reverse();

  const rows = ordered.map((rec, idx) => ({
    Lp: idx + 1,
    'ID sesji': rec.id,
    'Moduł / Test': rec.module,
    Data: fmtDate(rec.startedAt),
    Rozpoczęcie: fmtTime(rec.startedAt),
    Zakończenie: fmtTime(rec.endedAt),
    'Czas trwania (s)': Number(rec.durationSec.toFixed(1)),
    'Śr. temp. CPU (°C)': rec.avgCpuTempC !== null ? Number(rec.avgCpuTempC.toFixed(1)) : 'Brak czujnika',
    'Śr. temp. GPU (°C)': rec.avgGpuTempC !== null ? Number(rec.avgGpuTempC.toFixed(1)) : 'Brak czujnika',
    'Stabilność końcowa (%)': Number(rec.finalStabilityPct.toFixed(1)),
    Status: rec.status,
    Podsumowanie: rec.summaryMetric,
  }));

  const wb = XLSX.utils.book_new();
  const wsSessions = XLSX.utils.json_to_sheet(rows);
  wsSessions['!cols'] = [
    { wch: 5 },
    { wch: 20 },
    { wch: 20 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 16 },
    { wch: 18 },
    { wch: 18 },
    { wch: 20 },
    { wch: 10 },
    { wch: 46 },
  ];
  XLSX.utils.book_append_sheet(wb, wsSessions, 'Historia Stres-Testów');

  const count = history.length;
  const totalDurationSec = Number(history.reduce((s, r) => s + r.durationSec, 0).toFixed(1));
  const avgStabilityPct =
    count > 0 ? Number((history.reduce((s, r) => s + r.finalStabilityPct, 0) / count).toFixed(1)) : 0;
  const cpuTemps = history.map((r) => r.avgCpuTempC).filter((v): v is number => v !== null);
  const gpuTemps = history.map((r) => r.avgGpuTempC).filter((v): v is number => v !== null);

  const summaryRows = [
    { Metryka: 'Aplikacja', Wartość: 'SystemPulse Pro' },
    { Metryka: 'Data eksportu', Wartość: new Date().toLocaleString('pl-PL') },
    { Metryka: 'Liczba zapisanych sesji', Wartość: count },
    { Metryka: 'Łączny czas stres-testów (s)', Wartość: totalDurationSec },
    { Metryka: 'Średnia stabilność (%)', Wartość: count > 0 ? avgStabilityPct : '—' },
    {
      Metryka: 'Średnia temp. CPU z czujników (°C)',
      Wartość:
        cpuTemps.length > 0
          ? Number((cpuTemps.reduce((s, v) => s + v, 0) / cpuTemps.length).toFixed(1))
          : 'Brak czujnika',
    },
    {
      Metryka: 'Maksymalna śr. temp. CPU (°C)',
      Wartość: cpuTemps.length > 0 ? Math.max(...cpuTemps) : 'Brak czujnika',
    },
    {
      Metryka: 'Średnia temp. GPU z czujników (°C)',
      Wartość:
        gpuTemps.length > 0
          ? Number((gpuTemps.reduce((s, v) => s + v, 0) / gpuTemps.length).toFixed(1))
          : 'Brak czujnika',
    },
    {
      Metryka: 'Maksymalna śr. temp. GPU (°C)',
      Wartość: gpuTemps.length > 0 ? Math.max(...gpuTemps) : 'Brak czujnika',
    },
  ];

  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 36 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Podsumowanie');

  XLSX.writeFile(wb, `systempulse-stress-history-${makeFileStamp()}.xlsx`);
  return count;
}

export function exportStressHistoryToCsv(history: StressSessionRecord[]): number {
  const ordered = [...history].reverse();
  const headers = [
    'Lp',
    'ID_Sesji',
    'Modul',
    'Data',
    'Rozpoczecie',
    'Zakonczenie',
    'Czas_Trwania_s',
    'Sr_Temp_CPU_C',
    'Sr_Temp_GPU_C',
    'Stabilnosc_Koncowa_Pct',
    'Status',
    'Podsumowanie',
  ];

  const lines = ordered.map((rec, idx) =>
    [
      idx + 1,
      rec.id,
      rec.module,
      fmtDate(rec.startedAt),
      fmtTime(rec.startedAt),
      fmtTime(rec.endedAt),
      rec.durationSec.toFixed(1),
      rec.avgCpuTempC !== null ? rec.avgCpuTempC.toFixed(1) : 'Brak czujnika',
      rec.avgGpuTempC !== null ? rec.avgGpuTempC.toFixed(1) : 'Brak czujnika',
      rec.finalStabilityPct.toFixed(1),
      rec.status,
      rec.summaryMetric,
    ]
      .map(csvEscape)
      .join(',')
  );

  const csvContent = '\uFEFF' + [headers.join(','), ...lines].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `systempulse-stress-history-${makeFileStamp()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  return ordered.length;
}
