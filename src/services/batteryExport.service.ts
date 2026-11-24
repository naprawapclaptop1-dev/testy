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

