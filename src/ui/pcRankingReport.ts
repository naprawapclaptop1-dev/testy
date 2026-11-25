import type {
  CpuTestResult,
  DiskTestResult,
  GameBenchMetrics,
  GpuStressMetrics,
  RamTestResult,
  SuiteScores,
  SystemSpecs,
} from '../types';
import { computeHardwarePowerIndex, hasAnyBenchmarkResults } from './pcSuitabilityAndGamesReport';

export interface PcRankingEntry {
  id: string;
  name: string;
  tierLabel: string;
  category: 'Entuzjasta / Flagowy' | 'Gaming Pro' | 'Średnia Półka' | 'Laptop / Biuro' | 'Twój Zapisany PC' | 'Twój Aktualny PC';
  cpuSummary: string;
  gpuSummary: string;
  cpuScore: number;
  gpuScore: number;
  ramScore: number;
  diskScore: number;
  overallScore: number;
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
  tierBadge: string;
  hasRealMeasurements: boolean;
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

export const REFERENCE_PC_LEADERBOARD: PcRankingEntry[] = [
  {
    id: 'ref_5090_9950x3d',
    name: 'Stacja Flagowa Ultra (RTX 5090 + Ryzen 9 9950X3D)',
    tierLabel: 'S+ EKSTREMALNY',
    category: 'Entuzjasta / Flagowy',
    cpuSummary: '32 wątki · DDR5-6400',
    gpuSummary: 'RTX 5090 32 GB',
    cpuScore: 99,
    gpuScore: 100,
    ramScore: 98,
    diskScore: 99,
    overallScore: 99,
  },
  {
    id: 'ref_4090_7950x3d',
    name: 'High-End Entuzjasta (RTX 4090 / RX 7900 XTX + 16C/32T)',
    tierLabel: 'S FLAGOWY',
    category: 'Entuzjasta / Flagowy',
    cpuSummary: '32 wątki · DDR5-6000',
    gpuSummary: 'RTX 4090 / RX 7900 XTX 24 GB',
    cpuScore: 95,
    gpuScore: 96,
    ramScore: 93,
    diskScore: 95,
    overallScore: 95,
  },
  {
    id: 'ref_4080s_7800x3d',
    name: 'Gaming 4K Pro (RTX 4080 Super / RX 9070 XT + 7800X3D)',
    tierLabel: 'S GAMING 4K',
    category: 'Entuzjasta / Flagowy',
    cpuSummary: '16 wątków · DDR5-6000',
    gpuSummary: 'RTX 4080S / RX 9070 XT 16 GB',
    cpuScore: 90,
    gpuScore: 92,
    ramScore: 89,
    diskScore: 92,
    overallScore: 91,
  },
  {
    id: 'ref_4070tis_14700k',
    name: 'Gaming 1440p Ultra (RTX 4070 Ti Super / RX 7900 XT + i7)',
    tierLabel: 'A+ WYSOKA KLASA',
    category: 'Gaming Pro',
    cpuSummary: '24–28 wątków · DDR5',
    gpuSummary: 'RTX 4070 TiS / RX 7900 XT',
    cpuScore: 88,
    gpuScore: 86,
    ramScore: 85,
    diskScore: 88,
    overallScore: 87,
  },
  {
    id: 'ref_4070_7800xt',
    name: 'Gaming 1440p High (RTX 4070 / RX 7800 XT + Ryzen 7)',
    tierLabel: 'A BARDZO DOBRY',
    category: 'Gaming Pro',
    cpuSummary: '16 wątków · DDR5/DDR4',
    gpuSummary: 'RTX 4070 / RX 7800 XT',
    cpuScore: 81,
    gpuScore: 80,
    ramScore: 80,
    diskScore: 84,
    overallScore: 81,
  },
  {
    id: 'ref_laptop_rtx4070',
    name: 'Laptop Gamingowy Pro (RTX 4070 Mobile + Core i7 / Ryzen 9)',
    tierLabel: 'A LAPTOP GAMING',
    category: 'Gaming Pro',
    cpuSummary: '16–20 wątków Mobile',
    gpuSummary: 'RTX 4070 Laptop 8 GB',
    cpuScore: 78,
    gpuScore: 74,
    ramScore: 76,
    diskScore: 82,
    overallScore: 77,
  },
  {
    id: 'ref_4060_7600',
    name: 'PC Średnia Półka 1080p (RTX 4060 / RX 7600 + Ryzen 5)',
    tierLabel: 'B+ POPULARNY',
    category: 'Średnia Półka',
    cpuSummary: '12 wątków · DDR4/DDR5',
    gpuSummary: 'RTX 4060 / RX 7600 8 GB',
    cpuScore: 72,
    gpuScore: 68,
    ramScore: 72,
    diskScore: 78,
    overallScore: 71,
  },
  {
    id: 'ref_3060_i5',
    name: 'Uniwersalny PC 1080p (RTX 3060 / RX 6600 + i5-12400F)',
    tierLabel: 'B STANDARD',
    category: 'Średnia Półka',
    cpuSummary: '12 wątków · DDR4-3200',
    gpuSummary: 'RTX 3060 / RX 6600',
    cpuScore: 66,
    gpuScore: 62,
    ramScore: 68,
    diskScore: 74,
    overallScore: 66,
  },
  {
    id: 'ref_laptop_1650_780m',
    name: 'Laptop Multimedialny (GTX 1650 / Radeon 780M + 16 GB)',
    tierLabel: 'C+ MULTIMEDIA',
    category: 'Laptop / Biuro',
    cpuSummary: '8–16 wątków · LPDDR5',
    gpuSummary: 'GTX 1650 / Radeon 780M',
    cpuScore: 58,
    gpuScore: 48,
    ramScore: 62,
    diskScore: 70,
    overallScore: 56,
  },
  {
    id: 'ref_office_iris',
    name: 'Laptop Biurowy Nowoczesny (Intel Iris Xe / Core i5 U)',
    tierLabel: 'C BIUROWY',
    category: 'Laptop / Biuro',
    cpuSummary: '8–12 wątków ULV',
    gpuSummary: 'Intel Iris Xe (iGPU)',
    cpuScore: 52,
    gpuScore: 34,
    ramScore: 56,
    diskScore: 66,
    overallScore: 48,
  },
  {
    id: 'ref_budget_uhd',
    name: 'Laptop Budżetowy / Starszy PC (Intel UHD 620 / 4 wątki)',
    tierLabel: 'D PODSTAWOWY',
    category: 'Laptop / Biuro',
    cpuSummary: '4 wątki · 8 GB RAM',
    gpuSummary: 'Intel UHD Graphics',
    cpuScore: 34,
    gpuScore: 22,
    ramScore: 44,
    diskScore: 48,
    overallScore: 34,
  },
];

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
          typeof item.name === 'string' &&
          typeof item.overallScore === 'number'
      )
      .slice(0, 25);
  } catch {
    return [];
  }
}

export function savePcToRanking(entry: PcRankingEntry): PcRankingEntry[] {
  const list = loadSavedPcRankings();
  const normalized: PcRankingEntry = {
    ...entry,
    id: entry.id || `user_pc_${Date.now()}`,
    category: 'Twój Zapisany PC',
    isCurrentPc: false,
    isUserSaved: true,
    savedAt: entry.savedAt || Date.now(),
  };
  const next = [normalized, ...list.filter((x) => x.id !== normalized.id)].slice(0, 25);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  } catch {
    // ignore storage quota failures
  }
  return next;
}

export function deleteSavedPcFromRanking(id: string): PcRankingEntry[] {
  const next = loadSavedPcRankings().filter((x) => x.id !== id);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
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

  const clamp100 = (n: number) => Math.max(15, Math.min(100, Math.round(n)));
  const cpuScore = ctx.scores.cpu > 0 ? clamp100(ctx.scores.cpu) : clamp100(hw.cpuScore);
  const gpuScore = ctx.scores.gpu > 0 ? clamp100(ctx.scores.gpu) : clamp100(hw.gpuScore);
  const ramScore = ctx.scores.ram > 0 ? clamp100(ctx.scores.ram) : clamp100(hw.ramScore);
  const diskScore = ctx.scores.disk > 0 ? clamp100(ctx.scores.disk) : clamp100(hw.diskScore);

  // Weighted overall ranking score (GPU 38%, CPU 32%, RAM 16%, Disk 14%) blended with suite overall when available
  const weightedCalc = Math.round(gpuScore * 0.38 + cpuScore * 0.32 + ramScore * 0.16 + diskScore * 0.14);
  const overallScore =
    ctx.scores.overall > 0
      ? clamp100(Math.round(weightedCalc * 0.65 + ctx.scores.overall * 0.35))
      : clamp100(weightedCalc);

  const shortGpu = shortenGpuName(hw.gpuLabel);
  const currentEntry: PcRankingEntry = {
    id: 'current_pc',
    name: `TWÓJ KOMPUTER (${shortGpu} · ${hw.cpuCores}T)`,
    tierLabel: tierFromScore(overallScore),
    category: 'Twój Aktualny PC',
    cpuSummary: `${hw.cpuCores} wątków${ctx.cpu.multiCoreScore > 0 ? ` · ${ctx.cpu.multiCoreScore.toLocaleString('pl-PL')} pkt` : ''}`,
    gpuSummary: `${shortGpu}${hw.benchGpuFps > 0 ? ` · ${hw.benchGpuFps} FPS` : ''}`,
    cpuScore,
    gpuScore,
    ramScore,
    diskScore,
    overallScore,
    isCurrentPc: true,
  };

  const savedEntries = savedOverride ?? loadSavedPcRankings();
  const combined: PcRankingEntry[] = [
    currentEntry,
    ...savedEntries.map((e) => ({ ...e, isCurrentPc: false, isUserSaved: true })),
    ...REFERENCE_PC_LEADERBOARD,
  ].sort((a, b) => {
    if (b.overallScore !== a.overallScore) return b.overallScore - a.overallScore;
    if (b.gpuScore !== a.gpuScore) return b.gpuScore - a.gpuScore;
    return a.isCurrentPc ? -1 : b.isCurrentPc ? 1 : 0;
  });

  const currentIdx = combined.findIndex((e) => e.isCurrentPc);
  const currentRank = currentIdx >= 0 ? currentIdx + 1 : combined.length;
  const totalRanked = combined.length;
  const belowCount = Math.max(0, totalRanked - currentRank);
  const percentileBetterThan =
    totalRanked > 1 ? Math.round((belowCount / (totalRanked - 1)) * 100) : 100;

  const leader = combined[0];
  const gapToLeader = Math.max(0, leader.overallScore - overallScore);

  const parts: Array<{ name: string; score: number }> = [
    { name: `Procesor CPU (${cpuScore}/100)`, score: cpuScore },
    { name: `Grafika GPU 3D (${gpuScore}/100)`, score: gpuScore },
    { name: `Pamięć RAM (${ramScore}/100)`, score: ramScore },
    { name: `Dysk SSD/NVMe (${diskScore}/100)`, score: diskScore },
  ];
  const sortedParts = [...parts].sort((a, b) => b.score - a.score);
  const strongestComponent = sortedParts[0].name;
  const bottleneckComponent = sortedParts[sortedParts.length - 1].name;

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
    tierBadge: tierFromScore(overallScore),
    hasRealMeasurements: hasReal,
  };
}

let rankingFilter: 'all' | 'saved_only' = 'all';
let saveNotice: string | null = null;

export function renderPcRankingSectionHtml(ctx: PcRankingInputContext): string {
  const snap = computePcRankingSnapshot(ctx);
  const rows =
    rankingFilter === 'saved_only'
      ? [snap.currentEntry, ...snap.savedEntries].sort((a, b) => b.overallScore - a.overallScore)
      : snap.leaderboard;

  const defaultLabel = `${shortenGpuName(ctx.specs?.gpuRenderer || ctx.gpu?.rendererName || 'PC')} (${ctx.specs?.cpuCores || 8}T)`;

  return `
    <section class="sp-panel sp-ranking-panel" id="sp-pc-ranking-section">
      <div class="sp-panel-head">
        <div>
          <span class="sp-eyebrow">RANKING KOMPUTERÓW I LAPTOPÓW · PORÓWNANIE WYDAJNOŚCI (KTÓRY NAJLEPSZY?)</span>
          <h3>🏆 Ranking Komputerów — Pozycja #${snap.currentRank} z ${snap.totalRanked} (Lepszy niż ${snap.percentileBetterThan}% konfiguracji)</h3>
          <p class="sp-muted">
            Porównanie Twojego PC z konfiguracjami referencyjnymi oraz własnymi zapisanymi komputerami klientów/stanowisk.
            ${snap.hasRealMeasurements ? 'Pozycja wyliczona na podstawie zmierzonych benchmarków.' : 'Wstępna pozycja ze specyfikacji — uruchom Pełny Test, aby potwierdzić miejsce w rankingu.'}
          </p>
        </div>
        <div class="sp-ranking-controls">
          <div class="sp-games-filter-bar">
            <button type="button" class="sp-filter-btn ${rankingFilter === 'all' ? 'active' : ''}" data-rank-filter="all">
              Pełny Ranking (${snap.totalRanked})
            </button>
            <button type="button" class="sp-filter-btn ${rankingFilter === 'saved_only' ? 'active' : ''}" data-rank-filter="saved_only">
              Moje Zapisane PC (${snap.savedEntries.length + 1})
            </button>
          </div>
        </div>
      </div>

      <!-- KPI podsumowanie pozycji -->
      <div class="sp-ranking-kpi-grid">
        <div class="sp-ranking-kpi">
          <span class="sp-ranking-kpi-lbl">Miejsce w Rankingu</span>
          <strong class="sp-ranking-kpi-val status-cyan">#${snap.currentRank} / ${snap.totalRanked}</strong>
          <span class="sp-ranking-kpi-sub">Klasa: ${escHtml(snap.tierBadge)}</span>
        </div>
        <div class="sp-ranking-kpi">
          <span class="sp-ranking-kpi-lbl">Percentyl Mocy</span>
          <strong class="sp-ranking-kpi-val status-ok">TOP ${Math.max(1, 100 - snap.percentileBetterThan)}%</strong>
          <span class="sp-ranking-kpi-sub">Lepszy niż ${snap.percentileBetterThan}% PC</span>
        </div>
        <div class="sp-ranking-kpi">
          <span class="sp-ranking-kpi-lbl">Najmocniejszy element</span>
          <strong class="sp-ranking-kpi-val" style="font-size:13.5px;color:#34d399;">${escHtml(snap.strongestComponent)}</strong>
          <span class="sp-ranking-kpi-sub">Strata do #1: ${snap.gapToLeader === 0 ? 'LIDER RANKINGU!' : `-${snap.gapToLeader} pkt`}</span>
        </div>
        <div class="sp-ranking-kpi">
          <span class="sp-ranking-kpi-lbl">Najsłabsze ogniwo (Bottleneck)</span>
          <strong class="sp-ranking-kpi-val" style="font-size:13.5px;color:#fbbf24;">${escHtml(snap.bottleneckComponent)}</strong>
          <span class="sp-ranking-kpi-sub">Potencjał do modernizacji</span>
        </div>
      </div>

      <!-- Zapisz aktualny komputer do lokalnego rankingu serwisowego -->
      <div class="sp-ranking-save-bar">
        <input
          type="text"
          id="sp-ranking-pc-name"
          class="input-text"
          placeholder="Nazwa komputera (np. PC Klienta #1, Laptop Gamingowy...)"
          value="${escHtml(defaultLabel)}"
          style="flex:1;min-width:220px;"
        />
        <button type="button" class="btn btn-primary btn-sm" id="sp-ranking-save-btn">
          💾 Zapisz ten PC do Rankingu (Porównaj z innymi)
        </button>
      </div>
      ${saveNotice ? `<div class="sp-scheme-feedback">${escHtml(saveNotice)}</div>` : ''}

      <!-- Tabela rankingu od #1 najlepszego -->
      <div class="sp-ranking-table-wrap">
        <table class="sp-ranking-table">
          <thead>
            <tr>
              <th style="width:52px;">Poz.</th>
              <th>Komputer / Konfiguracja</th>
              <th style="width:74px;">CPU</th>
              <th style="width:74px;">GPU</th>
              <th style="width:74px;">RAM</th>
              <th style="width:74px;">Dysk</th>
              <th style="width:170px;">Wynik Ogólny</th>
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
                  ? '<span class="sp-rank-tag sp-rank-tag--current">TWÓJ PC</span>'
                  : entry.isUserSaved
                    ? '<span class="sp-rank-tag sp-rank-tag--saved">ZAPISANY</span>'
                    : `<span class="sp-rank-tag">${escHtml(entry.tierLabel)}</span>`;
                return `
                  <tr class="${rowCls}">
                    <td class="font-mono" style="font-weight:800;text-align:center;">${medal}</td>
                    <td>
                      <div class="sp-rank-name-cell">
                        <strong>${escHtml(entry.name)}</strong>
                        ${tagHtml}
                      </div>
                      <div class="sp-rank-sub">${escHtml(entry.gpuSummary)} · ${escHtml(entry.cpuSummary)}</div>
                    </td>
                    <td class="font-mono">${entry.cpuScore}</td>
                    <td class="font-mono">${entry.gpuScore}</td>
                    <td class="font-mono">${entry.ramScore}</td>
                    <td class="font-mono">${entry.diskScore}</td>
                    <td>
                      <div class="sp-rank-score-cell">
                        <div class="sp-rank-bar-track">
                          <div class="sp-rank-bar-fill ${barFillCls}" style="width:${entry.overallScore}%"></div>
                        </div>
                        <strong class="font-mono">${entry.overallScore}/100</strong>
                      </div>
                    </td>
                    <td style="text-align:right;">
                      ${
                        entry.isUserSaved
                          ? `<button type="button" class="btn btn-secondary btn-sm" data-rank-delete="${escHtml(entry.id)}" title="Usuń z rankingu" style="padding:2px 7px;font-size:11px;">✕</button>`
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

  const saveBtn = root.querySelector<HTMLButtonElement>('#sp-ranking-save-btn');
  saveBtn?.addEventListener('click', () => {
    const input = root.querySelector<HTMLInputElement>('#sp-ranking-pc-name');
    const customName = input?.value.trim() || 'Przetestowany PC';
    const snap = computePcRankingSnapshot(ctx);
    savePcToRanking({
      ...snap.currentEntry,
      id: `saved_${Date.now()}`,
      name: customName,
      isCurrentPc: false,
      isUserSaved: true,
      savedAt: Date.now(),
    });
    saveNotice = `✓ Zapisano „${customName}” (${snap.currentEntry.overallScore}/100 pkt) do lokalnego rankingu komputerów.`;
    rerender();
  });

  root.querySelectorAll<HTMLButtonElement>('[data-rank-delete]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.rankDelete;
      if (id) {
        deleteSavedPcFromRanking(id);
        saveNotice = 'Usunięto pozycję z zapisanego rankingu.';
        rerender();
      }
    });
  });
}
