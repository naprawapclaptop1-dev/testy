import * as d3 from 'd3';
import type { GpuTelemetryPoint } from '../types';
import {
  clampGpuFrameTimeThresholdMs,
  DEFAULT_GPU_FRAMETIME_THRESHOLD_MS,
  type GpuStabilityPhaseLog,
} from '../services/gpuStabilityLogExport.service';

export const GPU_FRAMETIME_APPROACHING_RATIO = 0.8;

export interface GpuFrameTimeThresholdStatus {
  thresholdMs: number;
  approachingThresholdMs: number;
  currentFrameTimeMs: number;
  avgFrameTimeMs: number;
  p99FrameTimeMs: number;
  maxFrameTimeMs: number;
  exceededCount: number;
  stutterCount: number;
  severeCount: number;
  thermalThrottleCount: number;
  sampleCount: number;
  exceededPct: number;
  proximityPct: number;
  isApproachingLimit: boolean;
  isCurrentExceeded: boolean;
  status: 'idle' | 'ok' | 'approaching' | 'warning' | 'breach';
  badgeLabel: string;
  detail: string;
}

export interface GpuStabilityPhaseBoundary {
  timeSec: number;
  label: string;
}

export interface FlattenedStabilityLogSeries {
  points: GpuTelemetryPoint[];
  phaseBoundaries: GpuStabilityPhaseBoundary[];
}

function escHtml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function computePercentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)));
  return sorted[idx];
}

/**
 * Converts one or more recorded GpuStabilityPhaseLog phases into a continuous
 * timeline of GpuTelemetryPoint samples with phase boundary markers so the
 * D3.js Stability Log line chart can visualize historical phase data as well as
 * real-time live stress telemetry.
 */
export function flattenStabilityPhasesToTelemetry(
  phases: GpuStabilityPhaseLog[]
): FlattenedStabilityLogSeries {
  const points: GpuTelemetryPoint[] = [];
  const phaseBoundaries: GpuStabilityPhaseBoundary[] = [];
  if (!phases || phases.length === 0) {
    return { points, phaseBoundaries };
  }

  let offsetSec = 0;
  for (const phase of phases) {
    if (offsetSec > 0) {
      phaseBoundaries.push({
        timeSec: Number(offsetSec.toFixed(2)),
        label: `Faza #${phase.phaseIndex} (${phase.sceneId})`,
      });
    }
    const samples = phase.telemetrySamples || [];
    let phaseMaxT = 0;
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      const localT = Number.isFinite(s.timeSec) ? s.timeSec : i;
      if (localT > phaseMaxT) phaseMaxT = localT;
      points.push({
        timeSec: Number((offsetSec + localT).toFixed(2)),
        fps: s.fps,
        frameTimeMs: s.frameTimeMs,
        stabilityPct: s.stabilityPct,
        estTempC: s.gpuTempC,
        allocatedVramMB: 0,
        textureVramMB: 0,
        coreClockMhz: s.coreClockMhz,
        thermalThrottle: s.thermalThrottle,
      });
    }
    offsetSec += Math.max(1, phaseMaxT || phase.durationSec || samples.length);
  }

  return { points, phaseBoundaries };
}

/**
 * Computes rolling moving-average frame times (window = 5) and flags relative
 * stutter spikes (>= 1.55x rolling average & >= 14ms, or >= 50ms) alongside
 * threshold breaches (> thresholdMs).
 */
export function computeFrameTimeSeriesDiagnostics(
  points: GpuTelemetryPoint[],
  thresholdMs = DEFAULT_GPU_FRAMETIME_THRESHOLD_MS
): Array<{
  point: GpuTelemetryPoint;
  rollingAvgMs: number;
  spikeMultiplier: number;
  exceedsThreshold: boolean;
  isStutter: boolean;
  isSevere: boolean;
  isThermalThrottle: boolean;
}> {
  const safeThreshold = clampGpuFrameTimeThresholdMs(thresholdMs);
  const windowBuf: number[] = [];
  return (points || []).map((pt) => {
    const ft = Number.isFinite(pt.frameTimeMs) && pt.frameTimeMs >= 0 ? pt.frameTimeMs : 0;
    const rollingAvgMs =
      windowBuf.length > 0
        ? Number((windowBuf.reduce((a, b) => a + b, 0) / windowBuf.length).toFixed(2))
        : Number(ft.toFixed(2));
    const spikeMultiplier = Number((ft / Math.max(1, rollingAvgMs)).toFixed(2));
    const exceedsThreshold = ft > safeThreshold;
    const isStutter =
      (windowBuf.length >= 2 && ft >= rollingAvgMs * 1.55 && ft >= 14) ||
      ft >= Math.max(safeThreshold * 2.2, 50);
    const isSevere = ft >= safeThreshold * 1.5 || spikeMultiplier >= 1.9;
    const isThermalThrottle = Boolean(pt.thermalThrottle || pt.estTempC >= 80);

    windowBuf.push(ft);
    if (windowBuf.length > 5) windowBuf.shift();

    return {
      point: pt,
      rollingAvgMs,
      spikeMultiplier,
      exceedsThreshold,
      isStutter,
      isSevere,
      isThermalThrottle,
    };
  });
}

export function evaluateGpuFrameTimeThreshold(
  points: GpuTelemetryPoint[],
  thresholdMs = DEFAULT_GPU_FRAMETIME_THRESHOLD_MS,
  isLive = false
): GpuFrameTimeThresholdStatus {
  const safeThreshold = clampGpuFrameTimeThresholdMs(thresholdMs);
  const approachingThresholdMs = Number((safeThreshold * GPU_FRAMETIME_APPROACHING_RATIO).toFixed(1));
  if (!points || points.length === 0) {
    return {
      thresholdMs: safeThreshold,
      approachingThresholdMs,
      currentFrameTimeMs: 0,
      avgFrameTimeMs: 0,
      p99FrameTimeMs: 0,
      maxFrameTimeMs: 0,
      exceededCount: 0,
      stutterCount: 0,
      severeCount: 0,
      thermalThrottleCount: 0,
      sampleCount: 0,
      exceededPct: 0,
      proximityPct: 0,
      isApproachingLimit: false,
      isCurrentExceeded: false,
      status: 'idle',
      badgeLabel: `Próg stabilności: ≤ ${safeThreshold} ms`,
      detail: 'Uruchom test GPU 3D, aby monitorować skoki czasu klatki i zdarzenia throttlingu.',
    };
  }

  const diags = computeFrameTimeSeriesDiagnostics(points, safeThreshold);
  const fts = points.map((p) => (Number.isFinite(p.frameTimeMs) ? p.frameTimeMs : 0));
  const currentFrameTimeMs = Number((fts[fts.length - 1] ?? 0).toFixed(2));
  const avgFrameTimeMs = Number((fts.reduce((a, b) => a + b, 0) / fts.length).toFixed(2));
  const p99FrameTimeMs = Number(computePercentile(fts, 0.99).toFixed(2));
  const maxFrameTimeMs = Number(Math.max(...fts).toFixed(2));

  let exceededCount = 0;
  let stutterCount = 0;
  let severeCount = 0;
  let thermalThrottleCount = 0;
  for (const d of diags) {
    if (d.exceedsThreshold) {
      exceededCount++;
      if (d.point.frameTimeMs >= safeThreshold * 1.5) severeCount++;
    }
    if (d.isStutter) stutterCount++;
    if (d.isThermalThrottle) thermalThrottleCount++;
  }

  const exceededPct = Number(((exceededCount / points.length) * 100).toFixed(1));
  const proximityPct = Number(
    Math.min(150, Math.max(0, (currentFrameTimeMs / Math.max(1, safeThreshold)) * 100)).toFixed(0)
  );
  const isCurrentExceeded = currentFrameTimeMs > safeThreshold;
  const isApproachingLimit =
    !isCurrentExceeded &&
    currentFrameTimeMs >= approachingThresholdMs &&
    currentFrameTimeMs <= safeThreshold;

  let status: GpuFrameTimeThresholdStatus['status'] = 'ok';
  if (isCurrentExceeded || exceededPct >= 20 || severeCount >= 2) {
    status = 'breach';
  } else if (isApproachingLimit) {
    status = 'approaching';
  } else if (exceededCount > 0 || stutterCount > 0 || thermalThrottleCount > 0) {
    status = 'warning';
  }

  const badgeLabel =
    status === 'breach'
      ? `${isLive ? '🔥 ALERT LIVE' : '🔥 PRZEKROCZONO PRÓG'}: ${currentFrameTimeMs.toFixed(1)} ms > ${safeThreshold} ms (${exceededCount} skoków · ${stutterCount} stutter)`
      : status === 'approaching'
        ? `⚡ ZBLIŻANIE DO LIMITU (${proximityPct}%): ${currentFrameTimeMs.toFixed(1)} / ${safeThreshold} ms`
        : status === 'warning'
          ? `⚠ WYKRYTO SKOKI / STUTTER (${exceededCount}× > ${safeThreshold} ms · ${stutterCount} stutter · szczyt ${maxFrameTimeMs.toFixed(1)} ms)`
          : `✓ FRAME TIME OK (${currentFrameTimeMs.toFixed(1)} / ${safeThreshold} ms)`;

  const detail =
    status === 'breach'
      ? `Przekroczono zdefiniowany próg stabilności (${safeThreshold} ms) w ${exceededCount}/${points.length} próbkach (${exceededPct}%), stutter: ${stutterCount}, P99: ${p99FrameTimeMs.toFixed(1)} ms, szczyt: ${maxFrameTimeMs.toFixed(1)} ms.`
      : status === 'approaching'
        ? `Bieżący czas klatki (${currentFrameTimeMs.toFixed(1)} ms) osiągnął ${proximityPct}% progu stabilności (${safeThreshold} ms; strefa ostrzegawcza od ${approachingThresholdMs.toFixed(1)} ms).`
        : status === 'warning'
          ? `Zarejestrowano ${exceededCount} skok(ów) czasu klatki powyżej ${safeThreshold} ms, ${stutterCount} zdarzeń stutter oraz ${thermalThrottleCount} zdarzeń throttlingu termicznego.`
          : `Wszystkie ${points.length} próbek mieszczą się w limicie stabilności ≤ ${safeThreshold} ms (średnio ${avgFrameTimeMs.toFixed(1)} ms, P99 ${p99FrameTimeMs.toFixed(1)} ms).`;

  return {
    thresholdMs: safeThreshold,
    approachingThresholdMs,
    currentFrameTimeMs,
    avgFrameTimeMs,
    p99FrameTimeMs,
    maxFrameTimeMs,
    exceededCount,
    stutterCount,
    severeCount,
    thermalThrottleCount,
    sampleCount: points.length,
    exceededPct,
    proximityPct,
    isApproachingLimit,
    isCurrentExceeded,
    status,
    badgeLabel,
    detail,
  };
}

export function renderGpuFrameTimeThresholdBadgeHtml(
  state: GpuFrameTimeThresholdStatus,
  isLive = false
): string {
  const pulseClass =
    state.status === 'breach' && isLive
      ? ' is-live-pulse'
      : state.status === 'approaching' || state.isApproachingLimit
        ? ' is-approaching-pulse'
        : '';
  const cls = `gpu-ft-threshold-badge is-${state.status}${pulseClass}`;
  return `
    <span
      class="${cls}"
      data-gpu-ft-threshold-status="${state.status}"
      data-gpu-ft-threshold-ms="${state.thresholdMs}"
      data-gpu-ft-approaching="${state.isApproachingLimit ? 'true' : 'false'}"
      data-gpu-ft-exceeded-count="${state.exceededCount}"
      data-gpu-ft-stutter-count="${state.stutterCount}"
      role="status"
      aria-live="polite"
      title="${escHtml(state.detail)}"
    >
      <span class="gpu-ft-threshold-dot" aria-hidden="true"></span>
      <span>${escHtml(state.badgeLabel)}</span>
    </span>
  `;
}

export function renderGpuFrameTimeColorAlertBarHtml(
  state: GpuFrameTimeThresholdStatus,
  isLive = false
): string {
  const fillWidth = Math.min(100, Math.max(4, state.proximityPct));
  const pulseClass =
    state.status === 'breach' && isLive
      ? ' is-live-pulse'
      : state.status === 'approaching' || state.isApproachingLimit
        ? ' is-approaching-pulse'
        : '';
  const statusHint =
    state.status === 'idle'
      ? `Limit: ${state.thresholdMs} ms · Zbliżanie ≥ ${state.approachingThresholdMs} ms`
      : state.status === 'breach'
        ? `Alert niestabilności! ${state.currentFrameTimeMs.toFixed(1)} ms przekracza limit ${state.thresholdMs} ms (${state.proximityPct}%)`
        : state.status === 'approaching'
          ? `Zbliżanie do progu (${state.proximityPct}%): ${state.currentFrameTimeMs.toFixed(1)} / ${state.thresholdMs} ms`
          : state.status === 'warning'
            ? `Wykryto ${state.exceededCount} skok(ów) > ${state.thresholdMs} ms · bieżąca klatka ${state.currentFrameTimeMs.toFixed(1)} ms`
            : `Stabilny czas klatki (${state.proximityPct}% limitu ${state.thresholdMs} ms)`;

  return `
    <div
      class="gpu-ft-color-alert-bar is-${state.status}${pulseClass}"
      data-gpu-ft-color-alert="${state.status}"
      title="${escHtml(state.detail)}"
    >
      <div class="gpu-ft-color-alert-head">
        <span class="gpu-ft-color-alert-label">${escHtml(statusHint)}</span>
        <span class="font-mono gpu-ft-color-alert-pct">${state.sampleCount > 0 ? `${state.currentFrameTimeMs.toFixed(1)} / ${state.thresholdMs} ms` : `Próg ${state.thresholdMs} ms`}</span>
      </div>
      <div class="gpu-ft-color-alert-track">
        <div class="gpu-ft-color-alert-fill is-${state.status}" style="width:${state.sampleCount > 0 ? fillWidth : 0}%;"></div>
      </div>
    </div>
  `;
}

/**
 * Renders the D3.js Stability Log Frame-Time Line Chart with:
 * - Real-time GPU frame time (ms) history curve + subtle area fill
 * - Rolling moving-average baseline line (dashed slate) to spot stutter immediately
 * - Configurable stability threshold line (> thresholdMs danger band)
 * - Highlighted spike dots (amber breach vs pulsing crimson stutter halo)
 * - Thermal throttling orange diamond markers & optional phase boundaries
 * - Interactive crosshair + hover tooltip and live KPI summary strip
 */
export function renderGpuStabilityLogD3Chart(
  container: HTMLElement,
  points: GpuTelemetryPoint[],
  options: {
    thresholdMs?: number;
    isLive?: boolean;
    height?: number;
    phaseBoundaries?: GpuStabilityPhaseBoundary[];
    sourceLabel?: string;
  } = {}
): GpuFrameTimeThresholdStatus {
  const thresholdMs = clampGpuFrameTimeThresholdMs(
    options.thresholdMs ?? DEFAULT_GPU_FRAMETIME_THRESHOLD_MS
  );
  const isLive = Boolean(options.isLive);
  const height = options.height ?? 225;
  const state = evaluateGpuFrameTimeThreshold(points, thresholdMs, isLive);

  if (!container) return state;
  container.innerHTML = '';

  if (!points || points.length === 0) {
    container.innerHTML = `
      <div style="padding:26px 16px;text-align:center;color:var(--text-muted);font-size:12.5px;border:1px dashed var(--border-hairline);border-radius:10px;background:var(--bg-inset);">
        Uruchom stres-test GPU 3D, Auto-Suite lub Harmonogram GPU, aby zobaczyć wykres D3.js historii czasu klatki (ms), wykrywać <strong>stutter / skoki powyżej ${thresholdMs} ms</strong> i zdarzenia thermal throttlingu.
      </div>
    `;
    return state;
  }

  const diags = computeFrameTimeSeriesDiagnostics(points, thresholdMs);
  const width = Math.max(320, Math.round(container.clientWidth || 760));
  const margin = { top: 22, right: 24, bottom: 34, left: 50 };
  const innerW = Math.max(160, width - margin.left - margin.right);
  const innerH = Math.max(115, height - margin.top - margin.bottom);

  const root = d3.select(container);

  // Real-time KPI summary strip above the D3 SVG
  root
    .append('div')
    .attr('class', 'row-between')
    .style('margin-bottom', '6px')
    .style('padding', '6px 10px')
    .style('border-radius', '8px')
    .style('background', 'var(--bg-inset)')
    .style('border', '1px solid var(--border-hairline)')
    .style('font-size', '11.5px')
    .style('flex-wrap', 'wrap')
    .style('gap', '10px')
    .html(`
      <div class="row-wrap font-mono" style="gap:14px;align-items:center;">
        <span>${isLive ? '<span style="color:#10b981;">● LIVE</span>' : '● LOG'}: <strong style="color:${state.isCurrentExceeded ? '#fb7185' : '#22d3ee'};">${state.currentFrameTimeMs.toFixed(1)} ms</strong></span>
        <span>Śr.: <strong>${state.avgFrameTimeMs.toFixed(1)} ms</strong></span>
        <span>P99: <strong style="color:${state.p99FrameTimeMs > thresholdMs ? '#fbbf24' : '#e2e8f0'};">${state.p99FrameTimeMs.toFixed(1)} ms</strong></span>
        <span>Szczyt: <strong style="color:${state.maxFrameTimeMs > thresholdMs ? '#fb7185' : '#34d399'};">${state.maxFrameTimeMs.toFixed(1)} ms</strong></span>
        <span>Skoki &gt;${thresholdMs}ms: <strong style="color:${state.exceededCount > 0 ? '#fb7185' : '#34d399'};">${state.exceededCount}</strong></span>
        <span>Stutter: <strong style="color:${state.stutterCount > 0 ? '#f43f5e' : '#34d399'};">${state.stutterCount}</strong></span>
        <span>Throttling: <strong style="color:${state.thermalThrottleCount > 0 ? '#fb923c' : '#34d399'};">${state.thermalThrottleCount}</strong></span>
      </div>
      <span class="font-mono" style="color:var(--text-muted);font-size:10.5px;">
        ${escHtml(options.sourceLabel || (isLive ? 'Strumień LIVE' : 'Historia sesji'))} · ${points.length} próbek
      </span>
    `);

  const wrapper = root
    .append('div')
    .style('position', 'relative')
    .style('width', '100%');

  const svg = wrapper
    .append('svg')
    .attr('class', 'gpu-stability-log-d3-svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('width', '100%')
    .attr('height', height)
    .attr('role', 'img')
    .attr(
      'aria-label',
      `Wykres liniowy D3.js Stability Log czasu klatki GPU (ms) z progiem stabilności ${thresholdMs} ms`
    );

  const defs = svg.append('defs');
  const lineColor =
    state.status === 'breach'
      ? '#fb7185'
      : state.status === 'approaching' || state.status === 'warning'
        ? '#fbbf24'
        : '#22d3ee';

  const areaGrad = defs
    .append('linearGradient')
    .attr('id', 'gpu-stability-ft-area-grad')
    .attr('x1', '0%')
    .attr('y1', '0%')
    .attr('x2', '0%')
    .attr('y2', '100%');
  areaGrad.append('stop').attr('offset', '0%').attr('stop-color', lineColor).attr('stop-opacity', 0.24);
  areaGrad.append('stop').attr('offset', '100%').attr('stop-color', lineColor).attr('stop-opacity', 0.01);

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const times = points.map((p, idx) => (Number.isFinite(p.timeSec) ? p.timeSec : idx));
  const xMin = Math.min(...times);
  const xMax = Math.max(xMin + 1, ...times);
  const xScale = d3.scaleLinear().domain([xMin, xMax]).range([0, innerW]);

  const maxFt = Math.max(thresholdMs * 1.4, ...points.map((p) => p.frameTimeMs || 0));
  const yMax = Math.ceil((maxFt * 1.12) / 5) * 5;
  const yScale = d3.scaleLinear().domain([0, Math.max(25, yMax)]).range([innerH, 0]);

  const threshY = yScale(thresholdMs);
  const approachY = yScale(state.approachingThresholdMs);

  // Shaded danger band above thresholdMs
  g.append('rect')
    .attr('class', 'gpu-ft-danger-zone')
    .attr('x', 0)
    .attr('y', 0)
    .attr('width', innerW)
    .attr('height', Math.max(0, threshY))
    .attr(
      'fill',
      state.status === 'breach'
        ? 'rgba(244, 63, 94, 0.16)'
        : state.status === 'approaching' || state.status === 'warning'
          ? 'rgba(245, 158, 11, 0.12)'
          : 'rgba(244, 63, 94, 0.06)'
    );

  // Subtle approaching-limit warning band (80%..100% of thresholdMs)
  g.append('rect')
    .attr('class', 'gpu-ft-approaching-zone')
    .attr('x', 0)
    .attr('y', Math.max(0, threshY))
    .attr('width', innerW)
    .attr('height', Math.max(0, approachY - threshY))
    .attr(
      'fill',
      state.status === 'approaching'
        ? 'rgba(245, 158, 11, 0.12)'
        : 'rgba(245, 158, 11, 0.04)'
    );

  // Horizontal gridlines
  g.append('g')
    .selectAll('line')
    .data(yScale.ticks(5))
    .join('line')
    .attr('x1', 0)
    .attr('x2', innerW)
    .attr('y1', (d) => yScale(d))
    .attr('y2', (d) => yScale(d))
    .attr('stroke', 'rgba(148, 163, 184, 0.14)')
    .attr('stroke-dasharray', '2,3');

  // Optional vertical phase boundary dividers when viewing combined Stability Log phases
  if (options.phaseBoundaries && options.phaseBoundaries.length > 0) {
    options.phaseBoundaries.forEach((b) => {
      const bx = xScale(b.timeSec);
      if (bx <= 0 || bx >= innerW) return;
      g.append('line')
        .attr('class', 'gpu-ft-phase-boundary')
        .attr('x1', bx)
        .attr('x2', bx)
        .attr('y1', 0)
        .attr('y2', innerH)
        .attr('stroke', 'rgba(148, 163, 184, 0.45)')
        .attr('stroke-dasharray', '4,4');
      g.append('text')
        .attr('x', bx + 4)
        .attr('y', 11)
        .attr('fill', '#94a3b8')
        .attr('font-size', '9px')
        .attr('font-family', 'JetBrains Mono, monospace')
        .text(b.label);
    });
  }

  // Approaching-limit guide line (80% of thresholdMs)
  g.append('line')
    .attr('class', 'gpu-ft-approaching-line')
    .attr('x1', 0)
    .attr('x2', innerW)
    .attr('y1', approachY)
    .attr('y2', approachY)
    .attr('stroke', 'rgba(245, 158, 11, 0.55)')
    .attr('stroke-width', state.status === 'approaching' ? 1.5 : 1.0)
    .attr('stroke-dasharray', '3,4');

  // Stability threshold line (> thresholdMs)
  const thresholdColor =
    state.status === 'breach'
      ? '#f43f5e'
      : state.status === 'approaching' || state.status === 'warning'
        ? '#f59e0b'
        : '#38bdf8';

  g.append('line')
    .attr('class', 'gpu-ft-threshold-line')
    .attr('x1', 0)
    .attr('x2', innerW)
    .attr('y1', threshY)
    .attr('y2', threshY)
    .attr('stroke', thresholdColor)
    .attr('stroke-width', state.status === 'breach' ? 2.1 : 1.6)
    .attr('stroke-dasharray', '6,4');

  g.append('text')
    .attr('x', innerW - 4)
    .attr('y', Math.max(11, threshY - 5))
    .attr('text-anchor', 'end')
    .attr('fill', thresholdColor)
    .attr('font-size', '10.5px')
    .attr('font-weight', '700')
    .attr('font-family', 'JetBrains Mono, monospace')
    .text(`Próg stabilności: > ${thresholdMs} ms`);

  // Subtle area under frame-time curve
  const area = d3
    .area<GpuTelemetryPoint>()
    .x((d, idx) => xScale(Number.isFinite(d.timeSec) ? d.timeSec : idx))
    .y0(innerH)
    .y1((d) => yScale(d.frameTimeMs || 0))
    .curve(d3.curveMonotoneX);

  g.append('path')
    .datum(points)
    .attr('fill', 'url(#gpu-stability-ft-area-grad)')
    .attr('d', area);

  // Rolling baseline average curve (dashed slate) to visually contrast sudden stutters
  if (diags.length >= 3) {
    const avgLine = d3
      .line<(typeof diags)[number]>()
      .x((d, idx) => xScale(Number.isFinite(d.point.timeSec) ? d.point.timeSec : idx))
      .y((d) => yScale(d.rollingAvgMs))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(diags)
      .attr('class', 'gpu-ft-rolling-avg-line')
      .attr('fill', 'none')
      .attr('stroke', 'rgba(148, 163, 184, 0.72)')
      .attr('stroke-width', 1.4)
      .attr('stroke-dasharray', '3,3')
      .attr('d', avgLine);
  }

  // Primary GPU frame-time (ms) line
  const line = d3
    .line<GpuTelemetryPoint>()
    .x((d, idx) => xScale(Number.isFinite(d.timeSec) ? d.timeSec : idx))
    .y((d) => yScale(d.frameTimeMs || 0))
    .curve(d3.curveMonotoneX);

  g.append('path')
    .datum(points)
    .attr('class', 'gpu-ft-primary-line')
    .attr('fill', 'none')
    .attr('stroke', lineColor)
    .attr('stroke-width', 2.3)
    .attr('d', line);

  // Outer halo rings for detected stutter spikes (>=1.55x rolling avg or severe stutter)
  const stutterDiags = diags.filter((d) => d.isStutter);
  g.selectAll('circle.gpu-ft-stutter-halo')
    .data(stutterDiags)
    .join('circle')
    .attr('class', 'gpu-ft-stutter-halo')
    .attr('cx', (d) => xScale(d.point.timeSec))
    .attr('cy', (d) => yScale(d.point.frameTimeMs))
    .attr('r', 8)
    .attr('fill', 'rgba(244, 63, 94, 0.22)')
    .attr('stroke', '#f43f5e')
    .attr('stroke-width', 1.1);

  // Highlight frame-time spikes exceeding thresholdMs or stutter spikes
  const spikeDiags = diags.filter((d) => d.exceedsThreshold || d.isStutter);
  g.selectAll('circle.gpu-ft-spike-dot')
    .data(spikeDiags)
    .join('circle')
    .attr('class', 'gpu-ft-spike-dot')
    .attr('cx', (d) => xScale(d.point.timeSec))
    .attr('cy', (d) => yScale(d.point.frameTimeMs))
    .attr('r', (d) => (d.isStutter || d.isSevere ? 4.8 : 3.6))
    .attr('fill', (d) => (d.isStutter || d.isSevere ? '#f43f5e' : '#f59e0b'))
    .attr('stroke', '#ffffff')
    .attr('stroke-width', 1.3);

  // Highlight thermal throttling events as orange diamonds
  const throttlePoints = points.filter((p) => p.thermalThrottle || p.estTempC >= 80);
  g.selectAll('path.gpu-ft-throttle-marker')
    .data(throttlePoints)
    .join('path')
    .attr('class', 'gpu-ft-throttle-marker')
    .attr('d', d3.symbol().type(d3.symbolDiamond).size(54))
    .attr(
      'transform',
      (d) => `translate(${xScale(d.timeSec)}, ${Math.max(8, yScale(d.frameTimeMs) - 10)})`
    )
    .attr('fill', '#f97316')
    .attr('stroke', '#070b14')
    .attr('stroke-width', 1.2);

  // Compact top-left legend inside chart
  const legend = g.append('g').attr('transform', 'translate(4, -7)');
  const legendItems = [
    { color: lineColor, label: 'Frame Time (ms)', dash: '' },
    { color: '#94a3b8', label: 'Średnia krocząca', dash: '3,3' },
  ];
  let lx = 0;
  legendItems.forEach((item) => {
    legend
      .append('line')
      .attr('x1', lx)
      .attr('x2', lx + 14)
      .attr('y1', 0)
      .attr('y2', 0)
      .attr('stroke', item.color)
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', item.dash || null);
    legend
      .append('text')
      .attr('x', lx + 19)
      .attr('y', 3.5)
      .attr('fill', '#cbd5e1')
      .attr('font-size', '9.5px')
      .text(item.label);
    lx += item.label.length * 6 + 30;
  });

  // Axes
  g.append('g')
    .call(d3.axisLeft(yScale).ticks(5).tickFormat((d) => `${d} ms`))
    .call((sel) => sel.select('.domain').attr('stroke', 'rgba(148,163,184,0.28)'))
    .call((sel) => sel.selectAll('.tick line').attr('stroke', 'rgba(148,163,184,0.25)'))
    .call((sel) =>
      sel
        .selectAll('text')
        .attr('fill', '#94a3b8')
        .attr('font-size', '10px')
        .attr('font-family', 'JetBrains Mono, monospace')
    );

  g.append('g')
    .attr('transform', `translate(0,${innerH})`)
    .call(d3.axisBottom(xScale).ticks(6).tickFormat((d) => `${Number(d).toFixed(0)}s`))
    .call((sel) => sel.select('.domain').attr('stroke', 'rgba(148,163,184,0.28)'))
    .call((sel) => sel.selectAll('.tick line').attr('stroke', 'rgba(148,163,184,0.25)'))
    .call((sel) =>
      sel
        .selectAll('text')
        .attr('fill', '#94a3b8')
        .attr('font-size', '10px')
        .attr('font-family', 'JetBrains Mono, monospace')
    );

  // Interactive hover crosshair & tooltip
  const focusLine = g
    .append('line')
    .attr('y1', 0)
    .attr('y2', innerH)
    .attr('stroke', 'rgba(226, 232, 240, 0.35)')
    .attr('stroke-dasharray', '3,3')
    .style('display', 'none');

  const focusDot = g
    .append('circle')
    .attr('r', 5.5)
    .attr('fill', lineColor)
    .attr('stroke', '#ffffff')
    .attr('stroke-width', 2)
    .style('display', 'none');

  const tooltip = wrapper
    .append('div')
    .style('position', 'absolute')
    .style('pointer-events', 'none')
    .style('display', 'none')
    .style('z-index', '15')
    .style('background', 'rgba(9, 14, 26, 0.96)')
    .style('border', `1px solid ${thresholdColor}`)
    .style('border-radius', '8px')
    .style('padding', '8px 10px')
    .style('font-size', '11px')
    .style('line-height', '1.45')
    .style('color', '#e2e8f0')
    .style('box-shadow', '0 8px 24px rgba(0,0,0,0.45)');

  g.append('rect')
    .attr('width', innerW)
    .attr('height', innerH)
    .attr('fill', 'transparent')
    .style('cursor', 'crosshair')
    .on('mousemove', (event: MouseEvent) => {
      const [mx] = d3.pointer(event);
      const tTarget = xScale.invert(mx);
      let nearestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < diags.length; i++) {
        const dist = Math.abs(diags[i].point.timeSec - tTarget);
        if (dist < bestDist) {
          bestDist = dist;
          nearestIdx = i;
        }
      }
      const diag = diags[nearestIdx];
      if (!diag) return;
      const nearest = diag.point;
      const cx = xScale(nearest.timeSec);
      const cy = yScale(nearest.frameTimeMs);

      focusLine.style('display', null).attr('x1', cx).attr('x2', cx);
      focusDot
        .style('display', null)
        .attr('cx', cx)
        .attr('cy', cy)
        .attr('fill', diag.isStutter || diag.exceedsThreshold ? '#f43f5e' : '#22d3ee');

      tooltip
        .style('display', 'block')
        .html(
          `<div class="font-mono"><strong>t = ${nearest.timeSec.toFixed(1)}s</strong> · ${nearest.fps} FPS</div>
           <div class="font-mono">Frame Time: <strong style="color:${diag.exceedsThreshold ? '#fb7185' : '#34d399'};">${nearest.frameTimeMs.toFixed(2)} ms</strong> ${diag.exceedsThreshold ? `<span style="color:#fb7185;">(+${(nearest.frameTimeMs - thresholdMs).toFixed(1)} ms ponad próg!)</span>` : `(≤ ${thresholdMs} ms OK)`}</div>
           <div class="font-mono">Śr. krocząca: <strong>${diag.rollingAvgMs.toFixed(2)} ms</strong> · Mnożnik: <strong style="color:${diag.isStutter ? '#fb7185' : '#cbd5e1'};">×${diag.spikeMultiplier.toFixed(2)}</strong></div>
           <div class="font-mono">Temp GPU: <strong>${nearest.estTempC.toFixed(1)} °C</strong> · Zegar: <strong>${nearest.coreClockMhz} MHz</strong></div>
           ${diag.isStutter ? `<div style="color:#fb7185;font-weight:700;">⚡ Wykryto Stutter / Skok czasu klatki</div>` : ''}
           ${diag.isThermalThrottle ? `<div style="color:#fb923c;font-weight:700;">⚠ Wykryto Thermal Throttling</div>` : ''}`
        );

      const leftPx = Math.min(Math.max(8, margin.left + cx + 12), Math.max(8, width - 260));
      const topPx = Math.max(8, margin.top + cy - 66);
      tooltip.style('left', `${leftPx}px`).style('top', `${topPx}px`);
    })
    .on('mouseleave', () => {
      focusLine.style('display', 'none');
      focusDot.style('display', 'none');
      tooltip.style('display', 'none');
    });

  return state;
}
