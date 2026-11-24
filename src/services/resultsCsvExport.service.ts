import {
  BatteryHealthState,
  CpuTestResult,
  DiskTestResult,
  GameBenchMetrics,
  GpuStressMetrics,
  NetworkTestResult,
  RamTestResult,
  SuiteScores,
  SystemSpecs,
  ThermalHeatMapSnapshot,
} from '../types';
import { HardwareScanSnapshot } from './hardwareScanner.service';

export interface ResultsCsvExportInput {
  systemSpecs: SystemSpecs | null;
  suiteScores: SuiteScores;
  cpuState: CpuTestResult;
  ramState: RamTestResult;
  diskState: DiskTestResult;
  gpuState: GpuStressMetrics;
  gameState: GameBenchMetrics;
  batteryState: BatteryHealthState;
  networkState: NetworkTestResult;
  hardwareScan: HardwareScanSnapshot | null;
  thermalState?: ThermalHeatMapSnapshot;
}

interface CsvRow {
  section: string;
  parameter: string;
  value: string | number;
  unit: string;
  details: string;
}

export function escapeCsvCell(val: string | number | null | undefined): string {
  const s = val === null || val === undefined ? '' : String(val);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function buildResultsAndSpecsCsv(input: ResultsCsvExportInput, now = new Date()): string {
  const s = input.systemSpecs;
  const sc = input.suiteScores;
  const cpu = input.cpuState;
  const ram = input.ramState;
  const disk = input.diskState;
  const gpu = input.gpuState;
  const game = input.gameState;
  const bat = input.batteryState;
  const net = input.networkState;
  const panel = input.hardwareScan?.panel;

  const rows: CsvRow[] = [
    // Meta & overall score
    {
      section: 'Podsumowanie',
      parameter: 'Aplikacja',
      value: 'SystemPulse Pro',
      unit: '',
      details: `Wygenerowano: ${now.toISOString()}`,
    },
    {
      section: 'Wyniki testów',
      parameter: 'Ogólny indeks systemu',
      value: sc.overall,
      unit: '/ 100',
      details: sc.overall > 0 ? `Ocena: ${sc.grade}` : 'Nie wykonano pełnego testu',
    },
    // CPU
    {
      section: 'Wyniki testów',
      parameter: 'CPU — Wynik ogólny',
      value: sc.cpu,
      unit: '/ 100',
      details: `Klasa: ${cpu.grade}`,
    },
    {
      section: 'Wyniki testów',
      parameter: 'CPU — Single-Core',
      value: cpu.singleCoreScore,
      unit: 'pkt',
      details: '1 wątek Web Worker',
    },
    {
      section: 'Wyniki testów',
      parameter: 'CPU — Multi-Core',
      value: cpu.multiCoreScore,
      unit: 'pkt',
      details: `${cpu.coresUsed} wątków · Skalowanie ${cpu.scalingRatio}x`,
    },
    {
      section: 'Wyniki testów',
      parameter: 'CPU — Taktowanie (śr. / szczyt)',
      value: `${cpu.avgClockGHz.toFixed(2)} / ${cpu.peakClockGHz.toFixed(2)}`,
      unit: 'GHz',
      details: `Throttling: ${cpu.throttlingPct}% · Stabilność: ${cpu.stabilityPct}%`,
    },
    {
      section: 'Wyniki testów',
      parameter: 'CPU — Kompresja GZIP / SHA-256',
      value: `${cpu.compressionMBs} / ${cpu.cryptoSha256MBs}`,
      unit: 'MB/s',
      details: `Math: ${cpu.mathMflops} kOps/s`,
    },
    // RAM
    {
      section: 'Wyniki testów',
      parameter: 'RAM — Wynik ogólny',
      value: sc.ram,
      unit: '/ 100',
      details: `Stan: ${ram.healthGrade} · Błędy: ${ram.errorsFound}`,
    },
    {
      section: 'Wyniki testów',
      parameter: 'RAM — Odczyt / Zapis',
      value: `${ram.bandwidthReadMBs} / ${ram.bandwidthWriteMBs}`,
      unit: 'MB/s',
      details: `Opóźnienie: ${ram.latencyNs} ns · Bufor: ${ram.allocatedMB} MB`,
    },
    // Disk
    {
      section: 'Wyniki testów',
      parameter: 'Dysk — Wynik ogólny',
      value: sc.disk,
      unit: '/ 100',
      details: `SMART: ${disk.smartStatus}`,
    },
    {
      section: 'Wyniki testów',
      parameter: 'Dysk — Odczyt / Zapis sekwencyjny',
      value: `${disk.seqReadMBs} / ${disk.seqWriteMBs}`,
      unit: 'MB/s',
      details: `Losowe 4K: ${disk.rand4kIops} IOPS (${disk.rand4kReadMBs}/${disk.rand4kWriteMBs} MB/s) · Dostęp: ${disk.accessTimeAvgMs} ms`,
    },
    // GPU
    {
      section: 'Wyniki testów',
      parameter: 'GPU 3D — Wynik ogólny',
      value: sc.gpu,
      unit: '/ 100',
      details: `Werdykt: ${gpu.verdict} · Tryb: ${gpu.fpsMode}`,
    },
    {
      section: 'Wyniki testów',
      parameter: 'GPU 3D — Średnie / Max / 1% Low FPS',
      value: `${gpu.avgFps} / ${gpu.maxFps} / ${gpu.low1PctFps}`,
      unit: 'FPS',
      details: `Frame-time: ${gpu.frameTimeMs} ms · Stabilność: ${gpu.stabilityPct}%`,
    },
    // Game 3D MAX
    {
      section: 'Wyniki testów',
      parameter: 'Gra 3D MAX — Indeks gamingowy',
      value: game.overallScore,
      unit: '/ 100',
      details: `Preset: ${game.preset} · Śr. FPS: ${game.avgFps} · 1% Low: ${game.low1PctFps}`,
    },
    // Battery
    {
      section: 'Wyniki testów',
      parameter: 'Bateria — Zdrowie / Zużycie (Wear)',
      value: `${bat.healthPct} / ${bat.wearLevelPct}`,
      unit: '%',
      details: `Kondycja: ${bat.condition} · Poziom: ${bat.levelPct}% · Cykle: ${bat.powerCycles.length}`,
    },
    {
      section: 'Wyniki testów',
      parameter: 'Bateria — Pojemność pełna / fabryczna',
      value: `${bat.fullChargeCapacityMWh} / ${bat.designCapacityMWh}`,
      unit: 'mWh',
      details: `Pobór mocy: ${bat.currentPowerDrawW} W`,
    },
    // Network
    {
      section: 'Wyniki testów',
      parameter: 'Sieć — Ping średni / Jitter',
      value: `${net.pingAvgMs} / ${net.jitterMs}`,
      unit: 'ms',
      details: `Ocena: ${net.qualityGrade} · Straty: ${net.packetLossPct}% · Transfer: ${net.downloadEstMbps} Mbps`,
    },

    // Hardware specs
    {
      section: 'Specyfikacja sprzętu',
      parameter: 'System operacyjny',
      value: s ? `${s.os} (${s.platform})` : 'Nieznany',
      unit: '',
      details: s ? `Przeglądarka: ${s.browser}` : '',
    },
    {
      section: 'Specyfikacja sprzętu',
      parameter: 'Rdzenie logiczne CPU',
      value: s ? s.cpuCores : cpu.coresUsed,
      unit: 'wątków',
      details: 'navigator.hardwareConcurrency',
    },
    {
      section: 'Specyfikacja sprzętu',
      parameter: 'Pamięć RAM (API)',
      value: s ? (typeof s.deviceMemory === 'number' ? `>= ${s.deviceMemory}` : s.deviceMemory) : 'Nieznana',
      unit: s && typeof s.deviceMemory === 'number' ? 'GB' : '',
      details: 'navigator.deviceMemory',
    },
    {
      section: 'Specyfikacja sprzętu',
      parameter: 'Karta graficzna (GPU Renderer)',
      value: s ? s.gpuRenderer : 'Nieznana',
      unit: '',
      details: s ? `Vendor: ${s.gpuVendor} · ${s.webglVersion} · Max tekstura: ${s.maxTextureSize}px` : '',
    },
    {
      section: 'Specyfikacja sprzętu',
      parameter: 'Ekran / Matryca',
      value: panel
        ? panel.label
        : s
          ? `${s.screenResolution} @ ${s.estimatedRefreshRate} Hz`
          : 'Nieznany',
      unit: '',
      details: panel
        ? `${panel.nativeResolution} @ ${panel.refreshRateHz} Hz · ${panel.colorGamut} · ${panel.hdrSupported ? 'HDR' : 'SDR'}`
        : s
          ? `${s.colorDepth}-bit · DPR ${s.devicePixelRatio}`
          : '',
    },
    {
      section: 'Specyfikacja sprzętu',
      parameter: 'Pula przestrzeni dyskowej przeglądarki',
      value: s && s.storageQuotaGB !== null ? s.storageQuotaGB : 'Dostępna',
      unit: s && s.storageQuotaGB !== null ? 'GB' : '',
      details: s && s.storageUsageMB !== null ? `Użyto: ${s.storageUsageMB} MB` : '',
    },
    {
      section: 'Specyfikacja sprzętu',
      parameter: 'Połączenie sieciowe',
      value: s ? `${s.online ? 'Online' : 'Offline'} (${s.connectionType})` : 'Nieznane',
      unit: '',
      details: s && typeof s.rtt === 'number' ? `RTT: ${s.rtt} ms` : '',
    },
  ];

  if (input.thermalState) {
    rows.push({
      section: 'Specyfikacja sprzętu',
      parameter: 'Źródło czujników temperatury',
      value: input.thermalState.bridgeStatus,
      unit: '',
      details: `Tryb: ${input.thermalState.sensorMode} · Strefy: ${input.thermalState.rows.length}`,
    });
  }

  const headers = ['Sekcja', 'Parametr', 'Wartość', 'Jednostka', 'Status / Szczegóły'];
  const lines = rows.map((r) =>
    [r.section, r.parameter, r.value, r.unit, r.details].map(escapeCsvCell).join(',')
  );
  return '\uFEFF' + [headers.join(','), ...lines].join('\r\n');
}

export function downloadResultsCsv(
  input: ResultsCsvExportInput
): { filename: string; rowCount: number; csvContent: string } {
  const now = new Date();
  const stamp = `${now.toISOString().slice(0, 10)}_${now.toTimeString().slice(0, 8).replace(/:/g, '-')}`;
  const filename = `systempulse-results-${stamp}.csv`;
  const csvContent = buildResultsAndSpecsCsv(input, now);

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);

  const rowCount = Math.max(0, csvContent.split('\r\n').length - 1);
  return { filename, rowCount, csvContent };
}

export const downloadResultsAndSpecsCsv = downloadResultsCsv;
