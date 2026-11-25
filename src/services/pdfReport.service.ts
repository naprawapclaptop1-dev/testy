import { jsPDF } from 'jspdf';
import {
  BatteryHealthState,
  ComponentScanCard,
  CpuTestResult,
  DiskTestResult,
  GameBenchMetrics,
  GpuSceneMode,
  GpuStressMetrics,
  NetworkTestResult,
  RamTestResult,
  SchedulerSummaryReport,
  StressSessionRecord,
  SuiteScores,
  SystemSpecs,
  ThermalHeatMapSnapshot,
} from '../types';
import { HardwareScanSnapshot } from './hardwareScanner.service';
import { diskTestService } from './diskTest.service';
import {
  computeHardwarePowerIndex,
  evaluateGamePlayabilitySummary,
  evaluatePcSuitability,
  predictPlayableGames,
} from '../ui/pcSuitabilityAndGamesReport';
import { computePcRankingSnapshot } from '../ui/pcRankingReport';

export interface GpuSuitePdfRow {
  sceneId: GpuSceneMode;
  name: string;
  targetUnit: string;
  avgFps: number;
  low1PctFps: number;
  triangles: number;
  stabilityPct: number;
  score: number;
}

export interface PdfReportPayload {
  specs: SystemSpecs | null;
  scores: SuiteScores;
  cpu: CpuTestResult;
  ram: RamTestResult;
  disk: DiskTestResult;
  gpu: GpuStressMetrics;
  game?: GameBenchMetrics;
  network?: NetworkTestResult;
  battery: BatteryHealthState;
  realCpuTempC?: number | null;
  realGpuTempC?: number | null;
  hardwareScan?: HardwareScanSnapshot | null;
  componentScans?: ComponentScanCard[];
  thermalState?: ThermalHeatMapSnapshot | null;
  gpuSuiteResults?: GpuSuitePdfRow[];
  stressHistory?: StressSessionRecord[];
}

const PL_MAP: Record<string, string> = {
  ą: 'a',
  ć: 'c',
  ę: 'e',
  ł: 'l',
  ń: 'n',
  ó: 'o',
  ś: 's',
  ź: 'z',
  ż: 'z',
  Ą: 'A',
  Ć: 'C',
  Ę: 'E',
  Ł: 'L',
  Ń: 'N',
  Ó: 'O',
  Ś: 'S',
  Ź: 'Z',
  Ż: 'Z',
  '×': 'x',
  '—': '-',
  '–': '-',
  '·': '|',
  '≥': '>=',
  '≤': '<=',
  '°': ' ',
  '✓': 'OK',
  '✔': 'OK',
  '⚠️': 'UWAGA:',
  '⚠': 'UWAGA:',
};

function pdfText(input: string | number | null | undefined): string {
  const s = String(input ?? '-');
  return s
    .replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ×—–·≥≤°✓✔⚠]/g, (ch) => PL_MAP[ch] ?? ch)
    .replace(/[^\x20-\x7E]/g, '');
}

function truncateText(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, Math.max(4, maxLen - 3)) + '...';
}

function fitTextToWidth(doc: jsPDF, rawText: string, maxWidthMm: number): string {
  const clean = pdfText(rawText);
  if (doc.getTextWidth(clean) <= maxWidthMm) return clean;
  let end = clean.length;
  while (end > 3 && doc.getTextWidth(clean.slice(0, end) + '...') > maxWidthMm) {
    end -= 1;
  }
  return clean.slice(0, Math.max(1, end)) + '...';
}

export function snapStandardMonitorHz(rawHz: number | null | undefined): number {
  const hz = Number(rawHz || 60);
  if (!Number.isFinite(hz) || hz <= 0) return 60;
  const standards = [60, 75, 90, 100, 120, 144, 165, 170, 175, 180, 200, 240, 280, 300, 360, 480];
  let best = Math.round(hz);
  let bestDiff = Infinity;
  for (const std of standards) {
    const diff = Math.abs(hz - std);
    if (diff <= Math.max(3.5, std * 0.025) && diff < bestDiff) {
      bestDiff = diff;
      best = std;
    }
  }
  return best;
}

export function cleanGpuModelFromAngle(
  rawRenderer: string | null | undefined,
  rawVendor: string | null | undefined
): {
  cleanModel: string;
  cleanVendor: string;
  backendApi: string;
  pciId: string;
} {
  const r = String(rawRenderer || 'Akcelerator Graficzny 3D').trim();
  const v = String(rawVendor || '').trim();

  const pciMatch = r.match(/\((0x[0-9a-fA-F]+)\)/);
  const pciId = pciMatch ? pciMatch[1] : '';

  let cleanModel = r;
  let backendApi = 'Direct3D 11 / WebGL 2.0';
  const angleMatch = r.match(/ANGLE\s*\(\s*([^,]+),\s*([^,]+?)(?:\s*\(0x[0-9a-fA-F]+\))?(?:\s+Direct3D11|\s+Direct3D|\s+Vulkan|\s+OpenGL|,|$)/i);
  if (angleMatch && angleMatch[2]) {
    cleanModel = angleMatch[2].replace(/\s*\(0x[0-9a-fA-F]+\)\s*/i, '').trim();
    if (/Direct3D11/i.test(r)) {
      const sm = r.match(/vs_5_0\s+ps_5_0/i) ? ' (Shader Model 5.0)' : '';
      backendApi = `Direct3D 11${sm}`;
    } else if (/Vulkan/i.test(r)) {
      backendApi = 'Vulkan API';
    } else if (/OpenGL/i.test(r)) {
      backendApi = 'OpenGL / ANGLE';
    }
  } else {
    cleanModel = r.replace(/^ANGLE\s*\(/i, '').replace(/\)$/i, '').trim();
  }

  let cleanVendor = v || 'Nieznany producent';
  if (/AMD|Radeon/i.test(r) || /AMD/i.test(v)) {
    cleanVendor = 'AMD (Advanced Micro Devices)';
  } else if (/NVIDIA|GeForce|RTX|GTX/i.test(r) || /NVIDIA/i.test(v)) {
    cleanVendor = 'NVIDIA Corporation';
  } else if (/Intel|Arc|Iris|UHD/i.test(r) || /Intel/i.test(v)) {
    cleanVendor = 'Intel Corporation';
  } else if (/Apple/i.test(r) || /Apple/i.test(v)) {
    cleanVendor = 'Apple Silicon GPU';
  }

  return {
    cleanModel: pciId ? `${cleanModel} (PCI ID: ${pciId})` : cleanModel,
    cleanVendor,
    backendApi,
    pciId,
  };
}

export function cleanWebGpuSummaryForPdf(rawSummary: string | null | undefined): string {
  const s = String(rawSummary || 'Aktywny').trim();
  return s
    .replace(/^WebGPU:\s*/i, '')
    .replace(/\s*\(MaxBuf\s*\d+\s*MB\)/gi, '')
    .trim() || 'Aktywny (Shader FP16 / Compute)';
}

/**
 * Draws the official vector service emblem & brand card from g.png:
 * Glowing cyan monitor with 4 left circuit trace lines/nodes on dark navy PCB card:
 * NAPRAWA KOMPUTEROW I LAPTOPOW - Rafal Jarosz
 * NAPRAWAPCLAPTOP.PL | 786 409 187 | WARSZAWA, UL. MARYMONCKA 125 M.109 P.6
 */
export function drawRafalJaroszServiceLogoPdf(
  doc: jsPDF,
  x: number,
  y: number,
  w = 66,
  h = 24
): void {
  // Dark Navy PCB background card (#02152b) with Cyan (#00d8ff) border
  doc.setFillColor(2, 21, 43);
  doc.setDrawColor(0, 216, 255);
  doc.setLineWidth(0.45);
  doc.roundedRect(x, y, w, h, 2.2, 2.2, 'FD');

  // Subtle decorative circuit trace lines in corner
  doc.setDrawColor(7, 58, 94);
  doc.setLineWidth(0.2);
  doc.line(x + w - 12, y + 1.5, x + w - 6, y + 1.5);
  doc.line(x + w - 6, y + 1.5, x + w - 3, y + 4.5);
  doc.circle(x + w - 12.6, y + 1.5, 0.45, 'S');

  // Glowing cyan monitor icon with 4 left circuit trace lines & circular nodes (matching g.png)
  const monX = x + 8.6;
  const monY = y + 3.4;
  const monW = 10.6;
  const monH = 7.0;

  doc.setDrawColor(0, 216, 255);
  doc.setFillColor(0, 216, 255);
  doc.setLineWidth(0.65);
  // Outer monitor bezel
  doc.roundedRect(monX, monY, monW, monH, 0.8, 0.8, 'S');
  // Inner screen frame
  doc.setLineWidth(0.25);
  doc.rect(monX + 0.9, monY + 0.8, monW - 1.8, monH - 1.7, 'S');
  // Monitor neck & base stand
  doc.setFillColor(0, 216, 255);
  doc.rect(monX + monW / 2 - 1.1, monY + monH, 2.2, 1.3, 'F');
  doc.roundedRect(monX + monW / 2 - 3.1, monY + monH + 1.2, 6.2, 0.9, 0.4, 0.4, 'F');

  // 4 left circuit trace lines & nodes extending from the left side of the monitor
  doc.setLineWidth(0.48);
  // Trace 1 (top angled up-left)
  doc.line(monX, monY + 1.4, monX - 2.6, monY + 1.4);
  doc.line(monX - 2.6, monY + 1.4, monX - 3.8, monY + 0.3);
  doc.circle(monX - 4.2, monY + 0.1, 0.55, 'F');
  // Trace 2 (upper-middle angled up-left)
  doc.line(monX, monY + 2.9, monX - 3.6, monY + 2.9);
  doc.line(monX - 3.6, monY + 2.9, monX - 4.7, monY + 2.0);
  doc.circle(monX - 5.1, monY + 1.8, 0.55, 'F');
  // Trace 3 (lower-middle angled down-left)
  doc.line(monX, monY + 4.4, monX - 3.4, monY + 4.4);
  doc.line(monX - 3.4, monY + 4.4, monX - 4.4, monY + 5.4);
  doc.circle(monX - 4.8, monY + 5.6, 0.55, 'F');
  // Trace 4 (bottom straight left)
  doc.line(monX, monY + 5.8, monX - 2.3, monY + 5.8);
  doc.circle(monX - 2.8, monY + 5.8, 0.55, 'F');

  // Text block inside logo card (right of monitor emblem & bottom full width)
  const tx = monX + monW + 2.4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.6);
  doc.setTextColor(0, 216, 255);
  doc.text('NAPRAWA KOMPUTEROW', tx, y + 5.5);
  doc.text('I LAPTOPOW', tx, y + 8.6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(255, 255, 255);
  doc.text('Rafal Jarosz', tx, y + 12.1);

  // Divider line inside card
  doc.setDrawColor(14, 116, 144);
  doc.setLineWidth(0.22);
  doc.line(x + 2.5, y + 14.2, x + w - 2.5, y + 14.2);

  // Website & Phone
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.3);
  doc.setTextColor(241, 245, 249);
  doc.text('NAPRAWAPCLAPTOP.PL  |  786 409 187', x + w / 2, y + 17.7, { align: 'center' });

  // Address
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(186, 230, 253);
  doc.text('WARSZAWA, UL. MARYMONCKA 125 M.109 P.6', x + w / 2, y + 21.3, { align: 'center' });
}

export function buildDiagnosticPdfDocument(payload: PdfReportPayload): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;
  const pageH = 297;
  const margin = 13;
  const contentW = pageW - margin * 2;
  const bottomLimit = 276;

  const {
    specs,
    scores,
    cpu,
    ram,
    disk,
    gpu,
    game,
    network,
    battery,
    realCpuTempC,
    realGpuTempC,
    hardwareScan,
    componentScans = [],
    thermalState,
    gpuSuiteResults = [],
    stressHistory = [],
  } = payload;

  const now = new Date();
  const nowStr = now.toLocaleString('pl-PL');
  const reportId = `SP-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

  const suitabilityCtx = {
    specs,
    cpu,
    ram,
    disk,
    gpu,
    game: game ?? ({
      avgFps: 0,
      fps: 0,
      low1PctFps: 0,
      low01PctFps: 0,
      overallScore: 0,
      stabilityPct: 0,
      preset: 'ultra',
      fpsMode: 'uncapped',
      verdict: 'OCZEKIWANIE',
    } as GameBenchMetrics),
  };

  const hwIndex = computeHardwarePowerIndex(suitabilityCtx);
  const gamesList = predictPlayableGames(suitabilityCtx);
  const gamesSummary = evaluateGamePlayabilitySummary(gamesList);
  const suitabilityList = evaluatePcSuitability(suitabilityCtx);
  const rankingSnap = computePcRankingSnapshot({
    ...suitabilityCtx,
    scores,
  });

  // Determine overall service health verdict
  const hasCriticalFault =
    ram.errorsFound > 0 ||
    disk.smartStatus === 'KRYTYCZNY' ||
    battery.healthPct < 55 ||
    (battery.psu?.status && battery.psu.status !== 'STABILNY');
  const hasMinorWarning =
    disk.smartStatus === 'UWAGA' ||
    battery.healthPct < 75 ||
    (gpu.avgFps > 0 && gpu.stabilityPct < 75) ||
    (network && network.packetLossPct > 2);

  const serviceVerdict = hasCriticalFault
    ? 'WYKRYTO USTERKI / WYMAGA SERWISU'
    : hasMinorWarning
      ? 'SPRAWNY Z UWAGAMI (ZALECANA KONSERWACJA)'
      : scores.overall > 0
        ? 'SPRZET W PELNI SPRAWNY - ZALICZONO TESTY'
        : 'RAPORT WSTEPNY (ZALECANY PELNY TEST)';

  const verdictColor: [number, number, number] = hasCriticalFault
    ? [225, 29, 72]
    : hasMinorWarning
      ? [217, 119, 6]
      : [5, 150, 105];

  let y = 42;

  const drawContinuationHeader = (sectionBanner: string) => {
    doc.setFillColor(12, 18, 30);
    doc.rect(0, 0, pageW, 16, 'F');
    doc.setFillColor(6, 182, 212);
    doc.rect(0, 15.2, pageW, 0.8, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(241, 245, 249);
    doc.text('SystemPulse Pro - Rozszerzony Raport Diagnostyczny PC / Laptopa', margin, 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(pdfText(`${sectionBanner} | ID: ${reportId}`), pageW - margin, 10, { align: 'right' });
    y = 23;
  };

  const ensureSpace = (neededMm: number, nextBanner = 'Kontynuacja raportu') => {
    if (y + neededMm > bottomLimit) {
      doc.addPage();
      drawContinuationHeader(nextBanner);
    }
  };

  const drawSectionHeading = (title: string, subtitle?: string) => {
    ensureSpace(subtitle ? 15 : 11, title);
    doc.setFillColor(6, 182, 212);
    doc.rect(margin, y - 3.6, 2.2, 4.8, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text(pdfText(title), margin + 4.5, y);

    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.line(margin, y + 2, pageW - margin, y + 2);
    y += 5.8;

    if (subtitle) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.8);
      doc.setTextColor(100, 116, 139);
      doc.text(fitTextToWidth(doc, subtitle, contentW), margin, y);
      y += 4.6;
    }
  };

  const drawDetailCard = (
    x: number,
    topY: number,
    w: number,
    cardH: number,
    title: string,
    rows: Array<[string, string]>,
    accentRgb: [number, number, number] = [6, 182, 212]
  ) => {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.25);
    doc.roundedRect(x, topY, w, cardH, 2, 2, 'FD');

    doc.setFillColor(accentRgb[0], accentRgb[1], accentRgb[2]);
    doc.rect(x, topY + 2, 1.5, 5.2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.8);
    doc.setTextColor(15, 23, 42);
    doc.text(fitTextToWidth(doc, title, w - 8), x + 4.5, topY + 6);

    doc.setDrawColor(226, 232, 240);
    doc.line(x + 4, topY + 8, x + w - 4, topY + 8);

    let ry = topY + 12.6;
    const labelMaxW = w * 0.48;
    const valMaxW = w * 0.46;
    doc.setFontSize(7.6);
    for (const [label, val] of rows) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(fitTextToWidth(doc, label, labelMaxW), x + 4, ry);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(fitTextToWidth(doc, val, valMaxW), x + w - 4, ry, { align: 'right' });
      ry += 4.9;
    }
  };

  // =========================================================================
  // STRONA 1: NAGLOWEK Z LOGO SERWISU RAFAL JAROSZ, WERDYKT, SPECYFIKACJA
  // =========================================================================
  doc.setFillColor(12, 18, 30);
  doc.rect(0, 0, pageW, 35, 'F');
  doc.setFillColor(6, 182, 212);
  doc.rect(0, 34, pageW, 1.2, 'F');

  doc.setTextColor(241, 245, 249);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15.5);
  doc.text('SystemPulse Pro', margin, 12.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(148, 163, 184);
  doc.text(pdfText('Kompleksowy Raport Diagnostyczny PC / Laptopa (A4)'), margin, 18.8);
  doc.text(pdfText(`Data: ${nowStr}`), margin, 24.0);
  doc.text(pdfText(`Nr raportu: ${reportId}`), margin, 29.0);

  // Official Service Logo Card (NAPRAWA KOMPUTEROW I LAPTOPOW - Rafal Jarosz)
  drawRafalJaroszServiceLogoPdf(doc, pageW - margin - 115, 5.2, 62, 23.6);

  // Ranking & Grade Badge in Header
  doc.setFillColor(20, 29, 46);
  doc.setDrawColor(6, 182, 212);
  doc.setLineWidth(0.5);
  doc.roundedRect(pageW - margin - 50, 5.2, 50, 23.6, 2.5, 2.5, 'FD');

  doc.setTextColor(6, 182, 212);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17.5);
  doc.text(scores.overall > 0 ? scores.grade : '--', pageW - margin - 40.5, 18.5, { align: 'center' });

  doc.setTextColor(241, 245, 249);
  doc.setFontSize(10.2);
  doc.text(
    scores.overall > 0 ? `${scores.overall}/100` : `${rankingSnap.currentEntry.overallScore}/100`,
    pageW - margin - 17.5,
    14.5,
    { align: 'center' }
  );
  doc.setTextColor(52, 211, 153);
  doc.setFontSize(7.0);
  doc.text(
    pdfText(`POZ. #${rankingSnap.currentRank}/${rankingSnap.totalRanked} (TOP ${Math.max(1, 100 - rankingSnap.percentileBetterThan)}%)`),
    pageW - margin - 17.5,
    20.2,
    { align: 'center' }
  );
  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.3);
  doc.text('INDEKS & RANKING', pageW - margin - 17.5, 25.2, { align: 'center' });

  // Service Verdict Banner
  y = 40;
  doc.setFillColor(verdictColor[0], verdictColor[1], verdictColor[2]);
  doc.roundedRect(margin, y, contentW, 9.5, 1.8, 1.8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  doc.setTextColor(255, 255, 255);
  doc.text(pdfText(`WERDYKT SERWISOWY: ${serviceVerdict}`), margin + 4, y + 6.2);
  doc.setFontSize(8);
  doc.text(
    pdfText(`Gry 60+ FPS: ${gamesSummary.smoothOrBetterCount}/${gamesSummary.total} | Klasa: ${rankingSnap.tierBadge}`),
    pageW - margin - 4,
    y + 6.2,
    { align: 'right' }
  );
  y += 15;

  // --- Section 1: Hardware Inventory (ZERO OVERLAP — Safe single/two-column rows) ---
  drawSectionHeading(
    '1. Pelna specyfikacja wykrytego sprzetu i srodowiska',
    'Automatyczny odczyt GPU, CPU, pamieci RAM, matrycy EDID oraz danych z lokalnego skanera SMBIOS / WMI'
  );

  const deep = hardwareScan?.deepInventory;
  const gpuClean = cleanGpuModelFromAngle(specs?.gpuRenderer, specs?.gpuVendor);
  const snappedHz = snapStandardMonitorHz(hardwareScan?.panel?.refreshRateHz ?? specs?.estimatedRefreshRate);
  const totalSmbiosRamGb =
    deep?.ramModules && deep.ramModules.length > 0
      ? Math.round(deep.ramModules.reduce((acc, m) => acc + (m.capacityGB || 0), 0))
      : 0;
  const ramDisplayStr =
    totalSmbiosRamGb > 0 && deep?.ramModules
      ? `${totalSmbiosRamGb} GB (${deep.ramModules.length}x ${deep.ramModules[0].memoryType} @ ${deep.ramModules[0].speedMHz} MHz)`
      : specs
        ? typeof specs.deviceMemory === 'number'
          ? `>= ${specs.deviceMemory} GB (limit prywatnosci API)`
          : String(specs.deviceMemory)
        : '-';

  const fullWidthSpecs: Array<[string, string]> = [
    ['System / Platforma', specs ? `${specs.os} (${specs.platform})` : 'Nieznany'],
    [
      'Karta graficzna (GPU)',
      deep?.gpus?.[0]?.name
        ? `${deep.gpus[0].name} (${deep.gpus[0].vramGB || `~${hwIndex.vramEstGb} GB`}) [${gpuClean.cleanVendor}]`
        : `${gpuClean.cleanModel} [${gpuClean.cleanVendor} | ${gpuClean.backendApi}]`,
    ],
  ];
  if (deep?.cpuModel) {
    fullWidthSpecs.push(['Procesor (CPU Model)', `${deep.cpuModel} (${deep.cpuDetails || `${specs?.cpuCores ?? '-'} watkow`})`]);
  }
  if (hardwareScan?.panel?.label) {
    fullWidthSpecs.push([
      'Model matrycy (EDID)',
      `${hardwareScan.panel.label} (${hardwareScan.panel.nativeResolution} @ ${snappedHz} Hz)`,
    ]);
  }

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.25);
  const specBoxY = y;
  const pairedSpecs: Array<[string, string, string, string]> = [
    [
      'Watki logiczne CPU',
      specs ? `${specs.cpuCores} watkow` : '-',
      'Pamiec RAM',
      ramDisplayStr,
    ],
    [
      'Ekran / Odswiezanie',
      specs ? `${hardwareScan?.panel?.nativeResolution || specs.screenResolution} | ${snappedHz} Hz (${specs.colorDepth}-bit)` : '-',
      'WebGL / WebGPU',
      specs ? `${specs.webglVersion} | MaxTex ${specs.maxTextureSize}px` : '-',
    ],
    [
      'Przegladarka / Silnik',
      specs ? specs.browser : '-',
      'Bufor I/O (OPFS)',
      specs && specs.storageQuotaGB
        ? `Sandbox I/O: ${specs.storageQuotaGB} GB`
        : 'Aktywny (Native OPFS)',
    ],
    [
      'Pamiec VRAM (klasa)',
      deep?.gpus?.[0]?.vramGB ? `${deep.gpus[0].vramGB} VRAM` : `~${hwIndex.vramEstGb} GB VRAM`,
      'Przestrzen barw / HDR',
      hardwareScan?.panel
        ? `${hardwareScan.panel.colorGamut} | ${hardwareScan.panel.hdrSupported ? 'HDR' : 'SDR'}`
        : specs
          ? `${specs.colorDepth}-bit SDR`
          : '-',
    ],
  ];

  // Add Deep Inventory row if available (Motherboard / BIOS / Physical Disks)
  if (deep?.motherboard) {
    fullWidthSpecs.push([
      'Plyta glowna / BIOS',
      `${deep.motherboard} | BIOS: ${deep.bios || '-'}`,
    ]);
  }
  if (deep?.ramModules && deep.ramModules.length > 0) {
    const ramSticksSummary = deep.ramModules
      .slice(0, 4)
      .map((m) => `${m.slot}: ${m.manufacturer} ${m.partNumber} (${m.capacityGB} GB ${m.memoryType}-${m.speedMHz})`)
      .join(' ; ');
    fullWidthSpecs.push(['Moduly RAM (SMBIOS)', ramSticksSummary]);
  }
  if (deep?.disks && deep.disks.length > 0) {
    const diskNames = deep.disks
      .slice(0, 3)
      .map((d) => `${d.model} (${d.sizeGB} GB ${d.interfaceType || ''})`)
      .join(' ; ');
    fullWidthSpecs.push(['Dyski fizyczne (WMI)', diskNames]);
  }

  const specBoxH = fullWidthSpecs.length * 5.2 + pairedSpecs.length * 5.2 + 5.5;
  doc.roundedRect(margin, specBoxY, contentW, specBoxH, 2, 2, 'FD');

  let sy = specBoxY + 5.2;
  doc.setFontSize(7.9);
  for (const [k, v] of fullWidthSpecs) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text(pdfText(k + ':'), margin + 3.5, sy);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(fitTextToWidth(doc, v, contentW - 43), margin + 39, sy);
    sy += 5.2;
  }

  const leftColLabelX = margin + 3.5;
  const leftColValX = margin + 39;
  const leftValMaxW = 50;
  const rightColLabelX = margin + 93;
  const rightColValX = margin + 129;
  const rightValMaxW = contentW - 132;

  for (const [k1, v1, k2, v2] of pairedSpecs) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text(fitTextToWidth(doc, k1 + ':', 34), leftColLabelX, sy);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(fitTextToWidth(doc, v1, leftValMaxW), leftColValX, sy);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text(fitTextToWidth(doc, k2 + ':', 34), rightColLabelX, sy);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(fitTextToWidth(doc, v2, rightValMaxW), rightColValX, sy);
    sy += 5.2;
  }

  y = specBoxY + specBoxH + 6;

  // --- Section 2: Benchmark Score Bars ---
  drawSectionHeading('2. Podsumowanie wynikow wszystkich podzespolow (skala 0-100)');

  const netScore =
    network && network.pingAvgMs > 0
      ? network.qualityGrade === 'WZOROWA'
        ? 95
        : network.qualityGrade === 'DOBRA'
          ? 78
          : 48
      : 0;

  const barItems: Array<{ label: string; score: number; detail: string }> = [
    {
      label: 'Procesor (CPU)',
      score: scores.cpu,
      detail:
        cpu.multiCoreScore > 0
          ? `SC ${cpu.singleCoreScore} / MC ${cpu.multiCoreScore} pkt (${cpu.grade}) | Skalowanie ${cpu.scalingRatio}x`
          : 'Nie testowano',
    },
    {
      label: 'Pamiec RAM',
      score: rankingSnap.currentEntry.ramScore || scores.ram,
      detail:
        ram.bandwidthReadMBs > 0
          ? `Odczyt ${ram.bandwidthReadMBs} / Zapis ${ram.bandwidthWriteMBs} MB/s | Bledy: ${ram.errorsFound} (${ram.healthGrade})`
          : 'Nie testowano',
    },
    {
      label: 'Dysk SSD/HDD',
      score: scores.disk,
      detail:
        disk.seqReadMBs > 0
          ? `Seq ${disk.seqReadMBs}/${disk.seqWriteMBs} MB/s | 4K: ${disk.rand4kIops} IOPS | SMART: ${disk.smartStatus}`
          : 'Nie testowano',
    },
    {
      label: 'Grafika 3D (GPU)',
      score: scores.gpu,
      detail:
        gpu.avgFps > 0
          ? `Sr. ${gpu.avgFps} FPS (Max ${gpu.maxFps} / 1% Low ${Math.min(gpu.avgFps, gpu.low1PctFps)}) | Stab. ${gpu.stabilityPct}%`
          : 'Nie testowano',
    },
    {
      label: 'Gra 3D MAX',
      score: game && game.overallScore > 0 ? game.overallScore : 0,
      detail:
        game && game.avgFps > 0
          ? `${game.preset.toUpperCase()} | Sr. ${game.avgFps} FPS | 1% Low: ${Math.min(game.avgFps, game.low1PctFps)} FPS (${game.verdict})`
          : 'Nie testowano',
    },
    {
      label: 'Siec i Lacznosc',
      score: netScore,
      detail:
        network && network.pingAvgMs > 0
          ? `Ping ${network.pingAvgMs} ms | Jitter ${network.jitterMs} ms | Utrata ${network.packetLossPct}% (${network.qualityGrade})`
          : 'Nie testowano',
    },
    {
      label: 'Kondycja Baterii / PSU',
      score: scores.battery,
      detail: `Bateria: ${battery.healthPct}% (${battery.condition}) | PSU +12V: ${battery.psu.rail12V.toFixed(2)}V (${battery.psu.status})`,
    },
  ];

  for (const item of barItems) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.1);
    doc.setTextColor(15, 23, 42);
    doc.text(fitTextToWidth(doc, item.label, 35), margin, y);

    const barX = margin + 37;
    const barW = 50;
    const barH = 3.5;
    doc.setFillColor(226, 232, 240);
    doc.roundedRect(barX, y - 2.9, barW, barH, 1, 1, 'F');

    const fillW = (Math.max(0, Math.min(100, item.score)) / 100) * barW;
    if (fillW > 0) {
      if (item.score >= 75) doc.setFillColor(16, 185, 129);
      else if (item.score >= 50) doc.setFillColor(6, 182, 212);
      else doc.setFillColor(245, 158, 11);
      doc.roundedRect(barX, y - 2.9, fillW, barH, 1, 1, 'F');
    }

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(item.score > 0 ? `${item.score}/100` : '--', barX + barW + 2.5, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(fitTextToWidth(doc, item.detail, contentW - 102), barX + barW + 16, y);
    y += 6.2;
  }

  y += 3;

  // --- Section 3: 12-Component Automatic Scan Matrix ---
  if (componentScans.length > 0) {
    drawSectionHeading(
      '3. Automatyczny skan 12 podzespolow komputera (Certyfikat sprawnosci)',
      'Szybka weryfikacja kazdego modulu sprzetowego oraz wykrytych interfejsow'
    );

    const cellW = (contentW - 4) / 2;
    const cellH = 10.5;
    for (let i = 0; i < componentScans.length; i += 2) {
      ensureSpace(cellH + 3, 'Skan 12 podzespolow');
      for (let c = 0; c < 2; c++) {
        const card = componentScans[i + c];
        if (!card) continue;
        const cx = margin + c * (cellW + 4);
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.2);
        doc.roundedRect(cx, y, cellW, cellH, 1.5, 1.5, 'FD');

        const statusRgb: [number, number, number] =
          card.status === 'OK'
            ? [5, 150, 105]
            : card.status === 'UWAGA'
              ? [217, 119, 6]
              : [14, 165, 233];
        doc.setFillColor(statusRgb[0], statusRgb[1], statusRgb[2]);
        doc.rect(cx, y + 1.5, 1.4, cellH - 3, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.6);
        doc.setTextColor(15, 23, 42);
        doc.text(fitTextToWidth(doc, card.title, cellW - 26), cx + 3.5, y + 4.3);

        doc.setTextColor(statusRgb[0], statusRgb[1], statusRgb[2]);
        doc.text(pdfText(`${card.status} ${card.score}%`), cx + cellW - 2.5, y + 4.3, { align: 'right' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.9);
        doc.setTextColor(71, 85, 105);
        doc.text(fitTextToWidth(doc, card.headline || card.summary, cellW - 6), cx + 3.5, y + 8.6);
      }
      y += cellH + 2.2;
    }
  }

  // =========================================================================
  // STRONA 2: SZCZEGOLOWE POMIARY CPU, RAM, DYSK + SMART, GPU 3D & GRA 3D MAX
  // =========================================================================
  doc.addPage();
  drawContinuationHeader('Strona 2: Szczegolowe pomiary podzespolow');

  drawSectionHeading(
    '4. Szczegolowe pomiary diagnostyczne: CPU, RAM, Dysk i Grafika 3D',
    'Kompletne parametry wydajnosci, integralnosci bitowej, stabilnosci klatek oraz czujnikow'
  );

  const colW = (contentW - 5) / 2;
  const col1X = margin;
  const col2X = margin + colW + 5;

  // Row A: CPU + RAM
  const rowAH = 49;
  drawDetailCard(
    col1X,
    y,
    colW,
    rowAH,
    'Procesor (CPU) - Wydajnosc i Stabilnosc',
    [
      ['Single-Core / Multi-Core', `${cpu.singleCoreScore || '-'} / ${cpu.multiCoreScore || '-'} pkt`],
      ['Skalowanie wielowatkowe', cpu.scalingRatio > 0 ? `${cpu.scalingRatio}x (${cpu.coresUsed} watkow)` : '-'],
      ['Kompresja GZIP', cpu.compressionMBs > 0 ? `${cpu.compressionMBs} MB/s` : '-'],
      ['Kryptografia SHA-256', cpu.cryptoSha256MBs > 0 ? `${cpu.cryptoSha256MBs} MB/s` : '-'],
      ['Stabilnosc / Ocena', `${cpu.stabilityPct}% | Klasa ${cpu.grade}`],
      ['Czujnik CPU (LIVE)', realCpuTempC != null ? `${realCpuTempC.toFixed(1)} C (prawdziwy)` : 'Brak mostka (LHM/HWiNFO)'],
      ['Wynik koncowy CPU', scores.cpu > 0 ? `${scores.cpu} / 100 pkt` : 'Nie testowano'],
    ],
    [6, 182, 212]
  );

  drawDetailCard(
    col2X,
    y,
    colW,
    rowAH,
    'Pamiec operacyjna (RAM) - Integralnosc',
    [
      ['Przetestowany bufor', `${ram.allocatedMB} MB`],
      ['Odczyt / Zapis sekwencyjny', ram.bandwidthReadMBs > 0 ? `${ram.bandwidthReadMBs} / ${ram.bandwidthWriteMBs} MB/s` : '-'],
      ['Czas dostepu losowego', ram.latencyNs > 0 ? `${ram.latencyNs} ns` : '-'],
      ['Test Szachownicy / PRNG', ram.status === 'completed' ? `${ram.patternErrors} / ${ram.randomErrors} bledow` : 'Oczekiwanie'],
      ['Test Walking 1s/0s', ram.status === 'completed' ? `${ram.walkingBitErrors} bledow` : 'Oczekiwanie'],
      ['Laczne bledy / Werdykt', `${ram.errorsFound} bledow | ${ram.healthGrade}`],
      ['Wynik koncowy RAM', (rankingSnap.currentEntry.ramScore || scores.ram) > 0 ? `${rankingSnap.currentEntry.ramScore || scores.ram} / 100 pkt` : 'Nie testowano'],
    ],
    [99, 102, 241]
  );

  y += rowAH + 5;

  // Row B: GPU 3D Stress + Gra 3D MAX (TWO FULL DEDICATED CARDS!)
  const safeGpuLow1 = gpu.avgFps > 0 ? Math.min(gpu.avgFps, gpu.low1PctFps) : 0;
  const safeGameLow1 = game && game.avgFps > 0 ? Math.min(game.avgFps, game.low1PctFps) : 0;
  const safeGameLow01 = game && game.avgFps > 0 ? Math.min(safeGameLow1, game.low01PctFps) : 0;

  const rowBH = 49;
  drawDetailCard(
    col1X,
    y,
    colW,
    rowBH,
    'Grafika 3D (WebGL2 Stress Benchmark)',
    [
      ['Tryb / Preset', `${gpu.fpsMode === 'uncapped' ? 'Bez limitu' : 'VSync'} | ${gpu.preset.toUpperCase()}`],
      ['Srednie / Max FPS', gpu.avgFps > 0 ? `${gpu.avgFps} / ${gpu.maxFps || gpu.avgFps} FPS` : '-'],
      ['1% Low / Min FPS', gpu.avgFps > 0 ? `${safeGpuLow1} / ${gpu.minFps} FPS` : '-'],
      ['Czas klatki / Stabilnosc', gpu.avgFps > 0 ? `${gpu.frameTimeMs} ms | ${gpu.stabilityPct}%` : '-'],
      ['Klatki / Trojkaty', gpu.avgFps > 0 ? `${gpu.totalFramesRendered} kl. | ${gpu.triangles.toLocaleString('pl-PL')}` : '-'],
      ['Czujnik GPU (LIVE)', realGpuTempC != null ? `${realGpuTempC.toFixed(1)} C (prawdziwy)` : 'Brak czujnika temp.'],
      ['Wynik GPU / Werdykt', gpu.avgFps > 0 ? `${gpu.overallScore}/100 | ${gpu.verdict}` : 'Nie testowano'],
    ],
    [16, 185, 129]
  );

  drawDetailCard(
    col2X,
    y,
    colW,
    rowBH,
    'Gra 3D MAX (Silnik PBR / Ray Tracing)',
    [
      ['Preset / Rozdzielczosc', game && game.avgFps > 0 ? `${game.preset.toUpperCase()} | ${game.resolutionLabel || 'Auto'}` : 'Nie testowano'],
      ['Srednie / Max FPS', game && game.avgFps > 0 ? `${game.avgFps} / ${game.maxFps || game.avgFps} FPS` : '-'],
      ['1% Low / 0.1% Low FPS', game && game.avgFps > 0 ? `${safeGameLow1} / ${safeGameLow01} FPS` : '-'],
      ['Czas klatki / Stabilnosc', game && game.avgFps > 0 ? `${game.frameTimeMs} ms | ${game.stabilityPct}%` : '-'],
      ['Upscaling / Frame Gen', game && game.avgFps > 0 ? `${game.upscalingMode || 'Natywne'} | FG: ${game.frameGenMode || 'off'}` : '-'],
      ['Trojkaty / Draw Calls', game && game.avgFps > 0 ? `${game.triangles.toLocaleString('pl-PL')} | ${game.drawCalls} DC` : '-'],
      ['Wynik Gra 3D / Werdykt', game && game.avgFps > 0 ? `${game.overallScore}/100 | ${game.verdict}` : 'Nie testowano'],
    ],
    [245, 158, 11]
  );

  y += rowBH + 6;

  // Section 5: Disk & Full SMART Attributes Table
  drawSectionHeading(
    '5. Dysk SSD/HDD - Wydajnosc I/O oraz Diagnostyka SMART',
    `Silnik: ${disk.backend} | Odczyt: ${disk.seqReadMBs} MB/s | Zapis: ${disk.seqWriteMBs} MB/s | 4K: ${disk.rand4kIops} IOPS | Dostep Sr/P95: ${disk.accessTimeAvgMs}/${disk.accessTimeP95Ms} ms | CRC32: ${disk.crcVerified ? 'Zgodna' : 'Oczekiwanie'} | SMART: ${disk.smartStatus} (${disk.smartHealthPct}%)`
  );

  // Compact Disk KPI Strip
  const diskKpis: Array<[string, string]> = [
    ['Odczyt Seq.', disk.seqReadMBs > 0 ? `${disk.seqReadMBs} MB/s` : '-'],
    ['Zapis Seq.', disk.seqWriteMBs > 0 ? `${disk.seqWriteMBs} MB/s` : '-'],
    ['Losowe 4K', disk.rand4kIops > 0 ? `${disk.rand4kIops} IOPS` : '-'],
    ['Dostep Sr/P95', disk.accessTimeAvgMs > 0 ? `${disk.accessTimeAvgMs}/${disk.accessTimeP95Ms} ms` : '-'],
    ['Kondycja SMART', `${disk.smartStatus} (${disk.smartHealthPct}%)`],
  ];
  const kpiW = (contentW - 8) / 5;
  for (let i = 0; i < diskKpis.length; i++) {
    const kx = margin + i * (kpiW + 2);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(kx, y, kpiW, 13.5, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139);
    doc.text(pdfText(diskKpis[i][0]), kx + kpiW / 2, y + 4.8, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.1);
    doc.setTextColor(15, 23, 42);
    doc.text(fitTextToWidth(doc, diskKpis[i][1], kpiW - 3), kx + kpiW / 2, y + 10.5, { align: 'center' });
  }
  y += 17;

  if (disk.smartAttributes && disk.smartAttributes.length > 0) {
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentW, 6.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.4);
    doc.setTextColor(51, 65, 85);
    doc.text('ID', margin + 2, y + 4.4);
    doc.text('Atrybut SMART', margin + 15, y + 4.4);
    doc.text('Wartosc', margin + 76, y + 4.4);
    doc.text('Prog', margin + 108, y + 4.4);
    doc.text('Status', margin + 128, y + 4.4);
    doc.text('Komentarz', margin + 146, y + 4.4);
    y += 7.5;

    doc.setFontSize(7.2);
    for (const attr of disk.smartAttributes.slice(0, 10)) {
      ensureSpace(6, 'Atrybuty SMART dysku');
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text(pdfText(attr.id), margin + 2, y + 3.2);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      doc.text(fitTextToWidth(doc, attr.name, 58), margin + 15, y + 3.2);
      doc.setFont('helvetica', 'bold');
      doc.text(fitTextToWidth(doc, attr.value, 30), margin + 76, y + 3.2);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(fitTextToWidth(doc, attr.threshold, 18), margin + 108, y + 3.2);

      if (attr.status === 'OK') doc.setTextColor(5, 150, 105);
      else if (attr.status === 'UWAGA') doc.setTextColor(217, 119, 6);
      else doc.setTextColor(225, 29, 72);
      doc.setFont('helvetica', 'bold');
      doc.text(pdfText(attr.status), margin + 128, y + 3.2);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(fitTextToWidth(doc, attr.note, contentW - 148), margin + 146, y + 3.2);

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.18);
      doc.line(margin, y + 4.8, pageW - margin, y + 4.8);
      y += 5.4;
    }
  }

  // Optional Multi-Scene GPU Auto-Suite breakdown if run
  if (gpuSuiteResults.length > 0) {
    y += 4;
    drawSectionHeading(
      `5B. Wyniki wieloscenowego Auto-Suite GPU 3D (${gpuSuiteResults.length} scen)`,
      'Pomiar poszczegolnych jednostek GPU (Raster, Shadery, Raymarching, Fizyka)'
    );
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentW, 6.2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(51, 65, 85);
    doc.text('Scena 3D', margin + 2, y + 4.2);
    doc.text('Podsystem GPU', margin + 62, y + 4.2);
    doc.text('Sr. FPS', margin + 112, y + 4.2);
    doc.text('1% Low', margin + 132, y + 4.2);
    doc.text('Stab.', margin + 150, y + 4.2);
    doc.text('Wynik', margin + 168, y + 4.2);
    y += 7;

    for (const row of gpuSuiteResults.slice(0, 14)) {
      ensureSpace(5.4, 'Wyniki scen GPU 3D');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.1);
      doc.setTextColor(15, 23, 42);
      doc.text(fitTextToWidth(doc, row.name, 58), margin + 2, y + 3);
      doc.setTextColor(71, 85, 105);
      doc.text(fitTextToWidth(doc, row.targetUnit, 48), margin + 62, y + 3);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`${row.avgFps}`, margin + 112, y + 3);
      doc.text(`${Math.min(row.avgFps, row.low1PctFps)}`, margin + 132, y + 3);
      doc.text(`${row.stabilityPct}%`, margin + 150, y + 3);
      doc.text(`${row.score}/100`, margin + 168, y + 3);
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, y + 4.5, pageW - margin, y + 4.5);
      y += 5.1;
    }
  }

  // =========================================================================
  // STRONA 3: JAKIE GRY OBSLUZY TEN PC (13 GIER) & PRZYDATNOSC PC (8 ZASTOSOWAN)
  // =========================================================================
  doc.addPage();
  drawContinuationHeader('Strona 3: Kompatybilnosc gier i przeznaczenie PC');

  drawSectionHeading(
    `6. Jakie gry obsluzy ten PC? (${gamesSummary.smoothOrBetterCount}/${gamesSummary.total} plynnie 60+ FPS)`,
    `Ultra 120+: ${gamesSummary.ultraCount} | Wysokie 60+: ${gamesSummary.smoothCount} | Srednie 35-59: ${gamesSummary.playableCount} | Niskie/Slabe: ${gamesSummary.lowCount} | Kalibracja: ${hwIndex.testedCount}/4 testow`
  );

  // Games Table Header
  doc.setFillColor(15, 23, 42);
  doc.rect(margin, y, contentW, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.3);
  doc.setTextColor(241, 245, 249);
  doc.text('Tytul gry / Silnik', margin + 2.5, y + 4.7);
  doc.text('1080p', margin + 74, y + 4.7);
  doc.text('1440p', margin + 91, y + 4.7);
  doc.text('DLSS+FG', margin + 107, y + 4.7);
  doc.text('Wykres FPS', margin + 124, y + 4.7);
  doc.text('Werdykt', margin + 152, y + 4.7);
  y += 8.2;

  for (let i = 0; i < gamesList.length; i++) {
    const g = gamesList[i];
    ensureSpace(10.5, 'Kompatybilnosc gier PC');
    if (i % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y - 1, contentW, 9.2, 'F');
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(fitTextToWidth(doc, g.title, 70), margin + 2.5, y + 3);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(fitTextToWidth(doc, `${g.engine} | VRAM ${g.vramRecommendedGb} GB`, 70), margin + 2.5, y + 6.8);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(2, 132, 199);
    doc.text(`${g.fps1080pNative}`, margin + 74, y + 4.6);

    doc.setTextColor(79, 70, 229);
    doc.text(`${g.fps1440pQuality}`, margin + 91, y + 4.6);

    doc.setTextColor(5, 150, 105);
    doc.text(`${g.fpsDlssFg}`, margin + 107, y + 4.6);

    // Mini FPS Bar (1080p native vs FG)
    const bX = margin + 123;
    const bW = 26;
    doc.setFillColor(226, 232, 240);
    doc.roundedRect(bX, y + 1.4, bW, 2.2, 0.7, 0.7, 'F');
    doc.setFillColor(14, 165, 233);
    doc.roundedRect(bX, y + 1.4, Math.max(1.5, (Math.min(360, g.fps1080pNative) / 360) * bW), 2.2, 0.7, 0.7, 'F');

    doc.setFillColor(226, 232, 240);
    doc.roundedRect(bX, y + 4.5, bW, 2.2, 0.7, 0.7, 'F');
    doc.setFillColor(16, 185, 129);
    doc.roundedRect(bX, y + 4.5, Math.max(1.5, (Math.min(360, g.fpsDlssFg) / 360) * bW), 2.2, 0.7, 0.7, 'F');

    const tierRgb: [number, number, number] =
      g.tier === 'ultra'
        ? [5, 150, 105]
        : g.tier === 'smooth'
          ? [2, 132, 199]
          : g.tier === 'playable'
            ? [217, 119, 6]
            : [225, 29, 72];
    const shortTier =
      g.tier === 'ultra'
        ? 'ULTRA 120+'
        : g.tier === 'smooth'
          ? 'WYSOKIE 60+'
          : g.tier === 'playable'
            ? 'SREDNIE 35+'
            : 'ZA SLABY (<35)';
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.1);
    doc.setTextColor(tierRgb[0], tierRgb[1], tierRgb[2]);
    doc.text(shortTier, margin + 152, y + 4.6);

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.18);
    doc.line(margin, y + 8.2, pageW - margin, y + 8.2);
    y += 9.2;
  }

  y += 5;

  // Section 7: 8-Category PC Suitability Assessment
  drawSectionHeading(
    '7. Do czego najlepiej nadaje sie ten PC / Laptop? (Ocena 8 zastosowan)',
    'Klasyfikacja mozliwosci komputera w gamingu, montazu 4K, lokalnym AI, programowaniu i pracy 24/7'
  );

  const suitColW = (contentW - 4) / 2;
  const suitCardH = 18.5;
  for (let i = 0; i < suitabilityList.length; i += 2) {
    ensureSpace(suitCardH + 3, 'Przydatnosc PC w 8 zastosowaniach');
    for (let c = 0; c < 2; c++) {
      const cat = suitabilityList[i + c];
      if (!cat) continue;
      const sx = margin + c * (suitColW + 4);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.22);
      doc.roundedRect(sx, y, suitColW, suitCardH, 1.8, 1.8, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.6);
      doc.setTextColor(15, 23, 42);
      doc.text(fitTextToWidth(doc, cat.title, suitColW - 18), sx + 3, y + 4.6);

      const sRgb: [number, number, number] =
        cat.score >= 75 ? [5, 150, 105] : cat.score >= 55 ? [217, 119, 6] : [225, 29, 72];
      doc.setTextColor(sRgb[0], sRgb[1], sRgb[2]);
      doc.text(`${cat.score}%`, sx + suitColW - 3, y + 4.6, { align: 'right' });

      // Progress bar
      doc.setFillColor(226, 232, 240);
      doc.roundedRect(sx + 3, y + 6.5, suitColW - 6, 2.3, 0.8, 0.8, 'F');
      doc.setFillColor(sRgb[0], sRgb[1], sRgb[2]);
      doc.roundedRect(sx + 3, y + 6.5, Math.max(2, ((suitColW - 6) * cat.score) / 100), 2.3, 0.8, 0.8, 'F');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.7);
      doc.setTextColor(71, 85, 105);
      doc.text(fitTextToWidth(doc, `${cat.verdict} | ${cat.summary}`, suitColW - 6), sx + 3, y + 12.2);
      doc.setTextColor(100, 116, 139);
      doc.text(fitTextToWidth(doc, cat.bottleneckNote, suitColW - 6), sx + 3, y + 16.2);
    }
    y += suitCardH + 2.5;
  }

  // =========================================================================
  // STRONA 4: RANKING KOMPUTEROW, ZASILANIE (BATERIA & PSU), SIEC, TERMIKA, WNIOSKI
  // =========================================================================
  doc.addPage();
  drawContinuationHeader('Strona 4: Ranking komputerow, zasilanie i wnioski serwisowe');

  drawSectionHeading(
    `8. Ranking Komputerow - Ktory Najlepszy? (Pozycja #${rankingSnap.currentRank} z ${rankingSnap.totalRanked})`,
    `Twoj komputer: ${rankingSnap.currentEntry.overallScore}/100 pkt (${rankingSnap.tierBadge}) | Lepszy niz ${rankingSnap.percentileBetterThan}% konfiguracji | Najmocniejszy: ${rankingSnap.strongestComponent} | Waskie gardlo: ${rankingSnap.bottleneckComponent}`
  );

  // Ranking Table Header
  doc.setFillColor(15, 23, 42);
  doc.rect(margin, y, contentW, 6.8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(241, 245, 249);
  doc.text('Poz.', margin + 2, y + 4.6);
  doc.text('Komputer / Konfiguracja', margin + 13, y + 4.6);
  doc.text('CPU', margin + 106, y + 4.6);
  doc.text('GPU', margin + 118, y + 4.6);
  doc.text('RAM', margin + 130, y + 4.6);
  doc.text('Dysk', margin + 142, y + 4.6);
  doc.text('Wynik', margin + 155, y + 4.6);
  y += 7.6;

  const rankingRows = rankingSnap.leaderboard.slice(0, 14);
  for (let i = 0; i < rankingRows.length; i++) {
    const entry = rankingRows[i];
    ensureSpace(6.8, 'Ranking komputerow');
    if (entry.isCurrentPc) {
      doc.setFillColor(224, 242, 254);
      doc.setDrawColor(6, 182, 212);
      doc.setLineWidth(0.35);
      doc.rect(margin, y - 0.6, contentW, 6.2, 'FD');
    } else if (entry.isUserSaved) {
      doc.setFillColor(236, 253, 245);
      doc.rect(margin, y - 0.6, contentW, 6.2, 'F');
    } else if (i % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y - 0.6, contentW, 6.2, 'F');
    }

    doc.setFont('helvetica', entry.isCurrentPc ? 'bold' : 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(entry.isCurrentPc ? 3 : 15, entry.isCurrentPc ? 105 : 23, entry.isCurrentPc ? 161 : 42);
    doc.text(`#${i + 1}`, margin + 2.5, y + 3.6);
    const nameLabel = entry.isCurrentPc
      ? `>>> ${entry.name}`
      : entry.isUserSaved
        ? `[ZAPISANY] ${entry.name}`
        : entry.name;
    doc.text(fitTextToWidth(doc, nameLabel, 91), margin + 13, y + 3.6);
    doc.text(entry.cpuScore > 0 ? `${entry.cpuScore}` : '--', margin + 106, y + 3.6);
    doc.text(entry.gpuScore > 0 ? `${entry.gpuScore}` : '--', margin + 118, y + 3.6);
    doc.text(entry.ramScore > 0 ? `${entry.ramScore}` : '--', margin + 130, y + 3.6);
    doc.text(entry.diskScore > 0 ? `${entry.diskScore}` : '--', margin + 142, y + 3.6);

    // Mini score bar + number
    doc.setFillColor(226, 232, 240);
    doc.roundedRect(margin + 154, y + 1.5, 16, 2.5, 0.7, 0.7, 'F');
    doc.setFillColor(entry.isCurrentPc ? 6 : 16, entry.isCurrentPc ? 182 : 185, entry.isCurrentPc ? 212 : 129);
    doc.roundedRect(margin + 154, y + 1.5, Math.max(1.5, (entry.overallScore / 100) * 16), 2.5, 0.7, 0.7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text(`${entry.overallScore}`, pageW - margin - 2, y + 3.6, { align: 'right' });

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.15);
    doc.line(margin, y + 5.6, pageW - margin, y + 5.6);
    y += 6.2;
  }

  y += 5;

  // Section 9: Power (Battery & PC PSU ATX) — CLEAN 2-COLUMN CARDS, ZERO OVERLAP!
  drawSectionHeading(
    '9. Zasilanie: Kondycja Baterii Laptopa i Zasilacz PC (PSU ATX)',
    'Pomiar zuzycia ogniw, cykli ladowania, stabilnosci linii napieciowych +12V / +5V / +3.3V i tetnien'
  );

  ensureSpace(44, 'Zasilanie i Siec');
  const curEst = battery.estimates[2]?.label || '-';
  const officeEst = battery.estimates[0]?.label || '-';
  const powerCardH = 40;

  drawDetailCard(
    col1X,
    y,
    colW,
    powerCardH,
    'Bateria Laptopa (Zdrowie & Degradacja)',
    [
      ['Naladowanie / Stan', `${battery.levelPct}% (${battery.charging ? 'Ladowanie' : 'Bateria'})`],
      ['Zdrowie / Zuzycie (Wear)', `${battery.healthPct}% | Wear ${battery.wearLevelPct}% (${battery.condition})`],
      ['Pojemnosc obecna / fabr.', `${battery.fullChargeCapacityMWh} / ${battery.designCapacityMWh} mWh`],
      ['Cykle / Degradacja', `~${battery.estimatedCycles} cykli (-${battery.avgDegradationPerCycleMWh} mWh/c)`],
      ['Czas pracy (Biuro / Biez.)', `${officeEst} / ${curEst}`],
    ],
    [16, 185, 129]
  );

  drawDetailCard(
    col2X,
    y,
    colW,
    powerCardH,
    'Zasilacz PC (PSU ATX) & Linie Napiec',
    [
      ['Model / Klasa', `${battery.psu.model} (${battery.psu.rating80Plus})`],
      ['Linia +12V / +5V / +3.3V', `${battery.psu.rail12V.toFixed(2)}V | ${battery.psu.rail5V.toFixed(2)}V | ${battery.psu.rail3P3V.toFixed(2)}V`],
      ['Tetnienia (Ripple) / Temp.', `${battery.psu.rippleMv} mV | ${battery.psu.tempC} C`],
      ['Pobor mocy / Sprawnosc', `${battery.currentPowerDrawW} W (${battery.currentLoadPct}%) | ${battery.psu.efficiencyPct}%`],
      ['Status zasilacza PSU', `${battery.psu.status} | Alerty: ${battery.railAlertEvents.length}`],
    ],
    [245, 158, 11]
  );

  y += powerCardH + 5;

  // Section 10: Network & Thermal Summary (2 Columns)
  ensureSpace(38, 'Siec i Termika');
  const netThermalH = 35;

  drawDetailCard(
    col1X,
    y,
    colW,
    netThermalH,
    'Siec, Opoznienia i Transfer',
    [
      ['Ping (Min / Sr. / Max)', network && network.pingAvgMs > 0 ? `${network.pingMinMs} / ${network.pingAvgMs} / ${network.pingMaxMs} ms` : 'Nie testowano'],
      ['Jitter / Utrata pakietow', network && network.pingAvgMs > 0 ? `${network.jitterMs} ms | ${network.packetLossPct}%` : '-'],
      ['Pobieranie / Wysylanie', network && network.downloadEstMbps > 0 ? `${network.downloadEstMbps} / ${network.uploadEstMbps ?? 0} Mbps` : '-'],
      ['Ocena jakosci lacza', network && network.pingAvgMs > 0 ? `${network.qualityGrade} (${network.effectiveType})` : 'Oczekiwanie'],
    ],
    [14, 165, 233]
  );

  const hottestStr =
    thermalState?.hottestTempC != null
      ? `${thermalState.hottestTempC.toFixed(1)} C (${thermalState.hottestZoneLabel})`
      : realGpuTempC != null
        ? `${realGpuTempC.toFixed(1)} C (GPU)`
        : 'Brak czujnika C (tryb obciazenia)';
  const avgSysTempStr =
    thermalState?.avgSystemTempC != null ? `${thermalState.avgSystemTempC.toFixed(1)} C` : 'Tryb obciazenia';

  drawDetailCard(
    col2X,
    y,
    colW,
    netThermalH,
    'Termika, Chlodzenie i Historia Sesji',
    [
      ['Status termiczny', thermalState ? thermalState.thermalStatus : 'Monitor gotowy'],
      ['Najgoretsza strefa', hottestStr],
      ['Srednia temp. systemu', avgSysTempStr],
      ['Zapisane sesje stress-test', `${stressHistory.length} sesji w bazie lokalnej`],
    ],
    [244, 63, 94]
  );

  y += netThermalH + 5;

  // Section 11: Service Conclusions, Bottlenecks & Technician Sign-Off
  ensureSpace(46, 'Wnioski serwisowe');
  drawSectionHeading('10. Wnioski serwisowe, zalecenia i potwierdzenie badania');

  const recommendations: string[] = [];
  if (ram.errorsFound > 0) {
    recommendations.push(`[PILNE] Wykryto ${ram.errorsFound} bledow pamieci RAM - zalecana diagnostyka kosci DIMM / wymiana modulu.`);
  } else if (ram.status === 'completed') {
    recommendations.push('[OK] Pamiec RAM przeszla wszystkie 4 etapy weryfikacji bitowej bez zadnego bledu (0 bledow).');
  }
  if (disk.smartStatus !== 'ZDROWY') {
    recommendations.push(`[UWAGA] Dysk wykazuje stan SMART: ${disk.smartStatus} (${disk.smartHealthPct}%) - zalecana kopia zapasowa danych.`);
  } else if (disk.seqReadMBs > 0) {
    recommendations.push(`[OK] Dysk SSD/HDD zdrowy (SMART ${disk.smartHealthPct}%), odczyt sekwencyjny ${disk.seqReadMBs} MB/s, weryfikacja CRC32 zgodna.`);
  }
  if (battery.healthPct < 75) {
    recommendations.push(`[UWAGA] Kondycja baterii ponizej 75% (${battery.healthPct}%, zuzycie ${battery.wearLevelPct}%) - zalecana wymiana ogniwa.`);
  }
  recommendations.push(
    `[RANKING] Komputer zajal miejsce #${rankingSnap.currentRank}/${rankingSnap.totalRanked} (${rankingSnap.tierBadge}). Najmocniejszy: ${rankingSnap.strongestComponent}; potencjal ulepszenia: ${rankingSnap.bottleneckComponent}.`
  );
  recommendations.push(
    `[GRY 3D] Komputer obsluzy plynnie (60+ FPS) ${gamesSummary.smoothOrBetterCount} z ${gamesSummary.total} przetestowanych tytulow PC (${gamesSummary.ultraCount} w jakosci Ultra 120+ FPS).`
  );

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  const recBoxH = recommendations.length * 5.2 + 5;
  doc.roundedRect(margin, y, contentW, recBoxH, 2, 2, 'FD');

  let ry = y + 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.6);
  doc.setTextColor(30, 41, 59);
  for (const line of recommendations) {
    doc.text(fitTextToWidth(doc, `- ${line}`, contentW - 7), margin + 3.5, ry);
    ry += 5.2;
  }
  y += recBoxH + 5;

  // Technician Sign-off strip
  ensureSpace(16, 'Potwierdzenie badania');
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.25);
  doc.roundedRect(margin, y, contentW, 14, 1.5, 1.5, 'S');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(100, 116, 139);
  doc.text(pdfText(`Data badania: ${nowStr}`), margin + 4, y + 5.5);
  doc.text('Technik / Serwis: ................................................', margin + 62, y + 5.5);
  doc.text('Podpis / Pieczatka: ...................................', margin + 132, y + 5.5);
  doc.setFontSize(6.7);
  doc.text(
    pdfText(`Nr raportu: ${reportId} | Wygenerowano lokalnie przez SystemPulse Pro (bez wysylania danych w chmure)`),
    margin + 4,
    y + 11
  );

  // --- Stamp Consistent Footer on EVERY Page ---
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.25);
    doc.line(margin, pageH - 14.5, pageW - margin, pageH - 14.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.0);
    doc.setTextColor(15, 23, 42);
    doc.text(
      pdfText('NAPRAWA KOMPUTEROW I LAPTOPOW - Rafal Jarosz | NAPRAWAPCLAPTOP.PL | Tel. 786 409 187 | Warszawa, ul. Marymoncka 125 m.109 p.6'),
      margin,
      pageH - 10.5
    );
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      pdfText(`Copyright (c) Rafal Jarosz - SystemPulse Pro | Raport Diagnostyczny i Ranking PC (${reportId})`),
      margin,
      pageH - 6.8
    );
    doc.text(`Strona ${p} / ${totalPages}`, pageW - margin, pageH - 8.5, { align: 'right' });
  }

  return doc;
}

export function generateDiagnosticPdfReport(payload: PdfReportPayload): void {
  const doc = buildDiagnosticPdfDocument(payload);
  const dateTag = new Date().toISOString().slice(0, 10);
  doc.save(`systempulse-raport-${dateTag}.pdf`);
}

export function generateSchedulerPdfReport(
  report: SchedulerSummaryReport,
  specs: SystemSpecs | null
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;
  const margin = 14;
  const contentW = pageW - margin * 2;

  // Header band
  doc.setFillColor(12, 18, 30);
  doc.rect(0, 0, pageW, 34, 'F');
  doc.setFillColor(6, 182, 212);
  doc.rect(0, 33, pageW, 1.2, 'F');

  doc.setTextColor(241, 245, 249);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('SystemPulse Pro - Raport Harmonogramu', margin, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(148, 163, 184);
  doc.text(
    pdfText(`Kolejka sekwencyjna (${report.steps.length} testow) | Czas: ${report.totalDurationSec.toFixed(1)} s`),
    margin,
    20
  );
  doc.text(pdfText(`Zakonczono: ${new Date(report.finishedAt).toLocaleString('pl-PL')}`), margin, 26);

  // Official Service Logo Card
  drawRafalJaroszServiceLogoPdf(doc, pageW - margin - 106, 4.8, 60, 23.4);

  // Score badge
  doc.setFillColor(20, 29, 46);
  doc.setDrawColor(6, 182, 212);
  doc.setLineWidth(0.5);
  doc.roundedRect(pageW - margin - 42, 4.8, 42, 23.4, 2.5, 2.5, 'FD');
  doc.setTextColor(6, 182, 212);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text(report.grade, pageW - margin - 32, 18.5, { align: 'center' });
  doc.setTextColor(241, 245, 249);
  doc.setFontSize(10);
  doc.text(`${report.overallScore}/100`, pageW - margin - 13, 16, { align: 'center' });
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(7);
  doc.text('WYNIK', pageW - margin - 13, 22, { align: 'center' });

  let y = 43;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(pdfText('Podsumowanie sesji i platformy sprzetowej'), margin, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  const hwLine = specs
    ? `${specs.os} | ${specs.cpuCores} watkow | GPU: ${truncateText(specs.gpuRenderer, 55)}`
    : 'Platforma lokalna';
  doc.text(pdfText(hwLine), margin, y);
  y += 5;
  doc.text(
    pdfText(
      `Zaliczone: ${report.passedCount} | Ostrzezenia: ${report.warningCount} | Bledy: ${report.failedCount} | Czujnik szczyt: ${report.peakSystemTempC > 0 ? `${report.peakSystemTempC.toFixed(1)} C` : 'brak mostka'}`
    ),
    margin,
    y
  );
  y += 9;

  // Steps table header
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, contentW, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('#', margin + 2, y + 5.3);
  doc.text('Test / Konfiguracja', margin + 10, y + 5.3);
  doc.text('Glowny wynik', margin + 84, y + 5.3);
  doc.text('Czas', margin + 132, y + 5.3);
  doc.text('Temp', margin + 148, y + 5.3);
  doc.text('Ocena', margin + 165, y + 5.3);
  y += 10;

  doc.setFont('helvetica', 'normal');
  report.steps.forEach((st, idx) => {
    if (y > 265) {
      doc.addPage();
      y = 20;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(15, 23, 42);
    doc.text(String(idx + 1), margin + 2, y);
    doc.text(pdfText(truncateText(st.label, 34)), margin + 10, y);
    doc.text(pdfText(truncateText(st.primaryMetricValue, 26)), margin + 84, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`${st.durationSec.toFixed(1)}s`, margin + 132, y);
    doc.text(st.peakTempC !== null ? `${st.peakTempC.toFixed(1)}C` : '-', margin + 148, y);

    const statusTag =
      st.status === 'passed'
        ? `OK (${st.score})`
        : st.status === 'warning'
          ? `UWAGA (${st.score})`
          : st.status === 'aborted'
            ? 'PRZERWANO'
            : `BLAD (${st.score})`;
    doc.text(statusTag, margin + 165, y);

    y += 4.2;
    doc.setFontSize(7.2);
    doc.setTextColor(100, 116, 139);
    doc.text(pdfText(truncateText(`${st.configSummary} | ${st.secondaryDetails}`, 98)), margin + 10, y);
    y += 3.2;
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, pageW - margin, y);
    y += 5.2;
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.0);
  doc.setTextColor(15, 23, 42);
  doc.text(
    pdfText('NAPRAWA KOMPUTEROW I LAPTOPOW - Rafal Jarosz | NAPRAWAPCLAPTOP.PL | Tel. 786 409 187 | Warszawa, ul. Marymoncka 125 m.109 p.6'),
    margin,
    284
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.0);
  doc.setTextColor(100, 116, 139);
  doc.text(
    pdfText('Copyright (c) Rafal Jarosz - SystemPulse Pro | Jednolity raport zbiorczy z kolejki testow obciazeniowych.'),
    margin,
    288
  );

  doc.save(`systempulse-harmonogram-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function generateHardwareInventoryPdfReport(
  specs: SystemSpecs | null,
  hardwareScan: HardwareScanSnapshot | null
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;
  const pageH = 297;
  const margin = 14;
  const contentW = pageW - margin * 2;
  const valColOffset = 64; // Generous 64mm label column so labels NEVER collide with values

  // Header band with Official Service Logo (NAPRAWA KOMPUTEROW I LAPTOPOW - Rafal Jarosz)
  doc.setFillColor(12, 18, 30);
  doc.rect(0, 0, pageW, 34, 'F');
  doc.setFillColor(6, 182, 212);
  doc.rect(0, 33, pageW, 1.2, 'F');

  doc.setTextColor(241, 245, 249);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15.5);
  doc.text('SystemPulse Pro - Inwentarz Sprzetu', margin, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.4);
  doc.setTextColor(148, 163, 184);
  doc.text(pdfText('Szczegolowy raport wykrytych podzespolow (CPU, plyta, RAM DIMM, GPU, EDID, dyski)'), margin, 19.8);
  doc.text(pdfText(`Wygenerowano: ${new Date().toLocaleString('pl-PL')}`), margin, 26);

  drawRafalJaroszServiceLogoPdf(doc, pageW - margin - 66, 4.6, 66, 24);

  let y = 42;
  const ensurePageSpace = (needMm: number) => {
    if (y + needMm > 274) {
      doc.addPage();
      doc.setFillColor(12, 18, 30);
      doc.rect(0, 0, pageW, 15, 'F');
      doc.setFillColor(6, 182, 212);
      doc.rect(0, 14.2, pageW, 0.8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(241, 245, 249);
      doc.text('SystemPulse Pro - Inwentarz Sprzetu (Kontynuacja)', margin, 9.8);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text('NAPRAWAPCLAPTOP.PL | 786 409 187', pageW - margin, 9.8, { align: 'right' });
      y = 23;
    }
  };

  const drawHeading = (title: string) => {
    ensurePageSpace(14);
    doc.setFillColor(6, 182, 212);
    doc.rect(margin, y - 3.4, 2.0, 4.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.2);
    doc.setTextColor(15, 23, 42);
    doc.text(pdfText(title), margin + 4, y);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.line(margin, y + 1.8, margin + contentW, y + 1.8);
    y += 6.8;
  };

  const drawKvRows = (rows: Array<[string, string]>) => {
    doc.setFontSize(8.3);
    for (const [k, v] of rows) {
      ensurePageSpace(6);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text(fitTextToWidth(doc, k + ':', valColOffset - 3), margin, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      doc.text(fitTextToWidth(doc, v, contentW - valColOffset), margin + valColOffset, y);
      y += 5.2;
    }
    y += 3;
  };

  const deep = hardwareScan?.deepInventory || null;
  const gpuClean = cleanGpuModelFromAngle(specs?.gpuRenderer, specs?.gpuVendor);
  const panel = hardwareScan?.panel;
  const snappedHz = snapStandardMonitorHz(panel?.refreshRateHz ?? specs?.estimatedRefreshRate);

  // Estimate VRAM class accurately from GPU name
  let estVramStr = 'Dedykowana pamiec VRAM';
  const gpuRefStr = `${deep?.gpus?.[0]?.name || ''} ${specs?.gpuRenderer || ''}`;
  if (/7900\s*XTX|4090|3090/i.test(gpuRefStr)) estVramStr = '24 GB GDDR6 / GDDR6X (Flagship 24GB)';
  else if (/5090/i.test(gpuRefStr)) estVramStr = '32 GB GDDR7 (Flagship 32GB)';
  else if (/7900\s*XT/i.test(gpuRefStr)) estVramStr = '20 GB GDDR6';
  else if (/7900\s*GRE|7800\s*XT|6800|6900|6950|4080|4070\s*Ti\s*Super|5080|5070\s*Ti/i.test(gpuRefStr)) estVramStr = '16 GB GDDR6 / GDDR6X';
  else if (/4070|3080|6700\s*XT|6750\s*XT|7700\s*XT|5070/i.test(gpuRefStr)) estVramStr = '12 GB GDDR6 / GDDR6X';
  else if (/4060|3070|3060\s*Ti|7600|6600/i.test(gpuRefStr)) estVramStr = '8 GB GDDR6';
  else if (deep?.gpus?.[0]?.vramGB) estVramStr = deep.gpus[0].vramGB;

  // 1. CPU, Platform, Motherboard & RAM
  drawHeading('1. Specyfikacja procesora, plyty glownej i pamieci RAM');
  const totalSmbiosRamGb =
    deep?.ramModules && deep.ramModules.length > 0
      ? Math.round(deep.ramModules.reduce((acc, m) => acc + (m.capacityGB || 0), 0))
      : 0;

  const cpuLines: Array<[string, string]> = [
    ['System operacyjny / Arch', specs ? `${specs.os} (${specs.platform})` : 'Nieznany'],
    [
      'Procesor (CPU)',
      deep?.cpuModel
        ? `${deep.cpuModel} (${deep.cpuDetails || `${specs?.cpuCores ?? '-'} watkow logicznych`})`
        : specs
          ? `${specs.cpuCores} watkow logicznych (${specs.platform})`
          : 'Nieznany',
    ],
  ];
  if (deep?.motherboard) {
    cpuLines.push(['Plyta glowna / BIOS', `${deep.motherboard} | BIOS: ${deep.bios || '-'}`]);
  }
  if (deep?.computerModel) {
    cpuLines.push(['Model komputera / System', deep.computerModel]);
  }
  if (totalSmbiosRamGb > 0 && deep?.ramModules) {
    const firstMod = deep.ramModules[0];
    const chLabel = deep.ramModules.length >= 2 ? 'Dual-Channel' : 'Single-Channel';
    cpuLines.push([
      'Zainstalowana pamiec RAM',
      `${totalSmbiosRamGb} GB ${firstMod.memoryType} @ ${firstMod.speedMHz} MHz (${deep.ramModules.length} moduly DIMM, ${chLabel})`,
    ]);
    deep.ramModules.forEach((mod, idx) => {
      cpuLines.push([
        `Kosc RAM #${idx + 1} (${mod.slot})`,
        `${mod.manufacturer} ${mod.partNumber} | ${mod.capacityGB} GB ${mod.memoryType} @ ${mod.speedMHz} MHz | S/N: ${mod.serial}`,
      ]);
    });
  } else {
    cpuLines.push([
      'Pamiec RAM (status odczytu)',
      specs && typeof specs.deviceMemory === 'number'
        ? `Wykryto >= ${specs.deviceMemory} GB (limit prywatnosci Web API - wczytaj skan SMBIOS/WMI w zakladce Peryferia dla pelnej listy kosci DIMM)`
        : 'Uzyj Skanera SMBIOS w zakladce Peryferia, aby odczytac dokladne kosci DIMM i taktowanie MHz',
    ]);
  }
  cpuLines.push(['Srodowisko wykonawcze', specs ? `${specs.browser} (Silnik diagnostyczny 64-bit)` : 'Nieznane']);
  drawKvRows(cpuLines);

  // 2. Display / EDID
  drawHeading('2. Matryca i Parametry Wyswietlacza (EDID)');
  const edidMonitor = deep?.monitors?.[0];
  const panelLines: Array<[string, string]> = [
    [
      'Model matrycy / Monitora',
      panel?.label || (edidMonitor ? `${edidMonitor.manufacturer} ${edidMonitor.model}` : specs?.screenResolution || 'Standardowy monitor'),
    ],
    ['Rozdzielczosc natywna', panel ? panel.nativeResolution : specs ? specs.screenResolution : '-'],
    ['Odswiezanie ekranu (Hz)', `${snappedHz} Hz (Synchronizacja V-Blank)`],
    [
      'Przestrzen barw / Glebia',
      panel
        ? `${panel.colorGamut} | ${panel.colorDepthBit}-bit | ${panel.hdrSupported ? 'HDR Obslugiwany' : 'SDR'}`
        : specs
          ? `${specs.colorDepth}-bit SDR`
          : '-',
    ],
    ['Klasa panelu / Szczegoly', panel?.estimatedClass || 'Monitor zewnetrzny / Matryca PC'],
  ];
  if (edidMonitor?.serial && edidMonitor.serial !== '—') {
    panelLines.push(['Numer seryjny EDID (S/N)', edidMonitor.serial]);
  }
  drawKvRows(panelLines);

  // 3. GPU Subsystem
  drawHeading('3. Podsystem Graficzny (GPU 3D)');
  const gpuLines: Array<[string, string]> = [
    ['Model karty graficznej', deep?.gpus?.[0]?.name || gpuClean.cleanModel],
    ['Producent ukladu (Vendor)', gpuClean.cleanVendor],
    ['Pamiec wideo (VRAM / Klasa)', estVramStr],
    ['Silnik renderowania 3D', `${gpuClean.backendApi} | ${specs?.webglVersion || 'WebGL 2.0'}`],
    ['Maks. rozmiar tekstur GPU', specs ? `${specs.maxTextureSize} x ${specs.maxTextureSize} px` : '16384 x 16384 px'],
    ['Akceleracja WebGPU Compute', cleanWebGpuSummaryForPdf(hardwareScan?.webGpuSummary)],
    ['Pelny identyfikator sterownika', specs ? specs.gpuRenderer : 'Brak danych'],
  ];
  if (deep?.gpus?.[0]?.driver) {
    gpuLines.push(['Wersja sterownika WMI', deep.gpus[0].driver]);
  }
  drawKvRows(gpuLines);

  // 4. Physical Disks, Partitions & Storage
  drawHeading('4. Dyski Fizyczne (NVMe / SSD / HDD), Partycje i Pamiec Masowa');
  const storageLines: Array<[string, string]> = [];
  const registeredDrives = diskTestService.getAvailableDrives();
  const physicalOrSmbiosDrives = registeredDrives.filter((d) => d.kind === 'native_exe' || d.kind === 'smbios' || d.kind === 'fs_picker');

  if (deep?.disks && deep.disks.length > 0) {
    deep.disks.forEach((d, idx) => {
      storageLines.push([
        `Dysk fizyczny #${idx + 1}`,
        `${d.model} | Pojemnosc: ${d.sizeGB} GB | Interfejs: ${d.interfaceType} (${d.mediaType}) | SMART: ${d.status}`,
      ]);
    });
  }
  if (deep?.logicalDisks && deep.logicalDisks.length > 0) {
    deep.logicalDisks.forEach((ld) => {
      storageLines.push([
        `Partycja logiczna ${ld.letter}`,
        `${ld.volumeName ? `${ld.volumeName} ` : ''}(${ld.fileSystem || 'NTFS'}) | Rozmiar: ${ld.totalGB} GB | Wolne: ${ld.freeGB} GB`,
      ]);
    });
  } else if (physicalOrSmbiosDrives.length > 0) {
    physicalOrSmbiosDrives.forEach((d, idx) => {
      storageLines.push([
        `Wykryty wolumin #${idx + 1}`,
        `${d.label} | ${d.totalGB ? `Pojemnosc: ${d.totalGB} GB` : d.interfaceType}${d.freeGB ? ` (Wolne: ${d.freeGB} GB)` : ''} | Status: ${d.smartStatus || 'OK'}`,
      ]);
    });
  } else {
    storageLines.push([
      'Dyski fizyczne NVMe / SSD',
      'Wczytaj skan 1-Klik SMBIOS w zakladce Peryferia lub uruchom SystemPulse-Pro.exe, aby odczytac modele i pojemnosci dyskow (GB/TB)',
    ]);
  }

  const opfsQuota =
    hardwareScan && hardwareScan.storageSummary.quotaGB
      ? `${hardwareScan.storageSummary.quotaGB} GB`
      : specs && specs.storageQuotaGB
        ? `${specs.storageQuotaGB} GB`
        : 'Aktywny';
  const opfsUsed =
    hardwareScan
      ? `${hardwareScan.storageSummary.usageMB} MB`
      : specs && specs.storageUsageMB
        ? `${specs.storageUsageMB} MB`
        : '0 MB';

  storageLines.push([
    'Bufor testowy I/O (OPFS)',
    `${opfsQuota} przydzielone na tymczasowe pliki benchmarku (uzyto ${opfsUsed} - to NIE jest rozmiar dysku fizycznego)`,
  ]);
  storageLines.push([
    'Silnik plikow OPFS Native',
    hardwareScan?.storageSummary.opfsSupported
      ? 'Aktywny (Bezposredni zapis/odczyt strumieniowy I/O)'
      : 'Standardowy',
  ]);
  drawKvRows(storageLines);

  // 5. Network Adapters & Peripherals
  if ((deep?.networkAdapters && deep.networkAdapters.length > 0) || (hardwareScan?.devices && hardwareScan.devices.length > 0)) {
    drawHeading('5. Karty Sieciowe, Audio i Wykryte Urzadzenia Peryferyjne');
    const periphLines: Array<[string, string]> = [];
    if (deep?.networkAdapters && deep.networkAdapters.length > 0) {
      periphLines.push(['Karty sieciowe (NIC)', deep.networkAdapters.join(' ; ')]);
    }
    const audioOut = (hardwareScan?.devices || []).filter((d) => d.category.includes('Audio') || d.category.includes('Mikrofon') || d.category.includes('Kamera'));
    for (const dev of audioOut.slice(0, 5)) {
      periphLines.push([dev.category, dev.name]);
    }
    if (periphLines.length > 0) {
      drawKvRows(periphLines);
    }
  }

  // Stamp Footer on all pages
  const invPages = doc.getNumberOfPages();
  for (let p = 1; p <= invPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, pageH - 14.5, pageW - margin, pageH - 14.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.0);
    doc.setTextColor(15, 23, 42);
    doc.text(
      pdfText('NAPRAWA KOMPUTEROW I LAPTOPOW - Rafal Jarosz | NAPRAWAPCLAPTOP.PL | Tel. 786 409 187 | Warszawa, ul. Marymoncka 125 m.109 p.6'),
      margin,
      pageH - 10.5
    );
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139);
    doc.text(pdfText('Copyright (c) Rafal Jarosz - SystemPulse Pro | Szczegolowy inwentarz sprzetu wygenerowany lokalnie.'), margin, pageH - 6.8);
    doc.text(`Strona ${p} / ${invPages}`, pageW - margin, pageH - 8.5, { align: 'right' });
  }

  doc.save(`systempulse-inwentarz-sprzetu-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export interface BatteryReportPdfOptions {
  summary?: boolean;
  cycleLog?: boolean;
  stats?: boolean;
  forecast?: boolean;
}

export function generateBatteryTrendReportPdf(
  battery: BatteryHealthState,
  options?: BatteryReportPdfOptions
): void {
  const opts = {
    summary: options?.summary ?? true,
    cycleLog: options?.cycleLog ?? true,
    stats: options?.stats ?? true,
    forecast: options?.forecast ?? true,
  };

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;
  const margin = 14;
  const contentW = pageW - margin * 2;
  const nowStr = new Date().toLocaleString('pl-PL');

  // --- Header Band ---
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 30, 'F');
  doc.setFillColor(16, 185, 129);
  doc.rect(0, 29, pageW, 1.2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('SystemPulse Pro - Battery Trend & Degradation Report', margin, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text(pdfText(`Analiza trendu poboru mocy vs degradacja ogniw (ostatnie 30+ dni) | Wygenerowano: ${nowStr}`), margin, 21);

  let y = 38;
  let sectionIdx = 1;

  // --- Summary KPIs ---
  if (opts.summary) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(pdfText(`${sectionIdx++}. Podsumowanie kondycji ogniw i degradacji`), margin, y);
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(51, 65, 85);
    doc.text(pdfText(`Pojemnosc fabryczna (Design): ${battery.designCapacityMWh} mWh`), margin, y);
    doc.text(pdfText(`Obecna pelna pojemnosc: ${battery.fullChargeCapacityMWh} mWh`), margin + 95, y);
    y += 6;
    doc.text(pdfText(`Stopien zuzycia (Wear Level): ${battery.wearLevelPct}%`), margin, y);
    doc.text(pdfText(`Kondycja ogniw: ${battery.condition}`), margin + 95, y);
    y += 6;
    if (opts.stats) {
      doc.text(pdfText(`Szacowany spadek na cykl: ${battery.avgDegradationPerCycleMWh} mWh / cykl`), margin, y);
      doc.text(pdfText(`Laczna utrata pojemnosci: ${battery.totalCapacityLostMWh} mWh`), margin + 95, y);
      y += 6;
    }
    if (opts.forecast) {
      const projLabel = battery.projectedCyclesTo80Pct !== null ? `~${battery.projectedCyclesTo80Pct} cykli` : 'Stabilna';
      doc.text(pdfText(`Prognoza do progu 80%: ${projLabel}`), margin, y);
      y += 6;
    }
    y += 4;
  }

  // --- Power Cycles Table ---
  if (opts.cycleLog) {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(pdfText(`${sectionIdx++}. Rejestr cykli ladowania i spadek pojemnosci (Power Cycle Log)`), margin, y);
    y += 6;

    // Table Headers
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentW, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('Data', margin + 3, y + 4.5);
    doc.text('Cykl', margin + 45, y + 4.5);
    doc.text('Zakres (%)', margin + 65, y + 4.5);
    doc.text('Czas (min)', margin + 100, y + 4.5);
    doc.text('Pojemnosc (mWh)', margin + 130, y + 4.5);
    doc.text('Zuzycie (%)', margin + 165, y + 4.5);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);

    const cycles = [...battery.powerCycles].slice(-15);
    for (const c of cycles) {
      if (y > 275) {
        doc.addPage();
        y = 20;
      }
      doc.text(pdfText(c.dateLabel), margin + 3, y + 4);
      doc.text(pdfText(`#${c.cycleNumber}`), margin + 45, y + 4);
      doc.text(pdfText(`${c.startPct}% -> ${c.endPct}%`), margin + 65, y + 4);
      doc.text(pdfText(`${c.durationMin} min`), margin + 100, y + 4);
      doc.text(pdfText(`${c.fullChargeCapacityMWh} mWh`), margin + 130, y + 4);
      doc.text(pdfText(`${c.cumulativeWearPct}%`), margin + 165, y + 4);

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.line(margin, y + 5.5, pageW - margin, y + 5.5);
      y += 7;
    }
  }

  // Footer
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, 282, pageW - margin, 282);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(pdfText('SystemPulse Pro | Raport trendu baterii i degradacji ogniw.'), margin, 287);
  doc.text('Strona 1 / 1', pageW - margin, 287, { align: 'right' });

  doc.save(`systempulse-battery-trend-report-${new Date().toISOString().slice(0, 10)}.pdf`);
}
