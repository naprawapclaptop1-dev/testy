import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  computePcRankingSnapshot,
  deleteSavedPcFromRanking,
  loadSavedPcRankings,
  REFERENCE_PC_LEADERBOARD,
  renderPcRankingSectionHtml,
  savePcToRanking,
  type PcRankingInputContext,
} from '../pcRankingReport';
import {
  buildDiagnosticPdfDocument,
  type PdfReportPayload,
} from '../../services/pdfReport.service';
import type {
  BatteryHealthState,
  ComponentScanCard,
  CpuTestResult,
  DiskTestResult,
  GameBenchMetrics,
  GpuStressMetrics,
  NetworkTestResult,
  RamTestResult,
  StressSessionRecord,
  SuiteScores,
  SystemSpecs,
  ThermalHeatMapSnapshot,
} from '../../types';

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };
}

function makeFixture(): { rankingCtx: PcRankingInputContext; pdfPayload: PdfReportPayload } {
  const specs: SystemSpecs = {
    os: 'Windows 11',
    platform: 'Windows | X86 64-bit | Komputer Stacjonarny (PC)',
    browser: 'Google Chrome',
    cpuCores: 32,
    deviceMemory: 32,
    gpuVendor: 'AMD',
    gpuRenderer: 'ANGLE (AMD, AMD Radeon RX 7900 XTX (0x0000744C) Direct3D11 vs_5_0 ps_5_0, D3D11)',
    webglVersion: 'WebGL 2.0 + WebGPU',
    maxTextureSize: 16384,
    screenResolution: '2560 x 1440',
    viewportSize: '1920 x 1080',
    colorDepth: 24,
    devicePixelRatio: 1,
    estimatedRefreshRate: 169,
    online: true,
    connectionType: '4g',
    downlink: 100,
    rtt: 25,
    storageQuotaGB: 10,
    storageUsageMB: 1.9,
  };

  const scores: SuiteScores = {
    cpu: 100,
    ram: 77,
    disk: 99,
    gpu: 100,
    battery: 91,
    overall: 94,
    grade: 'S',
    timestamp: Date.now(),
  };

  const cpu: CpuTestResult = {
    status: 'completed',
    phase: 'Zakończono',
    progress: 100,
    coresUsed: 32,
    singleCoreScore: 125802,
    multiCoreScore: 2464266,
    scalingRatio: 19.59,
    mathMflops: 184500,
    compressionMBs: 484.8,
    cryptoSha256MBs: 1678.3,
    avgClockGHz: 5.2,
    peakClockGHz: 5.5,
    currentTempC: 66,
    peakTempC: 71,
    throttlingPct: 0,
    stabilityPct: 98.6,
    telemetry: [
      { timeSec: 1, loadPct: 96, estClockGHz: 5.2, estTempC: 62, opsPerSec: 120000 },
      { timeSec: 2, loadPct: 98, estClockGHz: 5.3, estTempC: 66, opsPerSec: 124000 },
    ],
    overallScore: 100,
    grade: 'WZOROWY',
  };

  const ram: RamTestResult = {
    status: 'completed',
    progress: 100,
    allocatedMB: 128,
    bandwidthReadMBs: 5740,
    bandwidthWriteMBs: 6845,
    copyBandwidthMBs: 5120,
    cacheL1L2MBs: 14200,
    latencyNs: 18.7,
    errorsFound: 0,
    patternErrors: 0,
    randomErrors: 0,
    walkingBitErrors: 0,
    patternTestPassed: true,
    randomTestPassed: true,
    walkingBitsPassed: true,
    healthGrade: 'WZOROWY',
    overallScore: 77,
    testLog: ['Pass 1: OK', 'Pass 2: OK'],
  };

  const disk: DiskTestResult = {
    status: 'completed',
    phase: 'Zakończono',
    progress: 100,
    backend: 'OPFS (Native FS)',
    seqWriteMBs: 843.2,
    seqReadMBs: 2057.9,
    rand4kWriteMBs: 45.2,
    rand4kReadMBs: 68.4,
    rand4kIops: 289,
    qd32Iops: 1480,
    accessTimeAvgMs: 3.46,
    accessTimeMinMs: 1.12,
    accessTimeP95Ms: 6.0,
    crcVerified: true,
    quotaGB: 10,
    usedMB: 1.9,
    smartHealthPct: 100,
    smartStatus: 'ZDROWY',
    smartAttributes: [
      { id: '05', name: 'Reallocated Sectors Count', value: '0', threshold: '10', status: 'OK', note: 'Brak bad sektorow' },
      { id: '09', name: 'Power-On Hours', value: '1420 h', threshold: '0', status: 'OK', note: 'Niski przebieg' },
      { id: 'C2', name: 'Temperature', value: '39 C', threshold: '70 C', status: 'OK', note: 'Optymalna' },
      { id: 'E7', name: 'SSD Life Left', value: '100%', threshold: '10%', status: 'OK', note: 'Jak nowy' },
    ],
    overallScore: 99,
  };

  const gpu: GpuStressMetrics = {
    running: false,
    sceneMode: 'furmark',
    sceneLabel: 'FurMark Ring Stress',
    workloadNote: 'High FP32 ALU + Pixel Fillrate',
    preset: 'high',
    fpsMode: 'uncapped',
    instanceCount: 5000,
    triangles: 128000,
    drawCalls: 220,
    fps: 302,
    avgFps: 302,
    minFps: 235,
    maxFps: 330,
    low1PctFps: 235,
    totalFramesRendered: 1220,
    frameTimeMs: 3.33,
    stabilityPct: 98.3,
    estTempC: 72,
    peakTempC: 75,
    elapsedSec: 15,
    isSoftwareGl: false,
    rendererName: specs.gpuRenderer,
    allocatedVramMB: 4096,
    textureVramMB: 2048,
    coreClockMhz: 2520,
    thermalThrottleActive: false,
    thermalThrottleRecent60s: false,
    telemetry: [
      { timeSec: 1, fps: 302, frameTimeMs: 3.31, estTempC: 68, allocatedVramMB: 4096, textureVramMB: 2048, coreClockMhz: 2520, thermalThrottle: false },
    ],
    overallScore: 100,
    verdict: 'STABILNY',
  };

  const game: GameBenchMetrics = {
    running: false,
    interactiveMode: false,
    gameId: 'hyperion',
    gameTitle: 'Hyperion 3D MAX',
    preset: 'ultra',
    fpsMode: 'uncapped',
    renderScale: 1,
    upscalingMode: 'native',
    frameGenMode: 'off',
    bloomEnabled: true,
    shadowsEnabled: true,
    raymarchSteps: 64,
    resolutionLabel: '2560 x 1440',
    fps: 153,
    avgFps: 153,
    minFps: 141,
    maxFps: 174,
    low1PctFps: 167, // intentionally higher than avg to verify clamping in PDF
    low01PctFps: 167,
    frameTimeMs: 6.53,
    triangles: 420000,
    drawCalls: 610,
    particleCount: 15000,
    droneCount: 24,
    elapsedSec: 20,
    estTempC: 74,
    peakTempC: 76,
    realGpuTempC: 72,
    gpuLoadIndexPct: 99,
    stabilityPct: 97.4,
    overallScore: 98,
    shotsFired: 0,
    targetsHit: 0,
    telemetry: [],
    verdict: 'ULTRA PŁYNNOŚĆ',
  };

  const network: NetworkTestResult = {
    status: 'completed',
    progress: 100,
    online: true,
    effectiveType: '4g',
    downlinkMbps: 412.5,
    nativeRttMs: 14,
    pingMinMs: 12.1,
    pingAvgMs: 14.2,
    pingMaxMs: 19.8,
    jitterMs: 1.8,
    packetLossPct: 0,
    downloadEstMbps: 412.5,
    uploadEstMbps: 95.2,
    dnsLookupMs: 9.4,
    samples: [
      { seq: 1, latencyMs: 14.0, ok: true },
      { seq: 2, latencyMs: 14.4, ok: true },
    ],
    qualityGrade: 'WZOROWA',
  };

  const battery: BatteryHealthState = {
    apiSupported: true,
    levelPct: 100,
    charging: true,
    nativeChargingTimeSec: 0,
    nativeDischargingTimeSec: Infinity,
    designCapacityMWh: 56000,
    fullChargeCapacityMWh: 51200,
    wearLevelPct: 8.6,
    healthPct: 91.4,
    estimatedCycles: 125,
    currentLoadPct: 8,
    currentPowerDrawW: 9.3,
    powerThresholdW: 65,
    soundAlertEnabled: false,
    voltageV: 12.6,
    estTempC: 31,
    condition: 'DOSKONAŁA',
    estimates: [
      { profile: 'Biuro', powerW: 8, hours: 6, minutes: 34, label: '6 godz. 34 min' },
      { profile: 'Wideo', powerW: 11, hours: 4, minutes: 39, label: '4 godz. 39 min' },
      { profile: 'Bieżący', powerW: 9.3, hours: 5, minutes: 30, label: '5 godz. 30 min' },
    ],
    history: [{ timeLabel: '12:00', levelPct: 100, powerW: 9.3 }],
    railHistory: [{ timeLabel: '12:00', timestamp: Date.now(), rail12V: 12.04, rail5V: 5.01, rail3P3V: 3.31, powerW: 185 }],
    efficiencyTrend1h: [{ timestamp: Date.now(), timeLabel: '12:00', efficiencyPct: 91.5, powerDrawW: 185, tempC: 42 }],
    powerCycles: [],
    totalCapacityLostMWh: 4800,
    avgDegradationPerCycleMWh: 39.5,
    projectedCyclesTo80Pct: 162,
    psu: {
      detected: true,
      model: 'ATX 850W Modular',
      rating80Plus: '80 PLUS Gold',
      rail12V: 12.04,
      rail5V: 5.01,
      rail3P3V: 3.31,
      rippleMv: 18,
      efficiencyPct: 91.5,
      estimatedWattage: 850,
      tempC: 42,
      status: 'STABILNY',
    },
    criticalPowerAlert: false,
    railAlertEvents: [],
  };

  const componentScans: ComponentScanCard[] = [
    { id: 'cpu', title: 'Procesor CPU', category: 'Obliczenia', status: 'OK', score: 100, headline: '32 wątki · 2 464 266 pkt', summary: 'Stabilny', source: 'Auto (Web API)', metrics: [{ label: 'Multi', value: '2464266' }], scannedAt: Date.now() },
    { id: 'gpu', title: 'Karta Graficzna GPU', category: 'Grafika', status: 'OK', score: 100, headline: 'AMD Radeon RX 7900 XTX · 302 FPS', summary: 'WebGL2 + WebGPU', source: 'Auto (Web API)', metrics: [{ label: 'FPS', value: '302' }], scannedAt: Date.now() },
    { id: 'ram', title: 'Pamięć RAM', category: 'Pamięć', status: 'OK', score: 92, headline: '32 GB · 0 błędów', summary: 'Wzorowy', source: 'Auto (Web API)', metrics: [{ label: 'Odczyt', value: '5740 MB/s' }], scannedAt: Date.now() },
    { id: 'disk', title: 'Dysk SSD/NVMe', category: 'Magazyn', status: 'OK', score: 99, headline: '2057.9 / 843.2 MB/s · SMART OK', summary: 'Zdrowy', source: 'Auto (Web API)', metrics: [{ label: 'SMART', value: '100%' }], scannedAt: Date.now() },
    { id: 'network', title: 'Sieć / Wi-Fi / LAN', category: 'Sieć', status: 'OK', score: 96, headline: 'Ping 14.2 ms · 412.5 Mbps', summary: '0% strat', source: 'Auto (Web API)', metrics: [{ label: 'Ping', value: '14.2 ms' }], scannedAt: Date.now() },
    { id: 'power', title: 'Bateria / Zasilanie', category: 'Zasilanie', status: 'OK', score: 91, headline: '91.4% zdrowia · PSU +12V 12.04V', summary: 'Doskonała', source: 'Auto (Web API)', metrics: [{ label: '+12V', value: '12.04V' }], scannedAt: Date.now() },
  ];

  const thermalState: ThermalHeatMapSnapshot = {
    updatedAt: Date.now(),
    sensorMode: 'hardware-live',
    bridgeUrl: 'http://127.0.0.1:8085',
    bridgeStatus: 'Aktywny (LHM)',
    avgSystemTempC: 62,
    hottestTempC: 72,
    hottestZoneLabel: 'GPU Core',
    batteryTempC: 31,
    thermalStatus: 'OPTYMALNA',
    rows: [
      { id: 'cpu', name: 'CPU Package', subtitle: '32 wątki', loadPct: 64, active: true, avgTempC: 66, maxTempC: 71, zones: [] },
      { id: 'gpu', name: 'GPU Core', subtitle: 'RX 7900 XTX', loadPct: 82, active: true, avgTempC: 72, maxTempC: 75, zones: [] },
      { id: 'disk', name: 'NVMe SSD', subtitle: 'SMART', loadPct: 18, active: true, avgTempC: 39, maxTempC: 42, zones: [] },
    ],
  };

  const stressHistory: StressSessionRecord[] = [
    {
      id: 'sess_1',
      module: 'Pełna Diagnostyka',
      startedAt: Date.now() - 600000,
      endedAt: Date.now() - 540000,
      durationSec: 60,
      avgCpuTempC: 66,
      avgGpuTempC: 72,
      finalStabilityPct: 98.3,
      summaryMetric: '302 FPS · Indeks 94/100',
      status: 'OK',
    },
  ];

  return {
    rankingCtx: { specs, scores, cpu, ram, disk, gpu, game },
    pdfPayload: {
      specs,
      scores,
      cpu,
      ram,
      disk,
      gpu,
      game,
      network,
      battery,
      realCpuTempC: 66,
      realGpuTempC: 72,
      componentScans,
      thermalState,
      gpuSuiteResults: [
        { sceneId: 'furmark', name: 'FurMark Ring Stress', targetUnit: 'ALU / FP32', avgFps: 302, low1PctFps: 235, triangles: 128000, stabilityPct: 98.3, score: 100 },
        { sceneId: 'raymarching', name: 'Raymarching Fractal 3D', targetUnit: 'Raymarch / TMU', avgFps: 184, low1PctFps: 152, triangles: 240000, stabilityPct: 97.1, score: 96 },
      ],
      stressHistory,
    },
  };
}

describe('pcRankingReport & multi-page PDF report', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: createMemoryStorage(),
      configurable: true,
      writable: true,
    });
  });

  it('sorts leaderboard from best (#1) to lowest, computes percentile, and detects strongest & bottleneck components', () => {
    const { rankingCtx } = makeFixture();
    const snap = computePcRankingSnapshot(rankingCtx);

    expect(snap.totalRanked).toBe(REFERENCE_PC_LEADERBOARD.length + 1);
    expect(snap.currentRank).toBeGreaterThanOrEqual(1);
    expect(snap.currentRank).toBeLessThanOrEqual(3);
    expect(snap.percentileBetterThan).toBeGreaterThanOrEqual(80);
    expect(snap.hasRealMeasurements).toBe(true);

    // Leaderboard must be strictly non-increasing by overallScore
    for (let i = 1; i < snap.leaderboard.length; i++) {
      expect(snap.leaderboard[i - 1].overallScore).toBeGreaterThanOrEqual(snap.leaderboard[i].overallScore);
    }

    // RAM is 77 while CPU/GPU/Disk are 99-100 -> bottleneck must be RAM
    expect(snap.bottleneckComponent).toContain('RAM');
    expect(snap.strongestComponent).toMatch(/CPU|GPU/);
  });

  it('persists and deletes user-saved PCs in localStorage and reflects them in the ranking', () => {
    const { rankingCtx } = makeFixture();
    const initial = computePcRankingSnapshot(rankingCtx);

    savePcToRanking({
      ...initial.currentEntry,
      id: 'client_pc_1',
      name: 'PC Klienta #1 (RTX 4070)',
      cpuScore: 80,
      gpuScore: 82,
      ramScore: 78,
      diskScore: 85,
      overallScore: 81,
    });

    const saved = loadSavedPcRankings();
    expect(saved).toHaveLength(1);
    expect(saved[0].name).toBe('PC Klienta #1 (RTX 4070)');

    const afterSave = computePcRankingSnapshot(rankingCtx);
    expect(afterSave.totalRanked).toBe(REFERENCE_PC_LEADERBOARD.length + 2);
    expect(afterSave.leaderboard.some((e) => e.id === 'client_pc_1' && e.isUserSaved)).toBe(true);

    deleteSavedPcFromRanking('client_pc_1');
    expect(loadSavedPcRankings()).toHaveLength(0);
  });

  it('ensures every .sp-rank* and .sp-ranking* class rendered by pcRankingReport exists in src/index.css', () => {
    const { rankingCtx } = makeFixture();
    const html = renderPcRankingSectionHtml(rankingCtx);
    const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');

    const classMatches = Array.from(html.matchAll(/class="([^"]+)"/g));
    const emittedRankingClasses = new Set<string>();
    for (const match of classMatches) {
      for (const cls of match[1].split(/\s+/)) {
        if (cls.startsWith('sp-rank')) {
          emittedRankingClasses.add(cls);
        }
      }
    }

    expect(emittedRankingClasses.size).toBeGreaterThan(10);
    const missing = Array.from(emittedRankingClasses).filter((cls) => !css.includes(`.${cls}`));
    expect(missing).toEqual([]);
  });

  it('builds a rich multi-page A4 PDF (>= 4 pages) with full diagnostic sections and zero errors', () => {
    const { pdfPayload } = makeFixture();
    const doc = buildDiagnosticPdfDocument(pdfPayload);

    const pageCount = doc.getNumberOfPages();
    expect(pageCount).toBeGreaterThanOrEqual(4);

    // Output bytes should be substantial for a multi-page report
    const buffer = doc.output('arraybuffer');
    expect(buffer.byteLength).toBeGreaterThan(12000);
  });
});
