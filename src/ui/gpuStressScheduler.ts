import type { GpuSceneCatalogItem } from '../services/gpuStress.service';
import type {
  BenchmarkResolutionId,
  GpuFpsMode,
  GpuLoadPreset,
  GpuSceneMode,
} from '../types';
import {
  BENCHMARK_RESOLUTION_LIST,
  getBenchmarkResolutionSpec,
} from '../utils/benchmarkResolution';
import { classifyGpuScenePipeline, GPU_PIPELINE_META } from './gpuSceneStabilityHeatmap';
import { iconSvg } from './icons';

export interface GpuScheduledSceneItem {
  id: string;
  sceneId: GpuSceneMode;
  resolution: BenchmarkResolutionId;
  durationSec: number;
  preset: GpuLoadPreset;
  fpsMode: GpuFpsMode;
}

export interface GpuScheduledSceneResult {
  itemId: string;
  sceneId: GpuSceneMode;
  sceneName: string;
  targetUnit: string;
  resolution: BenchmarkResolutionId;
  durationSec: number;
  preset: GpuLoadPreset;
  avgFps: number;
  low1PctFps: number;
  frameTimeMs: number;
  stabilityPct: number;
  score: number;
  peakTempC: number | null;
  finishedAt: number;
}

export interface GpuScheduleRunState {
  queue: GpuScheduledSceneItem[];
  cooldownSec: number;
  running: boolean;
  abortRequested: boolean;
  activeIndex: number;
  activeRemainingSec: number;
  statusText: string;
  results: GpuScheduledSceneResult[];
  draftSceneId: GpuSceneMode;
  draftResolution: BenchmarkResolutionId;
  draftDurationSec: number;
  draftPreset: GpuLoadPreset;
  draftFpsMode: GpuFpsMode;
}

export type GpuSchedulePresetId =
  | 'rt_vs_rast'
  | 'resolution_ladder'
  | 'thermal_endurance'
  | 'quick_all_pipelines';

export const GPU_SCHEDULE_DURATION_OPTIONS = [3, 5, 10, 15, 30, 60, 120] as const;

let gpuSchedUid = 1;

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function clampGpuScheduleDurationSec(sec: number): number {
  if (!Number.isFinite(sec)) return 5;
  return Math.max(3, Math.min(300, Math.round(sec)));
}

export function createGpuScheduledItem(
  sceneId: GpuSceneMode,
  overrides: Partial<Omit<GpuScheduledSceneItem, 'id' | 'sceneId'>> = {}
): GpuScheduledSceneItem {
  const id = `gpusched-${Date.now().toString(36)}-${gpuSchedUid++}`;
  return {
    id,
    sceneId,
    resolution: overrides.resolution ?? '1080p',
    durationSec: clampGpuScheduleDurationSec(overrides.durationSec ?? 5),
    preset: overrides.preset ?? 'high',
    fpsMode: overrides.fpsMode ?? 'uncapped',
  };
}

export function createDefaultGpuScheduleQueue(): GpuScheduledSceneItem[] {
  return [
    createGpuScheduledItem('raymarching', { resolution: '1080p', durationSec: 5, preset: 'high' }),
    createGpuScheduledItem('vortex', { resolution: '2k', durationSec: 5, preset: 'high' }),
    createGpuScheduledItem('blackhole_lensing', {
      resolution: '4k',
      durationSec: 5,
      preset: 'extreme',
    }),
  ];
}

export function createInitialGpuScheduleState(): GpuScheduleRunState {
  return {
    queue: createDefaultGpuScheduleQueue(),
    cooldownSec: 1,
    running: false,
    abortRequested: false,
    activeIndex: -1,
    activeRemainingSec: 0,
    statusText: '',
    results: [],
    draftSceneId: 'raymarching',
    draftResolution: '1080p',
    draftDurationSec: 10,
    draftPreset: 'high',
    draftFpsMode: 'uncapped',
  };
}

export function createGpuSchedulePreset(presetId: GpuSchedulePresetId): GpuScheduledSceneItem[] {
  switch (presetId) {
    case 'rt_vs_rast':
      return [
        createGpuScheduledItem('raymarching', { resolution: '1080p', durationSec: 6, preset: 'high' }),
        createGpuScheduledItem('pathtraced_cornell', {
          resolution: '2k',
          durationSec: 6,
          preset: 'high',
        }),
        createGpuScheduledItem('blackhole_lensing', {
          resolution: '4k',
          durationSec: 6,
          preset: 'extreme',
        }),
        createGpuScheduledItem('vortex', { resolution: '1080p', durationSec: 6, preset: 'high' }),
        createGpuScheduledItem('cyber_city', { resolution: '2k', durationSec: 6, preset: 'high' }),
        createGpuScheduledItem('geometry', { resolution: '4k', durationSec: 6, preset: 'extreme' }),
      ];
    case 'resolution_ladder':
      return [
        createGpuScheduledItem('cyber_city', { resolution: '1080p', durationSec: 5, preset: 'high' }),
        createGpuScheduledItem('cyber_city', { resolution: '2k', durationSec: 5, preset: 'high' }),
        createGpuScheduledItem('cyber_city', { resolution: '4k', durationSec: 5, preset: 'high' }),
        createGpuScheduledItem('cyber_city', { resolution: '8k', durationSec: 5, preset: 'high' }),
      ];
    case 'thermal_endurance':
      return [
        createGpuScheduledItem('furmark', { resolution: '4k', durationSec: 15, preset: 'ultra' }),
        createGpuScheduledItem('raymarching', { resolution: '4k', durationSec: 15, preset: 'ultra' }),
        createGpuScheduledItem('vram_fill', { resolution: '4k', durationSec: 15, preset: 'extreme' }),
        createGpuScheduledItem('volumetric_clouds_4k', {
          resolution: '2k',
          durationSec: 15,
          preset: 'ultra',
        }),
      ];
    case 'quick_all_pipelines':
    default:
      return [
        createGpuScheduledItem('raymarching', { resolution: '2k', durationSec: 5, preset: 'high' }),
        createGpuScheduledItem('vortex', { resolution: '2k', durationSec: 5, preset: 'high' }),
        createGpuScheduledItem('furmark', { resolution: '2k', durationSec: 5, preset: 'high' }),
        createGpuScheduledItem('galaxy', { resolution: '2k', durationSec: 5, preset: 'high' }),
      ];
  }
}

export function addGpuScheduleItem(
  queue: GpuScheduledSceneItem[],
  item: GpuScheduledSceneItem
): GpuScheduledSceneItem[] {
  return [...queue, item];
}

export function removeGpuScheduleItem(
  queue: GpuScheduledSceneItem[],
  itemId: string
): GpuScheduledSceneItem[] {
  return queue.filter((q) => q.id !== itemId);
}

export function duplicateGpuScheduleItem(
  queue: GpuScheduledSceneItem[],
  itemId: string
): GpuScheduledSceneItem[] {
  const idx = queue.findIndex((q) => q.id === itemId);
  if (idx < 0) return queue;
  const src = queue[idx];
  const copy = createGpuScheduledItem(src.sceneId, {
    resolution: src.resolution,
    durationSec: src.durationSec,
    preset: src.preset,
    fpsMode: src.fpsMode,
  });
  const next = [...queue];
  next.splice(idx + 1, 0, copy);
  return next;
}

export function moveGpuScheduleItem(
  queue: GpuScheduledSceneItem[],
  itemId: string,
  direction: 'up' | 'down'
): GpuScheduledSceneItem[] {
  const idx = queue.findIndex((q) => q.id === itemId);
  if (idx < 0) return queue;
  const target = direction === 'up' ? idx - 1 : idx + 1;
  if (target < 0 || target >= queue.length) return queue;
  const next = [...queue];
  const [moved] = next.splice(idx, 1);
  next.splice(target, 0, moved);
  return next;
}

export function updateGpuScheduleItem(
  queue: GpuScheduledSceneItem[],
  itemId: string,
  patch: Partial<Omit<GpuScheduledSceneItem, 'id'>>
): GpuScheduledSceneItem[] {
  return queue.map((item) => {
    if (item.id !== itemId) return item;
    return {
      ...item,
      ...patch,
      durationSec:
        patch.durationSec !== undefined
          ? clampGpuScheduleDurationSec(patch.durationSec)
          : item.durationSec,
    };
  });
}

export function computeGpuScheduleTotalSec(
  queue: GpuScheduledSceneItem[],
  cooldownSec: number
): number {
  if (queue.length === 0) return 0;
  const runSum = queue.reduce((s, item) => s + clampGpuScheduleDurationSec(item.durationSec), 0);
  const pauseSum = Math.max(0, queue.length - 1) * Math.max(0, cooldownSec);
  return runSum + pauseSum;
}

export interface GpuScheduleResultsSummary {
  totalScenes: number;
  avgFps: number;
  avgStabilityPct: number;
  minStabilityPct: number;
  avgScore: number;
  peakTempC: number | null;
}

export function summarizeGpuScheduleResults(
  results: GpuScheduledSceneResult[]
): GpuScheduleResultsSummary | null {
  if (results.length === 0) return null;
  const avgFps = Math.round(results.reduce((s, r) => s + r.avgFps, 0) / results.length);
  const avgStabilityPct = Number(
    (results.reduce((s, r) => s + r.stabilityPct, 0) / results.length).toFixed(1)
  );
  const minStabilityPct = Number(Math.min(...results.map((r) => r.stabilityPct)).toFixed(1));
  const avgScore = Math.round(results.reduce((s, r) => s + r.score, 0) / results.length);
  const temps = results.map((r) => r.peakTempC).filter((t): t is number => t !== null);
  const peakTempC = temps.length > 0 ? Number(Math.max(...temps).toFixed(1)) : null;
  return {
    totalScenes: results.length,
    avgFps,
    avgStabilityPct,
    minStabilityPct,
    avgScore,
    peakTempC,
  };
}

function formatDurationHuman(totalSec: number): string {
  if (totalSec < 60) return `${totalSec}s`;
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export function renderGpuSchedulerPanelHtml(
  state: GpuScheduleRunState,
  catalog: GpuSceneCatalogItem[],
  disabledExternal: boolean
): string {
  const locked = state.running || disabledExternal;
  const totalSec = computeGpuScheduleTotalSec(state.queue, state.cooldownSec);
  const summary = summarizeGpuScheduleResults(state.results);

  const sceneOptionsHtml = catalog
    .map((sc) => {
      const pipe = GPU_PIPELINE_META[classifyGpuScenePipeline(sc)].shortLabel;
      return `<option value="${sc.id}" ${state.draftSceneId === sc.id ? 'selected' : ''}>${esc(sc.shortName)} — ${esc(sc.id)} [${pipe}]</option>`;
    })
    .join('');

  return `
    <div class="panel stack-md" id="gpu-stress-scheduler-panel">
      <div class="panel-header" style="margin-bottom:0;flex-wrap:wrap;gap:10px;">
        <div>
          <h2 class="panel-title">Harmonogram scen GPU 3D (Kolejka automatyczna: Scena + Rozdzielczość + Czas)</h2>
          <span class="panel-caption">
            Zaplanuj dowolną kolejność scen 3D z osobną rozdzielczością (1080p / 2K / 4K / 8K), czasem trwania (3–300 s) i poziomem obciążenia — test wykona się bezobsługowo i zasili mapę cieplną 2D
          </span>
        </div>
        <div class="row-wrap" style="gap:8px;align-items:center;">
          <span class="font-mono" style="font-size:12px;color:var(--text-secondary);">
            Kolejka: <strong class="status-cyan">${state.queue.length}</strong> · Łącznie: <strong>${formatDurationHuman(totalSec)}</strong>
          </span>
          <select id="gpu-sched-cooldown" class="field-input" style="width:auto;padding:5px 8px;font-size:12px;" title="Przerwa chłodząca między scenami" ${locked ? 'disabled' : ''}>
            <option value="0" ${state.cooldownSec === 0 ? 'selected' : ''}>Pauza: 0s</option>
            <option value="1" ${state.cooldownSec === 1 ? 'selected' : ''}>Pauza: 1s</option>
            <option value="3" ${state.cooldownSec === 3 ? 'selected' : ''}>Pauza: 3s</option>
            <option value="5" ${state.cooldownSec === 5 ? 'selected' : ''}>Pauza: 5s</option>
          </select>
          ${
            state.running
              ? `<button id="gpu-sched-stop-btn" type="button" class="btn btn-danger btn-sm">
                  ${iconSvg('stop', 14)}<span>Przerwij harmonogram</span>
                </button>`
              : `<button id="gpu-sched-run-btn" type="button" class="btn btn-primary btn-sm" ${state.queue.length === 0 || disabledExternal ? 'disabled' : ''}>
                  ${iconSvg('play', 14)}<span>Uruchom harmonogram (${state.queue.length})</span>
                </button>`
          }
        </div>
      </div>

      ${
        state.statusText
          ? `<div id="gpu-sched-status-banner" class="panel" style="background:rgba(6,182,212,0.08);border-color:rgba(6,182,212,0.35);padding:10px 12px;font-size:12.5px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
              <span class="font-mono status-cyan">${esc(state.statusText)}</span>
              ${
                state.running && state.activeIndex >= 0
                  ? `<span class="font-mono" style="font-size:11.5px;color:var(--text-secondary);">Krok ${state.activeIndex + 1} / ${state.queue.length}${state.activeRemainingSec > 0 ? ` · pozostało ~${state.activeRemainingSec}s` : ''}</span>`
                  : ''
              }
            </div>`
          : `<div id="gpu-sched-status-banner" style="display:none;"></div>`
      }

      <div class="row-wrap" style="gap:6px;flex-wrap:wrap;align-items:center;">
        <span style="font-size:11.5px;color:var(--text-muted);font-weight:600;">Szablony kolejki:</span>
        <button type="button" class="btn btn-secondary btn-sm" data-gpu-sched-preset="rt_vs_rast" ${locked ? 'disabled' : ''}>RT vs Rasteryzacja (6 scen)</button>
        <button type="button" class="btn btn-secondary btn-sm" data-gpu-sched-preset="resolution_ladder" ${locked ? 'disabled' : ''}>Drabina 1080p → 2K → 4K → 8K</button>
        <button type="button" class="btn btn-secondary btn-sm" data-gpu-sched-preset="thermal_endurance" ${locked ? 'disabled' : ''}>Wygrzewanie 4K Ultra (60s)</button>
        <button type="button" class="btn btn-secondary btn-sm" data-gpu-sched-preset="quick_all_pipelines" ${locked ? 'disabled' : ''}>4 Potoki GPU (20s)</button>
        <button type="button" class="btn btn-sm" id="gpu-sched-clear-btn" ${locked || state.queue.length === 0 ? 'disabled' : ''}>
          ${iconSvg('trash', 13)}<span>Wyczyść kolejkę</span>
        </button>
      </div>

      <div class="panel" style="background:var(--bg-inset);padding:12px;">
        <div class="row-wrap" style="gap:8px;align-items:flex-end;flex-wrap:wrap;">
          <div class="field-group" style="flex:2;min-width:220px;margin:0;">
            <label class="field-label" style="font-size:11px;" for="gpu-sched-draft-scene">Scena 3D GPU</label>
            <select id="gpu-sched-draft-scene" class="field-input" style="font-size:12px;padding:6px 8px;" ${locked ? 'disabled' : ''}>
              ${sceneOptionsHtml}
            </select>
          </div>
          <div class="field-group" style="min-width:110px;margin:0;">
            <label class="field-label" style="font-size:11px;" for="gpu-sched-draft-res">Rozdzielczość</label>
            <select id="gpu-sched-draft-res" class="field-input" style="font-size:12px;padding:6px 8px;" ${locked ? 'disabled' : ''}>
              ${BENCHMARK_RESOLUTION_LIST.map(
                (r) =>
                  `<option value="${r.id}" ${state.draftResolution === r.id ? 'selected' : ''}>${r.shortLabel} (${r.width}×${r.height})</option>`
              ).join('')}
            </select>
          </div>
          <div class="field-group" style="width:105px;margin:0;">
            <label class="field-label" style="font-size:11px;" for="gpu-sched-draft-dur">Czas (sekundy)</label>
            <input id="gpu-sched-draft-dur" type="number" min="3" max="300" step="1" value="${state.draftDurationSec}" class="field-input font-mono" style="font-size:12px;padding:6px 8px;" ${locked ? 'disabled' : ''} />
          </div>
          <div class="field-group" style="min-width:110px;margin:0;">
            <label class="field-label" style="font-size:11px;" for="gpu-sched-draft-preset">Obciążenie</label>
            <select id="gpu-sched-draft-preset" class="field-input" style="font-size:12px;padding:6px 8px;" ${locked ? 'disabled' : ''}>
              <option value="standard" ${state.draftPreset === 'standard' ? 'selected' : ''}>Standard</option>
              <option value="high" ${state.draftPreset === 'high' ? 'selected' : ''}>Wysoki</option>
              <option value="extreme" ${state.draftPreset === 'extreme' ? 'selected' : ''}>Ekstremalny</option>
              <option value="ultra" ${state.draftPreset === 'ultra' ? 'selected' : ''}>Ultra MAX</option>
            </select>
          </div>
          <button id="gpu-sched-add-btn" type="button" class="btn btn-amber btn-sm" style="height:32px;" ${locked ? 'disabled' : ''}>
            <span>+ Dodaj do kolejki</span>
          </button>
        </div>
      </div>

      ${
        state.queue.length === 0
          ? `<div style="padding:14px;border:1px dashed var(--border);border-radius:10px;color:var(--text-muted);font-size:12.5px;text-align:center;">
              Kolejka harmonogramu GPU jest pusta. Wybierz scenę, rozdzielczość i czas powyżej lub kliknij jeden z gotowych szablonów.
            </div>`
          : `
        <div class="queue-list" id="gpu-sched-queue-list">
          ${state.queue
            .map((item, idx) => {
              const meta = catalog.find((c) => c.id === item.sceneId) || catalog[0];
              const pipe = GPU_PIPELINE_META[classifyGpuScenePipeline(meta)];
              const resSpec = getBenchmarkResolutionSpec(item.resolution);
              const isActive = state.running && state.activeIndex === idx;
              const isDone =
                (state.running && state.activeIndex > idx) ||
                (!state.running && state.results.some((r) => r.itemId === item.id));
              const matchedRes = state.results.find((r) => r.itemId === item.id);
              return `
              <div class="queue-item ${isActive ? 'active-step' : isDone ? 'done-step' : ''}" data-gpu-sched-row="${item.id}">
                <div class="row-wrap" style="gap:10px;flex:1;min-width:220px;align-items:center;">
                  <span class="queue-order">${idx + 1}</span>
                  <div>
                    <div style="font-weight:600;font-size:13px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                      <span>${esc(meta.name)}</span>
                      <span class="font-mono" style="font-size:10.5px;padding:1px 6px;border-radius:4px;background:rgba(148,163,184,0.14);color:${pipe.accent};">${pipe.shortLabel}</span>
                      ${isActive ? '<span class="font-mono status-cyan" style="font-size:10.5px;font-weight:700;">● W TOKU</span>' : ''}
                      ${
                        matchedRes
                          ? `<span class="font-mono ${matchedRes.stabilityPct >= 90 ? 'status-ok' : matchedRes.stabilityPct >= 75 ? 'status-warn' : 'status-err'}" style="font-size:11px;">✓ ${matchedRes.avgFps} FPS · ${matchedRes.stabilityPct}% stab.</span>`
                          : ''
                      }
                    </div>
                    <div class="font-mono" style="font-size:11px;color:var(--text-muted);">
                      ID: ${esc(item.sceneId)} · ${esc(meta.targetUnit)} · ${resSpec.shortLabel} (${resSpec.width}×${resSpec.height}) · ${item.durationSec}s
                    </div>
                  </div>
                </div>
                <div class="row-wrap" style="gap:6px;align-items:center;">
                  <select class="field-input" style="width:auto;padding:4px 7px;font-size:11.5px;" data-gpu-sched-res="${item.id}" title="Rozdzielczość kroku" ${locked ? 'disabled' : ''}>
                    ${BENCHMARK_RESOLUTION_LIST.map(
                      (r) =>
                        `<option value="${r.id}" ${item.resolution === r.id ? 'selected' : ''}>${r.shortLabel}</option>`
                    ).join('')}
                  </select>
                  <input type="number" min="3" max="300" step="1" value="${item.durationSec}" class="field-input font-mono" style="width:68px;padding:4px 6px;font-size:11.5px;" data-gpu-sched-dur="${item.id}" title="Czas trwania w sekundach (3–300s)" ${locked ? 'disabled' : ''} />
                  <select class="field-input" style="width:auto;padding:4px 7px;font-size:11.5px;" data-gpu-sched-preset="${item.id}" title="Poziom obciążenia" ${locked ? 'disabled' : ''}>
                    ${(['standard', 'high', 'extreme', 'ultra'] as GpuLoadPreset[])
                      .map(
                        (p) =>
                          `<option value="${p}" ${item.preset === p ? 'selected' : ''}>${p.toUpperCase()}</option>`
                      )
                      .join('')}
                  </select>
                  <button type="button" class="btn btn-secondary btn-sm" style="padding:4px 7px;" data-gpu-sched-up="${item.id}" title="Przesuń wyżej" ${locked || idx === 0 ? 'disabled' : ''}>↑</button>
                  <button type="button" class="btn btn-secondary btn-sm" style="padding:4px 7px;" data-gpu-sched-down="${item.id}" title="Przesuń niżej" ${locked || idx === state.queue.length - 1 ? 'disabled' : ''}>↓</button>
                  <button type="button" class="btn btn-secondary btn-sm" style="padding:4px 7px;" data-gpu-sched-dup="${item.id}" title="Duplikuj krok" ${locked ? 'disabled' : ''}>⧉</button>
                  <button type="button" class="btn btn-sm" style="padding:4px 7px;" data-gpu-sched-del="${item.id}" title="Usuń z kolejki" ${locked ? 'disabled' : ''}>×</button>
                </div>
              </div>`;
            })
            .join('')}
        </div>`
      }

      ${
        summary
          ? `
        <div class="stack-sm" id="gpu-sched-results-wrap" style="padding-top:6px;border-top:1px solid var(--border);">
          <div class="row-between" style="flex-wrap:wrap;gap:8px;">
            <span style="font-weight:700;font-size:13px;">Wyniki harmonogramu GPU (${summary.totalScenes} wykonanych scen)</span>
            <span class="font-mono" style="font-size:12px;color:var(--text-secondary);">
              Śr. FPS: <strong class="status-cyan">${summary.avgFps}</strong> · Śr. stabilność: <strong class="${summary.avgStabilityPct >= 90 ? 'status-ok' : summary.avgStabilityPct >= 75 ? 'status-warn' : 'status-err'}">${summary.avgStabilityPct}%</strong> (min ${summary.minStabilityPct}%) · Wynik: <strong>${summary.avgScore}/100</strong>${summary.peakTempC !== null ? ` · Max Temp: <strong>${summary.peakTempC}°C</strong>` : ''}
            </span>
          </div>
          <div style="overflow-x:auto;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Scena (ID)</th>
                  <th>Rozdz.</th>
                  <th>Czas</th>
                  <th>Preset</th>
                  <th>Śr. FPS</th>
                  <th>1% Low</th>
                  <th>Frame ms</th>
                  <th>Stabilność</th>
                  <th>Wynik</th>
                </tr>
              </thead>
              <tbody>
                ${state.results
                  .map(
                    (row, i) => `
                  <tr>
                    <td class="font-mono">${i + 1}</td>
                    <td><strong>${esc(row.sceneName)}</strong> <span class="font-mono" style="font-size:11px;color:var(--text-muted);">(${esc(row.sceneId)})</span></td>
                    <td class="font-mono status-cyan">${getBenchmarkResolutionSpec(row.resolution).shortLabel}</td>
                    <td class="font-mono">${row.durationSec}s</td>
                    <td class="font-mono">${row.preset.toUpperCase()}</td>
                    <td class="font-mono status-cyan" style="font-weight:700;">${row.avgFps.toLocaleString('pl-PL')} FPS</td>
                    <td class="font-mono">${row.low1PctFps.toLocaleString('pl-PL')} FPS</td>
                    <td class="font-mono">${row.frameTimeMs} ms</td>
                    <td class="font-mono ${row.stabilityPct >= 90 ? 'status-ok' : row.stabilityPct >= 75 ? 'status-warn' : 'status-err'}">${row.stabilityPct}%</td>
                    <td class="font-mono" style="font-weight:700;">${row.score}/100</td>
                  </tr>`
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </div>`
          : ''
      }
    </div>
  `;
}
