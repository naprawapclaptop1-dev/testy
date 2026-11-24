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
        'Uruchom benchmark lub ciągły stres-test 100%, aby obserwować wahania częstotliwości taktowania CPU (GHz) w czasie rzeczywistym (D3.js).'
      );
    return stats;
  }

  const width = 680;
  const margin = { top: 20, right: 26, bottom: 28, left: 54 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  const wrap = root
    .append('div')
    .attr('class', 'chart-box chart-interactive-wrap')
    .attr('data-cpu-freq-d3', 'true');

  // Legend & live stats strip
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
      `<span style="display:inline-block;width:14px;height:0;border-top:2px dashed #f59e0b;"></span>Średnie (<strong class="font-mono status-warn">${stats.avgGHz.toFixed(2)} GHz</strong>)`
    );

  header
    .append('span')
    .attr('class', 'font-mono')
    .style('color', isLive ? 'var(--accent-cyan)' : 'var(--text-muted)')
    .style('font-size', '11px')
    .text(
      `${isLive ? '● LIVE · ' : ''}Min ${stats.minGHz.toFixed(2)} – Max ${stats.peakGHz.toFixed(2)} GHz (Δ ${stats.fluctuationMHz} MHz · ${stats.sampleCount} próbek)`
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

  // Gradient definition for area fill
  const gradId = `cpu-freq-grad-${Math.random().toString(36).slice(2, 8)}`;
  const defs = svg.append('defs');
  const linearGrad = defs
    .append('linearGradient')
    .attr('id', gradId)
    .attr('x1', '0%')
    .attr('y1', '0%')
    .attr('x2', '0%')
    .attr('y2', '100%');
  linearGrad.append('stop').attr('offset', '0%').attr('stop-color', '#06b6d4').attr('stop-opacity', 0.34);
  linearGrad.append('stop').attr('offset', '100%').attr('stop-color', '#06b6d4').attr('stop-opacity', 0.02);

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const xMin = samples[0].timeSec;
  const xMax = samples[samples.length - 1].timeSec;
  const xDomain: [number, number] =
    xMax > xMin ? [xMin, xMax] : [Math.max(0, xMin - 1), xMin + 1];

  const yPad = Math.max(0.25, (stats.peakGHz - stats.minGHz) * 0.25);
  const yMin = Math.max(0.5, Number((stats.minGHz - yPad).toFixed(2)));
  const yMax = Number((stats.peakGHz + yPad).toFixed(2));

  const xScale = d3.scaleLinear().domain(xDomain).range([0, plotW]);
  const yScale = d3.scaleLinear().domain([yMin, yMax]).range([plotH, 0]);

  // Horizontal grid lines
  const yTicks = yScale.ticks(4);
  g.append('g')
    .attr('class', 'cpu-freq-grid')
    .selectAll('line')
    .data(yTicks)
    .enter()
    .append('line')
    .attr('x1', 0)
    .attr('x2', plotW)
    .attr('y1', (d) => yScale(d))
    .attr('y2', (d) => yScale(d))
    .attr('stroke', 'var(--border-hairline)')
    .attr('stroke-width', 1);

  // Y Axis (GHz)
  const yAxis = d3
    .axisLeft(yScale)
    .ticks(4)
    .tickFormat((d) => `${Number(d).toFixed(2)}`);
  const yAxisG = g.append('g').attr('class', 'cpu-freq-y-axis').call(yAxis);
  yAxisG.selectAll('path, line').attr('stroke', 'none');
  yAxisG
    .selectAll('text')
    .attr('fill', 'var(--text-muted)')
    .attr('font-size', '10px')
    .attr('font-family', 'JetBrains Mono, monospace');

  // X Axis (seconds)
  const xTickCount = Math.min(6, Math.max(2, samples.length));
  const xAxis = d3
    .axisBottom(xScale)
    .ticks(xTickCount)
    .tickFormat((d) => `${Math.round(Number(d))}s`);
  const xAxisG = g
    .append('g')
    .attr('class', 'cpu-freq-x-axis')
    .attr('transform', `translate(0,${plotH})`)
    .call(xAxis);
  xAxisG.selectAll('path, line').attr('stroke', 'var(--border-hairline)');
  xAxisG
    .selectAll('text')
    .attr('fill', 'var(--text-muted)')
    .attr('font-size', '10px')
    .attr('font-family', 'JetBrains Mono, monospace');

  // Average clock reference line
  const avgY = yScale(stats.avgGHz);
  g.append('line')
    .attr('data-cpu-freq-avg-line', 'true')
    .attr('x1', 0)
    .attr('x2', plotW)
    .attr('y1', avgY)
    .attr('y2', avgY)
    .attr('stroke', '#f59e0b')
    .attr('stroke-width', 1.3)
    .attr('stroke-dasharray', '5 4')
    .attr('opacity', 0.85);

  g.append('text')
    .attr('x', plotW - 4)
    .attr('y', Math.max(11, avgY - 5))
    .attr('text-anchor', 'end')
    .attr('fill', '#f59e0b')
    .attr('font-size', '9.5px')
    .attr('font-family', 'JetBrains Mono, monospace')
    .text(`Śr. ${stats.avgGHz.toFixed(2)} GHz`);

  // Area & Line generators (D3 monotone curve for smooth clock wave visualization)
  const areaGen = d3
    .area<CpuTelemetryPoint>()
    .x((d) => xScale(d.timeSec))
    .y0(plotH)
    .y1((d) => yScale(d.estClockGHz))
    .curve(d3.curveMonotoneX);

  const lineGen = d3
    .line<CpuTelemetryPoint>()
    .x((d) => xScale(d.timeSec))
    .y((d) => yScale(d.estClockGHz))
    .curve(d3.curveMonotoneX);

  if (samples.length >= 2) {
    g.append('path')
      .datum(samples)
      .attr('data-cpu-freq-area', 'true')
      .attr('d', areaGen)
      .attr('fill', `url(#${gradId})`);

    g.append('path')
      .datum(samples)
      .attr('data-cpu-freq-line', 'true')
      .attr('d', lineGen)
      .attr('fill', 'none')
      .attr('stroke', '#06b6d4')
      .attr('stroke-width', 2.4)
      .attr('stroke-linejoin', 'round')
      .attr('stroke-linecap', 'round');
  }

  // Individual telemetry points
  g.selectAll('circle.cpu-freq-dot')
    .data(samples)
    .enter()
    .append('circle')
    .attr('class', 'cpu-freq-dot')
    .attr('cx', (d) => xScale(d.timeSec))
    .attr('cy', (d) => yScale(d.estClockGHz))
    .attr('r', (_d, idx) => (idx === samples.length - 1 ? 4.2 : 2.5))
    .attr('fill', (_d, idx) => (idx === samples.length - 1 ? '#22d3ee' : '#06b6d4'))
    .attr('stroke', 'var(--bg-canvas)')
    .attr('stroke-width', 1.4)
    .style('pointer-events', 'none');

  // Live pulse ring on the latest point when running/stressing
  if (isLive) {
    const latest = samples[samples.length - 1];
    g.append('circle')
      .attr('class', 'cpu-freq-live-pulse')
      .attr('cx', xScale(latest.timeSec))
      .attr('cy', yScale(latest.estClockGHz))
      .attr('r', 8)
      .attr('fill', 'none')
      .attr('stroke', '#22d3ee')
      .attr('stroke-width', 1.5)
      .attr('opacity', 0.65)
      .style('pointer-events', 'none');
  }

  // Interactive hover elements
  const crosshair = g
    .append('line')
    .attr('data-cpu-freq-crosshair', 'true')
    .attr('y1', 0)
    .attr('y2', plotH)
    .attr('stroke', 'var(--accent-cyan)')
    .attr('stroke-width', 1.2)
    .attr('stroke-dasharray', '3 3')
    .attr('opacity', 0)
    .style('pointer-events', 'none');

  const activeDot = g
    .append('circle')
    .attr('data-cpu-freq-active-dot', 'true')
    .attr('r', 5.5)
    .attr('fill', '#22d3ee')
    .attr('stroke', 'var(--bg-canvas)')
    .attr('stroke-width', 2)
    .attr('opacity', 0)
    .style('pointer-events', 'none');

  const tooltip = svgWrap
    .append('div')
    .attr('class', 'chart-tooltip')
    .attr('data-cpu-freq-tooltip', 'true')
    .attr('role', 'tooltip')
    .attr('hidden', '');

  const bisectTime = d3.bisector<CpuTelemetryPoint, number>((d) => d.timeSec).center;

  g.append('rect')
    .attr('class', 'chart-hit-col')
    .attr('data-cpu-freq-overlay', 'true')
    .attr('width', plotW)
    .attr('height', plotH)
    .attr('fill', 'transparent')
    .on('mousemove', (event: MouseEvent) => {
      const [mx] = d3.pointer(event);
      const timeVal = xScale.invert(Math.max(0, Math.min(plotW, mx)));
      const idx = Math.max(0, Math.min(samples.length - 1, bisectTime(samples, timeVal)));
      const pt = samples[idx];
      const cx = xScale(pt.timeSec);
      const cy = yScale(pt.estClockGHz);

      crosshair.attr('x1', cx).attr('x2', cx).attr('opacity', 0.85);
      activeDot.attr('cx', cx).attr('cy', cy).attr('opacity', 1);

      const mhz = Math.round(pt.estClockGHz * 1000);
      const kops = Math.round(pt.opsPerSec / 1000);

      tooltip
        .attr('hidden', null)
        .html(`
          <div class="chart-tooltip-date">Czas: ${pt.timeSec}s</div>
          <div class="chart-tooltip-row">
            <span class="chart-tooltip-label"><span class="chart-tooltip-swatch" style="background:#06b6d4;"></span>Taktowanie</span>
            <strong class="font-mono status-cyan">${pt.estClockGHz.toFixed(2)} GHz (${mhz} MHz)</strong>
          </div>
          <div class="chart-tooltip-row">
            <span class="chart-tooltip-label"><span class="chart-tooltip-swatch" style="background:#10b981;"></span>Obciążenie</span>
            <strong class="font-mono">${pt.loadPct}%</strong>
          </div>
          <div class="chart-tooltip-row">
            <span class="chart-tooltip-label">Przepustowość</span>
            <strong class="font-mono">${kops.toLocaleString('pl-PL')} kOps/s</strong>
          </div>
        `);

      const pctX = ((cx + margin.left) / width) * 100;
      if (pctX > 64) {
        tooltip.style('left', 'auto').style('right', `${Math.max(2, 100 - pctX + 2).toFixed(1)}%`);
      } else {
        tooltip.style('right', 'auto').style('left', `${Math.min(70, Math.max(2, pctX + 2)).toFixed(1)}%`);
      }
      tooltip.style('top', '8px');
    })
    .on('mouseleave', () => {
      crosshair.attr('opacity', 0);
      activeDot.attr('opacity', 0);
      tooltip.attr('hidden', '');
    });

  return stats;
}
