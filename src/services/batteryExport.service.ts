import * as XLSX from 'xlsx';
import { BatteryHealthState, BatteryPowerCycleEntry } from '../types';

function csvEscape(val: string | number | null | undefined): string {
  const s = val === null || val === undefined ? '' : String(val);
  if (/[",\n\r;]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function makeFileStamp(now = new Date()): string {
  return `${now.toISOString().slice(0, 10)}_${now.toTimeString().slice(0, 8).replace(/:/g, '-')}`;
}

export function formatCycleDateTime(entry: BatteryPowerCycleEntry): string {
  if (typeof entry.timestamp === 'number' && Number.isFinite(entry.timestamp) && entry.timestamp > 0) {
    return new Date(entry.timestamp).toLocaleString('pl-PL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return entry.dateLabel;
}

export function buildBatteryPowerCyclesCsv(powerCycles: BatteryPowerCycleEntry[]): string {
  const ordered = [...powerCycles].reverse();
  const headers = [
    'Cycle_ID',
    'Cykl_Nr',
    'Data_Czas',
    'Start_Charge_Pct',
    'End_Charge_Pct',
    'Przyrost_Pct',
    'Duration_Min',
    'Avg_Power_W',
    'Design_Capacity_mWh',
    'Measured_Full_Capacity_mWh',
    'Degradation_From_Prev_mWh',
    'Cumulative_Wear_Pct',
    'Zrodlo',
  ];

  const lines = ordered.map((entry) =>
    [
      entry.id,
      entry.cycleNumber,
      formatCycleDateTime(entry),
      entry.startPct,
      entry.endPct,
      entry.endPct - entry.startPct,
      entry.durationMin,
      entry.avgPowerW.toFixed(1),
      entry.designCapacityMWh,
      entry.fullChargeCapacityMWh,
      entry.degradationFromPrevMWh,
      entry.cumulativeWearPct.toFixed(1),
      entry.source,
    ]
      .map(csvEscape)
      .join(',')
  );

  return '\uFEFF' + [headers.join(','), ...lines].join('\r\n');
}

export function exportBatteryPowerCyclesToCsv(
  powerCycles: BatteryPowerCycleEntry[]
): { filename: string; count: number; csvContent: string } {
  const filename = `systempulse-battery-cycles-${makeFileStamp()}.csv`;
  const csvContent = buildBatteryPowerCyclesCsv(powerCycles);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { filename, count: powerCycles.length, csvContent };
}

export function exportBatteryPowerCyclesToXlsx(
  batteryState: BatteryHealthState
): { filename: string; count: number } {
  const ordered = [...batteryState.powerCycles].reverse();
  const rows = ordered.map((entry) => ({
    'Cycle ID': entry.id,
    'Cykl #': entry.cycleNumber,
    'Data / Czas': formatCycleDateTime(entry),
    'Start (%)': entry.startPct,
    'Koniec (%)': entry.endPct,
    'Przyrost (%)': entry.endPct - entry.startPct,
    'Czas trwania (min)': entry.durationMin,
    'Śr. moc (W)': Number(entry.avgPowerW.toFixed(1)),
    'Pojemność fabryczna (mWh)': entry.designCapacityMWh,
    'Zmierzona pełna pojemność (mWh)': entry.fullChargeCapacityMWh,
    'Degradacja vs poprz. (mWh)': entry.degradationFromPrevMWh,
    'Łączne zużycie Wear (%)': Number(entry.cumulativeWearPct.toFixed(1)),
    Źródło: entry.source === 'auto' ? 'Auto API' : entry.source === 'manual' ? 'Wpis ręczny' : 'Kalibracja',
  }));

  const wb = XLSX.utils.book_new();
  const wsCycles = XLSX.utils.json_to_sheet(rows);
  wsCycles['!cols'] = [
    { wch: 22 },
    { wch: 9 },
    { wch: 19 },
    { wch: 11 },
    { wch: 11 },
    { wch: 13 },
    { wch: 18 },
    { wch: 12 },
    { wch: 24 },
    { wch: 28 },
    { wch: 25 },
    { wch: 22 },
    { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, wsCycles, 'Cykle ładowania');

  const summaryRows = [
    { Metryka: 'Aplikacja', Wartość: 'SystemPulse Pro' },
    { Metryka: 'Data eksportu', Wartość: new Date().toLocaleString('pl-PL') },
    { Metryka: 'Zarejestrowane cykle', Wartość: batteryState.powerCycles.length },
    { Metryka: 'Pojemność fabryczna (mWh)', Wartość: batteryState.designCapacityMWh },
    { Metryka: 'Obecna pełna pojemność (mWh)', Wartość: batteryState.fullChargeCapacityMWh },
    { Metryka: 'Zdrowie ogniw (%)', Wartość: batteryState.healthPct },
    { Metryka: 'Zużycie Wear Level (%)', Wartość: batteryState.wearLevelPct },
    { Metryka: 'Łączna utrata pojemności (mWh)', Wartość: batteryState.totalCapacityLostMWh },
    { Metryka: 'Śr. degradacja na cykl (mWh)', Wartość: batteryState.avgDegradationPerCycleMWh },
    { Metryka: 'Kondycja baterii', Wartość: batteryState.condition },
  ];
  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 32 }, { wch: 26 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Podsumowanie baterii');

  const filename = `systempulse-battery-cycles-${makeFileStamp()}.xlsx`;
  XLSX.writeFile(wb, filename);
  return { filename, count: ordered.length };
}

export function buildPsuRailHistoryCsv(
  railHistory: Array<{ timeLabel: string; timestamp: number; rail12V: number; rail5V: number; rail3P3V: number; powerW: number }>
): string {
  const cutoff = Date.now() - 60000;
  const last60s = (railHistory || []).filter((h) => h.timestamp >= cutoff);
  const rowsToExport = last60s.length > 0 ? last60s : (railHistory || []);
  const ordered = [...rowsToExport].sort((a, b) => a.timestamp - b.timestamp);

  const headers = [
    'Czas_Etykieta',
    'Timestamp',
    'Data_Czas',
    'Szyna_+12V_V',
    'Szyna_+5V_V',
    'Szyna_+3.3V_V',
    'Pobor_Mocy_W',
  ];

  const lines = ordered.map((entry) => {
    const dtStr = new Date(entry.timestamp).toLocaleString('pl-PL');
    return [
      entry.timeLabel,
      entry.timestamp,
      dtStr,
      entry.rail12V.toFixed(2),
      entry.rail5V.toFixed(2),
      entry.rail3P3V.toFixed(2),
      entry.powerW.toFixed(1),
    ]
      .map(csvEscape)
      .join(',');
  });

  return '\uFEFF' + [headers.join(','), ...lines].join('\r\n');
}

export function exportPsuRailHistoryToCsv(
  railHistory: Array<{ timeLabel: string; timestamp: number; rail12V: number; rail5V: number; rail3P3V: number; powerW: number }>
): { filename: string; count: number; csvContent: string } {
  const filename = `systempulse-psu-rail-history-60s-${makeFileStamp()}.csv`;
  const csvContent = buildPsuRailHistoryCsv(railHistory);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  const cutoff = Date.now() - 60000;
  const last60s = (railHistory || []).filter((h) => h.timestamp >= cutoff);
  const count = last60s.length > 0 ? last60s.length : (railHistory || []).length;
  return { filename, count, csvContent };
}

export interface SingleRail5mCsvSample {
  timestamp: number;
  timeLabel: string;
  voltageV: number;
  powerW: number;
}

export interface SingleRail5mCsvOptions {
  railName: '+12V' | '+5V' | '+3.3V';
  nominalV: number;
  thresholdPct: number;
  samples: SingleRail5mCsvSample[];
  windowSeconds?: number;
}

export function buildSinglePsuRail5mCsv(options: SingleRail5mCsvOptions): string {
  const { railName, nominalV, thresholdPct, samples, windowSeconds = 300 } = options;
  const sorted = [...(samples || [])].sort((a, b) => a.timestamp - b.timestamp);
  const latestTs = sorted.length > 0 ? sorted[sorted.length - 1].timestamp : Date.now();
  const cutoffMs = latestTs - Math.max(60, windowSeconds) * 1000;
  const inWindow = sorted.filter((s) => s.timestamp >= cutoffMs);
  const rows = inWindow.length > 0 ? inWindow : sorted;

  const headers = [
    'Szyna',
    'Czas_Etykieta',
    'Timestamp_Ms',
    'ISO_Timestamp',
    'Data_Czas',
    'Napiecie_V',
    'Nominal_V',
    'Odchylka_V',
    'Odchylka_Pct',
    'Prog_ATX_Pct',
    'Przekroczenie_Progu',
    'Pobor_Mocy_W',
  ];

  const lines = rows.map((pt) => {
    const devV = pt.voltageV - nominalV;
    const devPct = nominalV > 0 ? (Math.abs(devV) / nominalV) * 100 : 0;
    const outOfThreshold = devPct > thresholdPct;
    const isoTime = new Date(pt.timestamp).toISOString();
    const localTime = new Date(pt.timestamp).toLocaleString('pl-PL');
    return [
      railName,
      pt.timeLabel,
      pt.timestamp,
      isoTime,
      localTime,
      pt.voltageV.toFixed(4),
      nominalV.toFixed(2),
      `${devV >= 0 ? '+' : ''}${devV.toFixed(4)}`,
      devPct.toFixed(3),
      thresholdPct.toFixed(2),
      outOfThreshold ? 'YES' : 'NO',
      pt.powerW.toFixed(1),
    ]
      .map(csvEscape)
      .join(',');
  });

  return '\uFEFF' + [headers.join(','), ...lines].join('\r\n');
}

export function exportSinglePsuRail5mHistoryToCsv(
  options: SingleRail5mCsvOptions
): { filename: string; count: number; csvContent: string } {
  const windowSeconds = Math.max(60, options.windowSeconds ?? 300);
  const windowMin = Math.max(1, Math.round(windowSeconds / 60));
  const railSlug = options.railName.replace('+', '').replace('.', 'p').toLowerCase();
  const filename = `systempulse-psu-rail-${railSlug}-${windowMin}m-${makeFileStamp()}.csv`;
  const csvContent = buildSinglePsuRail5mCsv(options);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  const sorted = [...(options.samples || [])].sort((a, b) => a.timestamp - b.timestamp);
  const latestTs = sorted.length > 0 ? sorted[sorted.length - 1].timestamp : Date.now();
  const cutoffMs = latestTs - windowSeconds * 1000;
  const inWindow = sorted.filter((s) => s.timestamp >= cutoffMs);
  const count = inWindow.length > 0 ? inWindow.length : sorted.length;
  return { filename, count, csvContent };
}

export interface PsuRailHistorySampleInput {
  timeLabel: string;
  timestamp: number;
  rail12V: number;
  rail5V: number;
  rail3P3V: number;
  powerW: number;
}

export interface PsuRailJsonExportOptions {
  psuMeta?: {
    rating80Plus?: string;
    capacityW?: number;
    tempC?: number;
    efficiencyPct?: number;
    currentLoadPct?: number;
    rippleMv?: number;
    status?: string;
  };
  thresholds?: {
    rail12VThresholdPct: number;
    rail5VThresholdPct: number;
    rail3P3VThresholdPct: number;
    globalDeviationPct?: number;
  };
  alertEvents?: Array<{
    timestamp: number;
    railName: string;
    voltage: number;
    deviationPct: number;
  }>;
}

export interface PsuRailStatsSummary {
  nominalV: number;
  thresholdPct: number;
  minV: number;
  maxV: number;
  avgV: number;
  peakDeviationPct: number;
  outOfThresholdCount: number;
}

export interface PsuRailJsonLog {
  schemaVersion: '1.0';
  application: 'SystemPulse Pro';
  exportedAt: string;
  psuMeta: {
    rating80Plus: string;
    capacityW: number;
    tempC: number | null;
    efficiencyPct: number | null;
    currentLoadPct: number | null;
    rippleMv: number | null;
    status: string;
  };
  thresholds: {
    rail12VThresholdPct: number;
    rail5VThresholdPct: number;
    rail3P3VThresholdPct: number;
    globalDeviationPct: number;
  };
  summary: {
    sampleCount: number;
    timeSpanSeconds: number;
    alertEventCount: number;
    rail12V: PsuRailStatsSummary;
    rail5V: PsuRailStatsSummary;
    rail3P3V: PsuRailStatsSummary;
    powerW: { min: number; max: number; avg: number };
  };
  samples: Array<{
    timestamp: number;
    isoTime: string;
    timeLabel: string;
    rail12V: number;
    rail5V: number;
    rail3P3V: number;
    deviation12VPct: number;
    deviation5VPct: number;
    deviation3P3VPct: number;
    powerW: number;
    outOfThresholdRails: Array<'+12V' | '+5V' | '+3.3V'>;
  }>;
  alertEvents: Array<{
    timestamp: number;
    isoTime: string;
    railName: string;
    voltage: number;
    deviationPct: number;
  }>;
}

function summarizeRail(
  values: number[],
  nominalV: number,
  thresholdPct: number
): PsuRailStatsSummary {
  if (values.length === 0) {
    return {
      nominalV,
      thresholdPct,
      minV: nominalV,
      maxV: nominalV,
      avgV: nominalV,
      peakDeviationPct: 0,
      outOfThresholdCount: 0,
    };
  }
  let minV = values[0];
  let maxV = values[0];
  let sum = 0;
  let peakDev = 0;
  let outCount = 0;
  for (const v of values) {
    if (v < minV) minV = v;
    if (v > maxV) maxV = v;
    sum += v;
    const dev = (Math.abs(v - nominalV) / nominalV) * 100;
    if (dev > peakDev) peakDev = dev;
    if (dev > thresholdPct) outCount++;
  }
  return {
    nominalV,
    thresholdPct,
    minV: Number(minV.toFixed(3)),
    maxV: Number(maxV.toFixed(3)),
    avgV: Number((sum / values.length).toFixed(3)),
    peakDeviationPct: Number(peakDev.toFixed(2)),
    outOfThresholdCount: outCount,
  };
}

export function buildPsuRailHistoryJson(
  railHistory: PsuRailHistorySampleInput[],
  options: PsuRailJsonExportOptions = {}
): { jsonContent: string; payload: PsuRailJsonLog } {
  const ordered = [...(railHistory || [])].sort((a, b) => a.timestamp - b.timestamp);
  const thr12 = options.thresholds?.rail12VThresholdPct ?? 5;
  const thr5 = options.thresholds?.rail5VThresholdPct ?? 5;
  const thr3 = options.thresholds?.rail3P3VThresholdPct ?? 5;
  const globalDev = options.thresholds?.globalDeviationPct ?? 5;

  const samples = ordered.map((entry) => {
    const dev12 = (Math.abs(entry.rail12V - 12.0) / 12.0) * 100;
    const dev5 = (Math.abs(entry.rail5V - 5.0) / 5.0) * 100;
    const dev3 = (Math.abs(entry.rail3P3V - 3.3) / 3.3) * 100;
    const outOfThresholdRails: Array<'+12V' | '+5V' | '+3.3V'> = [];
    if (dev12 > thr12) outOfThresholdRails.push('+12V');
    if (dev5 > thr5) outOfThresholdRails.push('+5V');
    if (dev3 > thr3) outOfThresholdRails.push('+3.3V');
    return {
      timestamp: entry.timestamp,
      isoTime: new Date(entry.timestamp).toISOString(),
      timeLabel: entry.timeLabel,
      rail12V: Number(entry.rail12V.toFixed(3)),
      rail5V: Number(entry.rail5V.toFixed(3)),
      rail3P3V: Number(entry.rail3P3V.toFixed(3)),
      deviation12VPct: Number(dev12.toFixed(2)),
      deviation5VPct: Number(dev5.toFixed(2)),
      deviation3P3VPct: Number(dev3.toFixed(2)),
      powerW: Number(entry.powerW.toFixed(1)),
      outOfThresholdRails,
    };
  });

  const powerVals = ordered.map((e) => e.powerW);
  const powerMin = powerVals.length ? Math.min(...powerVals) : 0;
  const powerMax = powerVals.length ? Math.max(...powerVals) : 0;
  const powerAvg = powerVals.length ? powerVals.reduce((s, v) => s + v, 0) / powerVals.length : 0;
  const timeSpanSeconds =
    ordered.length >= 2
      ? Math.max(0, Math.round((ordered[ordered.length - 1].timestamp - ordered[0].timestamp) / 1000))
      : 0;

  const alertEvents = (options.alertEvents || []).map((ev) => ({
    timestamp: ev.timestamp,
    isoTime: new Date(ev.timestamp).toISOString(),
    railName: ev.railName,
    voltage: Number(ev.voltage.toFixed(3)),
    deviationPct: Number(ev.deviationPct.toFixed(2)),
  }));

  const payload: PsuRailJsonLog = {
    schemaVersion: '1.0',
    application: 'SystemPulse Pro',
    exportedAt: new Date().toISOString(),
    psuMeta: {
      rating80Plus: options.psuMeta?.rating80Plus ?? '80 PLUS Gold',
      capacityW: options.psuMeta?.capacityW ?? 850,
      tempC: options.psuMeta?.tempC ?? null,
      efficiencyPct: options.psuMeta?.efficiencyPct ?? null,
      currentLoadPct: options.psuMeta?.currentLoadPct ?? null,
      rippleMv: options.psuMeta?.rippleMv ?? null,
      status: options.psuMeta?.status ?? 'OK',
    },
    thresholds: {
      rail12VThresholdPct: thr12,
      rail5VThresholdPct: thr5,
      rail3P3VThresholdPct: thr3,
      globalDeviationPct: globalDev,
    },
    summary: {
      sampleCount: samples.length,
      timeSpanSeconds,
      alertEventCount: alertEvents.length,
      rail12V: summarizeRail(ordered.map((e) => e.rail12V), 12.0, thr12),
      rail5V: summarizeRail(ordered.map((e) => e.rail5V), 5.0, thr5),
      rail3P3V: summarizeRail(ordered.map((e) => e.rail3P3V), 3.3, thr3),
      powerW: {
        min: Number(powerMin.toFixed(1)),
        max: Number(powerMax.toFixed(1)),
        avg: Number(powerAvg.toFixed(1)),
      },
    },
    samples,
    alertEvents,
  };

  return {
    jsonContent: JSON.stringify(payload, null, 2),
    payload,
  };
}

export function exportPsuRailHistoryToJson(
  railHistory: PsuRailHistorySampleInput[],
  options: PsuRailJsonExportOptions = {}
): { filename: string; count: number; jsonContent: string; payload: PsuRailJsonLog } {
  const filename = `systempulse-psu-rail-log-${makeFileStamp()}.json`;
  const { jsonContent, payload } = buildPsuRailHistoryJson(railHistory, options);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { filename, count: payload.samples.length, jsonContent, payload };
}

export interface AllPsuRailsRawJsonOptions {
  currentRails: {
    rail12V: number;
    rail5V: number;
    rail3P3V: number;
    powerW?: number;
  };
  thresholds: {
    rail12VThresholdPct: number;
    rail5VThresholdPct: number;
    rail3P3VThresholdPct: number;
  };
  windowSeconds?: number;
}

export function buildAllPsuRailsRawJson(
  railHistory: PsuRailHistorySampleInput[],
  options: AllPsuRailsRawJsonOptions
): { jsonContent: string; payload: Record<string, unknown> } {
  const windowSeconds = Math.max(10, options.windowSeconds ?? 60);
  const sorted = [...(railHistory || [])].sort((a, b) => a.timestamp - b.timestamp);
  const latestTs = sorted.length > 0 ? sorted[sorted.length - 1].timestamp : Date.now();
  const cutoff = latestTs - windowSeconds * 1000;
  const recent = sorted.filter((pt) => pt.timestamp >= cutoff);
  const rows = recent.length > 0 ? recent : sorted.slice(-24);

  const buildRailBlock = (
    railName: '+12V' | '+5V' | '+3.3V',
    nominalV: number,
    currentV: number,
    thresholdPct: number,
    selector: (pt: PsuRailHistorySampleInput) => number
  ) => {
    const sourceRows =
      rows.length > 0
        ? rows
        : [
            {
              timestamp: Date.now(),
              timeLabel: new Date().toLocaleTimeString('pl-PL', { hour12: false }),
              rail12V: options.currentRails.rail12V,
              rail5V: options.currentRails.rail5V,
              rail3P3V: options.currentRails.rail3P3V,
              powerW: options.currentRails.powerW ?? 0,
            },
          ];

    let minV = Infinity;
    let maxV = -Infinity;
    let sumV = 0;
    let peakDevPct = 0;
    let outOfThresholdCount = 0;

    const samples = sourceRows.map((pt) => {
      const voltageV = selector(pt);
      const devPct = nominalV > 0 ? (Math.abs(voltageV - nominalV) / nominalV) * 100 : 0;
      const out = devPct > thresholdPct;
      if (voltageV < minV) minV = voltageV;
      if (voltageV > maxV) maxV = voltageV;
      sumV += voltageV;
      if (devPct > peakDevPct) peakDevPct = devPct;
      if (out) outOfThresholdCount += 1;
      return {
        timestamp: pt.timestamp,
        isoTime: new Date(pt.timestamp).toISOString(),
        timeLabel: pt.timeLabel,
        voltageV: Number(voltageV.toFixed(4)),
        deviationPct: Number(devPct.toFixed(3)),
        outOfThreshold: out,
        powerW: Number(pt.powerW.toFixed(1)),
      };
    });

    return {
      rail: railName,
      nominalV,
      thresholdPct,
      currentV: Number(currentV.toFixed(4)),
      currentDeviationPct: Number(((Math.abs(currentV - nominalV) / nominalV) * 100).toFixed(3)),
      sampleCount: samples.length,
      stats: {
        minV: Number((Number.isFinite(minV) ? minV : currentV).toFixed(4)),
        maxV: Number((Number.isFinite(maxV) ? maxV : currentV).toFixed(4)),
        avgV: Number((samples.length > 0 ? sumV / samples.length : currentV).toFixed(4)),
        peakDeviationPct: Number(peakDevPct.toFixed(3)),
        outOfThresholdCount,
      },
      samples,
    };
  };

  const payload = {
    application: 'SystemPulse Pro',
    exportedAt: new Date().toISOString(),
    windowSeconds,
    rails: {
      '+12V': buildRailBlock(
        '+12V',
        12.0,
        options.currentRails.rail12V,
        options.thresholds.rail12VThresholdPct,
        (pt) => pt.rail12V
      ),
      '+5V': buildRailBlock(
        '+5V',
        5.0,
        options.currentRails.rail5V,
        options.thresholds.rail5VThresholdPct,
        (pt) => pt.rail5V
      ),
      '+3.3V': buildRailBlock(
        '+3.3V',
        3.3,
        options.currentRails.rail3P3V,
        options.thresholds.rail3P3VThresholdPct,
        (pt) => pt.rail3P3V
      ),
    },
  };

  return {
    jsonContent: JSON.stringify(payload, null, 2),
    payload,
  };
}


