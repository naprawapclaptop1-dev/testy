import * as d3 from 'd3';
import { GpuSceneMode } from '../types';
import type { GpuSceneCatalogItem } from '../services/gpuStress.service';

export type GpuPipelineCategory =
  | 'ray_tracing'
  | 'rasterization'
  | 'volumetric_shader'
  | 'particles_compute';

export type GpuHeatmapPipelineFilter = 'all' | GpuPipelineCategory;
export type GpuHeatmapVisibilityMode = 'tested' | 'all_scenes';

export type StabilityBandId = 'lt75' | 'b75_84' | 'b85_89' | 'b90_94' | 'b95_100';

export interface StabilityBandDef {
  id: StabilityBandId;
  label: string;
  shortLabel: string;
  minInclusive: number;
  maxExclusive: number;
  accentHex: string;
}

export const GPU_STABILITY_HEATMAP_BANDS: readonly StabilityBandDef[] = [
  {
    id: 'lt75',
    label: '< 75% (Alert)',
    shortLabel: '< 75%',
    minInclusive: 0,
    maxExclusive: 75,
    accentHex: '#f43f5e',
  },
  {
    id: 'b75_84',
    label: '75–84% (Niska)',
    shortLabel: '75–84%',
    minInclusive: 75,
    maxExclusive: 85,
    accentHex: '#f97316',
  },
  {
    id: 'b85_89',
    label: '85–89% (Wahania)',
    shortLabel: '85–89%',
    minInclusive: 85,
    maxExclusive: 90,
    accentHex: '#f59e0b',
  },
  {
    id: 'b90_94',
    label: '90–94% (Dobra)',
    shortLabel: '90–94%',
    minInclusive: 90,
    maxExclusive: 95,
    accentHex: '#06b6d4',
  },
  {
    id: 'b95_100',
    label: '95–100% (Wzorowa)',
    shortLabel: '95–100%',
    minInclusive: 95,
    maxExclusive: 101,
    accentHex: '#10b981',
  },
] as const;

export const GPU_PIPELINE_META: Record<
  GpuPipelineCategory,
  { label: string; shortLabel: string; accent: string }
> = {
  ray_tracing: {
    label: 'Ray Tracing / Raymarch RT',
    shortLabel: 'Ray Tracing',
    accent: '#a855f7',
  },
  rasterization: {
    label: 'Rasteryzacja / Geometria PBR',
    shortLabel: 'Rasteryzacja',
    accent: '#06b6d4',
  },
  volumetric_shader: {
    label: 'Wolumetria / Fillrate / Shadery',
    shortLabel: 'Wolumetria',
    accent: '#f59e0b',
  },
  particles_compute: {
    label: 'Cząstki / Fizyka / Compute',
    shortLabel: 'Cząstki/Compute',
    accent: '#10b981',
  },
};

export interface GpuSceneStabilityAccumulator {
  sceneId: GpuSceneMode;
  sampleCount: number;
  stabilitySum: number;
  minStabilityPct: number;
  maxStabilityPct: number;
  lastStabilityPct: number;
  fpsSum: number;
  frameTimeSum: number;
  throttleCount: number;
  bandCounts: Record<StabilityBandId, number>;
  lastUpdatedAt: number;
}

export interface GpuSceneHeatmapRow {
  sceneId: GpuSceneMode;
  shortName: string;
  name: string;
  targetUnit: string;
  pipeline: GpuPipelineCategory;
  tested: boolean;
  sampleCount: number;
  avgStabilityPct: number;
  minStabilityPct: number;
  maxStabilityPct: number;
  avgFps: number;
  avgFrameTimeMs: number;
  throttleCount: number;
  bandCounts: Record<StabilityBandId, number>;
  bandSharesPct: Record<StabilityBandId, number>;
}

export interface GpuPipelineCorrelationStat {
  pipeline: GpuPipelineCategory;
  label: string;
  shortLabel: string;
  accent: string;
  testedSceneCount: number;
  totalSampleCount: number;
  avgStabilityPct: number | null;
  minStabilityPct: number | null;
  below75SharePct: number;
}

export interface GpuSceneHeatmapAnalysis {
  rows: GpuSceneHeatmapRow[];
  testedCount: number;
  totalCatalogCount: number;
  pipelineStats: GpuPipelineCorrelationStat[];
  worstScene: GpuSceneHeatmapRow | null;
  bestScene: GpuSceneHeatmapRow | null;
  correlationInsight: string;
}

export interface GpuSceneHeatmapRenderOptions {
  activeSceneId?: GpuSceneMode;
  pipelineFilter?: GpuHeatmapPipelineFilter;
  visibilityMode?: GpuHeatmapVisibilityMode;
  onPipelineFilterChange?: (filter: GpuHeatmapPipelineFilter) => void;
  onVisibilityModeChange?: (mode: GpuHeatmapVisibilityMode) => void;
  onSelectScene?: (sceneId: GpuSceneMode) => void;
}

export function classifyGpuScenePipeline(
  scene: Pick<GpuSceneCatalogItem, 'id' | 'name' | 'targetUnit'>
): GpuPipelineCategory {
  const hay = `${scene.id} ${scene.name} ${scene.targetUnit}`.toLowerCase();
  if (
    /raytrac|raymarch|pathtrac|cornell|menger|blackhole|julia4d|metaballs|rt_reflections|voxel_pathtracer|caustic_raytrace|geodesic/.test(
      hay
    )
  ) {
    return 'ray_tracing';
  }
  if (
    /volumetric|furmark|vram_fill|overdraw|fluid_plasma|caustic_water|planet_atmo|magma|clouds_4k|godrays|fire_tornado/.test(
      hay
    )
  ) {
    return 'volumetric_shader';
  }
  if (
    /galaxy|particle|dna_|neural_lattice|cloth_|voronoi|supernova|tokamak|ocean_gerstner|navier_stokes|collider|nbody|magnetosphere|chromodynamics|sph_fluid|warp/.test(
      hay
    )
  ) {
    return 'particles_compute';
  }
  return 'rasterization';
}

export function resolveStabilityBandId(stabilityPct: number): StabilityBandId {
  const clamped = Math.max(0, Math.min(100, stabilityPct));
  if (clamped < 75) return 'lt75';
  if (clamped < 85) return 'b75_84';
  if (clamped < 90) return 'b85_89';
  if (clamped < 95) return 'b90_94';
  return 'b95_100';
}

export function createEmptyBandCounts(): Record<StabilityBandId, number> {
  return {
    lt75: 0,
    b75_84: 0,
    b85_89: 0,
    b90_94: 0,
    b95_100: 0,
  };
}

export function recordGpuSceneStabilitySample(
  store: Map<GpuSceneMode, GpuSceneStabilityAccumulator>,
  sample: {
    sceneId: GpuSceneMode;
    stabilityPct: number;
    fps: number;
    frameTimeMs?: number;
    thermalThrottle?: boolean;
    weight?: number;
  }
): GpuSceneStabilityAccumulator {
  const stab = Number(Math.max(0, Math.min(100, sample.stabilityPct)).toFixed(1));
  const weight = Math.max(1, Math.round(sample.weight ?? 1));
  const band = resolveStabilityBandId(stab);
  const existing = store.get(sample.sceneId);
  const frameMs =
    typeof sample.frameTimeMs === 'number' && Number.isFinite(sample.frameTimeMs)
      ? sample.frameTimeMs
      : sample.fps > 0
        ? Number((1000 / sample.fps).toFixed(2))
        : 0;

  if (!existing) {
    const counts = createEmptyBandCounts();
    counts[band] = weight;
    const created: GpuSceneStabilityAccumulator = {
      sceneId: sample.sceneId,
      sampleCount: weight,
      stabilitySum: stab * weight,
      minStabilityPct: stab,
      maxStabilityPct: stab,
      lastStabilityPct: stab,
      fpsSum: sample.fps * weight,
      frameTimeSum: frameMs * weight,
      throttleCount: sample.thermalThrottle ? weight : 0,
      bandCounts: counts,
      lastUpdatedAt: Date.now(),
    };
    store.set(sample.sceneId, created);
    return created;
  }

  existing.sampleCount += weight;
  existing.stabilitySum += stab * weight;
  existing.minStabilityPct = Math.min(existing.minStabilityPct, stab);
  existing.maxStabilityPct = Math.max(existing.maxStabilityPct, stab);
  existing.lastStabilityPct = stab;
  existing.fpsSum += sample.fps * weight;
  existing.frameTimeSum += frameMs * weight;
  if (sample.thermalThrottle) existing.throttleCount += weight;
  existing.bandCounts[band] += weight;
  existing.lastUpdatedAt = Date.now();
  return existing;
}

export function buildGpuSceneHeatmapAnalysis(
  catalog: GpuSceneCatalogItem[],
  store: Map<GpuSceneMode, GpuSceneStabilityAccumulator>,
  pipelineFilter: GpuHeatmapPipelineFilter = 'all',
  visibilityMode: GpuHeatmapVisibilityMode = 'tested'
): GpuSceneHeatmapAnalysis {
  const allRows: GpuSceneHeatmapRow[] = catalog.map((sc) => {
    const pipeline = classifyGpuScenePipeline(sc);
    const acc = store.get(sc.id);
    if (!acc || acc.sampleCount === 0) {
      return {
        sceneId: sc.id,
        shortName: sc.shortName,
        name: sc.name,
        targetUnit: sc.targetUnit,
        pipeline,
        tested: false,
        sampleCount: 0,
        avgStabilityPct: 0,
        minStabilityPct: 0,
        maxStabilityPct: 0,
        avgFps: 0,
        avgFrameTimeMs: 0,
        throttleCount: 0,
        bandCounts: createEmptyBandCounts(),
        bandSharesPct: createEmptyBandCounts(),
      };
    }

    const n = acc.sampleCount;
    const bandSharesPct: Record<StabilityBandId, number> = {
      lt75: Number(((acc.bandCounts.lt75 / n) * 100).toFixed(1)),
      b75_84: Number(((acc.bandCounts.b75_84 / n) * 100).toFixed(1)),
      b85_89: Number(((acc.bandCounts.b85_89 / n) * 100).toFixed(1)),
      b90_94: Number(((acc.bandCounts.b90_94 / n) * 100).toFixed(1)),
      b95_100: Number(((acc.bandCounts.b95_100 / n) * 100).toFixed(1)),
    };

    return {
      sceneId: sc.id,
      shortName: sc.shortName,
      name: sc.name,
      targetUnit: sc.targetUnit,
      pipeline,
      tested: true,
      sampleCount: n,
      avgStabilityPct: Number((acc.stabilitySum / n).toFixed(1)),
      minStabilityPct: Number(acc.minStabilityPct.toFixed(1)),
      maxStabilityPct: Number(acc.maxStabilityPct.toFixed(1)),
      avgFps: Math.round(acc.fpsSum / n),
      avgFrameTimeMs: Number((acc.frameTimeSum / n).toFixed(2)),
      throttleCount: acc.throttleCount,
      bandCounts: { ...acc.bandCounts },
      bandSharesPct,
    };
  });

  const testedAll = allRows.filter((r) => r.tested);

  const pipelinesOrder: GpuPipelineCategory[] = [
    'ray_tracing',
    'rasterization',
    'volumetric_shader',
    'particles_compute',
  ];

  const pipelineStats: GpuPipelineCorrelationStat[] = pipelinesOrder.map((p) => {
    const meta = GPU_PIPELINE_META[p];
    const matching = testedAll.filter((r) => r.pipeline === p);
    if (matching.length === 0) {
      return {
        pipeline: p,
        label: meta.label,
        shortLabel: meta.shortLabel,
        accent: meta.accent,
        testedSceneCount: 0,
        totalSampleCount: 0,
        avgStabilityPct: null,
        minStabilityPct: null,
        below75SharePct: 0,
      };
    }
    const totalSamples = matching.reduce((s, r) => s + r.sampleCount, 0);
    const totalLt75 = matching.reduce((s, r) => s + r.bandCounts.lt75, 0);
    const weightedAvg =
      matching.reduce((s, r) => s + r.avgStabilityPct * r.sampleCount, 0) / Math.max(1, totalSamples);
    const minStab = Math.min(...matching.map((r) => r.minStabilityPct));
    return {
      pipeline: p,
      label: meta.label,
      shortLabel: meta.shortLabel,
      accent: meta.accent,
      testedSceneCount: matching.length,
      totalSampleCount: totalSamples,
      avgStabilityPct: Number(weightedAvg.toFixed(1)),
      minStabilityPct: Number(minStab.toFixed(1)),
      below75SharePct: Number(((totalLt75 / Math.max(1, totalSamples)) * 100).toFixed(1)),
    };
  });

  let worstScene: GpuSceneHeatmapRow | null = null;
  let bestScene: GpuSceneHeatmapRow | null = null;
  for (const r of testedAll) {
    if (!worstScene || r.avgStabilityPct < worstScene.avgStabilityPct) worstScene = r;
    if (!bestScene || r.avgStabilityPct > bestScene.avgStabilityPct) bestScene = r;
  }

  let correlationInsight =
    'Uruchom stres-test na kilku scenach (np. Raymarch 3D / Czarna Dziura RT vs Wir PBR / Miliony Trójkątów) lub kliknij „Auto-test wszystkich scen”, aby wykryć spadki stabilności zależne od konkretnej sceny.';

  const rtStat = pipelineStats.find((s) => s.pipeline === 'ray_tracing');
  const rastStat = pipelineStats.find((s) => s.pipeline === 'rasterization');

  if (testedAll.length === 1 && worstScene) {
    correlationInsight = `Zebrano dane dla 1 sceny (${worstScene.sceneId} · śr. ${worstScene.avgStabilityPct}%). Przełącz na inną scenę (np. ${worstScene.pipeline === 'ray_tracing' ? 'rasteryzację PBR' : 'Ray Tracing / Raymarch'}) lub uruchom Auto-Suite, aby porównać korelację.`;
  } else if (testedAll.length >= 2 && worstScene && bestScene) {
    const spread = Number((bestScene.avgStabilityPct - worstScene.avgStabilityPct).toFixed(1));
    if (
      rtStat?.avgStabilityPct !== null &&
      rtStat?.avgStabilityPct !== undefined &&
      rastStat?.avgStabilityPct !== null &&
      rastStat?.avgStabilityPct !== undefined
    ) {
      const rtVsRast = Number((rastStat.avgStabilityPct - rtStat.avgStabilityPct).toFixed(1));
      if (rtVsRast >= 5) {
        correlationInsight = `Wykryto zależność od potoku: sceny Ray Tracing (${rtStat.avgStabilityPct}%) mają o ${rtVsRast} pkt proc. niższą stabilność niż Rasteryzacja (${rastStat.avgStabilityPct}%). Najbardziej wymagająca scena: ${worstScene.sceneId} (${worstScene.avgStabilityPct}%).`;
      } else if (rtVsRast <= -5) {
        correlationInsight = `Rasteryzacja / Geometria (${rastStat.avgStabilityPct}%) wykazuje o ${Math.abs(rtVsRast)} pkt proc. niższą stabilność niż Ray Tracing (${rtStat.avgStabilityPct}%). Najniższa stabilność: ${worstScene.sceneId} (${worstScene.avgStabilityPct}%).`;
      } else if (spread >= 8) {
        correlationInsight = `Różnica między najlepszą (${bestScene.sceneId}: ${bestScene.avgStabilityPct}%) a najsłabszą sceną (${worstScene.sceneId}: ${worstScene.avgStabilityPct}%) wynosi ${spread} pkt proc. — niestabilność jest specyficzna dla konkretnej sceny.`;
      } else {
        correlationInsight = `Stabilność spójna między potokami (Ray Tracing ${rtStat.avgStabilityPct}% vs Rasteryzacja ${rastStat.avgStabilityPct}%, rozrzut ${spread} pkt proc.) — brak problemów specyficznych dla jednej sceny.`;
      }
    } else if (spread >= 8) {
      correlationInsight = `Wykryto różnicę stabilności zależną od sceny (${spread} pkt proc.): najniższa w ${worstScene.sceneId} (${worstScene.avgStabilityPct}%), najwyższa w ${bestScene.sceneId} (${bestScene.avgStabilityPct}%).`;
    } else {
      correlationInsight = `Przetestowano ${testedAll.length} scen — stabilność jest wyrównana (${worstScene.avgStabilityPct}%–${bestScene.avgStabilityPct}%).`;
    }
  }

  let visibleRows = allRows.filter((r) =>
    pipelineFilter === 'all' ? true : r.pipeline === pipelineFilter
  );
  if (visibilityMode === 'tested' && testedAll.length > 0) {
    const testedFiltered = visibleRows.filter((r) => r.tested);
    visibleRows = testedFiltered.length > 0 ? testedFiltered : visibleRows.slice(0, 12);
  }

  // Sort tested scenes with lowest stability first so problematic scenes immediately jump to top
  visibleRows = [...visibleRows].sort((a, b) => {
    if (a.tested !== b.tested) return a.tested ? -1 : 1;
    if (a.tested && b.tested) {
      return a.avgStabilityPct - b.avgStabilityPct;
    }
    return a.sceneId.localeCompare(b.sceneId);
  });

  return {
    rows: visibleRows,
    testedCount: testedAll.length,
    totalCatalogCount: catalog.length,
    pipelineStats,
    worstScene,
    bestScene,
    correlationInsight,
  };
}

function getBandCellFill(bandId: StabilityBandId, sharePct: number): string {
  if (sharePct <= 0) return 'rgba(148, 163, 184, 0.06)';
  const intensity = Math.max(0.18, Math.min(0.95, 0.16 + (sharePct / 100) * 0.8));
  switch (bandId) {
    case 'lt75':
      return `rgba(244, 63, 94, ${intensity.toFixed(2)})`;
    case 'b75_84':
      return `rgba(249, 115, 22, ${intensity.toFixed(2)})`;
    case 'b85_89':
      return `rgba(245, 158, 11, ${intensity.toFixed(2)})`;
    case 'b90_94':
      return `rgba(6, 182, 212, ${intensity.toFixed(2)})`;
    case 'b95_100':
      return `rgba(16, 185, 129, ${intensity.toFixed(2)})`;
  }
}

const stabilityAvgColorScale = d3
  .scaleLinear<string>()
  .domain([60, 75, 88, 97])
  .range(['#e11d48', '#f97316', '#eab308', '#10b981'])
  .clamp(true);

/**
 * Renders an interactive D3.js 2D Heatmap correlating GPU stability percentages
 * across 5 stability bands (<75%, 75-84%, 85-89%, 90-94%, 95-100%) with specific Scene IDs.
 */
export function renderGpuSceneStabilityHeatmapD3(
  containerEl: HTMLElement,
  catalog: GpuSceneCatalogItem[],
  store: Map<GpuSceneMode, GpuSceneStabilityAccumulator>,
  options: GpuSceneHeatmapRenderOptions = {}
): GpuSceneHeatmapAnalysis {
  const pipelineFilter: GpuHeatmapPipelineFilter = options.pipelineFilter ?? 'all';
  const visibilityMode: GpuHeatmapVisibilityMode = options.visibilityMode ?? 'tested';
  const analysis = buildGpuSceneHeatmapAnalysis(catalog, store, pipelineFilter, visibilityMode);

  const root = d3.select(containerEl);
  root.selectAll('*').remove();

  const wrap = root
    .append('div')
    .attr('class', 'chart-box chart-interactive-wrap')
    .attr('data-gpu-scene-heatmap', 'true')
    .attr('data-gpu-scene-heatmap-tested', String(analysis.testedCount));

  // Top pipeline filter & visibility toolbar
  const toolbar = wrap
    .append('div')
    .attr('class', 'row-between')
    .style('flex-wrap', 'wrap')
    .style('gap', '8px')
    .style('margin-bottom', '10px')
    .style('align-items', 'center');

  const filterGroup = toolbar
    .append('div')
    .attr('class', 'segmented')
    .attr('role', 'group')
    .attr('aria-label', 'Filtr potoku renderowania heatmapy');

  const filterButtons: Array<{ id: GpuHeatmapPipelineFilter; label: string }> = [
    { id: 'all', label: `Wszystkie (${analysis.testedCount}/${analysis.totalCatalogCount})` },
    { id: 'ray_tracing', label: 'Ray Tracing / RT' },
    { id: 'rasterization', label: 'Rasteryzacja / PBR' },
    { id: 'volumetric_shader', label: 'Wolumetria' },
    { id: 'particles_compute', label: 'Cząstki / Compute' },
  ];

  filterButtons.forEach((btn) => {
    filterGroup
      .append('button')
      .attr('type', 'button')
      .attr('class', `segmented-btn ${pipelineFilter === btn.id ? 'active' : ''}`)
      .attr('data-heatmap-pipeline', btn.id)
      .style('padding', '3px 8px')
      .style('font-size', '11px')
      .text(btn.label)
      .on('click', () => {
        if (options.onPipelineFilterChange) {
          options.onPipelineFilterChange(btn.id);
        } else {
          renderGpuSceneStabilityHeatmapD3(containerEl, catalog, store, {
            ...options,
            pipelineFilter: btn.id,
          });
        }
      });
  });

  const visGroup = toolbar
    .append('div')
    .attr('class', 'segmented')
    .attr('role', 'group')
    .attr('aria-label', 'Widoczność scen w heatmapie');

  const visOptions: Array<{ id: GpuHeatmapVisibilityMode; label: string }> = [
    { id: 'tested', label: `Przetestowane (${analysis.testedCount})` },
    { id: 'all_scenes', label: `Wszystkie sceny (${analysis.totalCatalogCount})` },
  ];

  visOptions.forEach((opt) => {
    visGroup
      .append('button')
      .attr('type', 'button')
      .attr('class', `segmented-btn ${visibilityMode === opt.id ? 'active' : ''}`)
      .attr('data-heatmap-vis', opt.id)
      .style('padding', '3px 8px')
      .style('font-size', '11px')
      .text(opt.label)
      .on('click', () => {
        if (options.onVisibilityModeChange) {
          options.onVisibilityModeChange(opt.id);
        } else {
          renderGpuSceneStabilityHeatmapD3(containerEl, catalog, store, {
            ...options,
            visibilityMode: opt.id,
          });
        }
      });
  });

  // Pipeline comparison summary strip (Ray Tracing vs Rasterization vs Volumetric vs Compute)
  const pipelineGrid = wrap
    .append('div')
    .attr('class', 'grid-4')
    .style('gap', '8px')
    .style('margin-bottom', '10px');

  analysis.pipelineStats.forEach((ps) => {
    const avgCls =
      ps.avgStabilityPct === null
        ? 'color:var(--text-muted);'
        : ps.avgStabilityPct >= 90
          ? 'color:#34d399;'
          : ps.avgStabilityPct >= 75
            ? 'color:#fbbf24;'
            : 'color:#fb7185;';
    pipelineGrid
      .append('div')
      .attr('class', 'gpu-heatmap-pipeline-card')
      .attr('data-pipeline-summary', ps.pipeline)
      .style('padding', '8px 10px')
      .style('border-radius', '8px')
      .style('border', '1px solid var(--border-hairline)')
      .style('background', 'var(--bg-inset)')
      .html(`
        <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
          <span style="font-size:11px;font-weight:700;color:${ps.accent};">${ps.shortLabel}</span>
          <span class="font-mono" style="font-size:10px;color:var(--text-muted);">${ps.testedSceneCount} scen</span>
        </div>
        <div class="font-mono" style="font-size:15px;font-weight:700;margin-top:2px;${avgCls}">
          ${ps.avgStabilityPct !== null ? `${ps.avgStabilityPct.toFixed(1)}%` : '—'}
        </div>
        <div style="font-size:10.5px;color:var(--text-muted);margin-top:2px;">
          ${ps.totalSampleCount > 0 ? `Min: ${ps.minStabilityPct}% · <75%: ${ps.below75SharePct}%` : 'Brak pomiarów'}
        </div>
      `);
  });

  // Correlation insight callout
  wrap
    .append('div')
    .attr('data-gpu-heatmap-insight', 'true')
    .style('font-size', '11.5px')
    .style('color', 'var(--text-secondary)')
    .style('padding', '7px 10px')
    .style('margin-bottom', '10px')
    .style('border-radius', '7px')
    .style('background', 'rgba(6, 182, 212, 0.08)')
    .style('border', '1px solid rgba(6, 182, 212, 0.28)')
    .text(analysis.correlationInsight);

  if (analysis.testedCount === 0 && visibilityMode === 'tested') {
    wrap
      .append('div')
      .attr('data-gpu-heatmap-empty', 'true')
      .style('padding', '20px 14px')
      .style('text-align', 'center')
      .style('font-size', '12px')
      .style('color', 'var(--text-muted)')
      .style('border', '1px dashed var(--border-hairline)')
      .style('border-radius', '8px')
      .html(
        `Brak próbek stabilności dla poszczególnych scen. Uruchom <strong>Start stres-testu GPU</strong> na wybranych scenach albo kliknij <strong>Auto-test wszystkich scen</strong>, aby wypełnić mapę cieplną 2D korelacji <em>Scene ID × Stabilność (%)</em>.`
      );
    return analysis;
  }

  const rows = analysis.rows;
  const width = Math.max(600, containerEl.clientWidth || 720);
  const rowH = 26;
  const margin = { top: 34, right: 86, bottom: 26, left: 196 };
  const plotW = Math.max(260, width - margin.left - margin.right);
  const plotH = Math.max(rowH * 2, rows.length * rowH);
  const svgHeight = plotH + margin.top + margin.bottom;

  const svgWrap = wrap
    .append('div')
    .style('position', 'relative')
    .style('max-height', '440px')
    .style('overflow-y', 'auto')
    .style('overflow-x', 'auto');

  const svg = svgWrap
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${svgHeight}`)
    .attr('data-gpu-scene-heatmap-svg', 'true')
    .style('width', '100%')
    .style('min-width', '580px')
    .style('height', `${svgHeight}px`)
    .style('display', 'block');

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const xScale = d3
    .scaleBand<StabilityBandId>()
    .domain(GPU_STABILITY_HEATMAP_BANDS.map((b) => b.id))
    .range([0, plotW])
    .padding(0.08);

  const yScale = d3
    .scaleBand<GpuSceneMode>()
    .domain(rows.map((r) => r.sceneId))
    .range([0, plotH])
    .padding(0.14);

  // Column headers (X-axis stability buckets)
  GPU_STABILITY_HEATMAP_BANDS.forEach((band) => {
    const cx = (xScale(band.id) ?? 0) + xScale.bandwidth() / 2;
    g.append('text')
      .attr('x', cx)
      .attr('y', -12)
      .attr('text-anchor', 'middle')
      .style('fill', band.accentHex)
      .style('font-size', '10.5px')
      .style('font-weight', '700')
      .style('font-family', 'JetBrains Mono, monospace')
      .text(band.label);
  });

  // Right-side Mean Stability column header
  g.append('text')
    .attr('x', plotW + 38)
    .attr('y', -12)
    .attr('text-anchor', 'middle')
    .style('fill', 'var(--text-primary)')
    .style('font-size', '10.5px')
    .style('font-weight', '700')
    .style('font-family', 'JetBrains Mono, monospace')
    .text('Śr. %');

  const tooltip = svgWrap.append('div').attr('class', 'chart-tooltip').style('opacity', 0);

  const showCellTooltip = (
    event: MouseEvent,
    row: GpuSceneHeatmapRow,
    band: StabilityBandDef | null
  ) => {
    const [mx, my] = d3.pointer(event, svgWrap.node());
    const pipeMeta = GPU_PIPELINE_META[row.pipeline];
    const isRight = mx > width * 0.6;
    const tipLeft = isRight ? Math.max(8, mx - 250) : mx + 14;
    const tipTop = Math.max(4, my - 28);

    const bandSection = band
      ? `
        <div class="chart-tooltip-row">
          <span class="chart-tooltip-label"><span class="chart-tooltip-swatch" style="background:${band.accentHex}"></span>Przedział ${band.shortLabel}:</span>
          <strong>${row.bandSharesPct[band.id].toFixed(1)}% (${row.bandCounts[band.id]} / ${row.sampleCount} próbek)</strong>
        </div>`
      : '';

    tooltip
      .style('opacity', 1)
      .style('left', `${tipLeft}px`)
      .style('top', `${tipTop}px`)
      .html(`
        <div class="chart-tooltip-date">${row.shortName} <span style="opacity:0.75;">(${row.sceneId})</span></div>
        <div class="chart-tooltip-row">
          <span class="chart-tooltip-label">Potok / Jednostka:</span>
          <strong style="color:${pipeMeta.accent};">${pipeMeta.shortLabel} · ${row.targetUnit}</strong>
        </div>
        ${
          row.tested
            ? `
          ${bandSection}
          <div class="chart-tooltip-row">
            <span class="chart-tooltip-label">Stabilność (Śr. / Min):</span>
            <strong>${row.avgStabilityPct.toFixed(1)}% / ${row.minStabilityPct.toFixed(1)}%</strong>
          </div>
          <div class="chart-tooltip-row">
            <span class="chart-tooltip-label">Wydajność:</span>
            <strong>${row.avgFps} FPS · ${row.avgFrameTimeMs} ms</strong>
          </div>`
            : `<div style="font-size:11px;color:var(--text-muted);">Scena jeszcze nieprzetestowana — kliknij nazwę sceny po lewej, aby ją uruchomić.</div>`
        }
      `);
  };

  // Render rows (Y-axis labels + 2D matrix cells + Mean % badge)
  rows.forEach((row) => {
    const ry = yScale(row.sceneId) ?? 0;
    const rh = yScale.bandwidth();
    const pipeMeta = GPU_PIPELINE_META[row.pipeline];
    const isActive = options.activeSceneId === row.sceneId;

    // Row highlight strip for active scene
    if (isActive) {
      g.append('rect')
        .attr('x', -margin.left + 4)
        .attr('y', ry - 2)
        .attr('width', margin.left + plotW + margin.right - 8)
        .attr('height', rh + 4)
        .attr('rx', 5)
        .attr('fill', 'rgba(6, 182, 212, 0.09)')
        .attr('stroke', 'rgba(6, 182, 212, 0.35)')
        .attr('stroke-width', 1);
    }

    // Pipeline indicator bar on the left
    g.append('rect')
      .attr('x', -margin.left + 8)
      .attr('y', ry + 3)
      .attr('width', 4)
      .attr('height', Math.max(8, rh - 6))
      .attr('rx', 2)
      .attr('fill', pipeMeta.accent);

    // Clickable Scene ID label on Y-axis
    const yLabel = g
      .append('g')
      .style('cursor', options.onSelectScene ? 'pointer' : 'default')
      .on('click', () => options.onSelectScene?.(row.sceneId))
      .on('mousemove', (event: MouseEvent) => showCellTooltip(event, row, null))
      .on('mouseleave', () => tooltip.style('opacity', 0));

    yLabel
      .append('text')
      .attr('x', -10)
      .attr('y', ry + rh / 2 - 2)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .style('fill', isActive ? '#22d3ee' : row.tested ? 'var(--text-primary)' : 'var(--text-muted)')
      .style('font-size', '10.5px')
      .style('font-weight', isActive || row.tested ? '700' : '500')
      .style('font-family', 'JetBrains Mono, monospace')
      .text(row.sceneId);

    yLabel
      .append('text')
      .attr('x', -10)
      .attr('y', ry + rh / 2 + 8)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .style('fill', pipeMeta.accent)
      .style('font-size', '8.5px')
      .style('opacity', row.tested ? '0.9' : '0.55')
      .text(pipeMeta.shortLabel);

    // 5 Stability Band Cells
    GPU_STABILITY_HEATMAP_BANDS.forEach((band) => {
      const cx = xScale(band.id) ?? 0;
      const cw = xScale.bandwidth();
      const share = row.tested ? row.bandSharesPct[band.id] : 0;
      const cnt = row.tested ? row.bandCounts[band.id] : 0;

      const cell = g
        .append('rect')
        .attr('class', 'gpu-heatmap-cell')
        .attr('data-heatmap-scene', row.sceneId)
        .attr('data-heatmap-band', band.id)
        .attr('x', cx)
        .attr('y', ry)
        .attr('width', cw)
        .attr('height', rh)
        .attr('rx', 4)
        .attr('fill', getBandCellFill(band.id, share))
        .attr(
          'stroke',
          share > 0
            ? band.accentHex
            : 'rgba(148, 163, 184, 0.16)'
        )
        .attr('stroke-width', share > 0 ? 1 : 0.7)
        .attr('stroke-dasharray', row.tested ? null : '2 2')
        .style('cursor', 'pointer')
        .on('mousemove', (event: MouseEvent) => showCellTooltip(event, row, band))
        .on('mouseleave', () => tooltip.style('opacity', 0))
        .on('click', () => options.onSelectScene?.(row.sceneId));

      void cell;

      if (cnt > 0) {
        g.append('text')
          .attr('x', cx + cw / 2)
          .attr('y', ry + rh / 2)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .style('pointer-events', 'none')
          .style('fill', share >= 45 ? '#ffffff' : 'var(--text-primary)')
          .style('font-size', '10px')
          .style('font-weight', '700')
          .style('font-family', 'JetBrains Mono, monospace')
          .text(`${Math.round(share)}%`);
      }
    });

    // Right-hand Mean Stability Summary Cell
    const avgX = plotW + 10;
    const avgW = 58;
    const avgBg = row.tested ? stabilityAvgColorScale(row.avgStabilityPct) : 'rgba(148, 163, 184, 0.1)';
    g.append('rect')
      .attr('x', avgX)
      .attr('y', ry)
      .attr('width', avgW)
      .attr('height', rh)
      .attr('rx', 4)
      .attr('fill', avgBg)
      .attr('fill-opacity', row.tested ? 0.24 : 0.12)
      .attr('stroke', row.tested ? avgBg : 'rgba(148, 163, 184, 0.2)')
      .attr('stroke-width', 1)
      .style('cursor', 'pointer')
      .on('mousemove', (event: MouseEvent) => showCellTooltip(event, row, null))
      .on('mouseleave', () => tooltip.style('opacity', 0))
      .on('click', () => options.onSelectScene?.(row.sceneId));

    g.append('text')
      .attr('x', avgX + avgW / 2)
      .attr('y', ry + rh / 2)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .style('pointer-events', 'none')
      .style('fill', row.tested ? avgBg : 'var(--text-muted)')
      .style('font-size', '10px')
      .style('font-weight', '700')
      .style('font-family', 'JetBrains Mono, monospace')
      .text(row.tested ? `${row.avgStabilityPct.toFixed(1)}%` : '—');
  });

  // Color intensity legend footer
  wrap
    .append('div')
    .attr('class', 'row-between')
    .style('margin-top', '8px')
    .style('flex-wrap', 'wrap')
    .style('gap', '8px')
    .style('font-size', '11px')
    .style('color', 'var(--text-muted)')
    .html(`
      <span>Intensywność koloru komórki = odsetek próbek stabilności w danym przedziale (%) · Sceny posortowane od najniższej stabilności.</span>
      <span class="font-mono">Kliknij dowolny wiersz Scene ID, aby przełączyć scenę w podglądzie 3D.</span>
    `);

  return analysis;
}
