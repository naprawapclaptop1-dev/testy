import * as d3 from 'd3';
import { CpuTelemetryPoint } from '../types';

export interface CpuFrequencyStats {
  currentGHz: number;
  avgGHz: number;
  peakGHz: number;
  minGHz: number;
  fluctuationMHz: number;
  sampleCount: number;
}

export function computeCpuFrequencyStats(
  samples: CpuTelemetryPoint[],
  fallbackClockGHz = 2.4
): CpuFrequencyStats {
  if (samples.length === 0) {
    const base = Number(fallbackClockGHz.toFixed(2));
    return {
      currentGHz: base,
      avgGHz: base,
      peakGHz: base,
      minGHz: base,
      fluctuationMHz: 0,
      sampleCount: 0,
    };
  }

  let sum = 0;
  let min = samples[0].estClockGHz;
  let max = samples[0].estClockGHz;
  for (const s of samples) {
    sum += s.estClockGHz;
    if (s.estClockGHz < min) min = s.estClockGHz;
    if (s.estClockGHz > max) max = s.estClockGHz;
  }

  const currentGHz = Number(samples[samples.length - 1].estClockGHz.toFixed(2));
  const avgGHz = Number((sum / samples.length).toFixed(2));
  const peakGHz = Number(max.toFixed(2));
  const minGHz = Number(min.toFixed(2));
  const fluctuationMHz = Math.round((peakGHz - minGHz) * 1000);

  return {
    currentGHz,
    avgGHz,
    peakGHz,
    minGHz,
    fluctuationMHz,
    sampleCount: samples.length,
  };
}

export interface CpuFrequencyChartOptions {
  height?: number;
  isLive?: boolean;
  fallbackClockGHz?: number;
}

/**
 * Renders (or updates in place) a real-time CPU clock frequency graph using D3.js.
 * Visualizes clock fluctuations (GHz / MHz) during benchmarks and continuous stress tests
 * with an average-clock reference line, gradient area fill, live pulse dot, and interactive tooltip.
 */
export function renderCpuFrequencyD3Chart(
  container: HTMLElement,
  samples: CpuTelemetryPoint[],
  options: CpuFrequencyChartOptions = {}
): CpuFrequencyStats {
  const height = options.height ?? 220;
  const isLive = Boolean(options.isLive);
  const stats = computeCpuFrequencyStats(samples, options.fallbackClockGHz ?? 2.4);

  const root = d3.select(container);
  root.selectAll('*').remove();

  if (samples.length === 0) {
    root
      .append('div')
      .attr('class', 'chart-box')
      .attr('data-cpu-freq-empty', 'true')
      .style('height', `${height}px`)
      .style('display', 'flex')
      .style('align-items', 'center')
      .style('justify-content', 'center')
      .style('color', 'var(--text-muted)')
      .style('font-size', '12px')
      .style('text-align', 'center')
      .style('padding', '0 16px')
      .text(
        'Uruchom benchmark lub ciągły stres-test, aby obserwować trendy temperatury i taktowania CPU (D3.js) przez ostatnie 10 minut.'
      );
    return stats;
  }

  const width = 680;
  const margin = { top: 20, right: 54, bottom: 28, left: 54 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  const wrap = root
    .append('div')
    .attr('class', 'chart-box chart-interactive-wrap')
    .attr('data-cpu-freq-d3', 'true');

  const header = wrap
    .append('div')
    .attr('class', 'row-between')
    .style('margin-bottom', '8px')
    .style('font-size', '12px')
    .style('flex-wrap', 'wrap')
    .style('gap', '8px');

  const legend = header.append('div').attr('class', 'row-wrap').style('gap', '14px');
  legend
    .append('span')
    .style('display', 'inline-flex')
    .style('align-items', 'center')
    .style('gap', '6px')
    .style('color', 'var(--text-secondary)')
    .html(
      `<span style="display:inline-block;width:14px;height:2.5px;background:#06b6d4;"></span>Taktowanie CPU (<strong class="font-mono status-cyan">${stats.currentGHz.toFixed(2)} GHz</strong>)`
    );

  legend
    .append('span')
    .style('display', 'inline-flex')
    .style('align-items', 'center')
    .style('gap', '6px')
    .style('color', 'var(--text-secondary)')
    .html(
      `<span style="display:inline-block;width:14px;height:0;border-top:2px dashed #f59e0b;"></span>Temperatura (°C)`
    );

  header
    .append('span')
    .attr('class', 'font-mono')
    .style('color', isLive ? 'var(--accent-cyan)' : 'var(--text-muted)')
    .style('font-size', '11px')
    .text(
      `${isLive ? '● LIVE (10 min) · ' : ''}Min ${stats.minGHz.toFixed(2)} – Max ${stats.peakGHz.toFixed(2)} GHz (${stats.sampleCount} próbek)`
    );

  const svgWrap = wrap.append('div').style('position', 'relative');
  const svg = svgWrap
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('data-cpu-freq-svg', 'true')
    .style('width', '100%')
    .style('height', `${height}px`)
    .style('display', 'block')
    .style('overflow', 'visible');

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const xMin = samples[0].timeSec;
  const xMax = samples[samples.length - 1].timeSec;
  const xDomain: [number, number] = xMax > xMin ? [xMin, xMax] : [Math.max(0, xMin - 1), xMin + 1];

  const yPad = Math.max(0.25, (stats.peakGHz - stats.minGHz) * 0.25);
  const yMin = Math.max(0.5, Number((stats.minGHz - yPad).toFixed(2)));
  const yMax = Number((stats.peakGHz + yPad).toFixed(2));
  const maxTemp = Math.max(100, ...samples.map((s) => s.estTempC ?? 65));

  const xScale = d3.scaleLinear().domain(xDomain).range([0, plotW]);
  const yScaleClock = d3.scaleLinear().domain([yMin, yMax]).range([plotH, 0]);
  const yScaleTemp = d3.scaleLinear().domain([30, Math.ceil(maxTemp / 10) * 10]).range([plotH, 0]);

  // Grid lines
  [0.25, 0.5, 0.75, 1].forEach((f) => {
    const y = plotH * (1 - f);
    g.append('line')
      .attr('x1', 0).attr('x2', plotW)
      .attr('y1', y).attr('y2', y)
      .attr('stroke', 'var(--border-hairline)')
      .attr('stroke-width', 1);
  });

  const lineClock = d3.line<CpuTelemetryPoint>()
    .x((d) => xScale(d.timeSec))
    .y((d) => yScaleClock(d.estClockGHz))
    .curve(d3.curveMonotoneX);

  const lineTemp = d3.line<CpuTelemetryPoint>()
    .x((d) => xScale(d.timeSec))
    .y((d) => yScaleTemp(d.estTempC ?? 60))
    .curve(d3.curveMonotoneX);

  g.append('path')
    .datum(samples)
    .attr('fill', 'none')
    .attr('stroke', '#06b6d4')
    .attr('stroke-width', 2.4)
    .attr('d', lineClock);

  g.append('path')
    .datum(samples)
    .attr('fill', 'none')
    .attr('stroke', '#f59e0b')
    .attr('stroke-width', 2)
    .attr('stroke-dasharray', '4 3')
    .attr('d', lineTemp);

  samples.forEach((d) => {
    if ((d.estTempC ?? 0) >= 85) {
      g.append('circle')
        .attr('cx', xScale(d.timeSec))
        .attr('cy', yScaleTemp(d.estTempC))
        .attr('r', 4)
        .attr('fill', '#f43f5e')
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 1.2);
    }
  });

  const xAxis = d3.axisBottom(xScale).ticks(6).tickFormat((d) => `${Math.round(Number(d))}s`);
  g.append('g')
    .attr('transform', `translate(0,${plotH})`)
    .call(xAxis)
    .selectAll('text')
    .style('fill', 'var(--text-muted)')
    .style('font-size', '10px')
    .style('font-family', 'JetBrains Mono, monospace');

  const yAxisLeft = d3.axisLeft(yScaleClock).ticks(4).tickFormat((d) => `${Number(d).toFixed(2)}G`);
  g.append('g')
    .call(yAxisLeft)
    .selectAll('text')
    .style('fill', '#06b6d4')
    .style('font-size', '10px')
    .style('font-family', 'JetBrains Mono, monospace');

  const yAxisRight = d3.axisRight(yScaleTemp).ticks(4).tickFormat((d) => `${Math.round(Number(d))}°C`);
  g.append('g')
    .attr('transform', `translate(${plotW},0)`)
    .call(yAxisRight)
    .selectAll('text')
    .style('fill', '#f59e0b')
    .style('font-size', '10px')
    .style('font-family', 'JetBrains Mono, monospace');

  const tooltip = svgWrap.append('div').attr('class', 'chart-tooltip').style('opacity', 0);
  const bisectTime = d3.bisector<CpuTelemetryPoint, number>((d) => d.timeSec).center;

  g.append('rect')
    .attr('width', plotW)
    .attr('height', plotH)
    .attr('fill', 'transparent')
    .on('mousemove', (event: MouseEvent) => {
      const [mx] = d3.pointer(event);
      const timeVal = xScale.invert(Math.max(0, Math.min(plotW, mx)));
      const idx = Math.max(0, Math.min(samples.length - 1, bisectTime(samples, timeVal)));
      const pt = samples[idx];
      const tempVal = pt.estTempC ?? 55;
      const throttleMsg = tempVal >= 85 ? '<span class="status-err">(THROTTLING)</span>' : '';

      tooltip
        .style('opacity', 1)
        .style('left', `${event.offsetX + 12}px`)
        .style('top', `${event.offsetY - 28}px`)
        .html(`
          <div class="chart-tooltip-date">Czas: ${pt.timeSec}s (10 min trend)</div>
          <div class="chart-tooltip-row">
            <span class="chart-tooltip-label"><span class="chart-tooltip-swatch" style="background:#06b6d4"></span>Taktowanie:</span>
            <strong>${pt.estClockGHz.toFixed(2)} GHz (${Math.round(pt.estClockGHz * 1000)} MHz)</strong>
          </div>
          <div class="chart-tooltip-row">
            <span class="chart-tooltip-label"><span class="chart-tooltip-swatch" style="background:#f59e0b"></span>Temperatura:</span>
            <strong>${tempVal}°C ${throttleMsg}</strong>
          </div>
          <div class="chart-tooltip-row">
            <span class="chart-tooltip-label">Obciążenie CPU:</span>
            <strong>${pt.loadPct}%</strong>
          </div>
        `);
    })
    .on('mouseleave', () => {
      tooltip.style('opacity', 0);
    });

  return stats;
}
