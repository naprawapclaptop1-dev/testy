import {
  BenchmarkResolutionId,
  GameQualityPreset,
  GameSceneId,
} from '../types';
import type { GameCatalogItem } from '../services/gameBench.service';
import {
  BENCHMARK_RESOLUTION_LIST,
  getBenchmarkResolutionSpec,
} from '../utils/benchmarkResolution';

export type GameSuiteRunMode = 'auto' | 'manual';
export type GameSuiteAutoDurationSec = 5 | 8 | 12 | 20;

export interface GameSuiteRunResult {
  sceneId: GameSceneId;
  shortTitle: string;
  badge: string;
  mode: GameSuiteRunMode;
  preset: GameQualityPreset;
  resolution: BenchmarkResolutionId;
  avgFps: number;
  low1PctFps: number;
  low01PctFps: number;
  avgFrameTimeMs: number;
  stabilityPct: number;
  verdict: string;
  durationSec: number;
  completedAt: string;
}

export interface GameSuiteState {
  selectedIds: GameSceneId[];
  runMode: GameSuiteRunMode;
  autoDurationSec: GameSuiteAutoDurationSec;
  resolution: BenchmarkResolutionId;
  queueRunning: boolean;
  queueIndex: number;
  queueTotal: number;
  activeQueueGameTitle: string;
  remainingSec: number;
  results: GameSuiteRunResult[];
}

export interface GameSuiteSummary {
  completedCount: number;
  avgFps: number;
  avgLow1PctFps: number;
  avgStabilityPct: number;
  bestGameTitle: string;
  bestGameFps: number;
  heaviestGameTitle: string;
  heaviestGameFps: number;
}

const TOP_NEW_GAME_IDS: GameSceneId[] = [
  'spiderman_ny_3d',
  'bond_007_aston_3d',
  'fifa_2027_stadium_3d',
  'gta6_vice_neon_3d',
  'witcher4_polaris_3d',
  'battlefield_2027_tank_3d',
];

function escHtml(raw: string): string {
  return String(raw ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function createInitialGameSuiteState(defaultSceneId: GameSceneId): GameSuiteState {
  return {
    selectedIds: [defaultSceneId],
    runMode: 'auto',
    autoDurationSec: 8,
    resolution: '1080p',
    queueRunning: false,
    queueIndex: 0,
    queueTotal: 0,
    activeQueueGameTitle: '',
    remainingSec: 0,
    results: [],
  };
}

export function toggleGameSelection(
  selectedIds: GameSceneId[],
  sceneId: GameSceneId
): GameSceneId[] {
  if (selectedIds.includes(sceneId)) {
    return selectedIds.filter((id) => id !== sceneId);
  }
  return [...selectedIds, sceneId];
}

export function selectAllGames(catalog: GameCatalogItem[]): GameSceneId[] {
  return catalog.map((item) => item.id);
}

export function selectFilteredGames(filteredCatalog: GameCatalogItem[]): GameSceneId[] {
  return filteredCatalog.map((item) => item.id);
}

export function selectSingleGame(sceneId: GameSceneId): GameSceneId[] {
  return [sceneId];
}

export function selectTopNewGames(catalog: GameCatalogItem[]): GameSceneId[] {
  const available = new Set(catalog.map((item) => item.id));
  const picks = TOP_NEW_GAME_IDS.filter((id) => available.has(id));
  return picks.length > 0 ? picks : catalog.slice(0, Math.min(6, catalog.length)).map((i) => i.id);
}

export function clearGameSelection(): GameSceneId[] {
  return [];
}

export function computeGameSuiteSummary(results: GameSuiteRunResult[]): GameSuiteSummary {
  if (!results || results.length === 0) {
    return {
      completedCount: 0,
      avgFps: 0,
      avgLow1PctFps: 0,
      avgStabilityPct: 0,
      bestGameTitle: '—',
      bestGameFps: 0,
      heaviestGameTitle: '—',
      heaviestGameFps: 0,
    };
  }

  let sumFps = 0;
  let sumLow1 = 0;
  let sumStab = 0;
  let best = results[0];
  let heaviest = results[0];

  for (const r of results) {
    sumFps += r.avgFps;
    sumLow1 += r.low1PctFps;
    sumStab += r.stabilityPct;
    if (r.avgFps > best.avgFps) best = r;
    if (r.avgFps < heaviest.avgFps) heaviest = r;
  }

  const n = results.length;
  return {
    completedCount: n,
    avgFps: Number((sumFps / n).toFixed(1)),
    avgLow1PctFps: Number((sumLow1 / n).toFixed(1)),
    avgStabilityPct: Number((sumStab / n).toFixed(1)),
    bestGameTitle: best.shortTitle,
    bestGameFps: best.avgFps,
    heaviestGameTitle: heaviest.shortTitle,
    heaviestGameFps: heaviest.avgFps,
  };
}

export function renderGameSuiteProgressHtml(state: GameSuiteState): string {
  if (!state.queueRunning) return '';

  const currentNum = Math.min(state.queueTotal, state.queueIndex + 1);
  const pct =
    state.queueTotal > 0
      ? Math.min(100, Math.round(((state.queueIndex + (state.runMode === 'auto' ? 0.5 : 0.25)) / state.queueTotal) * 100))
      : 0;
  const isLast = currentNum >= state.queueTotal;

  if (state.runMode === 'auto') {
    return `
      <div
        id="game-suite-live-banner"
        class="panel stack-xs"
        data-game-suite-running="auto"
        style="padding:12px 14px;border:1.5px solid rgba(6, 182, 212, 0.55);background:rgba(6, 182, 212, 0.1);"
      >
        <div class="row-between" style="flex-wrap:wrap;gap:8px;align-items:center;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span class="font-mono status-cyan" style="font-weight:700;">🤖 AUTO-BENCHMARK (${currentNum} / ${state.queueTotal})</span>
            <strong style="font-size:13px;color:var(--text-primary);">${escHtml(state.activeQueueGameTitle)}</strong>
            <span class="font-mono" style="font-size:11.5px;color:var(--text-secondary);">Pozostało: <strong>${Math.max(0, Math.ceil(state.remainingSec))}s</strong></span>
          </div>
          <div class="row-wrap" style="gap:6px;">
            ${
              !isLast
                ? `<button id="game-suite-next-btn" type="button" class="btn btn-secondary btn-sm">⏭ Następna gra</button>`
                : ''
            }
            <button id="game-suite-stop-btn" type="button" class="btn btn-danger btn-sm">⏹ Przerwij kolejkę</button>
          </div>
        </div>
        <div class="progress-track" style="height:6px;">
          <div class="progress-fill" style="width:${pct}%;"></div>
        </div>
      </div>
    `;
  }

  return `
    <div
      id="game-suite-live-banner"
      class="panel stack-xs"
      data-game-suite-running="manual"
      style="padding:12px 14px;border:1.5px solid rgba(245, 158, 11, 0.58);background:rgba(245, 158, 11, 0.1);"
    >
      <div class="row-between" style="flex-wrap:wrap;gap:8px;align-items:center;">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span class="font-mono" style="font-weight:700;color:var(--accent-amber);">🎮 TEST RĘCZNY UŻYTKOWNIKA (${currentNum} / ${state.queueTotal})</span>
          <strong style="font-size:13px;color:var(--text-primary);">${escHtml(state.activeQueueGameTitle)}</strong>
          <span style="font-size:11.5px;color:var(--text-secondary);">Sterujesz samodzielnie (WASD / Strzałki / Mysz / Spacja / Shift).</span>
        </div>
        <div class="row-wrap" style="gap:6px;">
          <button id="game-suite-next-btn" type="button" class="btn btn-primary btn-sm">
            ${isLast ? '✓ Zapisz wynik i zakończ' : `⏭ Zapisz wynik i następna (${currentNum + 1} / ${state.queueTotal})`}
          </button>
          <button id="game-suite-stop-btn" type="button" class="btn btn-danger btn-sm">⏹ Zakończ sesję</button>
        </div>
      </div>
    </div>
  `;
}

export function renderGameSuiteControlPanelHtml(
  state: GameSuiteState,
  totalCatalogCount: number,
  filteredCatalogCount: number
): string {
  const selectedCount = state.selectedIds.length;
  const estTotalSec = selectedCount * state.autoDurationSec;
  const estLabel =
    estTotalSec >= 60
      ? `~${Math.floor(estTotalSec / 60)} min ${estTotalSec % 60 > 0 ? `${estTotalSec % 60}s` : ''}`.trim()
      : `~${estTotalSec}s`;

  const resSpec = getBenchmarkResolutionSpec(state.resolution);
  const modeBadge =
    state.runMode === 'auto'
      ? `Tryb: <strong class="status-cyan">🤖 Automatyczny</strong> (${state.autoDurationSec}s / gra · łącznie ${estLabel}) · Rozdzielczość: <strong class="font-mono status-ok">${resSpec.shortLabel} (${resSpec.width}×${resSpec.height})</strong>`
      : `Tryb: <strong style="color:var(--accent-amber);">🎮 Ręczny (Sam użytkownik)</strong> — pełne sterowanie WASD / Mysz · Rozdzielczość: <strong class="font-mono status-ok">${resSpec.shortLabel} (${resSpec.width}×${resSpec.height})</strong>`;

  const startBtnLabel =
    selectedCount === 0
      ? 'Zaznacz co najmniej 1 grę'
      : state.runMode === 'auto'
        ? selectedCount === totalCatalogCount
          ? `▶ Uruchom automatycznie WSZYSTKIE (${selectedCount} gier · ${resSpec.shortLabel})`
          : selectedCount === 1
            ? `▶ Uruchom automatycznie (1 grę · ${resSpec.shortLabel})`
            : `▶ Uruchom automatycznie wybrane (${selectedCount} gier · ${resSpec.shortLabel})`
        : selectedCount === totalCatalogCount
          ? `🎮 Uruchom ręcznie WSZYSTKIE (${selectedCount} gier · ${resSpec.shortLabel})`
          : selectedCount === 1
            ? `🎮 Uruchom ręcznie (1 grę · ${resSpec.shortLabel})`
            : `🎮 Uruchom ręcznie wybrane (${selectedCount} gier · ${resSpec.shortLabel})`;

  return `
    <div
      id="game-suite-controller"
      class="panel stack-sm"
      data-game-suite-mode="${state.runMode}"
      data-game-suite-selected="${selectedCount}"
      data-game-suite-res="${state.resolution}"
      style="padding:14px;border:1.5px solid rgba(6, 182, 212, 0.42);background:linear-gradient(135deg, rgba(6, 182, 212, 0.09), rgba(16, 185, 129, 0.05));"
    >
      <div class="row-between" style="flex-wrap:wrap;gap:10px;align-items:center;">
        <div>
          <strong style="font-size:13.5px;color:var(--accent-cyan);">
            🎯 Sterowanie testami gier 3D — Tryb Automatyczny lub Ręczny + Wybór (Wszystkie / Pojedyncze / Kilka)
          </strong>
          <div style="font-size:12px;color:var(--text-secondary);margin-top:2px;">
            Zaznacz dowolne gry przyciskiem <span class="font-mono">[+ Wybierz / ✓]</span> na kartach poniżej (1 grę, kilka wybranych, całą kategorię albo wszystkie ${totalCatalogCount}), ustaw rozdzielczość <strong>1080p / 2K / 4K / 8K</strong> i wybierz tryb automatyczny lub ręczny.
          </div>
        </div>
        <div class="row-wrap" style="gap:8px;align-items:center;">
          <div class="segmented" role="group" aria-label="Rozdzielczość testu gier 3D">
            ${BENCHMARK_RESOLUTION_LIST.map(
              (r) => `
              <button
                type="button"
                class="segmented-btn ${state.resolution === r.id ? 'active' : ''}"
                data-game-suite-res="${r.id}"
                title="${escHtml(r.label)}"
                ${state.queueRunning ? 'disabled' : ''}
              >
                ${r.shortLabel}
              </button>`
            ).join('')}
          </div>
          <div class="segmented" role="group" aria-label="Tryb wykonania testów gier 3D">
            <button
              type="button"
              class="segmented-btn ${state.runMode === 'auto' ? 'active' : ''}"
              data-game-suite-mode-btn="auto"
              ${state.queueRunning ? 'disabled' : ''}
            >
              🤖 Automatyczny (Auto)
            </button>
            <button
              type="button"
              class="segmented-btn ${state.runMode === 'manual' ? 'active' : ''}"
              data-game-suite-mode-btn="manual"
              ${state.queueRunning ? 'disabled' : ''}
            >
              🎮 Ręczny (Sam użytkownik)
            </button>
          </div>
        </div>
      </div>

      <div class="row-between" style="flex-wrap:wrap;gap:8px;align-items:center;">
        <div class="row-wrap" style="gap:6px;align-items:center;">
          <button type="button" id="game-select-all-btn" class="btn btn-secondary btn-sm" ${state.queueRunning ? 'disabled' : ''}>
            ☑ Wszystkie (${totalCatalogCount})
          </button>
          <button type="button" id="game-select-filtered-btn" class="btn btn-secondary btn-sm" ${state.queueRunning ? 'disabled' : ''}>
            📂 Widoczna kategoria (${filteredCatalogCount})
          </button>
          <button type="button" id="game-select-single-btn" class="btn btn-secondary btn-sm" ${state.queueRunning ? 'disabled' : ''}>
            1️⃣ Tylko aktywna (1)
          </button>
          <button type="button" id="game-select-topnew-btn" class="btn btn-secondary btn-sm" ${state.queueRunning ? 'disabled' : ''}>
            ✨ Nowości 2026–2027 (6)
          </button>
          <button type="button" id="game-select-clear-btn" class="btn btn-secondary btn-sm" ${state.queueRunning ? 'disabled' : ''}>
            ☐ Wyczyść (${selectedCount})
          </button>
        </div>

        <div class="row-wrap" style="gap:8px;align-items:center;">
          ${
            state.runMode === 'auto'
              ? `
            <span style="font-size:11.5px;color:var(--text-secondary);">Czas na grę:</span>
            <div class="segmented" role="group" aria-label="Czas testu automatycznego na jedną grę">
              ${([5, 8, 12, 20] as GameSuiteAutoDurationSec[])
                .map(
                  (sec) => `
                  <button
                    type="button"
                    class="segmented-btn ${state.autoDurationSec === sec ? 'active' : ''}"
                    data-game-suite-dur="${sec}"
                    ${state.queueRunning ? 'disabled' : ''}
                  >
                    ${sec}s
                  </button>`
                )
                .join('')}
            </div>`
              : ''
          }
          ${
            state.queueRunning
              ? `<button id="game-suite-stop-main-btn" type="button" class="btn btn-danger btn-sm">⏹ Zatrzymaj kolejkę (${Math.min(state.queueTotal, state.queueIndex + 1)}/${state.queueTotal})</button>`
              : `<button id="game-suite-start-btn" type="button" class="btn ${state.runMode === 'auto' ? 'btn-primary' : 'btn-amber'} btn-sm" ${selectedCount === 0 ? 'disabled' : ''}>
                   ${startBtnLabel}
                 </button>`
          }
        </div>
      </div>

      <div class="row-between" style="flex-wrap:wrap;gap:8px;font-size:11.5px;color:var(--text-muted);padding-top:4px;border-top:1px solid var(--border-hairline);">
        <span>Wybrano do testu: <strong class="font-mono status-cyan">${selectedCount} / ${totalCatalogCount}</strong> gier</span>
        <span>${modeBadge}</span>
      </div>

      <div id="game-suite-progress-slot">
        ${renderGameSuiteProgressHtml(state)}
      </div>
    </div>
  `;
}

export function renderGameSuiteResultsTableHtml(results: GameSuiteRunResult[]): string {
  if (!results || results.length === 0) return '';
  const summary = computeGameSuiteSummary(results);

  return `
    <div id="game-suite-results-panel" class="panel stack-sm" data-game-suite-results="${results.length}" style="padding:14px;">
      <div class="row-between" style="flex-wrap:wrap;gap:8px;align-items:center;">
        <div>
          <h2 class="panel-title">Wyniki przetestowanych gier 3D (${summary.completedCount})</h2>
          <span class="panel-caption">
            Średnia pakietu: <strong class="font-mono status-ok">${summary.avgFps} FPS</strong> ·
            1% Low: <strong class="font-mono status-cyan">${summary.avgLow1PctFps} FPS</strong> ·
            Stabilność: <strong class="font-mono">${summary.avgStabilityPct}%</strong> ·
            Najwyższy FPS: <strong>${escHtml(summary.bestGameTitle)} (${summary.bestGameFps})</strong>
          </span>
        </div>
        <button id="game-suite-clear-results-btn" type="button" class="btn btn-secondary btn-sm">
          Wyczyść tabelę wyników
        </button>
      </div>
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Gra 3D</th>
              <th>Tryb</th>
              <th>Rozdzielczość</th>
              <th>Jakość</th>
              <th>Śr. FPS</th>
              <th>1% Low</th>
              <th>Frame-Time</th>
              <th>Stabilność</th>
              <th>Werdykt</th>
            </tr>
          </thead>
          <tbody>
            ${results
              .map((r, idx) => {
                const resSpec = getBenchmarkResolutionSpec(r.resolution || '1080p');
                return `
              <tr>
                <td class="font-mono">${idx + 1}</td>
                <td><strong>${escHtml(r.shortTitle)}</strong> <span class="font-mono" style="font-size:10px;opacity:0.7;">${escHtml(r.badge)}</span></td>
                <td class="font-mono">${r.mode === 'auto' ? '🤖 Auto' : '🎮 Ręczny'} (${r.durationSec}s)</td>
                <td class="font-mono status-cyan">${escHtml(resSpec.shortLabel)}</td>
                <td class="font-mono">${escHtml(r.preset.toUpperCase())}</td>
                <td class="font-mono ${r.avgFps >= 60 ? 'status-ok' : r.avgFps >= 35 ? 'status-warn' : 'status-err'}" style="font-weight:700;">${r.avgFps} FPS</td>
                <td class="font-mono status-cyan">${r.low1PctFps} FPS</td>
                <td class="font-mono">${r.avgFrameTimeMs.toFixed(1)} ms</td>
                <td class="font-mono ${r.stabilityPct >= 90 ? 'status-ok' : r.stabilityPct >= 75 ? 'status-warn' : 'status-err'}">${r.stabilityPct.toFixed(1)}%</td>
                <td>${escHtml(r.verdict)}</td>
              </tr>`;
              })
              .join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
