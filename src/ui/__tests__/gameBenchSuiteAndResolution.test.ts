import { describe, expect, it } from 'vitest';
import { GAME_CATALOG } from '../../services/gameBench.service';
import {
  BENCHMARK_RESOLUTION_LIST,
  computeSafeBenchmarkBufferSize,
  getBenchmarkResolutionSpec,
} from '../../utils/benchmarkResolution';
import {
  clearGameSelection,
  computeGameSuiteSummary,
  createInitialGameSuiteState,
  renderGameSuiteControlPanelHtml,
  renderGameSuiteProgressHtml,
  renderGameSuiteResultsTableHtml,
  selectAllGames,
  selectFilteredGames,
  selectSingleGame,
  selectTopNewGames,
  toggleGameSelection,
  GameSuiteRunResult,
} from '../gameBenchSuite';
import { createScheduledItem, describeItemConfig } from '../schedulerUi';

describe('Benchmark Resolution (1080p / 2K / 4K / 8K)', () => {
  it('exposes all 4 required resolutions: 1080p, 2K, 4K, 8K', () => {
    const ids = BENCHMARK_RESOLUTION_LIST.map((r) => r.id);
    expect(ids).toEqual(['1080p', '2k', '4k', '8k']);
    expect(getBenchmarkResolutionSpec('1080p')).toMatchObject({ width: 1920, height: 1080 });
    expect(getBenchmarkResolutionSpec('2k')).toMatchObject({ width: 2560, height: 1440 });
    expect(getBenchmarkResolutionSpec('4k')).toMatchObject({ width: 3840, height: 2160 });
    expect(getBenchmarkResolutionSpec('8k')).toMatchObject({ width: 7680, height: 4320 });
  });

  it('computes exact native buffer dimensions on 8192px hardware and safe clamped + supersampled load on 4096px hardware', () => {
    const fhd = computeSafeBenchmarkBufferSize('1080p', 1.0, 8192);
    expect(fhd.drawWidth).toBe(1920);
    expect(fhd.drawHeight).toBe(1080);
    expect(fhd.cappedByHardware).toBe(false);
    expect(fhd.extraSupersampleSteps).toBe(0);

    const qhd = computeSafeBenchmarkBufferSize('2k', 1.0, 8192);
    expect(qhd.drawWidth).toBe(2560);
    expect(qhd.drawHeight).toBe(1440);
    expect(qhd.cappedByHardware).toBe(false);

    const uhd4k = computeSafeBenchmarkBufferSize('4k', 1.0, 8192);
    expect(uhd4k.drawWidth).toBe(3840);
    expect(uhd4k.drawHeight).toBe(2160);
    expect(uhd4k.extraSupersampleSteps).toBe(8);

    const uhd8kNative = computeSafeBenchmarkBufferSize('8k', 1.0, 8192);
    expect(uhd8kNative.drawWidth).toBe(7680);
    expect(uhd8kNative.drawHeight).toBe(4320);
    expect(uhd8kNative.cappedByHardware).toBe(false);
    expect(uhd8kNative.extraSupersampleSteps).toBe(16);

    const uhd8kClamped = computeSafeBenchmarkBufferSize('8k', 1.0, 4096);
    expect(uhd8kClamped.drawWidth).toBe(4096);
    expect(uhd8kClamped.drawHeight).toBe(2304);
    expect(uhd8kClamped.cappedByHardware).toBe(true);
    expect(uhd8kClamped.extraSupersampleSteps).toBe(32);
  });

  it('includes resolution defaults and labels in Scheduler GPU and Game items', () => {
    const gpuItem = createScheduledItem('gpu_stress');
    expect(gpuItem.resolution).toBe('1080p');
    expect(describeItemConfig({ ...gpuItem, resolution: '4k' })).toContain('4K');

    const gameItem = createScheduledItem('game_ultra');
    expect(gameItem.resolution).toBe('1080p');
    expect(describeItemConfig({ ...gameItem, resolution: '8k' })).toContain('8K');
  });
});

describe('Gra 3D MAX Auto/Manual Suite & Multi-Select Queue', () => {
  it('supports selecting single game, several games, filtered category, top new, all 50, and clearing', () => {
    const initial = createInitialGameSuiteState('hyperion');
    expect(initial.selectedIds).toEqual(['hyperion']);
    expect(initial.runMode).toBe('auto');
    expect(initial.resolution).toBe('1080p');

    const withTwo = toggleGameSelection(initial.selectedIds, 'cyber_racer');
    expect(withTwo).toEqual(['hyperion', 'cyber_racer']);

    const toggledOff = toggleGameSelection(withTwo, 'hyperion');
    expect(toggledOff).toEqual(['cyber_racer']);

    const all = selectAllGames(GAME_CATALOG);
    expect(all.length).toBe(GAME_CATALOG.length);
    expect(all.length).toBeGreaterThanOrEqual(50);

    const subset = selectFilteredGames(GAME_CATALOG.slice(0, 7));
    expect(subset.length).toBe(7);

    const single = selectSingleGame('formula_cyber_gp');
    expect(single).toEqual(['formula_cyber_gp']);

    const topNew = selectTopNewGames(GAME_CATALOG);
    expect(topNew.length).toBe(6);

    expect(clearGameSelection()).toEqual([]);
  });

  it('renders Auto & Manual mode buttons, all 4 resolution buttons (1080p/2K/4K/8K), and queue progress', () => {
    const state = createInitialGameSuiteState('hyperion');
    state.selectedIds = ['hyperion', 'formula_cyber_gp', 'gta6_vice_neon_3d'];
    state.resolution = '4k';

    const autoHtml = renderGameSuiteControlPanelHtml(state, 50, 12);
    expect(autoHtml).toContain('data-game-suite-mode-btn="auto"');
    expect(autoHtml).toContain('data-game-suite-mode-btn="manual"');
    expect(autoHtml).toContain('data-game-suite-res="1080p"');
    expect(autoHtml).toContain('data-game-suite-res="2k"');
    expect(autoHtml).toContain('data-game-suite-res="4k"');
    expect(autoHtml).toContain('data-game-suite-res="8k"');
    expect(autoHtml).toContain('3 gier · 4K');

    state.runMode = 'manual';
    state.resolution = '8k';
    const manualHtml = renderGameSuiteControlPanelHtml(state, 50, 12);
    expect(manualHtml).toContain('Uruchom ręcznie wybrane (3 gier · 8K)');
    expect(manualHtml).toContain('8K (7680×4320)');

    state.queueRunning = true;
    state.queueIndex = 1;
    state.queueTotal = 3;
    state.activeQueueGameTitle = 'Formula GP';
    const manualProgress = renderGameSuiteProgressHtml(state);
    expect(manualProgress).toContain('TEST RĘCZNY UŻYTKOWNIKA (2 / 3)');
    expect(manualProgress).toContain('Zapisz wynik i następna (3 / 3)');
  });

  it('computes suite summary and renders results table with resolution column', () => {
    const results: GameSuiteRunResult[] = [
      {
        sceneId: 'hyperion',
        shortTitle: 'HYPERION',
        badge: 'SCI-FI MAX',
        mode: 'auto',
        preset: 'ultra',
        resolution: '4k',
        avgFps: 112,
        low1PctFps: 94,
        low01PctFps: 81,
        avgFrameTimeMs: 8.9,
        stabilityPct: 96.4,
        verdict: 'ULTRA PŁYNNOŚĆ',
        durationSec: 8,
        completedAt: '10:00:00',
      },
      {
        sceneId: 'gta6_vice_neon_3d',
        shortTitle: 'GTA VI Vice City',
        badge: 'GTA VI 4K',
        mode: 'manual',
        preset: 'ultra',
        resolution: '8k',
        avgFps: 68,
        low1PctFps: 54,
        low01PctFps: 45,
        avgFrameTimeMs: 14.7,
        stabilityPct: 91.2,
        verdict: 'GRYWALNE (60+)',
        durationSec: 15,
        completedAt: '10:01:00',
      },
    ];

    const summary = computeGameSuiteSummary(results);
    expect(summary.completedCount).toBe(2);
    expect(summary.avgFps).toBe(90);
    expect(summary.bestGameTitle).toBe('HYPERION');
    expect(summary.heaviestGameTitle).toBe('GTA VI Vice City');

    const tableHtml = renderGameSuiteResultsTableHtml(results);
    expect(tableHtml).toContain('<th>Rozdzielczość</th>');
    expect(tableHtml).toContain('>4K<');
    expect(tableHtml).toContain('>8K<');
    expect(tableHtml).toContain('🤖 Auto');
    expect(tableHtml).toContain('🎮 Ręczny');
  });
});
