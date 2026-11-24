import * as XLSX from 'xlsx';
import { StressSessionRecord } from '../types';

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

function makeFileStamp(): string {
  const now = new Date();
  return `${now.toISOString().slice(0, 10)}_${now.toTimeString().slice(0, 8).replace(/:/g, '-')}`;
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
