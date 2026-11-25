import type {
  CpuTestResult,
  DiskTestResult,
  GameBenchMetrics,
  GpuStressMetrics,
  RamTestResult,
  SuiteScores,
  SystemSpecs,
} from '../types';
import { computeRamSummaryMetrics } from '../services/ramTest.service';
import { computeHardwarePowerIndex, hasAnyBenchmarkResults } from './pcSuitabilityAndGamesReport';

export interface PcRankingEntry {
  id: string;
  name: string;
  tierLabel: string;
  category:
    | 'Entuzjasta / Flagowy'
    | 'Gaming Pro'
    | 'Średnia Półka'
    | 'Laptop / Biuro'
    | 'Twój Zapisany PC'
    | 'Twój Aktualny PC';
  cpuSummary: string;
  gpuSummary: string;
  ramSummary?: string;
  diskSummary?: string;
  cpuScore: number;
  gpuScore: number;
  ramScore: number;
  diskScore: number;
  overallScore: number;
  testedCount?: number;
  isCurrentPc?: boolean;
  isUserSaved?: boolean;
  savedAt?: number;
}

export interface PcRankingSnapshot {
  currentEntry: PcRankingEntry;
  leaderboard: PcRankingEntry[];
  savedEntries: PcRankingEntry[];
  currentRank: number;
  totalRanked: number;
  percentileBetterThan: number;
  gapToLeader: number;
  leaderName: string;
  strongestComponent: string;
  bottleneckComponent: string;
  isBalancedHighEnd: boolean;
  tierBadge: string;
  hasRealMeasurements: boolean;
  testedCount: number;
}

export interface PcRankingInputContext {
  specs: SystemSpecs | null;
  scores: SuiteScores;
  cpu: CpuTestResult;
  ram: RamTestResult;
  disk: DiskTestResult;
  gpu: GpuStressMetrics;
  game: GameBenchMetrics;
}

const STORAGE_KEY = 'systempulse_pc_ranking_v1';
const MACHINE_ID_KEY = 'systempulse_machine_uid_v1';

let rankingBroadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof BroadcastChannel !== 'undefined') {
    rankingBroadcastChannel = new BroadcastChannel('systempulse_global_ranking_live');
  }
} catch {
  // BroadcastChannel optional
}

export function onGlobalRankingLiveUpdate(callback: () => void): void {
  if (!rankingBroadcastChannel) return;
  rankingBroadcastChannel.onmessage = () => {
    callback();
  };
}

function getPersistentMachineRankingId(): string {
  try {
    if (typeof localStorage !== 'undefined') {
      const existing = localStorage.getItem(MACHINE_ID_KEY);
      if (existing && existing.startsWith('live_pc_')) return existing;
      const created = `live_pc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      localStorage.setItem(MACHINE_ID_KEY, created);
      return created;
    }
  } catch {
    // ignore
  }
  return `live_pc_${Date.now()}`;
}

/**
 * Kept empty by default so that the ranking table NEVER mixes fictional/hardcoded
 * reference rows with real measured benchmark results.
 */
export const REFERENCE_PC_LEADERBOARD: PcRankingEntry[] = [];

function escHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function shortenGpuName(raw: string): string {
  const cleaned = raw
    .replace(/^ANGLE\s*\([^,]+,\s*/i, '')
    .replace(/\s*\(0x[0-9a-f]+\).*/i, '')
    .replace(/\s*Direct3D.*$/i, '')
    .replace(/\s*OpenGL.*$/i, '')
    .trim();
  return cleaned.length > 36 ? cleaned.slice(0, 33) + '...' : cleaned || 'GPU WebGL2';
}

function tierFromScore(score: number): string {
  if (score <= 0) return 'BRAK POMIARU';
  if (score >= 96) return 'S+ EKSTREMALNY';
  if (score >= 90) return 'S FLAGOWY';
  if (score >= 84) return 'A+ GAMING PRO';
  if (score >= 76) return 'A BARDZO DOBRY';
  if (score >= 66) return 'B ŚREDNIA PÓŁKA';
  if (score >= 52) return 'C MULTIMEDIA / BIURO';
  return 'D PODSTAWOWY';
}

export function loadSavedPcRankings(): PcRankingEntry[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is PcRankingEntry =>
          item &&
          typeof item.id === 'string' &&
          !item.id.startsWith('ref_') &&
          typeof item.name === 'string' &&
          typeof item.overallScore === 'number' &&
          item.overallScore > 0
      )
      .slice(0, 50);
  } catch {
    return [];
  }
}

export async function syncGlobalRankingsFromServer(): Promise<PcRankingEntry[]> {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') {
    return loadSavedPcRankings();
  }
  try {
    const res = await fetch('/api/global/rankings', {
      method: 'GET',
      cache: 'no-store',
    });
    if (!res.ok) return loadSavedPcRankings();
    const data = await res.json();
    if (!data || !Array.isArray(data.entries)) return loadSavedPcRankings();
    const localList = loadSavedPcRankings();
    const map = new Map<string, PcRankingEntry>();
    for (const item of localList) {
      map.set(item.id, item);
    }
    for (const srv of data.entries) {
      if (
        srv &&
        typeof srv.id === 'string' &&
        !srv.id.startsWith('ref_') &&
        typeof srv.name === 'string' &&
        typeof srv.overallScore === 'number' &&
        srv.overallScore > 0
      ) {
        map.set(srv.id, {
          ...srv,
          category: 'Twój Zapisany PC',
          isCurrentPc: false,
          isUserSaved: true,
        });
      }
    }
    const merged = Array.from(map.values())
      .sort((a, b) => b.overallScore - a.overallScore || (b.savedAt || 0) - (a.savedAt || 0))
      .slice(0, 50);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    }
    return merged;
  } catch {
    return loadSavedPcRankings();
  }
}

export async function publishPcRankingToGlobalServer(entry: PcRankingEntry): Promise<void> {
  if (!entry || entry.overallScore <= 0) return;
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return;
  try {
    await fetch('/api/global/rankings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    rankingBroadcastChannel?.postMessage({ type: 'ranking_updated', id: entry.id });
  } catch {
    // Offline fallback remains in localStorage
  }
}

export function clearAllSavedPcRankings(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
    if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
      void fetch('/api/global/rankings', { method: 'DELETE' }).catch(() => null);
    }
    rankingBroadcastChannel?.postMessage({ type: 'ranking_cleared' });
  } catch {
    // ignore
  }
}

export function savePcToRanking(entry: PcRankingEntry): PcRankingEntry[] {
  if (!entry || entry.overallScore <= 0) {
    return loadSavedPcRankings();
  }
  const list = loadSavedPcRankings();
  const normalized: PcRankingEntry = {
    ...entry,
    id: entry.id || `user_pc_${Date.now()}`,
    category: 'Twój Zapisany PC',
    isCurrentPc: false,
    isUserSaved: true,
    savedAt: entry.savedAt || Date.now(),
  };
  const next = [normalized, ...list.filter((x) => x.id !== normalized.id)].slice(0, 50);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  } catch {
    // ignore storage quota failures
  }
  void publishPcRankingToGlobalServer(normalized);
  return next;
}

export function autoPublishCurrentPcRankingIfTested(ctx: PcRankingInputContext): PcRankingEntry | null {
  const snap = computePcRankingSnapshot(ctx);
  if (!snap.hasRealMeasurements || snap.currentEntry.overallScore <= 0) return null;
  const machineId = getPersistentMachineRankingId();
  const shortGpu = shortenGpuName(ctx.specs?.gpuRenderer || ctx.gpu?.rendererName || 'PC');
  const cores = ctx.specs?.cpuCores || 8;
  const published: PcRankingEntry = {
    ...snap.currentEntry,
    id: machineId,
    name: `${shortGpu} · ${cores}T (Skan LIVE)`,
    category: 'Twój Zapisany PC',
    isCurrentPc: false,
    isUserSaved: true,
    savedAt: Date.now(),
  };
  savePcToRanking(published);
  return published;
}

export function deleteSavedPcFromRanking(id: string): PcRankingEntry[] {
  const next = loadSavedPcRankings().filter((x) => x.id !== id);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
    if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
      void fetch(`/api/global/rankings?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => null);
    }
    rankingBroadcastChannel?.postMessage({ type: 'ranking_deleted', id });
  } catch {
    // ignore
  }
  return next;
}

export function computePcRankingSnapshot(
  ctx: PcRankingInputContext,
  savedOverride?: PcRankingEntry[]
): PcRankingSnapshot {
  const hw = computeHardwarePowerIndex({
    specs: ctx.specs,
    cpu: ctx.cpu,
    ram: ctx.ram,
    disk: ctx.disk,
    gpu: ctx.gpu,
    game: ctx.game,
  });
  const hasReal = hasAnyBenchmarkResults({
    specs: ctx.specs,
    cpu: ctx.cpu,
    ram: ctx.ram,
    disk: ctx.disk,
    gpu: ctx.gpu,
    game: ctx.game,
  });

  const clamp100 = (n: number) => Math.max(10, Math.min(100, Math.round(n)));

  // Determine which subsystems actually have REAL measured benchmark results
  const cpuTested =
    (ctx.cpu?.multiCoreScore ?? 0) > 0 ||
    (ctx.cpu?.overallScore ?? 0) > 0 ||
    (ctx.scores?.cpu ?? 0) > 0;
  const gpuTested =
    (ctx.gpu?.avgFps ?? 0) > 0 ||
    (ctx.gpu?.overallScore ?? 0) > 0 ||
    (ctx.game?.avgFps ?? 0) > 0 ||
    (ctx.game?.overallScore ?? 0) > 0 ||
    (ctx.scores?.gpu ?? 0) > 0;
  const ramTested =
    (ctx.ram?.bandwidthReadMBs ?? 0) > 0 ||
    (ctx.ram?.overallScore ?? 0) > 0 ||
    (ctx.scores?.ram ?? 0) > 0;
  const diskTested =
    (ctx.disk?.seqReadMBs ?? 0) > 0 ||
    (ctx.disk?.overallScore ?? 0) > 0 ||
    (ctx.scores?.disk ?? 0) > 0;

  // Recompute calibrated DDR4/DDR5 RAM score from real measured throughput & latency if available
  const recalcRamScore =
    (ctx.ram?.bandwidthReadMBs ?? 0) > 0 && (ctx.ram?.bandwidthWriteMBs ?? 0) > 0
      ? computeRamSummaryMetrics({
          bandwidthReadMBs: ctx.ram.bandwidthReadMBs,
          bandwidthWriteMBs: ctx.ram.bandwidthWriteMBs,
          latencyNs: ctx.ram.latencyNs || 18,
          errorsFound: ctx.ram.errorsFound || 0,
        }).overallScore
      : 0;

  // NEVER invent scores for untested components: untested = 0
  const cpuScore = cpuTested
    ? clamp100(ctx.scores.cpu > 0 ? ctx.scores.cpu : ctx.cpu?.overallScore > 0 ? ctx.cpu.overallScore : hw.cpuScore)
    : 0;
  const gpuRawMeasured = Math.max(
    ctx.scores.gpu || 0,
    ctx.gpu?.overallScore || 0,
    ctx.game?.overallScore || 0
  );
  const gpuScore = gpuTested
    ? clamp100(gpuRawMeasured > 0 ? gpuRawMeasured : hw.gpuScore)
    : 0;
  const ramRawMeasured = Math.max(
    ctx.scores.ram || 0,
    ctx.ram?.overallScore || 0,
    recalcRamScore
  );
  const ramScore = ramTested
    ? clamp100(ramRawMeasured > 0 ? ramRawMeasured : hw.ramScore)
    : 0;
  const diskRawMeasured = Math.max(ctx.scores.disk || 0, ctx.disk?.overallScore || 0);
  const diskScore = diskTested
    ? clamp100(diskRawMeasured > 0 ? diskRawMeasured : hw.diskScore)
    : 0;

  // Weighted overall score strictly from ACTUALLY TESTED subsystems
  const weightedComponents: Array<{ score: number; weight: number }> = [];
  if (gpuScore > 0) weightedComponents.push({ score: gpuScore, weight: 0.38 });
  if (cpuScore > 0) weightedComponents.push({ score: cpuScore, weight: 0.32 });
  if (ramScore > 0) weightedComponents.push({ score: ramScore, weight: 0.16 });
  if (diskScore > 0) weightedComponents.push({ score: diskScore, weight: 0.14 });

  const totalWeight = weightedComponents.reduce((sum, item) => sum + item.weight, 0);
  const overallScore =
    totalWeight > 0
      ? clamp100(
          weightedComponents.reduce((sum, item) => sum + item.score * item.weight, 0) / totalWeight
        )
      : 0;

  const testedCount = weightedComponents.length;
  const shortGpu = shortenGpuName(hw.gpuLabel);

  const cpuSummary = cpuTested
    ? `${hw.cpuCores} wątków${ctx.cpu.multiCoreScore > 0 ? ` · Multi: ${ctx.cpu.multiCoreScore.toLocaleString('pl-PL')} pkt` : ''}${ctx.cpu.singleCoreScore > 0 ? ` · Single: ${ctx.cpu.singleCoreScore.toLocaleString('pl-PL')} pkt` : ''}`
    : `${hw.cpuCores} wątków (CPU: brak testu)`;

  const low1Fps = Math.max(ctx.gpu?.low1PctFps || 0, ctx.game?.low1PctFps || 0);
  const safeLow1 = hw.benchGpuFps > 0 && low1Fps > 0 ? Math.min(hw.benchGpuFps, low1Fps) : 0;
  const gpuSummary = gpuTested
    ? `${shortGpu}${hw.benchGpuFps > 0 ? ` · ${hw.benchGpuFps} FPS${safeLow1 > 0 ? ` (1% Low: ${safeLow1} FPS)` : ''}` : ''}`
    : `${shortGpu} (GPU: brak testu)`;

  const ramSummary = ramTested
    ? ctx.ram?.bandwidthReadMBs > 0
      ? `RAM: ${ctx.ram.bandwidthReadMBs}/${ctx.ram.bandwidthWriteMBs} MB/s · ${ctx.ram.latencyNs} ns · ${ctx.ram.errorsFound} błędów`
      : `RAM: ${ramScore}/100 pkt`
    : 'RAM: brak testu';

  const diskSummary = diskTested
    ? ctx.disk?.seqReadMBs > 0
      ? `Dysk: ${ctx.disk.seqReadMBs}/${ctx.disk.seqWriteMBs} MB/s · SMART ${ctx.disk.smartHealthPct}%`
      : `Dysk: ${diskScore}/100 pkt`
    : 'Dysk: brak testu';

  const currentEntry: PcRankingEntry = {
    id: 'current_pc',
    name: `TWÓJ KOMPUTER (${shortGpu} · ${hw.cpuCores}T)`,
    tierLabel: tierFromScore(overallScore),
    category: 'Twój Aktualny PC',
    cpuSummary,
    gpuSummary,
    ramSummary,
    diskSummary,
    cpuScore,
    gpuScore,
    ramScore,
    diskScore,
    overallScore,
    testedCount,
    isCurrentPc: true,
  };

  const savedEntries = savedOverride ?? loadSavedPcRankings();
  const ownMachineId = getPersistentMachineRankingId();
  // Filter out the auto-published duplicate of the current live machine when currentEntry is already active
  const filteredSaved = overallScore > 0
    ? savedEntries.filter((e) => e.id !== ownMachineId)
    : savedEntries;

  // ONLY real measured entries in the leaderboard — no invented reference machines
  const combined: PcRankingEntry[] = [
    ...(overallScore > 0 ? [currentEntry] : []),
    ...filteredSaved.map((e) => ({ ...e, isCurrentPc: false, isUserSaved: true })),
  ].sort((a, b) => {
    if (b.overallScore !== a.overallScore) return b.overallScore - a.overallScore;
    if (b.gpuScore !== a.gpuScore) return b.gpuScore - a.gpuScore;
    return a.isCurrentPc ? -1 : b.isCurrentPc ? 1 : 0;
  });

  if (combined.length === 0) {
    combined.push(currentEntry);
  }

  const currentIdx = combined.findIndex((e) => e.isCurrentPc);
  const currentRank = currentIdx >= 0 ? currentIdx + 1 : 1;
  const totalRanked = combined.length;
  const belowCount = Math.max(0, totalRanked - currentRank);
  const percentileBetterThan =
    totalRanked > 1
      ? Math.round((belowCount / (totalRanked - 1)) * 100)
      : overallScore > 0
        ? Math.min(99, Math.max(10, overallScore))
        : 0;

  const leader = combined[0] ?? currentEntry;
  const gapToLeader = Math.max(0, leader.overallScore - overallScore);

  const testedParts: Array<{ key: string; name: string; score: number }> = [];
  if (cpuScore > 0) testedParts.push({ key: 'cpu', name: `Procesor CPU (${cpuScore}/100)`, score: cpuScore });
  if (gpuScore > 0) testedParts.push({ key: 'gpu', name: `Grafika GPU 3D (${gpuScore}/100)`, score: gpuScore });
  if (diskScore > 0) testedParts.push({ key: 'disk', name: `Dysk SSD/NVMe (${diskScore}/100)`, score: diskScore });
  if (ramScore > 0) testedParts.push({ key: 'ram', name: `Pamięć RAM (${ramScore}/100)`, score: ramScore });

  const sortedParts = [...testedParts].sort((a, b) => b.score - a.score);
  const strongestComponent =
    sortedParts.length > 0 ? sortedParts[0].name : 'Brak pomiaru (uruchom test)';

  const lowestPart = sortedParts.length > 0 ? sortedParts[sortedParts.length - 1] : null;
  const hasRamErrors = (ctx.ram?.errorsFound ?? 0) > 0;
  const isBalancedHighEnd =
    lowestPart !== null && lowestPart.score >= 82 && !hasRamErrors;

  const bottleneckComponent =
    lowestPart === null
      ? 'Brak pomiaru (uruchom test)'
      : isBalancedHighEnd
        ? `Brak — pełny balans (${lowestPart.name} · 100% sprawny)`
        : lowestPart.name;

  return {
    currentEntry,
    leaderboard: combined,
    savedEntries,
    currentRank,
    totalRanked,
    percentileBetterThan,
    gapToLeader,
    leaderName: leader.name,
    strongestComponent,
    bottleneckComponent,
    isBalancedHighEnd,
    tierBadge: tierFromScore(overallScore),
    hasRealMeasurements: hasReal && overallScore > 0,
    testedCount,
  };
}

let rankingFilter: 'all' | 'saved_only' = 'all';
let saveNotice: string | null = null;

function formatScoreCell(score: number): string {
  return score > 0
    ? `<strong style="color:#f8fafc;">${score}</strong>`
    : `<span style="color:#64748b;" title="Nie wykonano jeszcze testu tego podzespołu">—</span>`;
}

export function renderPcRankingSectionHtml(ctx: PcRankingInputContext): string {
  const snap = computePcRankingSnapshot(ctx);

  // When no real tests have been executed yet and there are no saved tested PCs, never show made-up numbers
  if (!snap.hasRealMeasurements && snap.savedEntries.length === 0) {
    const shortGpu = shortenGpuName(ctx.specs?.gpuRenderer || ctx.gpu?.rendererName || 'GPU WebGL2');
    const cores = ctx.specs?.cpuCores || 8;
    return `
      <section class="sp-panel sp-ranking-panel" id="sp-pc-ranking-section">
        <div class="sp-panel-head">
          <div>
            <span class="sp-eyebrow">GLOBALNY RANKING LIVE · TYLKO RZECZYWISTE POMIARY BENCHMARKOWE</span>
            <h3>🏆 Globalny Ranking Przetestowanych Komputerów LIVE — Wymagany pomiar</h3>
            <p class="sp-muted">
              Ranking prezentuje wyłącznie <strong>prawdziwe, zmierzone wyniki</strong> po wykonaniu testów wydajności i automatycznie synchronizuje je między wszystkimi użytkownikami aplikacji.
              Wykryto Twój sprzęt: <strong>${escHtml(shortGpu)} · ${cores} wątków CPU</strong> — uruchom test, aby Twój wynik automatycznie wskoczył do globalnego rankingu.
            </p>
          </div>
        </div>
        <div class="sp-ranking-kpi-grid" style="display:none;"></div>
        <div class="sp-ranking-table-wrap" style="padding:18px;text-align:center;">
          <p style="margin:0 0 12px;color:#94a3b8;font-size:13px;">
            Brak wykonanych testów w bieżącej sesji. Kliknij poniższy przycisk, aby przeprowadzić prawdziwy pomiar CPU, RAM, Dysku i GPU 3D lub zsynchronizować wyniki z serwera LIVE.
          </p>
          <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
            <button type="button" class="btn btn-primary" data-run-full-suite="true" style="padding:10px 20px;font-weight:700;">
              🚀 Uruchom Pełny Test PC (Zmierz i wyślij wynik LIVE)
            </button>
            <button type="button" class="btn btn-secondary" id="sp-ranking-sync-global-btn" style="padding:10px 18px;font-weight:700;">
              🌍 Synchronizuj wyniki LIVE ze świata
            </button>
          </div>
        </div>
      </section>
    `;
  }

  const rows =
    rankingFilter === 'saved_only' && snap.savedEntries.length > 0
      ? snap.leaderboard.filter((e) => e.isUserSaved || e.isCurrentPc)
      : snap.leaderboard;

  const defaultLabel = `${shortenGpuName(ctx.specs?.gpuRenderer || ctx.gpu?.rendererName || 'PC')} (${ctx.specs?.cpuCores || 8}T)`;

  const bottleneckColor = snap.isBalancedHighEnd ? '#34d399' : '#fbbf24';
  const bottleneckSub = snap.isBalancedHighEnd
    ? 'Wszystkie podzespoły pracują wzorowo — brak potrzeby wymiany'
    : snap.testedCount < 4
      ? `Przetestowano ${snap.testedCount}/4 podzespołów — uruchom pozostałe testy`
      : 'Element o najniższym wyniku w tej konfiguracji';

  return `
    <section class="sp-panel sp-ranking-panel" id="sp-pc-ranking-section">
      <div class="sp-panel-head">
        <div>
          <span class="sp-eyebrow">GLOBALNY RANKING PRZETESTOWANYCH KOMPUTERÓW LIVE · 100% RZECZYWISTE WYNIKI Z TESTÓW (${snap.testedCount}/4 PODZESPOŁÓW)</span>
          <h3>🏆 Globalny Ranking Komputerów LIVE — Pozycja #${snap.currentRank} z ${snap.totalRanked} (${snap.totalRanked > 1 ? `Lepszy niż ${snap.percentileBetterThan}% przetestowanych PC` : `Wynik pomiaru: ${snap.currentEntry.overallScore}/100 pkt`})</h3>
          <p class="sp-muted">
            Każdy wykonany skan i test automatycznie wskakuje do <strong>Globalnej Bazy LIVE</strong> widocznej u wszystkich użytkowników aplikacji. Nieprzetestowane podzespoły są oznaczane jako „—”.
          </p>
        </div>
        <div class="sp-ranking-controls">
          <div class="sp-games-filter-bar">
            <button type="button" class="sp-filter-btn ${rankingFilter === 'all' ? 'active' : ''}" data-rank-filter="all">
              Wszystkie Przetestowane (${snap.totalRanked})
            </button>
            <button type="button" class="sp-filter-btn ${rankingFilter === 'saved_only' ? 'active' : ''}" data-rank-filter="saved_only">
              Zapisane w Bazie (${snap.savedEntries.length})
            </button>
          </div>
        </div>
      </div>

      <!-- KPI podsumowanie pozycji z realnych pomiarów -->
      <div class="sp-ranking-kpi-grid">
        <div class="sp-ranking-kpi">
          <span class="sp-ranking-kpi-lbl">Miejsce w Rankingu</span>
          <strong class="sp-ranking-kpi-val status-cyan">#${snap.currentRank} / ${snap.totalRanked}</strong>
          <span class="sp-ranking-kpi-sub">Klasa pomiaru: ${escHtml(snap.tierBadge)}</span>
        </div>
        <div class="sp-ranking-kpi">
          <span class="sp-ranking-kpi-lbl">Zmierzony Indeks Ogólny</span>
          <strong class="sp-ranking-kpi-val status-ok">${snap.currentEntry.overallScore}/100 pkt</strong>
          <span class="sp-ranking-kpi-sub">Wykonane testy: ${snap.testedCount}/4 podzespołów</span>
        </div>
        <div class="sp-ranking-kpi">
          <span class="sp-ranking-kpi-lbl">Najmocniejszy przetestowany element</span>
          <strong class="sp-ranking-kpi-val" style="font-size:13.5px;color:#34d399;">${escHtml(snap.strongestComponent)}</strong>
          <span class="sp-ranking-kpi-sub">${snap.gapToLeader === 0 ? 'LIDER RANKINGU (#1)!' : `Strata do #1: -${snap.gapToLeader} pkt`}</span>
        </div>
        <div class="sp-ranking-kpi">
          <span class="sp-ranking-kpi-lbl">Balans Konfiguracji / Diagnoza</span>
          <strong class="sp-ranking-kpi-val" style="font-size:13.5px;color:${bottleneckColor};">${escHtml(snap.bottleneckComponent)}</strong>
          <span class="sp-ranking-kpi-sub">${escHtml(bottleneckSub)}</span>
        </div>
      </div>

      <!-- Szczegółowe potwierdzenie rzeczywistych pomiarów sprzętowych 4 podzespołów -->
      <div class="sp-ranking-kpi-grid" style="margin-top:10px;">
        <div class="sp-ranking-kpi" style="border-left:3px solid ${snap.currentEntry.cpuScore > 0 ? '#38bdf8' : '#475569'};">
          <span class="sp-ranking-kpi-lbl">1. Pomiar Procesora (CPU)</span>
          <strong class="sp-ranking-kpi-val" style="font-size:13.5px;color:${snap.currentEntry.cpuScore > 0 ? '#38bdf8' : '#64748b'};">
            ${snap.currentEntry.cpuScore > 0 ? `${snap.currentEntry.cpuScore}/100 pkt · ${escHtml(ctx.cpu.grade)}` : 'Brak pomiaru CPU'}
          </strong>
          <span class="sp-ranking-kpi-sub">
            ${
              ctx.cpu.multiCoreScore > 0
                ? `Multi: ${ctx.cpu.multiCoreScore.toLocaleString('pl-PL')} pkt · Single: ${ctx.cpu.singleCoreScore.toLocaleString('pl-PL')} pkt (${ctx.cpu.scalingRatio}x) · SHA-256: ${ctx.cpu.cryptoSha256MBs} MB/s`
                : 'Uruchom test CPU, aby zmierzyć punkty wielowątkowe'
            }
          </span>
        </div>
        <div class="sp-ranking-kpi" style="border-left:3px solid ${snap.currentEntry.gpuScore > 0 ? '#34d399' : '#475569'};">
          <span class="sp-ranking-kpi-lbl">2. Pomiar Grafiki 3D (GPU)</span>
          <strong class="sp-ranking-kpi-val" style="font-size:13.5px;color:${snap.currentEntry.gpuScore > 0 ? '#34d399' : '#64748b'};">
            ${snap.currentEntry.gpuScore > 0 ? `${snap.currentEntry.gpuScore}/100 pkt · ${Math.max(ctx.gpu.avgFps || 0, ctx.game.avgFps || 0)} FPS` : 'Brak pomiaru GPU 3D'}
          </strong>
          <span class="sp-ranking-kpi-sub">
            ${
              snap.currentEntry.gpuScore > 0
                ? `1% Low: ${Math.min(Math.max(ctx.gpu.avgFps || 0, ctx.game.avgFps || 0), Math.max(ctx.gpu.low1PctFps || 0, ctx.game.low1PctFps || 0))} FPS · Frametime: ${ctx.gpu.frameTimeMs || ctx.game.frameTimeMs || 0} ms · Stab. ${ctx.gpu.stabilityPct || ctx.game.stabilityPct || 0}%`
                : 'Uruchom test GPU 3D lub Gra 3D MAX, aby zmierzyć FPS'
            }
          </span>
        </div>
        <div class="sp-ranking-kpi" style="border-left:3px solid ${snap.currentEntry.ramScore > 0 ? '#a78bfa' : '#475569'};">
          <span class="sp-ranking-kpi-lbl">3. Pomiar Pamięci RAM</span>
          <strong class="sp-ranking-kpi-val" style="font-size:13.5px;color:${snap.currentEntry.ramScore > 0 ? '#a78bfa' : '#64748b'};">
            ${snap.currentEntry.ramScore > 0 ? `${snap.currentEntry.ramScore}/100 pkt · ${ctx.ram.errorsFound} błędów (${escHtml(ctx.ram.healthGrade)})` : 'Brak pomiaru RAM'}
          </strong>
          <span class="sp-ranking-kpi-sub">
            ${
              ctx.ram.bandwidthReadMBs > 0
                ? `Odczyt: ${ctx.ram.bandwidthReadMBs.toLocaleString('pl-PL')} MB/s · Zapis: ${ctx.ram.bandwidthWriteMBs.toLocaleString('pl-PL')} MB/s · Opóźnienie: ${ctx.ram.latencyNs} ns`
                : 'Uruchom 18-etapowy test RAM, aby zmierzyć przepustowość MB/s'
            }
          </span>
        </div>
        <div class="sp-ranking-kpi" style="border-left:3px solid ${snap.currentEntry.diskScore > 0 ? '#fbbf24' : '#475569'};">
          <span class="sp-ranking-kpi-lbl">4. Pomiar Dysku SSD / NVMe</span>
          <strong class="sp-ranking-kpi-val" style="font-size:13.5px;color:${snap.currentEntry.diskScore > 0 ? '#fbbf24' : '#64748b'};">
            ${snap.currentEntry.diskScore > 0 ? `${snap.currentEntry.diskScore}/100 pkt · SMART ${ctx.disk.smartStatus} (${ctx.disk.smartHealthPct}%)` : 'Brak pomiaru Dysku'}
          </strong>
          <span class="sp-ranking-kpi-sub">
            ${
              ctx.disk.seqReadMBs > 0
                ? `Seq: ${ctx.disk.seqReadMBs}/${ctx.disk.seqWriteMBs} MB/s · 4K: ${ctx.disk.rand4kIops} IOPS · Dostęp: ${ctx.disk.accessTimeAvgMs} ms`
                : 'Uruchom test Dysku, aby zmierzyć transfery I/O i SMART'
            }
          </span>
        </div>
      </div>

      <!-- Zapisz, opublikuj LIVE lub wyeksportuj/zaimportuj aktualnie przetestowany komputer -->
      <div class="sp-ranking-save-bar" style="flex-wrap:wrap;gap:8px;">
        <input
          type="text"
          id="sp-ranking-pc-name"
          class="input-text"
          placeholder="Nazwa przetestowanego komputera (np. PC Klienta #1, Stacja RX 7900 XTX...)"
          value="${escHtml(defaultLabel)}"
          style="flex:1;min-width:220px;"
        />
        <button type="button" class="btn btn-primary btn-sm" id="sp-ranking-save-btn" ${snap.hasRealMeasurements ? '' : 'disabled'}>
          🌍 Zapisz i Opublikuj Wynik LIVE
        </button>
        <button type="button" class="btn btn-secondary btn-sm" id="sp-ranking-sync-global-btn" title="Pobierz najnowsze wyniki przetestowanych komputerów z serwera globalnego">
          🔄 Synchronizuj LIVE ze świata
        </button>
        <button type="button" class="btn btn-secondary btn-sm" id="sp-ranking-export-json-btn" ${snap.hasRealMeasurements ? '' : 'disabled'} title="Pobierz plik .JSON z prawdziwym wynikiem testu tego komputera">
          📤 Eksportuj (.JSON)
        </button>
        <label class="btn btn-secondary btn-sm" style="cursor:pointer;margin:0;" title="Wczytaj plik .JSON z wynikiem testu innego komputera, aby porównać w rankingu">
          📥 Importuj (.JSON)
          <input type="file" id="sp-ranking-import-json-input" accept=".json,application/json" style="display:none;" />
        </label>
        ${
          snap.savedEntries.length > 0
            ? `<button type="button" class="btn btn-secondary btn-sm" id="sp-ranking-clear-all-btn" title="Usuń wszystkie zapisane wcześniej pozycje">🗑️ Wyczyść zapisane (${snap.savedEntries.length})</button>`
            : ''
        }
      </div>
      ${saveNotice ? `<div class="sp-scheme-feedback">${escHtml(saveNotice)}</div>` : ''}

      <!-- Tabela rankingu z prawdziwymi pomiarami -->
      <div class="sp-ranking-table-wrap">
        <table class="sp-ranking-table">
          <thead>
            <tr>
              <th style="width:52px;">Poz.</th>
              <th>Przetestowany Komputer / Rzeczywiste Pomiary</th>
              <th style="width:74px;">CPU</th>
              <th style="width:74px;">GPU</th>
              <th style="width:74px;">RAM</th>
              <th style="width:74px;">Dysk</th>
              <th style="width:170px;">Wynik z Testów</th>
              <th style="width:46px;"></th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map((entry, idx) => {
                const pos = idx + 1;
                const medal = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : `#${pos}`;
                const rowCls = entry.isCurrentPc
                  ? 'sp-rank-row sp-rank-row--current'
                  : entry.isUserSaved
                    ? 'sp-rank-row sp-rank-row--saved'
                    : 'sp-rank-row';
                const barFillCls =
                  entry.overallScore >= 85
                    ? 'sp-rank-bar-fill--top'
                    : entry.overallScore >= 65
                      ? 'sp-rank-bar-fill--mid'
                      : 'sp-rank-bar-fill--low';
                const tagHtml = entry.isCurrentPc
                  ? '<span class="sp-rank-tag sp-rank-tag--current">TWÓJ WYNIK LIVE</span>'
                  : entry.isUserSaved
                    ? '<span class="sp-rank-tag sp-rank-tag--saved">WYNIK LIVE / ZAPISANY</span>'
                    : `<span class="sp-rank-tag">${escHtml(entry.tierLabel)}</span>`;
                const extraDetails = [entry.gpuSummary, entry.cpuSummary, entry.ramSummary, entry.diskSummary]
                  .filter(Boolean)
                  .join(' · ');
                return `
                  <tr class="${rowCls}">
                    <td class="font-mono" style="font-weight:800;text-align:center;">${medal}</td>
                    <td>
                      <div class="sp-rank-name-cell">
                        <strong>${escHtml(entry.name)}</strong>
                        ${tagHtml}
                      </div>
                      <div class="sp-rank-sub">${escHtml(extraDetails)}</div>
                    </td>
                    <td class="font-mono">${formatScoreCell(entry.cpuScore)}</td>
                    <td class="font-mono">${formatScoreCell(entry.gpuScore)}</td>
                    <td class="font-mono">${formatScoreCell(entry.ramScore)}</td>
                    <td class="font-mono">${formatScoreCell(entry.diskScore)}</td>
                    <td>
                      <div class="sp-rank-score-cell">
                        <div class="sp-rank-bar-track">
                          <div class="sp-rank-bar-fill ${barFillCls}" style="width:${entry.overallScore}%"></div>
                        </div>
                        <strong class="font-mono">${entry.overallScore > 0 ? `${entry.overallScore}/100` : 'Brak'}</strong>
                      </div>
                    </td>
                    <td style="text-align:right;">
                      ${
                        entry.isUserSaved
                          ? `<button type="button" class="btn btn-secondary btn-sm" data-rank-delete="${escHtml(entry.id)}" title="Usuń zapisany wynik z rankingu" style="padding:2px 7px;font-size:11px;">✕</button>`
                          : ''
                      }
                    </td>
                  </tr>
                `;
              })
              .join('')}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

export function bindPcRankingSectionEvents(
  root: HTMLElement,
  ctx: PcRankingInputContext,
  rerender: () => void
): void {
  root.querySelectorAll<HTMLButtonElement>('[data-rank-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      rankingFilter = btn.dataset.rankFilter === 'saved_only' ? 'saved_only' : 'all';
      rerender();
    });
  });

  const syncBtn = root.querySelector<HTMLButtonElement>('#sp-ranking-sync-global-btn');
  syncBtn?.addEventListener('click', async () => {
    saveNotice = '⏳ Synchronizowanie globalnego rankingu LIVE z serwerem...';
    rerender();
    const list = await syncGlobalRankingsFromServer();
    saveNotice = `✓ Zsynchronizowano bazę LIVE (${list.length} przetestowanych komputerów w bazie globalnej).`;
    rerender();
  });

  const saveBtn = root.querySelector<HTMLButtonElement>('#sp-ranking-save-btn');
  saveBtn?.addEventListener('click', () => {
    const snap = computePcRankingSnapshot(ctx);
    if (!snap.hasRealMeasurements || snap.currentEntry.overallScore <= 0) {
      saveNotice = '⚠️ Uruchom najpierw test wydajności (np. Pełny Test PC), aby zapisać prawdziwy zmierzony wynik.';
      rerender();
      return;
    }
    const input = root.querySelector<HTMLInputElement>('#sp-ranking-pc-name');
    const customName = input?.value.trim() || 'Przetestowany PC';
    savePcToRanking({
      ...snap.currentEntry,
      id: `saved_${Date.now()}`,
      name: customName,
      isCurrentPc: false,
      isUserSaved: true,
      savedAt: Date.now(),
    });
    saveNotice = `✓ Zapisano i opublikowano LIVE wynik „${customName}” (${snap.currentEntry.overallScore}/100 pkt) w globalnym rankingu.`;
    rerender();
  });

  const exportBtn = root.querySelector<HTMLButtonElement>('#sp-ranking-export-json-btn');
  exportBtn?.addEventListener('click', () => {
    const snap = computePcRankingSnapshot(ctx);
    if (!snap.hasRealMeasurements || snap.currentEntry.overallScore <= 0) return;
    const input = root.querySelector<HTMLInputElement>('#sp-ranking-pc-name');
    const customName = input?.value.trim() || snap.currentEntry.name;
    const exportPayload: PcRankingEntry = {
      ...snap.currentEntry,
      id: `imported_${Date.now()}`,
      name: customName,
      category: 'Twój Zapisany PC',
      isCurrentPc: false,
      isUserSaved: true,
      savedAt: Date.now(),
    };
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `systempulse-wynik-pc-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    saveNotice = `✓ Wyeksportowano prawdziwy wynik testu „${customName}” do pliku JSON.`;
    rerender();
  });

  const importInput = root.querySelector<HTMLInputElement>('#sp-ranking-import-json-input');
  importInput?.addEventListener('change', async () => {
    const file = importInput.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const candidates: PcRankingEntry[] = Array.isArray(parsed) ? parsed : [parsed];
      let importedCount = 0;
      for (const item of candidates) {
        if (item && typeof item.name === 'string' && typeof item.overallScore === 'number' && item.overallScore > 0) {
          savePcToRanking({
            ...item,
            id: item.id && !item.id.startsWith('ref_') ? item.id : `imported_${Date.now()}_${importedCount}`,
            isCurrentPc: false,
            isUserSaved: true,
            savedAt: item.savedAt || Date.now(),
          });
          importedCount++;
        }
      }
      saveNotice =
        importedCount > 0
          ? `✓ Zaimportowano i opublikowano LIVE ${importedCount} przetestowany(ch) komputer(ów) do rankingu.`
          : '⚠️ Plik JSON nie zawierał prawidłowego wyniku testu.';
    } catch {
      saveNotice = '⚠️ Nie udało się odczytać pliku JSON z wynikiem testu.';
    }
    importInput.value = '';
    rerender();
  });

  const clearAllBtn = root.querySelector<HTMLButtonElement>('#sp-ranking-clear-all-btn');
  clearAllBtn?.addEventListener('click', () => {
    clearAllSavedPcRankings();
    saveNotice = 'Wyczyszczono wszystkie wcześniej zapisane pozycje z rankingu.';
    rerender();
  });

  root.querySelectorAll<HTMLButtonElement>('[data-rank-delete]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.rankDelete;
      if (id) {
        deleteSavedPcFromRanking(id);
        saveNotice = 'Usunięto zapisany wynik z rankingu.';
        rerender();
      }
    });
  });
}
