import * as d3 from 'd3';

export interface GpuStabilityPoint {
  timeSec: number;
  stabilityPct: number;
  fps: number;
  frameTimeMs: number;
  thermalThrottle?: boolean;
}

export interface GpuStabilityStats {
  currentPct: number;
  avgPct: number;
  minPct: number;
  maxPct: number;
  trendDeltaPct: number;
  belowWarningCount: number;
  belowCriticalCount: number;
  sampleCount: number;
  verdictLabel: string;
  verdictClass: 'status-ok' | 'status-warn' | 'status-err' | 'status-cyan';
}

export type GpuStabilityWindowMode = 'all' | '60s' | '30s';

export interface GpuStabilityChartOptions {
  height?: number;
  isLive?: boolean;
  windowMode?: GpuStabilityWindowMode;
  onWindowModeChange?: (mode: GpuStabilityWindowMode) => void;
}

export interface GpuStabilityThresholdDefinition {
  pct: number;
  label: string;
  color: string;
  dashStyle: string;
  meaning: string;
}

export const GPU_STABILITY_THRESHOLDS = {
  optimalPct: 90,
  criticalPct: 75,
  items: [
    {
      pct: 90,
      label: 'Próg 90% — Stabilność wzorowa (≥ 90%)',
      color: '#10b981',
      dashStyle: '2px dashed #10b981',
      meaning:
        'Równy czas klatek (frame pacing) bez mikroprzycięć; karta GPU utrzymuje stabilne taktowanie boost i pełny zapas termiczny.',
    },
    {
      pct: 82,
      label: 'Strefa 75%–89% — Wahania wydajności',
      color: '#f59e0b',
      dashStyle: '2px solid #f59e0b',
      meaning:
        'Zauważalne wahania czasu klatek lub fluktuacje taktowania rdzenia pod obciążeniem; warto monitorować temperatury.',
    },
    {
      pct: 75,
      label: 'Próg 75% — Alert stabilności (< 75%)',
      color: '#f43f5e',
      dashStyle: '2px dashed #f43f5e',
      meaning:
        'Krytyczny próg wyzwalający Alert Stabilności na wykresie LIVE — oznacza silne przycięcia klatek, możliwy thermal throttling, limit mocy (VRM/PSU) lub przeciążenie sterownika.',
    },
  ] as readonly GpuStabilityThresholdDefinition[],
} as const;

export interface GpuStabilityAlertState {
  triggered: boolean;
  isLiveAlert: boolean;
  currentPct: number;
  thresholdPct: number;
  dropCountBelow75: number;
  lowestPct: number;
  fpsAtDrop: number;
  frameTimeMsAtDrop: number;
  headline: string;
  detail: string;
}

export function evaluateGpuStabilityAlert(
  points: GpuStabilityPoint[],
  isLive = false
): GpuStabilityAlertState {
  const thresholdPct = GPU_STABILITY_THRESHOLDS.criticalPct;
  if (!points || points.length === 0) {
    return {
      triggered: false,
      isLiveAlert: false,
      currentPct: 0,
      thresholdPct,
      dropCountBelow75: 0,
      lowestPct: 0,
      fpsAtDrop: 0,
      frameTimeMsAtDrop: 0,
      headline: '',
      detail: '',
    };
  }

  const last = points[points.length - 1];
  const currentPct = Number(Math.max(0, Math.min(100, last.stabilityPct)).toFixed(1));
  let dropCountBelow75 = 0;
  let lowestPct = currentPct;

  for (const pt of points) {
    const val = Math.max(0, Math.min(100, pt.stabilityPct));
    if (val < thresholdPct) dropCountBelow75++;
    if (val < lowestPct) lowestPct = val;
  }

  lowestPct = Number(lowestPct.toFixed(1));
  const triggered = currentPct < thresholdPct;
  const isLiveAlert = Boolean(isLive && triggered);

  const headline = isLiveAlert
    ? `ALERT STABILNOŚCI LIVE: ${currentPct.toFixed(1)}% (< ${thresholdPct}%)`
    : triggered
      ? `ALERT STABILNOŚCI GPU: ${currentPct.toFixed(1)}% (< ${thresholdPct}%)`
      : '';

  const detail = triggered
    ? `Stabilność klatek spadła poniżej krytycznego progu ${thresholdPct}% (${Math.round(last.fps)} FPS · ${last.frameTimeMs.toFixed(2)} ms · min sesji: ${lowestPct.toFixed(1)}%). Sprawdź temperatury GPU/VRM, zasilanie oraz obciążenie w tle.`
    : '';

  return {
    triggered,
    isLiveAlert,
    currentPct,
    thresholdPct,
    dropCountBelow75,
    lowestPct,
    fpsAtDrop: Math.round(last.fps),
    frameTimeMsAtDrop: Number(last.frameTimeMs.toFixed(2)),
    headline,
    detail,
  };
}

export function renderGpuStabilityThresholdLegendHtml(
  popoverId = 'gpu-stab-threshold-tooltip',
  align: 'right' | 'center' = 'right'
): string {
  const itemsHtml = GPU_STABILITY_THRESHOLDS.items
    .map(
      (item) => `
      <div class="gpu-stab-legend-item" data-threshold-item="${item.pct}">
        <span class="gpu-stab-legend-line" style="border-top:${item.dashStyle};"></span>
        <div>
          <div style="font-weight:700;color:${item.color};">${item.label}</div>
          <div style="margin-top:2px;color:var(--text-secondary);">${item.meaning}</div>
        </div>
      </div>`
    )
    .join('');

  return `
    <div class="gpu-stab-legend-wrap ${align === 'center' ? 'is-centered' : ''}" data-gpu-stability-threshold-legend="true">
      <button
        type="button"
        class="gpu-stab-legend-trigger"
        aria-describedby="${popoverId}"
        aria-expanded="false"
        title="Najedź lub kliknij, aby sprawdzić znaczenie progów 90% i 75%"
      >
        <span style="display:inline-flex;align-items:center;gap:4px;">
          <span style="display:inline-block;width:10px;height:0;border-top:2px dashed #10b981;"></span>
          <span class="font-mono" style="color:#34d399;">90%</span>
        </span>
        <span style="opacity:0.45;">/</span>
        <span style="display:inline-flex;align-items:center;gap:4px;">
          <span style="display:inline-block;width:10px;height:0;border-top:2px dashed #f43f5e;"></span>
          <span class="font-mono" style="color:#fb7185;">75%</span>
        </span>
        <span>Legenda progów</span>
        <span class="font-mono" style="opacity:0.75;">(?)</span>
      </button>
      <div id="${popoverId}" class="gpu-stab-legend-popover" role="tooltip" data-gpu-stability-threshold-tooltip="true">
        <div class="gpu-stab-legend-title">Znaczenie progów stabilności GPU (90% i 75%)</div>
        ${itemsHtml}
        <div style="padding-top:5px;border-top:1px solid var(--border-hairline);font-size:11px;color:var(--text-muted);">
          Linia cyjanowa przerywana oznacza bieżącą średnią stabilności sesji. Najedź na linie 90% / 75% na wykresie, aby podejrzeć progi bezpośrednio.
        </div>
      </div>
    </div>
  `;
}

export function renderGpuStabilityAlertIndicatorHtml(
  alert: GpuStabilityAlertState,
  isLive = false
): string {
  if (alert.triggered) {
    const label = alert.isLiveAlert
      ? `ALERT STABILNOŚCI < ${alert.thresholdPct}% (${alert.currentPct.toFixed(1)}%)`
      : `SPADEK STABILNOŚCI < ${alert.thresholdPct}% (${alert.currentPct.toFixed(1)}%)`;
    return `
      <span
        class="gpu-stab-alert-badge"
        role="alert"
        aria-live="assertive"
        data-gpu-stability-alert="active"
        title="Alert stabilności GPU wyzwolony — bieżąca stabilność (${alert.currentPct.toFixed(1)}%) spadła poniżej progu ${alert.thresholdPct}%."
      >
        <span class="gpu-stab-alert-dot" aria-hidden="true"></span>
        <span>${label}</span>
      </span>
    `;
  }

  if (isLive) {
    return `
      <span
        class="gpu-stab-alert-badge is-ok"
        role="status"
        aria-live="polite"
        data-gpu-stability-alert="ok"
        title="Monitorowanie na żywo aktywne — alert stabilności włączy się automatycznie przy spadku poniżej ${alert.thresholdPct}%."
      >
        <span class="gpu-stab-alert-dot" aria-hidden="true"></span>
        <span>LIVE · Alert &lt; ${alert.thresholdPct}%: OK${alert.currentPct > 0 ? ` (${alert.currentPct.toFixed(1)}%)` : ''}</span>
      </span>
    `;
  }

  return `
    <span
      class="gpu-stab-alert-badge is-standby"
      role="status"
      data-gpu-stability-alert="standby"
      title="Wskaźnik alertu stabilności GPU — uruchamia się automatycznie, gdy stabilność na wykresie na żywo spadnie poniżej ${alert.thresholdPct}%."
    >
      <span class="gpu-stab-alert-dot" aria-hidden="true"></span>
      <span>Alert stabilności &lt; ${alert.thresholdPct}%: Czuwanie</span>
    </span>
  `;
}

export function renderGpuStabilityAlertBannerHtml(alert: GpuStabilityAlertState): string {
  if (!alert.triggered) return '';
  return `
    <div class="gpu-stab-alert-banner" role="alert" aria-live="assertive" data-gpu-stability-alert-banner="active">
      <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:220px;">
        <span class="gpu-stab-alert-dot" aria-hidden="true"></span>
        <div>
          <strong style="color:#fda4af;">${alert.headline}</strong>
          <div style="font-size:11.5px;color:var(--text-secondary);margin-top:2px;">${alert.detail}</div>
        </div>
      </div>
      <span class="font-mono" style="font-size:11px;color:#fda4af;white-space:nowrap;">
        Spadki &lt;75%: <strong>${alert.dropCountBelow75}</strong> · Min: <strong>${alert.lowestPct.toFixed(1)}%</strong>
      </span>
    </div>
  `;
}

export function filterGpuStabilityWindow(
  points: GpuStabilityPoint[],
  windowMode: GpuStabilityWindowMode = 'all'
): GpuStabilityPoint[] {
  if (!points || points.length === 0 || windowMode === 'all') return points || [];
  const latestSec = points[points.length - 1].timeSec;
  const spanSec = windowMode === '30s' ? 30 : 60;
  const cutoff = latestSec - spanSec;
  const filtered = points.filter((p) => p.timeSec >= cutoff);
  return filtered.length >= 2 ? filtered : points.slice(-2);
}

export function computeGpuStabilityStats(points: GpuStabilityPoint[]): GpuStabilityStats {
  if (!points || points.length === 0) {
    return {
      currentPct: 0,
      avgPct: 0,
      minPct: 0,
      maxPct: 0,
      trendDeltaPct: 0,
      belowWarningCount: 0,
      belowCriticalCount: 0,
      sampleCount: 0,
      verdictLabel: 'Oczekiwanie na próbki',
      verdictClass: 'status-cyan',
    };
  }

  let sum = 0;
  let min = points[0].stabilityPct;
  let max = points[0].stabilityPct;
  let belowWarningCount = 0;
  let belowCriticalCount = 0;

  for (const p of points) {
    const val = Math.max(0, Math.min(100, p.stabilityPct));
    sum += val;
    if (val < min) min = val;
    if (val > max) max = val;
    if (val < 85) belowWarningCount++;
    if (val < 75) belowCriticalCount++;
  }

  const firstPct = points[0].stabilityPct;
  const currentPct = Number(points[points.length - 1].stabilityPct.toFixed(1));
  const avgPct = Number((sum / points.length).toFixed(1));
  const minPct = Number(min.toFixed(1));
  const maxPct = Number(max.toFixed(1));
  const trendDeltaPct = Number((currentPct - firstPct).toFixed(1));

  let verdictLabel = 'Wzorowa stabilność';
  let verdictClass: GpuStabilityStats['verdictClass'] = 'status-ok';
  if (avgPct < 75 || belowCriticalCount >= Math.max(2, Math.ceil(points.length * 0.25))) {
    verdictLabel = 'Niestabilność / Throttling';
    verdictClass = 'status-err';
  } else if (avgPct < 88 || minPct < 80) {
    verdictLabel = 'Lekkie wahania klatek';
    verdictClass = 'status-warn';
  }

  return {
    currentPct,
    avgPct,
    minPct,
    maxPct,
    trendDeltaPct,
    belowWarningCount,
    belowCriticalCount,
    sampleCount: points.length,
    verdictLabel,
    verdictClass,
  };
}

/**
 * Renders an interactive D3.js line chart visualizing GPU frame-pacing stability (%)
 * over time during the current GPU stress test session.
 */
export function renderGpuStabilityD3Chart(
  containerEl: HTMLElement,
  rawPoints: GpuStabilityPoint[],
  options: GpuStabilityChartOptions = {}
): GpuStabilityStats {
  const height = options.height ?? 220;
  const isLive = Boolean(options.isLive);
  const windowMode: GpuStabilityWindowMode = options.windowMode ?? 'all';
  const points = filterGpuStabilityWindow(rawPoints, windowMode);
  const stats = computeGpuStabilityStats(points);
  const alertState = evaluateGpuStabilityAlert(points, isLive);

  const prevLegendWrap = containerEl.querySelector<HTMLElement>('[data-gpu-stability-threshold-legend]');
  const wasLegendOpen = Boolean(prevLegendWrap?.classList.contains('is-open'));

  const root = d3.select(containerEl);
  root.selectAll('*').remove();

  const bindThresholdLegendToggle = (scopeEl: HTMLElement | null) => {
    if (!scopeEl) return;
    const wrapEl = scopeEl.querySelector<HTMLElement>('[data-gpu-stability-threshold-legend]');
    const triggerEl = wrapEl?.querySelector<HTMLButtonElement>('.gpu-stab-legend-trigger');
    if (!wrapEl || !triggerEl) return;
    if (wasLegendOpen) {
      wrapEl.classList.add('is-open');
      triggerEl.setAttribute('aria-expanded', 'true');
    }
    triggerEl.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = wrapEl.classList.toggle('is-open');
      triggerEl.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    triggerEl.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && wrapEl.classList.contains('is-open')) {
        wrapEl.classList.remove('is-open');
        triggerEl.setAttribute('aria-expanded', 'false');
      }
    });
  };

  if (points.length < 2) {
    const emptyBox = root
      .append('div')
      .attr('class', 'chart-box')
      .attr('data-gpu-stability-empty', 'true')
      .style('min-height', `${height}px`)
      .style('display', 'flex')
      .style('flex-direction', 'column')
      .style('align-items', 'center')
      .style('justify-content', 'center')
      .style('gap', '10px')
      .style('color', 'var(--text-muted)')
      .style('font-size', '12px')
      .style('text-align', 'center')
      .style('padding', '14px 16px')
      .html(
        `<span>Oczekiwanie na próbki stabilności GPU (uruchom stres-test 3D, aby obserwować krzywą D3.js w czasie rzeczywistym).</span>
         <div class="row-wrap" style="gap:8px;justify-content:center;align-items:center;">
           ${renderGpuStabilityAlertIndicatorHtml(alertState, isLive)}
           ${renderGpuStabilityThresholdLegendHtml('gpu-stab-threshold-tooltip-empty', 'center')}
         </div>
         <span class="font-mono" style="font-size:11px;opacity:0.85;">Progi: ≥ 90% Stabilny · 75–89% Wahania · &lt; 75% Alert stabilności</span>`
      );
    bindThresholdLegendToggle(emptyBox.node());
    return stats;
  }

  const width = Math.max(540, containerEl.clientWidth || 680);
  const margin = { top: 20, right: 26, bottom: 30, left: 52 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  const wrap = root
    .append('div')
    .attr(
      'class',
      `chart-box chart-interactive-wrap${alertState.triggered ? ' is-stability-alert' : ''}`
    )
    .attr('data-gpu-stability-d3', 'true')
    .attr('data-gpu-stability-alert-state', alertState.triggered ? 'alert' : 'normal');

  // Top KPI, stability alert badge, threshold tooltip legend & time-window controls bar
  const header = wrap
    .append('div')
    .attr('class', 'row-between')
    .style('margin-bottom', '10px')
    .style('flex-wrap', 'wrap')
    .style('gap', '8px')
    .style('font-size', '12px');

  const legend = header.append('div').attr('class', 'row-wrap').style('gap', '14px').style('align-items', 'center');
  legend
    .append('span')
    .style('display', 'inline-flex')
    .style('align-items', 'center')
    .style('gap', '6px')
    .style('color', 'var(--text-secondary)')
    .html(
      `<span style="display:inline-block;width:14px;height:2.5px;background:${alertState.triggered ? '#f43f5e' : '#10b981'};border-radius:2px;"></span>Stabilność: <strong class="font-mono ${alertState.triggered ? 'status-err' : stats.verdictClass}">${stats.currentPct.toFixed(1)}%</strong>`
    );

  legend
    .append('span')
    .style('display', 'inline-flex')
    .style('align-items', 'center')
    .style('gap', '6px')
    .style('color', 'var(--text-secondary)')
    .html(
      `<span style="display:inline-block;width:14px;height:0;border-top:2px dashed #06b6d4;"></span>Średnia sesji: <strong class="font-mono status-cyan">${stats.avgPct.toFixed(1)}%</strong>`
    );

  legend
    .append('span')
    .attr('class', 'font-mono')
    .style('font-size', '11px')
    .style('color', 'var(--text-muted)')
    .text(`Min ${stats.minPct.toFixed(1)}% · Max ${stats.maxPct.toFixed(1)}% · ${stats.sampleCount} próbek`);

  const rightControls = header.append('div').attr('class', 'row-wrap').style('gap', '8px').style('align-items', 'center');

  rightControls.append('span').html(renderGpuStabilityAlertIndicatorHtml(alertState, isLive));

  const thresholdLegendHost = rightControls.append('span').html(renderGpuStabilityThresholdLegendHtml());
  bindThresholdLegendToggle(thresholdLegendHost.node());

  const windowGroup = rightControls
    .append('div')
    .attr('class', 'segmented')
    .attr('role', 'group')
    .attr('aria-label', 'Zakres czasu wykresu stabilności GPU');

  const windowOptions: Array<{ id: GpuStabilityWindowMode; label: string }> = [
    { id: 'all', label: 'Cała sesja' },
    { id: '60s', label: '60s' },
    { id: '30s', label: '30s' },
  ];

  windowOptions.forEach((opt) => {
    windowGroup
      .append('button')
      .attr('type', 'button')
      .attr('class', `segmented-btn ${windowMode === opt.id ? 'active' : ''}`)
      .attr('data-gpu-stab-window', opt.id)
      .style('padding', '3px 8px')
      .style('font-size', '11px')
      .text(opt.label)
      .on('click', () => {
        if (options.onWindowModeChange) {
          options.onWindowModeChange(opt.id);
        } else {
          renderGpuStabilityD3Chart(containerEl, rawPoints, { ...options, windowMode: opt.id });
        }
      });
  });

  if (alertState.triggered) {
    wrap.append('div').html(renderGpuStabilityAlertBannerHtml(alertState));
  }

  const svgWrap = wrap.append('div').style('position', 'relative');
  const gradId = `gpu-stab-area-grad-${Math.random().toString(36).slice(2, 9)}`;

  const svg = svgWrap
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('data-gpu-stability-svg', 'true')
    .style('width', '100%')
    .style('height', `${height}px`)
    .style('display', 'block')
    .style('overflow', 'visible');

  const defs = svg.append('defs');
  const areaGrad = defs
    .append('linearGradient')
    .attr('id', gradId)
    .attr('x1', '0%')
    .attr('y1', '0%')
    .attr('x2', '0%')
    .attr('y2', '100%');
  areaGrad.append('stop').attr('offset', '0%').attr('stop-color', '#10b981').attr('stop-opacity', 0.28);
  areaGrad.append('stop').attr('offset', '65%').attr('stop-color', '#06b6d4').attr('stop-opacity', 0.08);
  areaGrad.append('stop').attr('offset', '100%').attr('stop-color', '#06b6d4').attr('stop-opacity', 0.0);

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const xMin = points[0].timeSec;
  const xMax = points[points.length - 1].timeSec;
  const xDomain: [number, number] = xMax > xMin ? [xMin, xMax] : [Math.max(0, xMin - 1), xMin + 1];

  // Auto-scale Y floor for readability while keeping 100% ceiling and threshold visibility
  const yFloor = Math.max(0, Math.min(70, Math.floor((stats.minPct - 5) / 10) * 10));
  const xScale = d3.scaleLinear().domain(xDomain).range([0, plotW]);
  const yScale = d3.scaleLinear().domain([yFloor, 100]).range([plotH, 0]);

  // Horizontal grid lines
  g.append('g')
    .attr('class', 'grid')
    .call(
      d3
        .axisLeft(yScale)
        .ticks(5)
        .tickSize(-plotW)
        .tickFormat(() => '')
    )
    .call((sel) => sel.select('.domain').remove())
    .selectAll('line')
    .style('stroke', 'var(--border-hairline)')
    .style('stroke-opacity', '0.65');

  // Warning & Critical threshold reference bands/lines
  if (90 >= yFloor) {
    const y90 = yScale(90);
    g.append('line')
      .attr('class', 'gpu-stability-threshold-90')
      .attr('x1', 0)
      .attr('x2', plotW)
      .attr('y1', y90)
      .attr('y2', y90)
      .attr('stroke', 'rgba(16, 185, 129, 0.45)')
      .attr('stroke-width', 1.1)
      .attr('stroke-dasharray', '3 3');
    g.append('text')
      .attr('x', plotW - 4)
      .attr('y', y90 - 4)
      .attr('text-anchor', 'end')
      .style('fill', '#34d399')
      .style('font-size', '9.5px')
      .style('font-family', 'JetBrains Mono, monospace')
      .text('Próg 90%');
  }
  if (75 >= yFloor) {
    const y75 = yScale(75);
    g.append('rect')
      .attr('class', 'gpu-stability-danger-zone')
      .attr('x', 0)
      .attr('y', y75)
      .attr('width', plotW)
      .attr('height', Math.max(0, plotH - y75))
      .attr('fill', alertState.triggered ? 'rgba(244, 63, 94, 0.14)' : 'rgba(244, 63, 94, 0.05)');
    g.append('line')
      .attr('class', 'gpu-stability-threshold-75')
      .attr('x1', 0)
      .attr('x2', plotW)
      .attr('y1', y75)
      .attr('y2', y75)
      .attr('stroke', alertState.triggered ? 'rgba(244, 63, 94, 0.85)' : 'rgba(244, 63, 94, 0.5)')
      .attr('stroke-width', alertState.triggered ? 1.5 : 1.1)
      .attr('stroke-dasharray', '4 3');
    g.append('text')
      .attr('x', plotW - 4)
      .attr('y', y75 - 4)
      .attr('text-anchor', 'end')
      .style('fill', '#fb7185')
      .style('font-size', '9.5px')
      .style('font-family', 'JetBrains Mono, monospace')
      .text('Próg 75% (Alert)');
  }

  // Session average reference line
  const yAvg = yScale(stats.avgPct);
  g.append('line')
    .attr('class', 'gpu-stability-avg-line')
    .attr('x1', 0)
    .attr('x2', plotW)
    .attr('y1', yAvg)
    .attr('y2', yAvg)
    .attr('stroke', '#06b6d4')
    .attr('stroke-width', 1.4)
    .attr('stroke-dasharray', '5 4')
    .attr('opacity', 0.85);

  // Gradient area under the stability line
  const areaGen = d3
    .area<GpuStabilityPoint>()
    .x((d) => xScale(d.timeSec))
    .y0(plotH)
    .y1((d) => yScale(Math.max(yFloor, Math.min(100, d.stabilityPct))))
    .curve(d3.curveMonotoneX);

  g.append('path')
    .datum(points)
    .attr('class', 'gpu-stability-area')
    .attr('fill', `url(#${gradId})`)
    .attr('d', areaGen);

  // Main stability line
  const lineGen = d3
    .line<GpuStabilityPoint>()
    .x((d) => xScale(d.timeSec))
    .y((d) => yScale(Math.max(yFloor, Math.min(100, d.stabilityPct))))
    .curve(d3.curveMonotoneX);

  g.append('path')
    .datum(points)
    .attr('class', 'gpu-stability-line')
    .attr('fill', 'none')
    .attr('stroke', stats.avgPct >= 88 ? '#10b981' : stats.avgPct >= 75 ? '#f59e0b' : '#f43f5e')
    .attr('stroke-width', 2.4)
    .attr('d', lineGen);

  // Highlight drops (< 85%) or thermal throttle samples
  points.forEach((pt) => {
    if (pt.stabilityPct < 85 || pt.thermalThrottle) {
      const isCrit = pt.stabilityPct < 75 || pt.thermalThrottle;
      g.append('circle')
        .attr('class', 'gpu-stability-anomaly-dot')
        .attr('cx', xScale(pt.timeSec))
        .attr('cy', yScale(Math.max(yFloor, Math.min(100, pt.stabilityPct))))
        .attr('r', isCrit ? 4.2 : 3.2)
        .attr('fill', isCrit ? '#f43f5e' : '#f59e0b')
        .attr('stroke', '#0f172a')
        .attr('stroke-width', 1.2);
    }
  });

  // Live endpoint dot (with pulsing outer alert ring when below 75%)
  const lastPt = points[points.length - 1];
  const lastX = xScale(lastPt.timeSec);
  const lastY = yScale(Math.max(yFloor, Math.min(100, lastPt.stabilityPct)));
  if (alertState.triggered) {
    g.append('circle')
      .attr('class', 'gpu-stability-live-alert-ring')
      .attr('cx', lastX)
      .attr('cy', lastY)
      .attr('r', 10)
      .attr('fill', 'rgba(244, 63, 94, 0.24)')
      .attr('stroke', '#f43f5e')
      .attr('stroke-width', 1.5);

    // In-chart SVG visual stability alert pill directly on the live D3 chart
    const svgAlertPill = g
      .append('g')
      .attr('class', 'gpu-stability-svg-alert-pill')
      .attr('data-gpu-stability-svg-alert', 'active')
      .attr('transform', 'translate(8, 6)');
    svgAlertPill
      .append('rect')
      .attr('width', 216)
      .attr('height', 22)
      .attr('rx', 6)
      .attr('fill', 'rgba(136, 19, 55, 0.9)')
      .attr('stroke', '#fb7185')
      .attr('stroke-width', 1.1);
    svgAlertPill
      .append('circle')
      .attr('class', 'gpu-stability-svg-alert-dot')
      .attr('cx', 12)
      .attr('cy', 11)
      .attr('r', 3.8)
      .attr('fill', '#fb7185');
    svgAlertPill
      .append('text')
      .attr('x', 22)
      .attr('y', 14.5)
      .style('fill', '#ffe4e6')
      .style('font-size', '10px')
      .style('font-weight', '700')
      .style('font-family', 'JetBrains Mono, monospace')
      .text(`ALERT STABILNOŚCI < 75% · ${alertState.currentPct.toFixed(1)}%`);
  }
  g.append('circle')
    .attr('cx', lastX)
    .attr('cy', lastY)
    .attr('r', 4.2)
    .attr('fill', lastPt.stabilityPct >= 90 ? '#10b981' : lastPt.stabilityPct >= 75 ? '#f59e0b' : '#f43f5e')
    .attr('stroke', '#ffffff')
    .attr('stroke-width', 1.5);

  // Axes
  const xAxis = d3
    .axisBottom(xScale)
    .ticks(6)
    .tickFormat((d: d3.NumberValue) => `${Math.round(Number(d))}s`);
  g.append('g')
    .attr('transform', `translate(0,${plotH})`)
    .call(xAxis)
    .call((axis) => axis.selectAll('path, line').attr('stroke', 'var(--border-hairline)'))
    .selectAll('text')
    .style('fill', 'var(--text-muted)')
    .style('font-size', '10px')
    .style('font-family', 'JetBrains Mono, monospace');

  const yAxis = d3
    .axisLeft(yScale)
    .ticks(5)
    .tickFormat((d: d3.NumberValue) => `${Math.round(Number(d))}%`);
  g.append('g')
    .call(yAxis)
    .call((axis) => axis.selectAll('path, line').attr('stroke', 'var(--border-hairline)'))
    .selectAll('text')
    .style('fill', '#34d399')
    .style('font-size', '10px')
    .style('font-family', 'JetBrains Mono, monospace');

  // Interactive hover crosshair + focus dot + tooltip
  const focusGroup = g.append('g').style('display', 'none');
  const focusVLine = focusGroup
    .append('line')
    .attr('y1', 0)
    .attr('y2', plotH)
    .attr('stroke', 'rgba(148, 163, 184, 0.55)')
    .attr('stroke-width', 1)
    .attr('stroke-dasharray', '3 3');
  const focusDot = focusGroup
    .append('circle')
    .attr('r', 5)
    .attr('fill', '#10b981')
    .attr('stroke', '#ffffff')
    .attr('stroke-width', 1.8);

  const tooltip = svgWrap.append('div').attr('class', 'chart-tooltip').style('opacity', 0);
  const bisectTime = d3.bisector<GpuStabilityPoint, number>((d) => d.timeSec).center;

  const updateHover = (event: MouseEvent | TouchEvent) => {
    const [mx] = d3.pointer(event, g.node());
    const clampedX = Math.max(0, Math.min(plotW, mx));
    const timeVal = xScale.invert(clampedX);
    const idx = Math.max(0, Math.min(points.length - 1, bisectTime(points, timeVal)));
    const pt = points[idx];
    const clampedStab = Math.max(yFloor, Math.min(100, pt.stabilityPct));
    const px = xScale(pt.timeSec);
    const py = yScale(clampedStab);
    const dotColor = pt.stabilityPct >= 90 ? '#10b981' : pt.stabilityPct >= 75 ? '#f59e0b' : '#f43f5e';
    const deltaFromAvg = Number((pt.stabilityPct - stats.avgPct).toFixed(1));
    const deltaSign = deltaFromAvg > 0 ? `+${deltaFromAvg}%` : `${deltaFromAvg}%`;
    const statusTxt = pt.thermalThrottle
      ? '<span class="status-err">THROTTLING</span>'
      : pt.stabilityPct >= 90
        ? '<span class="status-ok">STABILNY (≥90%)</span>'
        : pt.stabilityPct >= 75
          ? '<span class="status-warn">WAHANIA (75–89%)</span>'
          : '<span class="status-err">ALERT (&lt;75%)</span>';
    const thresholdNote =
      pt.stabilityPct >= 90
        ? '≥ 90%: stabilny frame pacing'
        : pt.stabilityPct >= 75
          ? '75–89%: lekkie wahania taktowania'
          : '< 75%: krytyczny spadek stabilności';

    focusGroup.style('display', null);
    focusVLine.attr('x1', px).attr('x2', px);
    focusDot.attr('cx', px).attr('cy', py).attr('fill', dotColor);

    const isRightHalf = px > plotW * 0.62;
    const tipLeft = isRightHalf ? Math.max(8, px + margin.left - 210) : px + margin.left + 14;
    const tipTop = Math.max(4, py + margin.top - 42);

    tooltip
      .style('opacity', 1)
      .style('left', `${tipLeft}px`)
      .style('top', `${tipTop}px`)
      .html(`
        <div class="chart-tooltip-date">Czas sesji: ${pt.timeSec.toFixed(1)}s · ${statusTxt}</div>
        <div class="chart-tooltip-row">
          <span class="chart-tooltip-label"><span class="chart-tooltip-swatch" style="background:${dotColor}"></span>Stabilność GPU:</span>
          <strong>${pt.stabilityPct.toFixed(1)}% (${deltaSign} vs śr.)</strong>
        </div>
        <div class="chart-tooltip-row">
          <span class="chart-tooltip-label"><span class="chart-tooltip-swatch" style="background:#06b6d4"></span>Wydajność:</span>
          <strong>${Math.round(pt.fps)} FPS · ${pt.frameTimeMs.toFixed(2)} ms</strong>
        </div>
        <div class="chart-tooltip-row" style="font-size:10.5px;opacity:0.85;">
          <span class="chart-tooltip-label">Strefa progu:</span>
          <span>${thresholdNote}</span>
        </div>
      `);
  };

  g.append('rect')
    .attr('class', 'gpu-stability-hover-overlay')
    .attr('width', plotW)
    .attr('height', plotH)
    .attr('fill', 'transparent')
    .style('cursor', 'crosshair')
    .on('mousemove', (event: MouseEvent) => updateHover(event))
    .on('touchmove', (event: TouchEvent) => updateHover(event))
    .on('mouseleave', () => {
      focusGroup.style('display', 'none');
      tooltip.style('opacity', 0);
    });

  // Direct interactive hover targets on the 90% and 75% threshold label badges inside the SVG
  const attachThresholdHoverTarget = (pct: 90 | 75) => {
    if (pct < yFloor) return;
    const def = GPU_STABILITY_THRESHOLDS.items.find((it) => it.pct === pct);
    if (!def) return;
    const ty = yScale(pct);
    g.append('rect')
      .attr('class', `gpu-stability-threshold-hit-${pct}`)
      .attr('x', Math.max(0, plotW - 118))
      .attr('y', Math.max(0, ty - 16))
      .attr('width', 118)
      .attr('height', 18)
      .attr('fill', 'transparent')
      .style('cursor', 'help')
      .on('mouseenter', () => {
        focusGroup.style('display', 'none');
        tooltip
          .style('opacity', 1)
          .style('left', `${Math.max(8, plotW + margin.left - 270)}px`)
          .style('top', `${Math.max(4, ty + margin.top - 10)}px`)
          .html(`
            <div class="chart-tooltip-date" style="color:${def.color};">${def.label}</div>
            <div style="font-size:11px;line-height:1.45;color:var(--text-secondary);max-width:250px;">${def.meaning}</div>
          `);
      })
      .on('mouseleave', () => {
        tooltip.style('opacity', 0);
      });
  };
  attachThresholdHoverTarget(90);
  attachThresholdHoverTarget(75);

  // Footer micro-summary inside widget
  wrap
    .append('div')
    .attr('class', 'row-between')
    .style('margin-top', '8px')
    .style('font-size', '11.5px')
    .style('color', 'var(--text-muted)')
    .style('flex-wrap', 'wrap')
    .style('gap', '8px')
    .html(`
      <span>Werdykt sesji: <strong class="${stats.verdictClass}">${stats.verdictLabel}</strong> · Spadki &lt;85%: <strong class="font-mono">${stats.belowWarningCount}</strong> · Krytyczne &lt;75%: <strong class="font-mono">${stats.belowCriticalCount}</strong></span>
      <span class="font-mono">Trend sesji: <strong class="${stats.trendDeltaPct >= -2 ? 'status-ok' : stats.trendDeltaPct >= -6 ? 'status-warn' : 'status-err'}">${stats.trendDeltaPct > 0 ? `+${stats.trendDeltaPct}%` : `${stats.trendDeltaPct}%`}</strong></span>
    `);

  return stats;
}
