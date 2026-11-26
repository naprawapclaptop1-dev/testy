import {
  ScheduledTestItem,
  ScheduledTestType,
  SchedulerSummaryReport,
} from '../types';
import { getBenchmarkResolutionSpec } from '../utils/benchmarkResolution';
import { iconSvg } from './icons';

export interface SchedulerTestCatalogEntry {
  type: ScheduledTestType;
  label: string;
  shortDesc: string;
  defaultDurationSec?: number;
  defaultRamSizeMB?: number;
}

export const SCHEDULER_CATALOG: SchedulerTestCatalogEntry[] = [
  {
    type: 'cpu_bench',
    label: '1. Procesor CPU — Pełny Benchmark (10 podtestów)',
    shortDesc: 'Single/Multi-Core, AVX/SIMD, Fizyka N-Body, Monte Carlo, FFT, Raytracing, GZIP, SHA-256',
  },
  {
    type: 'cpu_stress',
    label: '2. Procesor CPU — Stres-test termiczny 100%',
    shortDesc: 'Ciągłe 100% obciążenie wszystkich wątków pod kątem throttlingu i stabilności VRM',
    defaultDurationSec: 8,
  },
  {
    type: 'ram',
    label: '3. Pamięć RAM — 10-etapowy MemTest86+ i Przepustowość',
    shortDesc: 'MATS+, March C-, Modulo-20, Hammering, Xorshift32, Walking 1s/0s oraz GB/s + ns',
    defaultRamSizeMB: 128,
  },
  {
    type: 'disk',
    label: '4. Dysk NVMe / SSD / HDD — 8 podtestów I/O + SMART',
    shortDesc: 'Seq Read/Write, 4K QD1, 4K QD32, Mixed 70/30, IOPS, P99 ms i weryfikacja CRC32',
  },
  {
    type: 'gpu_stress',
    label: '5. Karta GPU 3D — Stres-test WebGL (Bez limitu FPS)',
    shortDesc: 'Scena PBR Three.js z barierą gl.finish(), FPS, 1% Low, czas klatki i temperatura',
    defaultDurationSec: 6,
  },
  {
    type: 'gpu_all_scenes',
    label: '6. Karta GPU 3D — Maraton 40 Scen 3D WebGL',
    shortDesc: 'Automatyczny przelot przez sceny FurMark, Raymarch, Czarna Dziura, CERN, Tokamak i in.',
    defaultDurationSec: 10,
  },
  {
    type: 'game_ultra',
    label: '7. Gra 3D MAX — Benchmark HYPERION Ultra (28 światów)',
    shortDesc: 'Cienie 4K, Bloom Post-FX, 24k obiektów, shader plazmy oraz 1% / 0.1% Low FPS',
    defaultDurationSec: 7,
  },
  {
    type: 'game_racing',
    label: '8. Gra 3D Wyścigi — Benchmark Toru Wyścigowego 3D (Nitro GP)',
    shortDesc: 'Symulacja wyścigowa 3D (Formula Cyber GP / Tokyo Drift / MagLev) z telemetrią km/h i FPS',
    defaultDurationSec: 8,
  },
  {
    type: 'display_cal',
    label: '9. Ekran i Matryca — Automatyczny Test Odświeżania Hz i Kolorów',
    shortDesc: 'Pomiar precyzyjny Hz, stabilności VSync, czasu klatki matrycy oraz przebieg 32 plansz',
    defaultDurationSec: 5,
  },
  {
    type: 'psu_stress',
    label: '10. Zasilacz PC & Bateria — Test Stabilności Linii 12V/5V/3.3V',
    shortDesc: 'Symulacja skoków obciążenia Cross-Load (CPU+GPU Peak), tętnień Ripple mV i sprawności %',
    defaultDurationSec: 6,
  },
  {
    type: 'audio_sweep',
    label: '11. Audio DSP & Peryferia — Sweep 20Hz–20kHz + Stereo L/R',
    shortDesc: 'Synteza WebAudio kanałów L/R, pomiar opóźnienia wyjścia audio i skan szyn USB/HID',
    defaultDurationSec: 4,
  },
  {
    type: 'network',
    label: '12. Sieć 10 Gbps — Speed Test Polska/Świat, Ping, Jitter i VoIP MOS',
    shortDesc: 'Wielostrumieniowy Download/Upload bez limitu (10G), skan węzłów PLIX/Świat i Bufferbloat',
  },
];

let uidCounter = 1;
export function createScheduledItem(type: ScheduledTestType): ScheduledTestItem {
  const def = SCHEDULER_CATALOG.find((c) => c.type === type) || SCHEDULER_CATALOG[0];
  const id = `sched-${Date.now().toString(36)}-${uidCounter++}`;
  if (type === 'cpu_stress') {
    return { id, type, label: def.label, durationSec: 8 };
  }
  if (type === 'ram') {
    return { id, type, label: def.label, ramSizeMB: 128 };
  }
  if (type === 'gpu_stress' || type === 'gpu_all_scenes') {
    return {
      id,
      type,
      label: def.label,
      durationSec: type === 'gpu_all_scenes' ? 10 : 6,
      gpuPreset: 'high',
      gpuFpsMode: 'uncapped',
      gpuSceneId: type === 'gpu_stress' ? 'vortex' : undefined,
      resolution: '1080p',
    };
  }
  if (type === 'game_ultra' || type === 'game_racing') {
    return {
      id,
      type,
      label: def.label,
      durationSec: type === 'game_racing' ? 8 : 7,
      gpuFpsMode: 'uncapped',
      resolution: '1080p',
    };
  }
  if (type === 'display_cal' || type === 'psu_stress' || type === 'audio_sweep') {
    return { id, type, label: def.label, durationSec: def.defaultDurationSec || 5 };
  }
  return { id, type, label: def.label };
}

export function getDefaultSchedulerQueue(): ScheduledTestItem[] {
  return [
    createScheduledItem('cpu_bench'),
    createScheduledItem('ram'),
    createScheduledItem('disk'),
    createScheduledItem('gpu_stress'),
    createScheduledItem('game_racing'),
    createScheduledItem('network'),
  ];
}

export function getSchedulerPresetQueue(presetId: string): ScheduledTestItem[] {
  switch (presetId) {
    case 'cpu_gpu':
      return [
        createScheduledItem('cpu_bench'),
        createScheduledItem('gpu_stress'),
        createScheduledItem('game_racing'),
      ];
    case 'thermal_burn':
      return [
        { ...createScheduledItem('cpu_stress'), durationSec: 10 },
        { ...createScheduledItem('gpu_stress'), durationSec: 10, gpuPreset: 'extreme' },
        { ...createScheduledItem('game_ultra'), durationSec: 10 },
        { ...createScheduledItem('game_racing'), durationSec: 10 },
        { ...createScheduledItem('psu_stress'), durationSec: 8 },
      ];
    case 'mem_disk':
      return [
        { ...createScheduledItem('ram'), ramSizeMB: 256 },
        createScheduledItem('disk'),
      ];
    case 'all_12_mega':
    case 'full_az':
    default:
      return SCHEDULER_CATALOG.map((entry) => createScheduledItem(entry.type));
  }
}

export function describeItemConfig(item: ScheduledTestItem): string {
  if (item.type === 'cpu_stress') return `Czas: ${item.durationSec || 8}s · 100% wątków (Burn-in)`;
  if (item.type === 'ram') return `Bufor: ${item.ramSizeMB || 128} MB · 10 etapów MemTest86+`;
  if (item.type === 'gpu_stress') {
    const res = getBenchmarkResolutionSpec(item.resolution || '1080p').shortLabel;
    const scenePart = item.gpuSceneId ? `Scena: ${item.gpuSceneId} · ` : '';
    return `${scenePart}Czas: ${item.durationSec || 6}s · ${res} · Preset: ${item.gpuPreset || 'high'} · ${item.gpuFpsMode === 'vsync' ? 'VSync' : 'Bez limitu FPS'}`;
  }
  if (item.type === 'gpu_all_scenes') {
    const res = getBenchmarkResolutionSpec(item.resolution || '1080p').shortLabel;
    return `Czas: ${item.durationSec || 10}s · ${res} · Przelot przez sceny 3D WebGL · Bez limitu FPS`;
  }
  if (item.type === 'game_ultra') {
    const res = getBenchmarkResolutionSpec(item.resolution || '1080p').shortLabel;
    return `Czas: ${item.durationSec || 7}s · ${res} · HYPERION Ultra MAX`;
  }
  if (item.type === 'game_racing') {
    const res = getBenchmarkResolutionSpec(item.resolution || '1080p').shortLabel;
    return `Czas: ${item.durationSec || 8}s · ${res} · Wyścig 3D Formula Cyber GP + Nitro`;
  }
  if (item.type === 'display_cal') return `Czas: ${item.durationSec || 5}s · Pomiar Hz, VSync Jitter i 32 plansz`;
  if (item.type === 'psu_stress') return `Czas: ${item.durationSec || 6}s · Stabilność 12V/5V/3.3V + Ripple mV`;
  if (item.type === 'audio_sweep') return `Czas: ${item.durationSec || 4}s · Sweep DSP 20Hz-20kHz + L/R`;
  if (item.type === 'disk') return '8 testów: Seq R/W, 4K QD1/QD32, Mixed 70/30 + SMART CRC32';
  if (item.type === 'network') return 'Speed Test 10 Gbps + Skan serwerów Polska/Świat + VoIP MOS';
  return '10 testów: Single/Multi-Core, AVX, N-Body, FFT, Raytracing, GZIP, SHA-256';
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function renderSchedulerSummaryReportHtml(report: SchedulerSummaryReport | null): string {
  if (!report) {
    return `
      <div class="panel stack-sm">
        <div class="panel-header" style="margin-bottom:0;">
          <h2 class="panel-title">Jednolity raport zbiorczy harmonogramu</h2>
          <span class="panel-caption">Oczekiwanie na uruchomienie kolejki</span>
        </div>
        <p style="margin:0;font-size:13px;color:var(--text-muted);">
          Dodaj dowolne testy do kolejki (np. CPU → GPU 3D → Gra Ultra MAX) i kliknij <strong>„Uruchom kolejkę”</strong>. Po zakończeniu sekwencji wygenerujemy tutaj zbiorczy raport z oceną końcową, temperaturami szczytowymi oraz eksportem PDF i JSON.
        </p>
      </div>
    `;
  }

  const gradeCls =
    report.overallScore >= 80
      ? 'status-ok'
      : report.overallScore >= 58
        ? 'status-cyan'
        : 'status-warn';

  return `
    <div class="panel stack-md">
      <div class="panel-header" style="margin-bottom:0;flex-wrap:wrap;">
        <div>
          <h2 class="panel-title">Jednolity raport zbiorczy harmonogramu ${report.aborted ? '(Przerwany)' : '(Zakończony)'}</h2>
          <span class="panel-caption">
            Zakończono: ${new Date(report.finishedAt).toLocaleString('pl-PL')} · Łączny czas: ${report.totalDurationSec.toFixed(1)} s
          </span>
        </div>
        <div class="row-wrap">
          <button id="sched-export-pdf-btn" type="button" class="btn btn-secondary btn-sm">
            ${iconSvg('pdf', 14)}
            <span>Pobierz raport PDF</span>
          </button>
          <button id="sched-export-json-btn" type="button" class="btn btn-secondary btn-sm">
            ${iconSvg('download', 14)}
            <span>Eksport JSON</span>
          </button>
        </div>
      </div>

      <div class="grid-4">
        <div class="metric-card">
          <span class="metric-label">Ocena końcowa kolejki</span>
          <div class="metric-row">
            <span class="metric-value ${gradeCls}">${report.grade}</span>
            <span class="metric-unit">${report.overallScore} / 100</span>
          </div>
          <span class="metric-foot">Średni wynik z ${report.steps.length} testów</span>
        </div>

        <div class="metric-card">
          <span class="metric-label">Status wykonanych kroków</span>
          <div class="metric-row">
            <span class="metric-value status-ok">${report.passedCount}</span>
            <span class="metric-unit">OK · ${report.warningCount} UWAGA · ${report.failedCount} BŁĄD</span>
          </div>
          <span class="metric-foot">${report.aborted ? 'Sekwencja przerwana ręcznie' : 'Wszystkie kroki ukończone'}</span>
        </div>

        <div class="metric-card">
          <span class="metric-label">Szczytowa temp. (czujnik)</span>
          <div class="metric-row">
            ${
              report.peakSystemTempC > 0
                ? `<span class="metric-value ${report.peakSystemTempC >= 82 ? 'status-err' : report.peakSystemTempC >= 68 ? 'status-warn' : 'status-ok'}">${report.peakSystemTempC.toFixed(1)}</span><span class="metric-unit">°C</span>`
                : `<span class="metric-value" style="font-size:17px;">Brak czujnika</span>`
            }
          </div>
          <span class="metric-foot">${report.peakSystemTempC > 0 ? 'Prawdziwy odczyt z mostka LHM :8085' : 'Podłącz LibreHardwareMonitor (:8085) na Dashboardzie'}</span>
        </div>

        <div class="metric-card">
          <span class="metric-label">Łączny czas wykonania</span>
          <div class="metric-row">
            <span class="metric-value">${report.totalDurationSec.toFixed(1)}</span>
            <span class="metric-unit">sek</span>
          </div>
          <span class="metric-foot">Automatyczna egzekucja krok po kroku</span>
        </div>
      </div>

      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Test i parametry</th>
              <th>Główna metryka</th>
              <th>Szczegóły</th>
              <th>Czas</th>
              <th>Szczyt °C</th>
              <th>Wynik / Status</th>
            </tr>
          </thead>
          <tbody>
            ${report.steps
              .map((st, idx) => {
                const stCls =
                  st.status === 'passed'
                    ? 'status-ok'
                    : st.status === 'warning'
                      ? 'status-warn'
                      : 'status-err';
                const stText =
                  st.status === 'passed'
                    ? '● ZALICZONY'
                    : st.status === 'warning'
                      ? '▲ UWAGA'
                      : st.status === 'aborted'
                        ? '■ PRZERWANO'
                        : '✖ BŁĄD';
                return `
                  <tr>
                    <td class="font-mono" style="font-weight:700;">${idx + 1}</td>
                    <td>
                      <div style="font-weight:600;">${escHtml(st.label)}</div>
                      <div style="font-size:11.5px;color:var(--text-muted);">${escHtml(st.configSummary)}</div>
                    </td>
                    <td>
                      <div class="font-mono" style="font-weight:700;">${escHtml(st.primaryMetricValue)}</div>
                      <div style="font-size:11px;color:var(--text-muted);">${escHtml(st.primaryMetricLabel)}</div>
                    </td>
                    <td style="font-size:12px;color:var(--text-secondary);">${escHtml(st.secondaryDetails)}</td>
                    <td class="font-mono">${st.durationSec.toFixed(1)} s</td>
                    <td class="font-mono">${st.peakTempC !== null ? `${st.peakTempC.toFixed(1)} °C` : '—'}</td>
                    <td class="font-mono ${stCls}">${stText} (${st.score}/100)</td>
                  </tr>`;
              })
              .join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
