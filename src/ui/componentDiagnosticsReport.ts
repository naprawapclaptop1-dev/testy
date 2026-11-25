import {
  BatteryHealthState,
  CpuTestResult,
  DiskTestResult,
  FanTestState,
  GameBenchMetrics,
  GpuSceneSuiteEntry,
  GpuStressMetrics,
  NetworkTestResult,
  RamTestResult,
  SystemSpecs,
  ThermalHeatMapSnapshot,
} from '../types';
import { HardwareScanSnapshot } from '../services/hardwareScanner.service';
import { GPU_SCENE_CATALOG } from '../services/gpuStress.service';
import { DISPLAY_PATTERNS } from './displayDiagnostics';
import { PSU_STRESS_PROFILES, psuCalculatorService } from '../services/psuCalculator.service';
import { renderPcSuitabilityAndGamesReport } from './pcSuitabilityAndGamesReport';

export type ComponentHealthStatus = 'ok' | 'warn' | 'err' | 'untested';

export interface ComponentBarMetric {
  label: string;
  valueLabel: string;
  pct: number; // 0-100 bar width
  color: string;
}

export interface ComponentDiagnosticCardData {
  id:
    | 'cpu'
    | 'ram'
    | 'disk'
    | 'gpu'
    | 'game'
    | 'display'
    | 'battery'
    | 'network'
    | 'thermal'
    | 'peripherals';
  name: string;
  subtitle: string;
  status: ComponentHealthStatus;
  statusLabel: string;
  score: number; // 0-100
  description: string;
  works: string[];
  issues: string[];
  bars: ComponentBarMetric[];
  moduleNav:
    | 'cpu'
    | 'ram'
    | 'disk'
    | 'gpu'
    | 'game'
    | 'display'
    | 'battery'
    | 'network'
    | 'peripherals';
}

export interface ComponentReportContext {
  specs: SystemSpecs | null;
  hardwareScan: HardwareScanSnapshot | null;
  cpu: CpuTestResult;
  ram: RamTestResult;
  disk: DiskTestResult;
  gpu: GpuStressMetrics;
  gpuSuiteResults: GpuSceneSuiteEntry[];
  game: GameBenchMetrics;
  battery: BatteryHealthState;
  network: NetworkTestResult;
  thermal: ThermalHeatMapSnapshot;
  fan: FanTestState;
  peripheralsTestedAudio?: boolean;
}

function esc(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function clampPct(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}

export function evaluateAllComponents(ctx: ComponentReportContext): ComponentDiagnosticCardData[] {
  const cards: ComponentDiagnosticCardData[] = [];

  // 1. CPU
  {
    const c = ctx.cpu;
    const tested = c.status === 'completed' || c.multiCoreScore > 0;
    const liveCpuTemp = ctx.thermal.rows.flatMap((r) => r.zones).find((z) => z.id === 'cpu-package')?.tempC ?? null;
    const works: string[] = [
      `Aktywna wielowątkowość Web Workers: ${c.coresUsed} wątków logicznych.`,
    ];
    const issues: string[] = [];

    if (!tested) {
      issues.push('Nie wykonano jeszcze pełnej serii 10 podtestów CPU — kliknij „Pełny test” lub moduł CPU.');
    } else {
      works.push(`Single-Core: ${c.singleCoreScore.toLocaleString('pl-PL')} pkt · Multi-Core: ${c.multiCoreScore.toLocaleString('pl-PL')} pkt (skalowanie ${c.scalingRatio}×).`);
      if (c.avxMatrixGflops) works.push(`Jednostka FPU/AVX FP64: ${c.avxMatrixGflops} GFLOPS · AI/GEMM: ${c.neuralInferenceOps ?? 0} MOps/s.`);
      if (c.compressionMBs > 0 && c.cryptoSha256MBs > 0) {
        works.push(`Kryptografia SHA-256 (${c.cryptoSha256MBs} MB/s) i kompresja GZIP (${c.compressionMBs} MB/s) sprawne.`);
      }
      if (c.throttlingPct > 15) {
        issues.push(`Wykryto throttling wydajności pod obciążeniem: -${c.throttlingPct}% (sprawdź chłodzenie / limit mocy TDP).`);
      } else {
        works.push(`Stabilność pętli obliczeniowej wzorowa (${c.stabilityPct}% · throttling tylko ${c.throttlingPct}%).`);
      }
    }
    if (liveCpuTemp === null) {
      issues.push('Czujnik temperatury °C CPU niedostępny bezpośrednio z przeglądarki — włącz LibreHardwareMonitor :8085 w Windows .EXE dla realnych °C.');
    } else {
      works.push(`Czujnik sprzętowy CPU LIVE działa: ${liveCpuTemp.toFixed(1)} °C.`);
      if (liveCpuTemp >= 88) issues.push(`Wysoka temperatura pakietu CPU (${liveCpuTemp.toFixed(1)} °C) — bliska progu TjMax.`);
    }

    const status: ComponentHealthStatus = !tested
      ? 'untested'
      : c.throttlingPct > 22 || (liveCpuTemp !== null && liveCpuTemp >= 92)
        ? 'err'
        : c.throttlingPct > 12 || (liveCpuTemp !== null && liveCpuTemp >= 82)
          ? 'warn'
          : 'ok';

    cards.push({
      id: 'cpu',
      name: 'Procesor (CPU — 10 podtestów)',
      subtitle: `${ctx.specs?.cpuCores ?? c.coresUsed} wątków · Śr. ${c.avgClockGHz.toFixed(2)} GHz`,
      status,
      statusLabel: !tested ? 'DO PRZETESTOWANIA' : status === 'ok' ? 'DZIAŁA PRAWIDŁOWO' : status === 'warn' ? 'THROTTLING / UWAGA' : 'PROBLEM TERMICZNY',
      score: tested ? c.overallScore : 0,
      description:
        'Testuje wydajność jedno- i wielowątkową (ALU/FPU, macierze FP64 AVX, Ray-Tracing BVH, N-Body Gravity, sieć neuronowa GEMM, Monte Carlo Pi, GZIP i SHA-256/AES-GCM).',
      works,
      issues,
      bars: [
        { label: 'Single-Core', valueLabel: tested ? `${c.singleCoreScore} pkt` : '—', pct: clampPct((c.singleCoreScore / 1800) * 100), color: '#06b6d4' },
        { label: 'Multi-Core', valueLabel: tested ? `${c.multiCoreScore} pkt` : '—', pct: clampPct((c.multiCoreScore / 12000) * 100), color: '#10b981' },
        { label: 'Macierze AVX', valueLabel: c.avxMatrixGflops ? `${c.avxMatrixGflops} GFLOPS` : '—', pct: clampPct(((c.avxMatrixGflops || 0) / 80) * 100), color: '#8b5cf6' },
        { label: 'Stabilność', valueLabel: `${c.stabilityPct}%`, pct: clampPct(c.stabilityPct), color: c.stabilityPct >= 85 ? '#10b981' : '#f59e0b' },
      ],
      moduleNav: 'cpu',
    });
  }

  // 2. RAM
  {
    const r = ctx.ram;
    const tested = r.status === 'completed' || r.bandwidthReadMBs > 0;
    const works: string[] = [];
    const issues: string[] = [];
    const sysRamLabel = ctx.specs
      ? typeof ctx.specs.deviceMemory === 'number'
        ? `≥ ${ctx.specs.deviceMemory} GB (Limit prywatności API)`
        : ctx.specs.deviceMemory
      : '—';

    if (!tested) {
      works.push(`Alokator TypedArray / pamięć operacyjna zgłoszona przez API: ${sysRamLabel}.`);
      issues.push('Nie uruchomiono 10-etapowego skanowania integralności bitowej RAM (MemTest86+ / RowHammer).');
    } else {
      works.push(`Odczyt: ${r.bandwidthReadMBs.toLocaleString('pl-PL')} MB/s · Zapis: ${r.bandwidthWriteMBs.toLocaleString('pl-PL')} MB/s · DMA Copy: ${(r.copyBandwidthMBs || 0).toLocaleString('pl-PL')} MB/s.`);
      if (r.cacheL1L2MBs) works.push(`Cache L1/L2: ${r.cacheL1L2MBs.toLocaleString('pl-PL')} MB/s · Cache L3: ${(r.cacheL3MBs || 0).toLocaleString('pl-PL')} MB/s · Opóźnienie: ${r.latencyNs} ns.`);
      if (r.errorsFound === 0) {
        works.push('Wszystkie 10 testów bitowych DRAM (Checkerboard, PRNG, Walking Bits, March C-, RowHammer 200k, Modulo-20, Moving Inv, GALPAT) zaliczone z 0 błędów.');
      } else {
        issues.push(`KRYTYCZNE: Wykryto ${r.errorsFound} błędów integralności bitowej pamięci RAM! Sprawdź profile XMP/DOCP lub kości w BIOS.`);
      }
    }

    const status: ComponentHealthStatus = !tested ? 'untested' : r.errorsFound > 0 ? 'err' : r.overallScore < 55 ? 'warn' : 'ok';
    cards.push({
      id: 'ram',
      name: 'Pamięć RAM i Cache CPU (10 etapów)',
      subtitle: `${sysRamLabel} · Bufor testu ${r.allocatedMB} MB`,
      status,
      statusLabel: !tested ? 'DO PRZETESTOWANIA' : r.errorsFound > 0 ? 'BŁĘDY PAMIĘCI DRAM' : 'ZERO BŁĘDÓW (OK)',
      score: tested ? r.overallScore : 0,
      description:
        'Weryfikuje integralność komórek pamięci algorytmami znanymi z MemTest86+ (Checkerboard, March C-, RowHammer, Modulo-20, Moving Inversions, GALPAT) oraz mierzy transfer Cache L1-L3 i DRAM.',
      works,
      issues,
      bars: [
        { label: 'Odczyt DRAM', valueLabel: tested ? `${r.bandwidthReadMBs} MB/s` : '—', pct: clampPct((r.bandwidthReadMBs / 28000) * 100), color: '#06b6d4' },
        { label: 'Zapis DRAM', valueLabel: tested ? `${r.bandwidthWriteMBs} MB/s` : '—', pct: clampPct((r.bandwidthWriteMBs / 24000) * 100), color: '#10b981' },
        { label: 'Cache L1/L2', valueLabel: r.cacheL1L2MBs ? `${r.cacheL1L2MBs} MB/s` : '—', pct: clampPct(((r.cacheL1L2MBs || 0) / 60000) * 100), color: '#f59e0b' },
        { label: 'Sprawność bitowa', valueLabel: tested ? `${r.errorsFound} błędów` : '—', pct: tested ? (r.errorsFound === 0 ? 100 : 15) : 0, color: r.errorsFound === 0 ? '#10b981' : '#f43f5e' },
      ],
      moduleNav: 'ram',
    });
  }

  // 3. DISK
  {
    const d = ctx.disk;
    const tested = d.status === 'completed' || d.seqReadMBs > 0;
    const works: string[] = [];
    const issues: string[] = [];

    if (!tested) {
      issues.push('Nie zmierzono jeszcze prędkości dysku (Seq/4K/QD32/QD64) ani atrybutów SMART.');
    } else {
      works.push(`Backend zapisu plików: ${d.backend} · Odczyt Seq: ${d.seqReadMBs} MB/s · Zapis Seq: ${d.seqWriteMBs} MB/s.`);
      works.push(`Losowe 4K: ${d.rand4kIops.toLocaleString('pl-PL')} IOPS · QD32: ${(d.qd32Iops || 0).toLocaleString('pl-PL')} IOPS · QD64: ${(d.qd64Iops || 0).toLocaleString('pl-PL')} IOPS.`);
      if (d.crcVerified) works.push('Weryfikacja sum kontrolnych CRC32 po zapisie i odczycie bloku bez błędów.');
      else issues.push('BŁĄD SUMY KONTROLNEJ CRC32 podczas weryfikacji zapisanego pliku — ryzyko uszkodzenia danych!');

      if (d.backend !== 'OPFS (Native FS)') {
        issues.push('Użyto trybu IndexedDB zamiast OPFS (Native FS) — wyniki sekwencyjne mogą być ograniczone przez bazę przeglądarki.');
      }
      if (d.smartStatus !== 'ZDROWY') {
        issues.push(`Status SMART wymaga uwagi (${d.smartStatus}, kondycja ${d.smartHealthPct}%).`);
      }
    }

    const status: ComponentHealthStatus = !tested ? 'untested' : !d.crcVerified || d.smartStatus === 'KRYTYCZNY' ? 'err' : d.smartStatus === 'UWAGA' ? 'warn' : 'ok';
    cards.push({
      id: 'disk',
      name: 'Dysk SSD / HDD / NVMe & SMART',
      subtitle: `${d.backend} · SMART ${d.smartStatus}`,
      status,
      statusLabel: !tested ? 'DO PRZETESTOWANIA' : !d.crcVerified ? 'BŁĄD CRC32' : d.smartStatus === 'ZDROWY' ? 'DYSK ZDROWY' : d.smartStatus,
      score: tested ? d.overallScore : 0,
      description:
        'Mierzy transfery sekwencyjne (OPFS/IDB), kolejki wielowątkowe QD32/QD64 IOPS, obciążenie mieszane 70/30, spójność CRC32 oraz czas dostępu kontrolera nośnika.',
      works,
      issues,
      bars: [
        { label: 'Odczyt Seq', valueLabel: tested ? `${d.seqReadMBs} MB/s` : '—', pct: clampPct((d.seqReadMBs / 2500) * 100), color: '#06b6d4' },
        { label: 'Zapis Seq', valueLabel: tested ? `${d.seqWriteMBs} MB/s` : '—', pct: clampPct((d.seqWriteMBs / 2000) * 100), color: '#10b981' },
        { label: 'Kolejka QD64', valueLabel: d.qd64Iops ? `${d.qd64Iops} IOPS` : '—', pct: clampPct(((d.qd64Iops || 0) / 40000) * 100), color: '#a855f7' },
        { label: 'Kondycja SMART', valueLabel: `${d.smartHealthPct}%`, pct: clampPct(d.smartHealthPct), color: d.smartHealthPct >= 85 ? '#10b981' : '#f59e0b' },
      ],
      moduleNav: 'disk',
    });
  }

  // 4. GPU 3D WebGL
  {
    const g = ctx.gpu;
    const tested = g.totalFramesRendered > 0 || g.avgFps > 0 || ctx.gpuSuiteResults.length > 0;
    const works: string[] = [];
    const issues: string[] = [];
    const suiteCount = ctx.gpuSuiteResults.length;
    const liveGpuTemp = ctx.thermal.rows.flatMap((r) => r.zones).find((z) => z.id === 'gpu-core')?.tempC ?? null;

    if (g.isSoftwareGl) {
      issues.push(`Wykryto renderowanie programowe Software WebGL (${g.rendererName}) zamiast dedykowanej karty GPU! Włącz akcelerację sprzętową w przeglądarce.`);
    } else {
      works.push(`Aktywna sprzętowa akceleracja GPU 3D (${g.rendererName}).`);
    }

    if (!tested) {
      issues.push(`Nie uruchomiono jeszcze testu 3D WebGL (${GPU_SCENE_CATALOG.length} scen Auto-Suite).`);
    } else {
      works.push(`Zmierzono: Śr. ${g.avgFps} FPS (Max ${g.maxFps} FPS · 1% Low ${g.low1PctFps} FPS · stabilność ${g.stabilityPct}%).`);
      if (suiteCount > 0) {
        const avgSuiteScore = Math.round(ctx.gpuSuiteResults.reduce((s, r) => s + r.score, 0) / suiteCount);
        works.push(`Przebadano ${suiteCount}/${GPU_SCENE_CATALOG.length} scen 3D w Auto-Suite (średni indeks: ${avgSuiteScore}/100).`);
        if (suiteCount < GPU_SCENE_CATALOG.length) {
          issues.push(`Auto-Suite objął ${suiteCount} z ${GPU_SCENE_CATALOG.length} scen — uruchom pełny Auto-Suite lub „Pełny test”, aby zaliczyć 100% scen.`);
        }
      }
      if (g.stabilityPct < 75) {
        issues.push(`Niska spójność klatek (${g.stabilityPct}%) — możliwe przycięcia lub przełączanie trybów oszczędzania energii GPU.`);
      }
    }
    if (liveGpuTemp === null) {
      issues.push('Brak odczytu temperatury °C z czujnika GPU w przeglądarce (wymagany mostek LHM :8085 lub nvidia-smi).');
    } else {
      works.push(`Czujnik GPU LIVE działa: ${liveGpuTemp.toFixed(1)} °C.`);
    }

    const status: ComponentHealthStatus = g.isSoftwareGl
      ? 'err'
      : !tested
        ? 'untested'
        : g.verdict === 'THROTTLING / PRZECIĄŻENIE' || g.stabilityPct < 70
          ? 'warn'
          : 'ok';

    cards.push({
      id: 'gpu',
      name: `Karta Graficzna GPU 3D (${GPU_SCENE_CATALOG.length} scen)`,
      subtitle: `${esc(g.rendererName.slice(0, 42))}`,
      status,
      statusLabel: g.isSoftwareGl ? 'SOFTWARE GL (BRAK GPU)' : !tested ? 'DO PRZETESTOWANIA' : status === 'ok' ? 'AKCELERACJA OK' : 'NIESTABILNE FPS',
      score: tested ? g.overallScore : 0,
      description:
        'Renderuje 40 scen WebGL2 bez limitu FPS (Raymarching, FurMark, Mandelbulb, Galaktyka 350k, Tokamak, Navier-Stokes, Voxel GI, QCD), badając jednostki ALU, ROP i VRAM.',
      works,
      issues,
      bars: [
        { label: 'Śr. FPS', valueLabel: tested ? `${g.avgFps} FPS` : '—', pct: clampPct((g.avgFps / 240) * 100), color: '#06b6d4' },
        { label: '1% Low', valueLabel: tested ? `${g.low1PctFps} FPS` : '—', pct: clampPct((g.low1PctFps / 160) * 100), color: '#10b981' },
        { label: 'Spójność kl.', valueLabel: tested ? `${g.stabilityPct}%` : '—', pct: tested ? clampPct(g.stabilityPct) : 0, color: g.stabilityPct >= 80 ? '#10b981' : '#f59e0b' },
        { label: 'Pokrycie scen', valueLabel: `${suiteCount}/${GPU_SCENE_CATALOG.length}`, pct: clampPct((suiteCount / GPU_SCENE_CATALOG.length) * 100), color: '#f59e0b' },
      ],
      moduleNav: 'gpu',
    });
  }

  // 5. GAME 3D & RACING
  {
    const gm = ctx.game;
    const tested = gm.avgFps > 0 || gm.elapsedSec > 0;
    const works: string[] = [
      `Silnik gier 3D MAX: ${gm.bloomEnabled ? 'Bloom Post-FX WŁ.' : 'Bloom WYŁ.'}, ${gm.shadowsEnabled ? 'Cienie 4K PCFShadowMap WŁ.' : 'Cienie WYŁ.'}.`,
    ];
    const issues: string[] = [];

    if (!tested) {
      issues.push('Nie uruchomiono jeszcze benchmarku Gra 3D MAX ani Wyścigów 3D Nitro GP.');
    } else {
      works.push(`Aktywny silnik gry osiągnął śr. ${gm.avgFps} FPS (1% Low: ${gm.low1PctFps} FPS, czas klatki: ${gm.frameTimeMs} ms).`);
      if (gm.avgFps < 30) {
        issues.push(`Niska płynność rozgrywki (${gm.avgFps} FPS < 30 FPS) — obniż preset lub SSAA.`);
      }
    }

    const status: ComponentHealthStatus = !tested ? 'untested' : gm.avgFps < 30 ? 'warn' : 'ok';
    const gameScore = tested ? clampPct(Math.min(100, Math.round(gm.avgFps * 0.65 + gm.stabilityPct * 0.35))) : 0;

    cards.push({
      id: 'game',
      name: 'Silnik Gier 3D MAX & Wyścigi 3D Nitro',
      subtitle: `${gm.gameTitle || 'Gra 3D MAX'} · ${gm.resolutionLabel}`,
      status,
      statusLabel: !tested ? 'DO PRZETESTOWANIA' : gm.avgFps >= 60 ? 'PŁYNNOŚĆ IDEALNA' : gm.avgFps >= 30 ? 'GRYWALNE (OK)' : 'NISKIE FPS',
      score: gameScore,
      description:
        'Testuje realistyczne sceny gier 3D MAX z oświetleniem PBR, cieniami 4K, efektem Bloom oraz 4 interaktywne tory Wyścigów 3D z rywalami AI i kamerą pościgową.',
      works,
      issues,
      bars: [
        { label: 'FPS w grze', valueLabel: tested ? `${gm.avgFps} FPS` : '—', pct: clampPct((gm.avgFps / 144) * 100), color: '#06b6d4' },
        { label: '1% Low', valueLabel: tested ? `${gm.low1PctFps} FPS` : '—', pct: clampPct((gm.low1PctFps / 120) * 100), color: '#10b981' },
        { label: 'Stabilność', valueLabel: tested ? `${gm.stabilityPct}%` : '—', pct: tested ? clampPct(gm.stabilityPct) : 0, color: '#f59e0b' },
      ],
      moduleNav: 'game',
    });
  }

  // 6. DISPLAY & EDID
  {
    const panel = ctx.hardwareScan?.panel;
    const hz = panel?.refreshRateHz ?? ctx.specs?.estimatedRefreshRate ?? 60;
    const hasExactModel = Boolean(ctx.hardwareScan?.deepInventory?.monitors?.length) || (Boolean(panel?.label) && !/^Matryca\s/i.test(panel!.label));
    const works: string[] = [
      `Rozdzielczość aktywna: ${panel?.nativeResolution || ctx.specs?.screenResolution || '—'} @ ${hz} Hz (${panel?.colorGamut || 'sRGB'}).`,
      `Dostępne ${DISPLAY_PATTERNS.length} plansze testowe + Auto-Test 5s (martwe piksele RGB/CMY, OLED Burn-In, UFO Motion, PWM, VRR, Gamma 2.2).`,
    ];
    const issues: string[] = [];
    if (hasExactModel) {
      works.push(`Odczytano dokładny chip EDID monitora: ${panel!.label}.`);
    } else {
      issues.push('Brak odczytu chipu EDID monitora (w Windows użyj .EXE lub wklej wynik „pnputil” w zakładce Ekran).');
    }
    if (!panel?.hdrSupported) {
      issues.push('Wyświetlacz pracuje w trybie SDR (HDR10 nieaktywny w systemie lub nieobsługiwany przez matrycę).');
    } else {
      works.push('Tryb szerokiego zakresu dynamicznego HDR jest aktywny i wspierany.');
    }

    const dispScore = (hasExactModel ? 92 : 76) + (hz >= 120 ? 8 : 0);
    cards.push({
      id: 'display',
      name: `Ekran, Matryca & EDID (${DISPLAY_PATTERNS.length} testów)`,
      subtitle: `${panel?.label || 'Monitor główny'} · ${hz} Hz`,
      status: hasExactModel ? 'ok' : 'warn',
      statusLabel: hasExactModel ? 'MATRYCA ZWERYFIKOWANA' : 'BRAK EDID / SDR',
      score: Math.min(100, dispScore),
      description:
        `Identyfikuje model matrycy poprzez EDID/WMI, mierzy częstotliwość odświeżania VSync (Hz), głębię bitową, przestrzeń barw (sRGB/P3/HDR) oraz udostępnia ${DISPLAY_PATTERNS.length} plansz kalibracyjnych.`,
      works,
      issues,
      bars: [
        { label: 'Odświeżanie', valueLabel: `${hz} Hz`, pct: clampPct((hz / 240) * 100), color: '#06b6d4' },
        { label: 'Głębia kolorów', valueLabel: `${panel?.colorDepthBit ?? 24}-bit`, pct: clampPct(((panel?.colorDepthBit ?? 24) / 30) * 100), color: '#10b981' },
        { label: 'Identyfikacja EDID', valueLabel: hasExactModel ? 'Tak' : 'Ogólny', pct: hasExactModel ? 100 : 45, color: hasExactModel ? '#10b981' : '#f59e0b' },
      ],
      moduleNav: 'display',
    });
  }

  // 7. BATTERY & PSU
  {
    const b = ctx.battery;
    const p = b.psu;
    const psuCalc = psuCalculatorService.calculate(b.currentLoadPct, ctx.gpu.running ? 90 : 25);
    const works: string[] = [];
    const issues: string[] = [];

    if (b.apiSupported) {
      works.push(`Web Battery API działa: stan ${b.levelPct}%, zdrowie ogniw ${b.healthPct}% (zużycie ${b.wearLevelPct}%).`);
      if (b.healthPct < 65) issues.push(`Zużyte ogniwa baterii laptopa (${b.healthPct}% pojemności fabrycznej) — zalecana wymiana akumulatora.`);
    } else {
      issues.push('Brak fizycznej baterii lub przeglądarka zablokowała Battery Status API (tryb zasilania sieciowego Desktop ATX).');
    }

    if (p) {
      works.push(`Zasilacz ATX (${psuCalc.psuCapacityW}W · ${p.rating80Plus}): +12V=${p.rail12V.toFixed(2)}V, +5V=${p.rail5V.toFixed(2)}V, +3.3V=${p.rail3P3V.toFixed(2)}V.`);
      if ((b.railAlertEvents || []).length > 0) {
        issues.push(`Zarejestrowano ${b.railAlertEvents!.length} przekroczeń progu napięcia szyn ATX (sprawdź w dzienniku Alert Log).`);
      }
      if (psuCalc.loadPercentageOfPsu > 90) {
        issues.push(`Bardzo wysokie obciążenie PSU (${psuCalc.loadPercentageOfPsu}%) — bliski limit mocy zasilacza!`);
      }
    }

    const batScore = b.apiSupported
      ? Math.round(b.healthPct * 0.6 + (psuCalc.loadPercentageOfPsu < 85 ? 40 : 20))
      : psuCalc.loadPercentageOfPsu < 85 ? 88 : 65;

    const status: ComponentHealthStatus =
      (b.railAlertEvents || []).length > 3 || (b.apiSupported && b.healthPct < 50)
        ? 'err'
        : !b.apiSupported || psuCalc.loadPercentageOfPsu > 88
          ? 'warn'
          : 'ok';

    cards.push({
      id: 'battery',
      name: 'Zasilacz ATX PSU & Bateria Laptopa',
      subtitle: `${psuCalc.psuCapacityW}W · Obciążenie ${psuCalc.loadPercentageOfPsu}% · Sprawność ${psuCalc.efficiencyPct}%`,
      status,
      statusLabel: status === 'ok' ? 'ZASILANIE STABILNE' : status === 'warn' ? (b.apiSupported ? 'UWAGA ZASILANIA' : 'TRYB STACJONARNY AC') : 'ALERT NAPIĘĆ ATX',
      score: clampPct(batScore),
      description:
        'Monitoruje kondycję akumulatora (mWh, cykle ładowania, poziom degradacji) oraz stabilność linii zasilania ATX +12V / +5V / +3.3V i krzywą sprawności zasilacza.',
      works,
      issues,
      bars: [
        { label: 'Sprawność PSU', valueLabel: `${psuCalc.efficiencyPct}%`, pct: clampPct(psuCalc.efficiencyPct), color: '#10b981' },
        { label: 'Obciążenie PSU', valueLabel: `${psuCalc.loadPercentageOfPsu}%`, pct: clampPct(psuCalc.loadPercentageOfPsu), color: psuCalc.loadPercentageOfPsu > 85 ? '#f43f5e' : '#06b6d4' },
        { label: 'Kondycja baterii', valueLabel: b.apiSupported ? `${b.healthPct}%` : 'Brak / AC', pct: b.apiSupported ? clampPct(b.healthPct) : 50, color: b.apiSupported ? '#10b981' : '#94a3b8' },
      ],
      moduleNav: 'battery',
    });
  }

  // 8. NETWORK (100% REAL)
  {
    const n = ctx.network;
    const tested = n.status === 'completed' || n.samples.length > 0;
    const probes = n.serverScanResults || [];
    const onlineCount = probes.filter((p) => p.status === 'ONLINE').length;
    const timeoutCount = probes.filter((p) => p.status === 'TIMEOUT').length;
    const works: string[] = [];
    const issues: string[] = [];

    if (!n.online) {
      issues.push('Brak połączenia z internetem (navigator.onLine = false)!');
    } else {
      works.push('Interfejs sieciowy aktywny (Online).');
    }
    const primaryNic = (n.adapters || []).find((a) => a.status === 'Up' && a.linkSpeedMbps > 0);
    if (primaryNic) {
      works.push(`Wykryta karta ${primaryNic.type}: „${primaryNic.name}” — link PHY ${primaryNic.linkSpeedMbps} Mbps (${primaryNic.maxStandardLabel}, maks. realny TCP ~${primaryNic.theoreticalMaxTcpMbps} Mbps).`);
    }

    if (!tested) {
      issues.push('Nie wykonano jeszcze rzeczywistego pomiaru Speed Test & Ping — otwórz Sieć lub kliknij „Pełny test”.');
    } else {
      if (n.downloadEstMbps > 0) works.push(`Zmierzony REAL Download: ${n.downloadEstMbps >= 1000 ? `${(n.downloadEstMbps / 1000).toFixed(2)} Gbps` : `${n.downloadEstMbps} Mbps`} (Szczyt: ${n.peakDownloadMbps || n.downloadEstMbps} Mbps).`);
      else issues.push('Pobieranie Download zwróciło 0 Mbps — blokada zapory/CORS lub brak połączenia z punktem Cloudflare Edge.');

      if ((n.uploadEstMbps || 0) > 0) works.push(`Zmierzony REAL Upload: ${(n.uploadEstMbps || 0) >= 1000 ? `${((n.uploadEstMbps || 0) / 1000).toFixed(2)} Gbps` : `${n.uploadEstMbps} Mbps`}.`);
      else issues.push('Wysyłanie Upload zwróciło 0 Mbps — sprawdź połączenie wychodzące HTTPS POST.');

      works.push(`Ping HTTP: śr. ${n.pingAvgMs} ms · Jitter: ${n.jitterMs} ms · Przesłano realnie: ${(n.transferredMB || 0).toFixed(1)} MB.`);
      if (n.packetLossPct > 0) issues.push(`Wykryto utratę pakietów HTTP: ${n.packetLossPct}% (niestabilne połączenie / Wi-Fi).`);
      if (onlineCount > 0 || timeoutCount > 0) {
        works.push(`Skaner serwerów: ${onlineCount}/${probes.length} węzłów odpowiedziało na ping HTTP.`);
        if (timeoutCount > 0) issues.push(`${timeoutCount} serwerów nie odpowiedziało w limicie 2.2s (TIMEOUT lub blokada CORS/ICMP po stronie hosta).`);
      }
    }

    const netScore = !n.online
      ? 0
      : !tested
        ? 0
        : clampPct(
            (n.downloadEstMbps > 0 ? 55 : 10) +
              ((n.uploadEstMbps || 0) > 0 ? 20 : 0) +
              (n.packetLossPct === 0 ? 15 : 0) +
              (n.pingAvgMs > 0 && n.pingAvgMs < 80 ? 10 : 4)
          );

    const status: ComponentHealthStatus = !n.online
      ? 'err'
      : !tested
        ? 'untested'
        : n.packetLossPct > 3 || n.downloadEstMbps === 0
          ? 'err'
          : (n.uploadEstMbps || 0) === 0 || n.jitterMs > 20
            ? 'warn'
            : 'ok';

    cards.push({
      id: 'network',
      name: 'Sieć, Speed Test & 32 Węzły Ping',
      subtitle: tested ? `${n.downloadEstMbps} / ${n.uploadEstMbps || 0} Mbps · Ping ${n.pingAvgMs} ms` : 'Cloudflare Edge + 32 serwery PL/Świat',
      status,
      statusLabel: !n.online ? 'OFFLINE' : !tested ? 'DO PRZETESTOWANIA' : status === 'ok' ? 'ŁĄCZE SPRAWNE' : 'SPADEK / BŁĄD SIECI',
      score: netScore,
      description:
        'W 100% prawdziwy test wielostrumieniowy (Cloudflare HTTPS ReadableStream Download + POST Upload) bez sztucznych limitów ani zgadywania oraz skan opóźnień 32 serwerów.',
      works,
      issues,
      bars: [
        { label: 'Download', valueLabel: n.downloadEstMbps > 0 ? `${n.downloadEstMbps} Mbps` : '—', pct: clampPct((n.downloadEstMbps / 3500) * 100), color: '#06b6d4' },
        { label: 'Upload', valueLabel: (n.uploadEstMbps || 0) > 0 ? `${n.uploadEstMbps} Mbps` : '—', pct: clampPct(((n.uploadEstMbps || 0) / 1500) * 100), color: '#10b981' },
        { label: 'Niski Ping', valueLabel: n.pingAvgMs > 0 ? `${n.pingAvgMs} ms` : '—', pct: n.pingAvgMs > 0 ? clampPct(Math.max(10, 100 - n.pingAvgMs)) : 0, color: '#f59e0b' },
        { label: 'Brak strat', valueLabel: `${(100 - n.packetLossPct).toFixed(1)}%`, pct: tested ? clampPct(100 - n.packetLossPct * 10) : 0, color: n.packetLossPct === 0 ? '#10b981' : '#f43f5e' },
      ],
      moduleNav: 'network',
    });
  }

  // 9. THERMAL & FANS
  {
    const th = ctx.thermal;
    const f = ctx.fan;
    const hasHardwareSensors = th.sensorMode === 'hardware-live' || th.sensorMode === 'hardware-imported';
    const fanTested = f.history.length > 5 || f.progressPct >= 100;
    const works: string[] = [];
    const issues: string[] = [];

    if (hasHardwareSensors) {
      works.push(`Telemetria sprzętowa °C aktywna (${th.sensorMode}): średnio ${th.avgSystemTempC ?? '—'} °C · najcieplejsza strefa: ${th.hottestZoneLabel}.`);
    } else {
      issues.push('Brak podłączonego mostka czujników °C (LibreHardwareMonitor :8085 / HWiNFO64 CSV) — wyświetlane jest rzeczywiste obciążenie stref %.');
    }

    if (fanTested) {
      works.push(`Test chłodzenia i krzywej obrotów wykonany: szczyt ${f.peakRpm} RPM · ocena: ${f.verdict}.`);
    } else {
      issues.push('Nie uruchomiono jeszcze 24-sekundowego testu rampy chłodzenia i wentylatorów.');
    }

    const thScore = (hasHardwareSensors ? 65 : 35) + (fanTested ? 35 : 15);
    const status: ComponentHealthStatus =
      th.thermalStatus === 'WYSOKA TEMPERATURA' || f.verdict === 'SŁABE SCHŁADZANIE'
        ? 'err'
        : hasHardwareSensors && fanTested
          ? 'ok'
          : 'warn';

    cards.push({
      id: 'thermal',
      name: 'Termika (16 Stref) & Układ Chłodzenia',
      subtitle: hasHardwareSensors ? `Czujniki LIVE · ${th.thermalStatus}` : 'Tryb obciążenia (Brak mostka °C)',
      status,
      statusLabel: status === 'ok' ? 'CHŁODZENIE & °C OK' : status === 'warn' ? 'BRAK CZUJNIKA °C / TESTU' : 'WYSOKA TEMPERATURA',
      score: clampPct(thScore),
      description:
        'Monitoruje 16 stref cieplnych (CPU P-Core, VRM, GPU Hotspot, VRAM, NVMe, RAM, ATX PSU) oraz weryfikuje zdolność schładzania wentylatorów przy skokowym obciążeniu.',
      works,
      issues,
      bars: [
        { label: 'Czujniki °C', valueLabel: hasHardwareSensors ? 'Podłączone' : 'Brak LHM', pct: hasHardwareSensors ? 100 : 25, color: hasHardwareSensors ? '#10b981' : '#f59e0b' },
        { label: 'Test wentyl.', valueLabel: fanTested ? `${f.peakRpm} RPM` : 'Nie wykonano', pct: fanTested ? 100 : 15, color: '#06b6d4' },
        { label: 'Stan term.', valueLabel: th.thermalStatus, pct: th.thermalStatus === 'OPTYMALNA' ? 100 : th.thermalStatus === 'PODWYŻSZONA' ? 70 : 30, color: th.thermalStatus === 'WYSOKA TEMPERATURA' ? '#f43f5e' : '#10b981' },
      ],
      moduleNav: 'peripherals',
    });
  }

  // 10. PERIPHERALS, AUDIO & HID
  {
    const hasAudio = typeof window.AudioContext !== 'undefined';
    const hasMedia = Boolean(navigator.mediaDevices?.getUserMedia);
    const hasGamepadApi = typeof navigator.getGamepads === 'function';
    const pads = hasGamepadApi ? Array.from(navigator.getGamepads()).filter(Boolean).length : 0;
    const hasHid = 'hid' in navigator;
    const hasUsb = 'usb' in navigator;
    const works: string[] = [];
    const issues: string[] = [];

    if (hasAudio) works.push('Wyjście Audio Stereo DSP (Web Audio 20Hz–16kHz Sweep & Balans L/R) gotowe.');
    else issues.push('Web Audio API niedostępne w tym środowisku.');

    if (hasMedia) works.push('Obsługa kamery i mikrofonu (getUserMedia + spektrum FFT) dostępna.');
    else issues.push('Brak dostępu do API kamery/mikrofonu (wymagany kontekst HTTPS lub localhost).');

    if (hasGamepadApi) works.push(`API Kontrolerów / Padów gotowe (aktualnie podłączone: ${pads}).`);
    if (hasHid || hasUsb) works.push(`Magistrala WebHID / WebUSB dostępna (${hasHid ? 'HID OK' : ''}${hasHid && hasUsb ? ', ' : ''}${hasUsb ? 'USB OK' : ''}).`);
    else issues.push('Brak obsługi WebHID/WebUSB w tej przeglądarce (użyj Edge/Chrome lub Windows .EXE).');

    if (!ctx.peripheralsTestedAudio) {
      works.push('Klawiatura (NKRO), mysz (Hz/DPI) oraz test wielodotykowy gotowe do interaktywnej weryfikacji.');
    } else {
      works.push('Zweryfikowano kanał Audio Stereo Sweep podczas pełnego testu.');
    }

    const periphScore = (hasAudio ? 35 : 0) + (hasMedia ? 30 : 0) + (hasGamepadApi ? 15 : 0) + (hasHid || hasUsb ? 20 : 0);
    const status: ComponentHealthStatus = periphScore >= 85 ? 'ok' : periphScore >= 50 ? 'warn' : 'err';

    cards.push({
      id: 'peripherals',
      name: 'Peryferia, Audio Stereo & Porty USB/HID',
      subtitle: `Audio: ${hasAudio ? 'OK' : 'Brak'} · Pady: ${pads} · HID/USB: ${hasHid || hasUsb ? 'OK' : 'Ograniczone'}`,
      status,
      statusLabel: status === 'ok' ? 'INTERFEJSY GOTOWE' : 'OGRANICZONE API',
      score: periphScore,
      description:
        'Sprawdza klawiaturę (Anti-Ghosting), częstotliwość raportowania myszy (Polling Rate Hz), gładzik, kontrolery (gałki/wibracje), mikrofon z echem, głośniki L/R oraz urządzenia USB/HID.',
      works,
      issues,
      bars: [
        { label: 'Audio DSP', valueLabel: hasAudio ? '20Hz–16kHz' : 'Brak', pct: hasAudio ? 100 : 0, color: '#10b981' },
        { label: 'Kamera / Mic', valueLabel: hasMedia ? 'Dostępne' : 'Brak', pct: hasMedia ? 100 : 0, color: '#06b6d4' },
        { label: 'USB / HID / Pad', valueLabel: `${hasHid || hasUsb ? 'HID/USB' : 'Podst.'}`, pct: hasHid || hasUsb ? 100 : 40, color: '#8b5cf6' },
      ],
      moduleNav: 'peripherals',
    });
  }

  return cards;
}

export function renderComponentDiagnosticsReportHtml(
  ctx: ComponentReportContext,
  filter: 'all' | ComponentHealthStatus = 'all'
): string {
  const cards = evaluateAllComponents(ctx);
  const okCount = cards.filter((c) => c.status === 'ok').length;
  const warnCount = cards.filter((c) => c.status === 'warn').length;
  const errCount = cards.filter((c) => c.status === 'err').length;
  const untestedCount = cards.filter((c) => c.status === 'untested').length;
  const avgScore = Math.round(cards.reduce((s, c) => s + c.score, 0) / Math.max(1, cards.length));

  const visibleCards = filter === 'all' ? cards : cards.filter((c) => c.status === filter);

  // Master Horizontal Bar Chart comparing all 10 components (0–100 pts)
  const chartW = 760;
  const rowH = 26;
  const chartH = cards.length * rowH + 20;
  const barChartSvg = `
    <svg viewBox="0 0 ${chartW} ${chartH}" style="width:100%;height:auto;display:block;overflow:visible;" role="img" aria-label="Wykres oceny wszystkich podzespołów komputera">
      ${cards
        .map((c, idx) => {
          const y = 8 + idx * rowH;
          const labelW = 240;
          const maxBarW = chartW - labelW - 110;
          const barW = Math.max(4, Math.round((c.score / 100) * maxBarW));
          const col =
            c.status === 'ok'
              ? '#10b981'
              : c.status === 'warn'
                ? '#f59e0b'
                : c.status === 'err'
                  ? '#f43f5e'
                  : '#475569';
          return `
            <g>
              <text x="0" y="${y + 16}" fill="var(--text-secondary)" font-size="11.5" font-weight="600">${esc(c.name.split('(')[0].trim())}</text>
              <rect x="${labelW}" y="${y + 4}" width="${maxBarW}" height="14" rx="4" fill="rgba(255,255,255,0.06)" />
              <rect x="${labelW}" y="${y + 4}" width="${barW}" height="14" rx="4" fill="${col}" />
              <text x="${labelW + maxBarW + 10}" y="${y + 15}" fill="${col}" font-size="11.5" font-family="var(--font-mono)" font-weight="700">${c.score}/100 (${c.status === 'ok' ? 'OK' : c.status === 'warn' ? 'UWAGA' : c.status === 'err' ? 'BŁĄD' : 'BRAK'})</text>
            </g>
          `;
        })
        .join('')}
    </svg>
  `;

  return `
    <div id="dash-component-report-root" class="panel stack-md" style="border:1.5px solid rgba(6, 182, 212, 0.28);">
      <div class="panel-header" style="margin-bottom:0;flex-wrap:wrap;gap:10px;">
        <div>
          <h2 class="panel-title">Szczegółowy Raport Każdej Części Komputera (Co działa · Co nie działa · Wykresy)</h2>
          <span class="panel-caption">Automatyczna analiza 10 podzespołów i interfejsów po wykonanych testach oraz wykrytym sprzęcie</span>
        </div>
        <div class="row-wrap" style="gap:6px;">
          <span class="font-mono" style="font-size:12px;padding:4px 10px;border-radius:6px;background:rgba(16,185,129,0.14);color:#10b981;font-weight:700;">✅ Działa: ${okCount}</span>
          <span class="font-mono" style="font-size:12px;padding:4px 10px;border-radius:6px;background:rgba(245,158,11,0.14);color:#f59e0b;font-weight:700;">⚠️ Uwagi: ${warnCount}</span>
          <span class="font-mono" style="font-size:12px;padding:4px 10px;border-radius:6px;background:rgba(244,63,94,0.14);color:#f43f5e;font-weight:700;">✖ Problemy: ${errCount}</span>
          <span class="font-mono" style="font-size:12px;padding:4px 10px;border-radius:6px;background:rgba(148,163,184,0.14);color:#94a3b8;font-weight:700;">⏳ Do testu: ${untestedCount}</span>
        </div>
      </div>

      <div class="panel" style="background:var(--bg-inset);padding:14px;">
        <div class="row-between" style="flex-wrap:wrap;gap:8px;margin-bottom:10px;">
          <strong style="font-size:13px;">Wykres zbiorczy kondycji i wydajności wszystkich 10 podzespołów (Śr. indeks: <span class="font-mono status-cyan">${avgScore}/100</span>)</strong>
          <div class="row-wrap" style="gap:6px;">
            <button type="button" class="btn ${filter === 'all' ? 'btn-primary' : 'btn-secondary'} btn-sm" data-comp-filter="all">Wszystkie (${cards.length})</button>
            <button type="button" class="btn ${filter === 'ok' ? 'btn-primary' : 'btn-secondary'} btn-sm" data-comp-filter="ok">Działa (${okCount})</button>
            <button type="button" class="btn ${filter === 'warn' ? 'btn-primary' : 'btn-secondary'} btn-sm" data-comp-filter="warn">Uwagi (${warnCount})</button>
            <button type="button" class="btn ${filter === 'err' ? 'btn-primary' : 'btn-secondary'} btn-sm" data-comp-filter="err">Problemy (${errCount})</button>
            <button type="button" class="btn ${filter === 'untested' ? 'btn-primary' : 'btn-secondary'} btn-sm" data-comp-filter="untested">Nieprzetestowane (${untestedCount})</button>
          </div>
        </div>
        ${barChartSvg}
      </div>

      <div class="grid-2" style="gap:12px;">
        ${visibleCards
          .map((c) => {
            const borderColor =
              c.status === 'ok'
                ? 'rgba(16,185,129,0.35)'
                : c.status === 'warn'
                  ? 'rgba(245,158,11,0.45)'
                  : c.status === 'err'
                    ? 'rgba(244,63,94,0.55)'
                    : 'rgba(148,163,184,0.22)';
            const statusBadgeColor =
              c.status === 'ok'
                ? '#10b981'
                : c.status === 'warn'
                  ? '#f59e0b'
                  : c.status === 'err'
                    ? '#f43f5e'
                    : '#94a3b8';

            return `
              <div class="panel stack-sm" style="background:var(--bg-inset);padding:14px;border:1.5px solid ${borderColor};justify-content:space-between;">
                <div class="stack-sm">
                  <div class="row-between" style="align-items:flex-start;gap:8px;">
                    <div>
                      <h3 style="margin:0;font-size:14px;font-weight:700;color:var(--text-primary);">${esc(c.name)}</h3>
                      <div class="font-mono" style="font-size:11px;color:var(--text-muted);margin-top:2px;">${esc(c.subtitle)}</div>
                    </div>
                    <div style="text-align:right;flex-shrink:0;">
                      <span class="font-mono" style="font-size:11px;font-weight:700;color:${statusBadgeColor};padding:3px 8px;border-radius:6px;background:rgba(255,255,255,0.05);border:1px solid ${borderColor};">${esc(c.statusLabel)}</span>
                      <div class="font-mono" style="font-size:11px;color:var(--text-secondary);margin-top:3px;">Indeks: <strong>${c.score}/100</strong></div>
                    </div>
                  </div>

                  <p style="margin:0;font-size:12px;color:var(--text-secondary);line-height:1.4;">${esc(c.description)}</p>

                  <!-- Mini telemetry bars for this part -->
                  <div class="stack-xs" style="padding:8px 10px;border-radius:8px;background:rgba(0,0,0,0.22);gap:6px;">
                    ${c.bars
                      .map(
                        (b) => `
                      <div style="display:grid;grid-template-columns:96px 1fr 78px;align-items:center;gap:8px;font-size:11px;">
                        <span style="color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(b.label)}</span>
                        <div style="height:7px;background:rgba(255,255,255,0.08);border-radius:4px;overflow:hidden;">
                          <div style="width:${b.pct}%;height:100%;background:${b.color};border-radius:4px;transition:width 0.3s ease;"></div>
                        </div>
                        <span class="font-mono" style="text-align:right;color:var(--text-primary);font-weight:600;">${esc(b.valueLabel)}</span>
                      </div>`
                      )
                      .join('')}
                  </div>

                  ${
                    c.works.length > 0
                      ? `<div style="font-size:11.5px;line-height:1.45;">
                          <strong style="color:#10b981;">✅ Co działa prawidłowo:</strong>
                          <ul style="margin:3px 0 0;padding-left:18px;color:var(--text-primary);">
                            ${c.works.map((w) => `<li>${esc(w)}</li>`).join('')}
                          </ul>
                        </div>`
                      : ''
                  }

                  ${
                    c.issues.length > 0
                      ? `<div style="font-size:11.5px;line-height:1.45;">
                          <strong style="color:${c.status === 'err' ? '#f43f5e' : '#f59e0b'};">⚠️ Co nie działa / wymaga uwagi:</strong>
                          <ul style="margin:3px 0 0;padding-left:18px;color:var(--text-secondary);">
                            ${c.issues.map((iss) => `<li>${esc(iss)}</li>`).join('')}
                          </ul>
                        </div>`
                      : `<div style="font-size:11.5px;color:#10b981;">✔ Nie wykryto żadnych usterek ani braków dla tego elementu.</div>`
                  }
                </div>

                <div class="row-between" style="padding-top:6px;border-top:1px solid rgba(255,255,255,0.06);">
                  <span style="font-size:11px;color:var(--text-muted);">Przejdź do szczegółowych wykresów modułu</span>
                  <button type="button" class="btn btn-secondary btn-sm" data-open-mod="${c.moduleNav}">Otwórz moduł</button>
                </div>
              </div>
            `;
          })
          .join('')}
      </div>

      ${renderPcSuitabilityAndGamesReport(ctx)}
    </div>
  `;
}
