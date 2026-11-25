import { jsPDF } from 'jspdf';
import {
  BatteryHealthState,
  CpuTestResult,
  DiskTestResult,
  GameBenchMetrics,
  GpuStressMetrics,
  NetworkTestResult,
  RamTestResult,
  SchedulerSummaryReport,
  SuiteScores,
  SystemSpecs,
} from '../types';
import { HardwareScanSnapshot } from './hardwareScanner.service';

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
  '°': ' deg ',
};

function pdfText(input: string | number | null | undefined): string {
  const s = String(input ?? '—');
  return s.replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ×—–·≥°]/g, (ch) => PL_MAP[ch] ?? ch);
}

function truncateText(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

export function generateDiagnosticPdfReport(payload: PdfReportPayload): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;
  const margin = 14;
  const contentW = pageW - margin * 2;

  const { specs, scores, cpu, ram, disk, gpu, game, network, battery, realCpuTempC, realGpuTempC } = payload;
  const nowStr = new Date().toLocaleString('pl-PL');

  // --- Header Band ---
  doc.setFillColor(12, 18, 30);
  doc.rect(0, 0, pageW, 34, 'F');

  doc.setFillColor(6, 182, 212);
  doc.rect(0, 33, pageW, 1.2, 'F');

  doc.setTextColor(241, 245, 249);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text('SystemPulse Pro', margin, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(148, 163, 184);
  doc.text(pdfText('Raport diagnostyczny i benchmarkowy komputera / laptopa'), margin, 21);
  doc.text(pdfText(`Wygenerowano: ${nowStr}`), margin, 27);

  // Overall Grade Badge in Header
  doc.setFillColor(20, 29, 46);
  doc.setDrawColor(6, 182, 212);
  doc.setLineWidth(0.5);
  doc.roundedRect(pageW - margin - 42, 6, 42, 22, 2.5, 2.5, 'FD');

  doc.setTextColor(6, 182, 212);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(scores.overall > 0 ? scores.grade : '--', pageW - margin - 33, 18.5, { align: 'center' });

  doc.setTextColor(241, 245, 249);
  doc.setFontSize(10);
  doc.text(scores.overall > 0 ? `${scores.overall}/100` : 'Brak', pageW - margin - 14, 15.5, { align: 'center' });
  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('INDEKS', pageW - margin - 14, 21.5, { align: 'center' });

  let y = 42;

  const drawSectionHeading = (title: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text(pdfText(title), margin, y);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.line(margin, y + 1.8, pageW - margin, y + 1.8);
    y += 6.5;
  };

  // --- Section 1: Hardware Inventory ---
  drawSectionHeading('1. Specyfikacja wykrytego sprzetu');

  const specRows: Array<[string, string, string, string]> = [
    [
      'System / Platforma',
      specs ? `${specs.os} (${specs.platform})` : 'Nieznany',
      'Rdzenie logiczne CPU',
      specs ? `${specs.cpuCores} watkow` : '-',
    ],
    [
      'Przegladarka',
      specs ? specs.browser : '-',
      'Pamiec RAM (API)',
      specs ? (typeof specs.deviceMemory === 'number' ? `>= ${specs.deviceMemory} GB` : String(specs.deviceMemory)) : '-',
    ],
    [
      'Ekran / Odswiezanie',
      specs ? `${specs.screenResolution} | ~${specs.estimatedRefreshRate} Hz (${specs.colorDepth}-bit)` : '-',
      'WebGL / Tekstury',
      specs ? `${specs.webglVersion} | ${specs.maxTextureSize}px` : '-',
    ],
    [
      'Karta graficzna (GPU)',
      truncateText(specs ? specs.gpuRenderer : '-', 46),
      'Pula dyskowa',
      specs && specs.storageQuotaGB ? `${specs.storageQuotaGB} GB (uzyto ${specs.storageUsageMB ?? 0} MB)` : 'Dostepna',
    ],
  ];

  doc.setFontSize(8.5);
  for (const [k1, v1, k2, v2] of specRows) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text(pdfText(k1 + ':'), margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(pdfText(v1), margin + 35, y);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text(pdfText(k2 + ':'), margin + 102, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(pdfText(v2), margin + 135, y);
    y += 5.4;
  }

  y += 4;

  // --- Section 2: Benchmark Score Bars ---
  drawSectionHeading('2. Podsumowanie wynikow podzespolow (skala 0-100)');

  const barItems: Array<{ label: string; score: number; detail: string }> = [
    {
      label: 'Procesor (CPU)',
      score: scores.cpu,
      detail: cpu.multiCoreScore > 0 ? `SC ${cpu.singleCoreScore} / MC ${cpu.multiCoreScore} pkt (${cpu.grade})` : 'Nie testowano',
    },
    {
      label: 'Pamiec RAM',
      score: scores.ram,
      detail: ram.bandwidthReadMBs > 0 ? `Odczyt ${ram.bandwidthReadMBs} MB/s | Bledy: ${ram.errorsFound} (${ram.healthGrade})` : 'Nie testowano',
    },
    {
      label: 'Dysk SSD/HDD',
      score: scores.disk,
      detail: disk.seqReadMBs > 0 ? `Seq ${disk.seqReadMBs}/${disk.seqWriteMBs} MB/s | SMART: ${disk.smartStatus}` : 'Nie testowano',
    },
    {
      label: 'Grafika 3D (GPU)',
      score: scores.gpu,
      detail: gpu.avgFps > 0 ? `Sr. ${gpu.avgFps} FPS (1% Low: ${gpu.low1PctFps}) | Stabilnosc ${gpu.stabilityPct}%` : 'Nie testowano',
    },
    {
      label: 'Kondycja Baterii',
      score: scores.battery,
      detail: `Zdrowie ${battery.healthPct}% | Zuzycie ${battery.wearLevelPct}% (${battery.condition})`,
    },
  ];

  for (const item of barItems) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(pdfText(item.label), margin, y);

    const barX = margin + 36;
    const barW = 58;
    const barH = 3.6;
    doc.setFillColor(226, 232, 240);
    doc.roundedRect(barX, y - 3, barW, barH, 1, 1, 'F');

    const fillW = Math.max(0, Math.min(100, item.score)) / 100 * barW;
    if (fillW > 0) {
      if (item.score >= 70) doc.setFillColor(16, 185, 129);
      else if (item.score >= 45) doc.setFillColor(6, 182, 212);
      else doc.setFillColor(245, 158, 11);
      doc.roundedRect(barX, y - 3, fillW, barH, 1, 1, 'F');
    }

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`${item.score}/100`, barX + barW + 3, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(pdfText(item.detail), barX + barW + 17, y);
    y += 6.8;
  }

  y += 4;

  // --- Section 3: Detailed Diagnostics Grid (2 Columns) ---
  drawSectionHeading('3. Szczegolowe pomiary diagnostyczne');

  const colW = (contentW - 6) / 2;
  const col1X = margin;
  const col2X = margin + colW + 6;

  const drawDetailCard = (
    x: number,
    topY: number,
    cardH: number,
    title: string,
    rows: Array<[string, string]>
  ) => {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.25);
    doc.roundedRect(x, topY, colW, cardH, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(pdfText(title), x + 4, topY + 6);

    doc.setDrawColor(226, 232, 240);
    doc.line(x + 4, topY + 8, x + colW - 4, topY + 8);

    let ry = topY + 13;
    doc.setFontSize(8);
    for (const [label, val] of rows) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(pdfText(label), x + 4, ry);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(pdfText(val), x + colW - 4, ry, { align: 'right' });
      ry += 5.1;
    }
  };

  // Row A: CPU + RAM
  const rowAH = 46;
  drawDetailCard(col1X, y, rowAH, 'Procesor (CPU)', [
    ['Single-Core / Multi-Core', `${cpu.singleCoreScore || '-'} / ${cpu.multiCoreScore || '-'} pkt`],
    ['Skalowanie wielowatkowe', cpu.scalingRatio > 0 ? `${cpu.scalingRatio}x (${cpu.coresUsed} watkow)` : '-'],
    ['Kompresja GZIP', cpu.compressionMBs > 0 ? `${cpu.compressionMBs} MB/s` : '-'],
    ['Kryptografia SHA-256', cpu.cryptoSha256MBs > 0 ? `${cpu.cryptoSha256MBs} MB/s` : '-'],
    ['Taktowanie / Obciazenie', `${cpu.coresUsed} watkow | Stabilnosc ${cpu.stabilityPct}%`],
    ['Czujnik CPU (LIVE)', realCpuTempC != null ? `${realCpuTempC.toFixed(1)} C (prawdziwy)` : 'Brak czujnika (LHM/HWiNFO)'],
  ]);

  drawDetailCard(col2X, y, rowAH, 'Pamiec operacyjna (RAM)', [
    ['Przetestowany bufor', `${ram.allocatedMB} MB`],
    ['Odczyt / Zapis sekwencyjny', ram.bandwidthReadMBs > 0 ? `${ram.bandwidthReadMBs} / ${ram.bandwidthWriteMBs} MB/s` : '-'],
    ['Czas dostepu losowego', ram.latencyNs > 0 ? `${ram.latencyNs} ns` : '-'],
    ['Test szachownicy / PRNG', ram.status === 'completed' ? `${ram.patternErrors} / ${ram.randomErrors} bledow` : 'Oczekiwanie'],
    ['Test Walking 1s/0s', ram.status === 'completed' ? `${ram.walkingBitErrors} bledow` : 'Oczekiwanie'],
    ['Laczne bledy / Ocena', `${ram.errorsFound} | ${ram.healthGrade}`],
  ]);

  y += rowAH + 5;

  // Row B: Disk/SMART + GPU 3D
  const rowBH = 46;
  drawDetailCard(col1X, y, rowBH, 'Dysk (SSD/HDD) i SMART', [
    ['Silnik pomiaru I/O', disk.backend],
    ['Odczyt / Zapis sekwencyjny', disk.seqReadMBs > 0 ? `${disk.seqReadMBs} / ${disk.seqWriteMBs} MB/s` : '-'],
    ['Losowe 4K IOPS', disk.rand4kIops > 0 ? `${disk.rand4kIops} IOPS` : '-'],
    ['Czas dostepu (Sr. / P95)', disk.accessTimeAvgMs > 0 ? `${disk.accessTimeAvgMs} / ${disk.accessTimeP95Ms} ms` : '-'],
    ['Weryfikacja CRC32', disk.status === 'completed' ? (disk.crcVerified ? 'Zgodna (OK)' : 'Niezgodna') : '-'],
    ['Kondycja SMART', `${disk.smartStatus} (${disk.smartHealthPct}%)`],
  ]);

  drawDetailCard(col2X, y, rowBH, 'Grafika 3D (WebGL Stress)', [
    ['Tryb / Obciazenie', `${gpu.fpsMode === 'uncapped' ? 'Bez limitu' : 'VSync'} | ${gpu.preset.toUpperCase()} (${gpu.instanceCount})`],
    ['Srednie / Max FPS', gpu.avgFps > 0 ? `${gpu.avgFps} / ${gpu.maxFps || gpu.avgFps} FPS` : '-'],
    ['1% Low / Min FPS', gpu.avgFps > 0 ? `${gpu.low1PctFps} / ${gpu.minFps} FPS (${gpu.frameTimeMs} ms)` : '-'],
    ['Stabilnosc / Klatki', gpu.avgFps > 0 ? `${gpu.stabilityPct}% (${gpu.totalFramesRendered || 0} kl.)` : '-'],
    ['Czujnik GPU (LIVE)', realGpuTempC != null ? `${realGpuTempC.toFixed(1)} C (prawdziwy)` : `Czas klatki: ${gpu.frameTimeMs} ms`],
    ['Werdykt stabilnosci', gpu.verdict],
  ]);

  y += rowBH + 5;

  // Row C: Full-width Battery Health Panel
  const batH = 34;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, contentW, batH, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('Bateria i zasilanie laptopa', margin + 4, y + 6);
  doc.setDrawColor(226, 232, 240);
  doc.line(margin + 4, y + 8, pageW - margin - 4, y + 8);

  const curEst = battery.estimates[2]?.label || '-';
  const officeEst = battery.estimates[0]?.label || '-';
  const batLeft: Array<[string, string]> = [
    ['Naladowanie / Stan', `${battery.levelPct}% (${battery.charging ? 'Ladowanie' : 'Bateria'})`],
    ['Zdrowie / Zuzycie (Wear)', `${battery.healthPct}% | Wear ${battery.wearLevelPct}% (${battery.condition})`],
    ['Pojemnosc obecna / fabryczna', `${battery.fullChargeCapacityMWh} / ${battery.designCapacityMWh} mWh`],
  ];
  const batRight: Array<[string, string]> = [
    ['Cykle / Degradacja', `~${battery.estimatedCycles} cykli (-${battery.avgDegradationPerCycleMWh} mWh/cykl)`],
    ['Biezacy pobor mocy', `${battery.currentPowerDrawW} W (obciazenie ${battery.currentLoadPct}%)`],
    ['Szac. czas pracy (Biuro / Biezacy)', `${officeEst} / ${curEst}`],
  ];

  doc.setFontSize(8);
  let by = y + 14;
  for (let i = 0; i < batLeft.length; i++) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(pdfText(batLeft[i][0]), col1X + 4, by);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(pdfText(batLeft[i][1]), col1X + colW - 4, by, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(pdfText(batRight[i][0]), col2X + 4, by);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(pdfText(batRight[i][1]), col2X + colW - 4, by, { align: 'right' });
    by += 6;
  }

  // Row D: Optional Game 3D MAX & Network summary line
  if ((game && game.avgFps > 0) || (network && network.pingAvgMs > 0)) {
    y += batH + 4;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(margin, y, contentW, 13, 2, 2, 'FD');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    const parts: string[] = [];
    if (game && game.avgFps > 0) {
      parts.push(
        `Gra 3D MAX (${game.preset.toUpperCase()}): Sr. ${game.avgFps} FPS | 1% Low: ${game.low1PctFps} | 0.1% Low: ${game.low01PctFps} (${game.verdict})`
      );
    }
    if (network && network.pingAvgMs > 0) {
      parts.push(
        `Siec: Ping ${network.pingAvgMs} ms | Jitter ${network.jitterMs} ms | Utrata ${network.packetLossPct}% (${network.qualityGrade})`
      );
    }
    doc.text(pdfText(truncateText(parts.join('   ||   '), 118)), margin + 4, y + 8);
  }

  // --- Footer ---
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, 282, pageW - margin, 282);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    pdfText('SystemPulse Pro | Raport wygenerowany lokalnie w przegladarce — dokument gotowy do wydruku A4.'),
    margin,
    287
  );
  doc.text('Strona 1 / 1', pageW - margin, 287, { align: 'right' });

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
  doc.setFontSize(16);
  doc.text('SystemPulse Pro - Raport Harmonogramu', margin, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text(
    pdfText(`Kolejka sekwencyjna (${report.steps.length} testow) | Czas: ${report.totalDurationSec.toFixed(1)} s`),
    margin,
    21
  );
  doc.text(pdfText(`Zakonczono: ${new Date(report.finishedAt).toLocaleString('pl-PL')}`), margin, 27);

  // Score badge
  doc.setFillColor(20, 29, 46);
  doc.setDrawColor(6, 182, 212);
  doc.setLineWidth(0.5);
  doc.roundedRect(pageW - margin - 42, 6, 42, 22, 2.5, 2.5, 'FD');
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
      `Zaliczone: ${report.passedCount} | Ostrzezenia: ${report.warningCount} | Bledy: ${report.failedCount} | Czujnik szczyt: ${report.peakSystemTempC > 0 ? `${report.peakSystemTempC.toFixed(1)} deg C` : 'brak mostka'}`
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

  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    pdfText('SystemPulse Pro | Jednolity raport zbiorczy z kolejki testow obciazeniowych.'),
    margin,
    287
  );

  doc.save(`systempulse-harmonogram-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function generateHardwareInventoryPdfReport(
  specs: SystemSpecs | null,
  hardwareScan: HardwareScanSnapshot | null
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
  doc.setFontSize(16);
  doc.text('SystemPulse Pro - Inwentarz Sprzetu', margin, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text(pdfText('Szczegolowy raport wykrytych podzespolow (RAM, dyski, matryca, GPU, CPU)'), margin, 21);
  doc.text(pdfText(`Wygenerowano: ${new Date().toLocaleString('pl-PL')}`), margin, 27);

  let y = 43;
  const drawHeading = (title: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text(pdfText(title), margin, y);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.line(margin, y + 1.8, pageW - margin, y + 1.8);
    y += 7;
  };

  drawHeading('1. Specyfikacja procesora i platformy systemowej');
  const cpuLines = [
    ['System operacyjny / Arch', specs ? `${specs.os} (${specs.platform})` : 'Nieznany'],
    ['Wątki logiczne CPU', specs ? `${specs.cpuCores} wątków logicznych` : 'Nieznany'],
    ['Przeglądarka / Środowisko', specs ? specs.browser : 'Nieznana'],
    ['Pamięć RAM (API)', specs ? (typeof specs.deviceMemory === 'number' ? `>= ${specs.deviceMemory} GB` : String(specs.deviceMemory)) : 'Nieznana'],
  ];
  doc.setFontSize(8.5);
  for (const [k, v] of cpuLines) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text(pdfText(k + ':'), margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(pdfText(v), margin + 55, y);
    y += 5.5;
  }
  y += 4;

  drawHeading('2. Matryca i Parametry Wyświetlacza (EDID)');
  const panel = hardwareScan?.panel;
  const panelLines = [
    ['Model matrycy / Panel', panel ? panel.label : specs ? specs.screenResolution : 'Standardowy monitor'],
    ['Rozdzielczość natywna', panel ? panel.nativeResolution : specs ? specs.screenResolution : '-'],
    ['Odświeżanie ekranu', panel ? `${panel.refreshRateHz} Hz` : specs ? `~${specs.estimatedRefreshRate} Hz` : '-'],
    ['Przestrzeń barw / HDR', panel ? `${panel.colorGamut} | ${panel.hdrSupported ? 'HDR obsługiwany' : 'SDR'}` : specs ? `${specs.colorDepth}-bit` : '-'],
  ];
  for (const [k, v] of panelLines) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text(pdfText(k + ':'), margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(pdfText(v), margin + 55, y);
    y += 5.5;
  }
  y += 4;

  drawHeading('3. Podsystem Graficzny (GPU)');
  const gpuLines = [
    ['Renderer GPU', specs ? specs.gpuRenderer : 'Brak danych'],
    ['Dostawca (Vendor)', specs ? specs.gpuVendor : 'Brak danych'],
    ['Wersja WebGL', specs ? `${specs.webglVersion} | Max tekstura: ${specs.maxTextureSize}px` : 'Brak danych'],
    ['WebGPU', hardwareScan?.webGpuSummary || 'Sprawdzono w przeglądarce'],
  ];
  for (const [k, v] of gpuLines) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text(pdfText(k + ':'), margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(pdfText(truncateText(v, 78)), margin + 55, y);
    y += 5.5;
  }
  y += 4;

  drawHeading('4. Pamięć Masowa i Zasoby Dyskowe');
  const storageLines = [
    ['Pula magazynowa przeglądarki', hardwareScan && hardwareScan.storageSummary.quotaGB ? `${hardwareScan.storageSummary.quotaGB} GB` : specs && specs.storageQuotaGB ? `${specs.storageQuotaGB} GB` : 'Dostępna'],
    ['Użycie przestrzeni', hardwareScan ? `${hardwareScan.storageSummary.usageMB} MB` : specs && specs.storageUsageMB ? `${specs.storageUsageMB} MB` : 'Brak danych'],
    ['Obsługa OPFS (Native FS)', hardwareScan ? (hardwareScan.storageSummary.opfsSupported ? 'Tak (Wysoka wydajność I/O)' : 'Ograniczona (IndexedDB)') : 'Tak'],
    ['Trwałość danych (Persisted)', hardwareScan ? (hardwareScan.storageSummary.persisted ? 'Trwałe (Chronione przed czyszczeniem)' : 'Standardowa') : 'Standardowa'],
  ];
  for (const [k, v] of storageLines) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text(pdfText(k + ':'), margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(pdfText(v), margin + 55, y);
    y += 5.5;
  }

  // Footer
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, 282, pageW - margin, 282);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(pdfText('SystemPulse Pro | Szczegółowy inwentarz sprzętu wygenerowany lokalnie.'), margin, 287);
  doc.text('Strona 1 / 1', pageW - margin, 287, { align: 'right' });

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
  doc.text('SystemPulse Pro — Battery Trend & Degradation Report', margin, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text(pdfText(`Analiza trendu poboru mocy vs degradacja ogniw (ostatnie 30+ dni) · Wygenerowano: ${nowStr}`), margin, 21);

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
    doc.text(pdfText(`Pojemność fabryczna (Design): ${battery.designCapacityMWh} mWh`), margin, y);
    doc.text(pdfText(`Obecna pełna pojemność: ${battery.fullChargeCapacityMWh} mWh`), margin + 95, y);
    y += 6;
    doc.text(pdfText(`Stopień zużycia (Wear Level): ${battery.wearLevelPct}%`), margin, y);
    doc.text(pdfText(`Kondycja ogniw: ${battery.condition}`), margin + 95, y);
    y += 6;
    if (opts.stats) {
      doc.text(pdfText(`Szacowany spadek na cykl: ${battery.avgDegradationPerCycleMWh} mWh / cykl`), margin, y);
      doc.text(pdfText(`Łączna utrata pojemności: ${battery.totalCapacityLostMWh} mWh`), margin + 95, y);
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
    doc.text(pdfText(`${sectionIdx++}. Rejestr cykli ładowania i spadek pojemności (Power Cycle Log)`), margin, y);
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
    doc.text('Pojemność (mWh)', margin + 130, y + 4.5);
    doc.text('Zużycie (%)', margin + 165, y + 4.5);
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



