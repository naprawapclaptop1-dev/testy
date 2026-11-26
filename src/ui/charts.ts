import { BatteryHistoryPoint, BatteryPowerCycleEntry } from '../types';
import * as d3 from 'd3';

export interface LineSeries {
  label: string;
  color: string;
  values: number[];
  unit: string;
  min?: number;
  max?: number;
  dashed?: boolean;
}

function escapeAttr(val: string): string {
  return val
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function renderDualLineChart(
  seriesList: LineSeries[],
  xLabels: string[],
  height = 175
): string {
  const width = 680;
  const padL = 44;
  const padR = 44;
  const padT = 18;
  const padB = 26;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const primary = seriesList[0];
  const secondary = seriesList[1];
  const count = Math.max(primary?.values.length ?? 0, secondary?.values.length ?? 0);

  if (count < 2) {
    return `
      <div class="chart-box" style="height:${height}px;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:12px;">
        Uruchom test, aby zarejestrować przebieg telemetrii w czasie rzeczywistym.
      </div>
    `;
  }

  const getBounds = (s: LineSeries) => {
    const min = s.min ?? Math.floor(Math.min(...s.values) * 0.9);
    const max = s.max ?? Math.ceil(Math.max(...s.values, min + 1) * 1.08);
    return { min, max: Math.max(max, min + 1) };
  };

  const buildPath = (s: LineSeries, bounds: { min: number; max: number }) => {
    return s.values
      .map((val, i) => {
        const x = padL + (i / Math.max(1, s.values.length - 1)) * plotW;
        const norm = (val - bounds.min) / (bounds.max - bounds.min);
        const y = padT + plotH - Math.max(0, Math.min(1, norm)) * plotH;
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  };

  const b0 = getBounds(primary);
  const path0 = buildPath(primary, b0);
  const b1 = secondary ? getBounds(secondary) : null;
  const path1 = secondary && b1 ? buildPath(secondary, b1) : '';

  const gridLines = [0, 0.25, 0.5, 0.75, 1]
    .map((f) => {
      const y = padT + plotH * (1 - f);
      const valL = (b0.min + (b0.max - b0.min) * f).toFixed(0);
      const valR = b1 ? (b1.min + (b1.max - b1.min) * f).toFixed(0) : '';
      return `
        <line x1="${padL}" y1="${y.toFixed(1)}" x2="${width - padR}" y2="${y.toFixed(1)}" stroke="var(--border-hairline)" stroke-width="1" />
        <text x="${padL - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" fill="var(--text-muted)" font-size="10" font-family="JetBrains Mono, monospace">${valL}</text>
        ${
          b1
            ? `<text x="${width - padR + 8}" y="${(y + 4).toFixed(1)}" text-anchor="start" fill="var(--text-muted)" font-size="10" font-family="JetBrains Mono, monospace">${valR}</text>`
            : ''
        }
      `;
    })
    .join('');

  const lastLabel = xLabels[xLabels.length - 1] || '';
  const firstLabel = xLabels[0] || '';
  const midLabel = xLabels[Math.floor(xLabels.length / 2)] || '';

  return `
    <div class="chart-box">
      <div class="row-between" style="margin-bottom:8px;font-size:12px;">
        <div class="row-wrap" style="gap:16px;">
          ${seriesList
            .map(
              (s) => `
              <span style="display:inline-flex;align-items:center;gap:6px;color:var(--text-secondary);">
                <span style="display:inline-block;width:14px;height:2px;background:${s.color};"></span>
                ${s.label} (${s.unit})
              </span>`
            )
            .join('')}
        </div>
        <span class="font-mono" style="color:var(--text-muted);font-size:11px;">${count} próbek</span>
      </div>
      <svg viewBox="0 0 ${width} ${height}" style="width:100%;height:${height}px;display:block;">
        ${gridLines}
        <path d="${path0}" fill="none" stroke="${primary.color}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" />
        ${
          path1 && secondary
            ? `<path d="${path1}" fill="none" stroke="${secondary.color}" stroke-width="2" ${secondary.dashed ? 'stroke-dasharray="5 4"' : ''} stroke-linejoin="round" stroke-linecap="round" />`
            : ''
        }
        <text x="${padL}" y="${height - 6}" text-anchor="start" fill="var(--text-muted)" font-size="10" font-family="JetBrains Mono, monospace">${firstLabel}</text>
        <text x="${padL + plotW / 2}" y="${height - 6}" text-anchor="middle" fill="var(--text-muted)" font-size="10" font-family="JetBrains Mono, monospace">${midLabel}</text>
        <text x="${width - padR}" y="${height - 6}" text-anchor="end" fill="var(--text-muted)" font-size="10" font-family="JetBrains Mono, monospace">${lastLabel}</text>
      </svg>
    </div>
  `;
}

export function renderBatteryHistoryChart(
  history: BatteryHistoryPoint[],
  height = 190
): string {
  const width = 680;
  const padL = 44;
  const padR = 44;
  const padT = 18;
  const padB = 26;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  if (history.length < 2) {
    return `
      <div class="chart-box" style="height:${height}px;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:12px;">
        Zbieranie próbek historii baterii...
      </div>
    `;
  }

  const maxPower = Math.max(45, ...history.map((h) => h.powerW));
  const powerCeiling = Math.ceil((maxPower * 1.2) / 10) * 10;
  const count = history.length;

  const coords = history.map((pt, i) => {
    const x = padL + (i / Math.max(1, count - 1)) * plotW;
    const normLevel = Math.max(0, Math.min(1, pt.levelPct / 100));
    const normPower = Math.max(0, Math.min(1, pt.powerW / Math.max(1, powerCeiling)));
    const yLevel = padT + plotH - normLevel * plotH;
    const yPower = padT + plotH - normPower * plotH;
    const exactDate =
      pt.dateTimeLabel ||
      (pt.timestamp
        ? new Date(pt.timestamp).toLocaleString('pl-PL', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
        : pt.timeLabel);
    return { i, x, yLevel, yPower, pt, exactDate };
  });

  const levelPath = coords
    .map((c, idx) => `${idx === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.yLevel.toFixed(1)}`)
    .join(' ');
  const powerPath = coords
    .map((c, idx) => `${idx === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.yPower.toFixed(1)}`)
    .join(' ');

  const gridLines = [0, 0.25, 0.5, 0.75, 1]
    .map((f) => {
      const y = padT + plotH * (1 - f);
      const valL = (100 * f).toFixed(0);
      const valR = (powerCeiling * f).toFixed(0);
      return `
        <line x1="${padL}" y1="${y.toFixed(1)}" x2="${width - padR}" y2="${y.toFixed(1)}" stroke="var(--border-hairline)" stroke-width="1" />
        <text x="${padL - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" fill="var(--text-muted)" font-size="10" font-family="JetBrains Mono, monospace">${valL}</text>
        <text x="${width - padR + 8}" y="${(y + 4).toFixed(1)}" text-anchor="start" fill="var(--text-muted)" font-size="10" font-family="JetBrains Mono, monospace">${valR}</text>
      `;
    })
    .join('');

  const stepW = plotW / Math.max(1, count - 1);
  const hitColumns = coords
    .map((c) => {
      const rx = Math.max(padL, c.x - stepW / 2);
      const rw = Math.min(width - padR, c.x + stepW / 2) - rx;
      return `
        <circle cx="${c.x.toFixed(1)}" cy="${c.yLevel.toFixed(1)}" r="2.6" fill="#10b981" opacity="0.85" pointer-events="none" />
        <circle cx="${c.x.toFixed(1)}" cy="${c.yPower.toFixed(1)}" r="2.4" fill="#f59e0b" opacity="0.85" pointer-events="none" />
        <rect
          class="chart-hit-col"
          x="${rx.toFixed(1)}"
          y="${padT}"
          width="${Math.max(4, rw).toFixed(1)}"
          height="${plotH}"
          fill="transparent"
          data-point-idx="${c.i}"
          data-date="${escapeAttr(c.exactDate)}"
          data-level="${c.pt.levelPct}"
          data-power="${c.pt.powerW.toFixed(1)}"
          data-x="${c.x.toFixed(1)}"
          data-y-level="${c.yLevel.toFixed(1)}"
          data-y-power="${c.yPower.toFixed(1)}"
        />
      `;
    })
    .join('');

  const firstLabel = history[0]?.timeLabel || '';
  const midLabel = history[Math.floor(count / 2)]?.timeLabel || '';
  const lastLabel = history[count - 1]?.timeLabel || '';

  return `
    <div class="chart-box chart-interactive-wrap" data-battery-chart-wrap="true">
      <div class="row-between" style="margin-bottom:8px;font-size:12px;">
        <div class="row-wrap" style="gap:16px;">
          <span style="display:inline-flex;align-items:center;gap:6px;color:var(--text-secondary);">
            <span style="display:inline-block;width:14px;height:2px;background:#10b981;"></span>
            Poziom naładowania (%)
          </span>
          <span style="display:inline-flex;align-items:center;gap:6px;color:var(--text-secondary);">
            <span style="display:inline-block;width:14px;height:2px;background:#f59e0b;"></span>
            Pobór mocy (W)
          </span>
        </div>
        <span class="font-mono" style="color:var(--text-muted);font-size:11px;">${count} próbek · najedź na punkt</span>
      </div>
      <div style="position:relative;">
        <svg viewBox="0 0 ${width} ${height}" data-battery-chart-svg="true" style="width:100%;height:${height}px;display:block;overflow:visible;">
          ${gridLines}
          <path d="${levelPath}" fill="none" stroke="#10b981" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" />
          <path d="${powerPath}" fill="none" stroke="#f59e0b" stroke-width="2" stroke-dasharray="5 4" stroke-linejoin="round" stroke-linecap="round" />
          <line data-chart-crosshair="true" x1="0" y1="${padT}" x2="0" y2="${padT + plotH}" stroke="var(--accent-cyan)" stroke-width="1.2" stroke-dasharray="3 3" opacity="0" pointer-events="none" />
          <circle data-chart-active-level="true" cx="0" cy="0" r="5" fill="#10b981" stroke="var(--bg-canvas)" stroke-width="2" opacity="0" pointer-events="none" />
          <circle data-chart-active-power="true" cx="0" cy="0" r="5" fill="#f59e0b" stroke="var(--bg-canvas)" stroke-width="2" opacity="0" pointer-events="none" />
          ${hitColumns}
          <text x="${padL}" y="${height - 6}" text-anchor="start" fill="var(--text-muted)" font-size="10" font-family="JetBrains Mono, monospace">${escapeAttr(firstLabel)}</text>
          <text x="${padL + plotW / 2}" y="${height - 6}" text-anchor="middle" fill="var(--text-muted)" font-size="10" font-family="JetBrains Mono, monospace">${escapeAttr(midLabel)}</text>
          <text x="${width - padR}" y="${height - 6}" text-anchor="end" fill="var(--text-muted)" font-size="10" font-family="JetBrains Mono, monospace">${escapeAttr(lastLabel)}</text>
        </svg>
        <div class="chart-tooltip" data-chart-tooltip="true" role="tooltip" hidden></div>
      </div>
    </div>
  `;
}

export function bindBatteryHistoryChartTooltip(container: HTMLElement): void {
  const hideTooltip = () => {
    const tooltip = container.querySelector<HTMLElement>('[data-chart-tooltip]');
    const crosshair = container.querySelector<SVGLineElement>('[data-chart-crosshair]');
    const dotLevel = container.querySelector<SVGCircleElement>('[data-chart-active-level]');
    const dotPower = container.querySelector<SVGCircleElement>('[data-chart-active-power]');
    if (tooltip) tooltip.hidden = true;
    if (crosshair) crosshair.setAttribute('opacity', '0');
    if (dotLevel) dotLevel.setAttribute('opacity', '0');
    if (dotPower) dotPower.setAttribute('opacity', '0');
  };

  const showForHit = (hit: Element) => {
    const tooltip = container.querySelector<HTMLElement>('[data-chart-tooltip]');
    const crosshair = container.querySelector<SVGLineElement>('[data-chart-crosshair]');
    const dotLevel = container.querySelector<SVGCircleElement>('[data-chart-active-level]');
    const dotPower = container.querySelector<SVGCircleElement>('[data-chart-active-power]');
    if (!tooltip) return;

    const dateStr = hit.getAttribute('data-date') || '';
    const levelStr = hit.getAttribute('data-level') || '0';
    const powerStr = hit.getAttribute('data-power') || '0.0';
    const xVal = Number(hit.getAttribute('data-x') || '0');
    const yLevelVal = Number(hit.getAttribute('data-y-level') || '0');
    const yPowerVal = Number(hit.getAttribute('data-y-power') || '0');

    if (crosshair) {
      crosshair.setAttribute('x1', String(xVal));
      crosshair.setAttribute('x2', String(xVal));
      crosshair.setAttribute('opacity', '0.85');
    }
    if (dotLevel) {
      dotLevel.setAttribute('cx', String(xVal));
      dotLevel.setAttribute('cy', String(yLevelVal));
      dotLevel.setAttribute('opacity', '1');
    }
    if (dotPower) {
      dotPower.setAttribute('cx', String(xVal));
      dotPower.setAttribute('cy', String(yPowerVal));
      dotPower.setAttribute('opacity', '1');
    }

    tooltip.innerHTML = `
      <div class="chart-tooltip-date">${escapeAttr(dateStr)}</div>
      <div class="chart-tooltip-row">
        <span class="chart-tooltip-label"><span class="chart-tooltip-swatch" style="background:#10b981;"></span>Naładowanie</span>
        <strong class="font-mono status-ok">${escapeAttr(levelStr)}%</strong>
      </div>
      <div class="chart-tooltip-row">
        <span class="chart-tooltip-label"><span class="chart-tooltip-swatch" style="background:#f59e0b;"></span>Pobór mocy</span>
        <strong class="font-mono status-warn">${escapeAttr(powerStr)} W</strong>
      </div>
    `;

    const pctX = (xVal / 680) * 100;
    tooltip.hidden = false;
    if (pctX > 66) {
      tooltip.style.left = 'auto';
      tooltip.style.right = `${Math.max(2, 100 - pctX + 2).toFixed(1)}%`;
    } else {
      tooltip.style.right = 'auto';
      tooltip.style.left = `${Math.min(72, Math.max(2, pctX + 2)).toFixed(1)}%`;
    }
    tooltip.style.top = '8px';
  };

  container.addEventListener('mousemove', (ev) => {
    const target = ev.target as Element | null;
    const hit = target?.closest?.('[data-point-idx]');
    if (hit) {
      showForHit(hit);
    }
  });

  container.addEventListener('mouseleave', hideTooltip);
}

export interface LinearTrendResult {
  slope: number;
  intercept: number;
  predict: (x: number) => number;
}

export function computeLinearTrend(points: Array<{ x: number; y: number }>): LinearTrendResult {
  const n = points.length;
  if (n === 0) {
    return { slope: 0, intercept: 0, predict: () => 0 };
  }
  if (n === 1) {
    const y0 = points[0].y;
    return { slope: 0, intercept: y0, predict: () => y0 };
  }

  let sumX = 0;
  let sumY = 0;
  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
  }
  const meanX = sumX / n;
  const meanY = sumY / n;

  let num = 0;
  let den = 0;
  for (const p of points) {
    const dx = p.x - meanX;
    num += dx * (p.y - meanY);
    den += dx * dx;
  }

  const slope = den > 1e-9 ? num / den : 0;
  const intercept = meanY - slope * meanX;
  return {
    slope,
    intercept,
    predict: (x: number) => slope * x + intercept,
  };
}

export function renderBatteryDegradationTrendChart(
  powerCycles: BatteryPowerCycleEntry[],
  designCapacityMWh: number,
  height = 215
): string {
  const width = 680;
  const padL = 56;
  const padR = 26;
  const padT = 20;
  const padB = 28;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  if (powerCycles.length === 0) {
    return `
      <div class="chart-box" style="height:${height}px;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:12px;">
        Brak zarejestrowanych cykli ładowania do wyznaczenia wykresu degradacji pojemności (mWh).
      </div>
    `;
  }

  const sorted = [...powerCycles].sort(
    (a, b) => a.timestamp - b.timestamp || a.cycleNumber - b.cycleNumber
  );
  const count = sorted.length;
  const minTs = sorted[0].timestamp;
  const maxTs = sorted[count - 1].timestamp;
  const tsSpan = maxTs - minTs;

  const xFractions = sorted.map((entry, idx) => {
    if (count === 1) return 0.5;
    if (tsSpan > 0) return (entry.timestamp - minTs) / tsSpan;
    return idx / (count - 1);
  });

  const trendOverNormX = computeLinearTrend(
    sorted.map((entry, idx) => ({ x: xFractions[idx], y: entry.fullChargeCapacityMWh }))
  );
  const trendOverCycle = computeLinearTrend(
    sorted.map((entry, idx) => ({ x: idx, y: entry.fullChargeCapacityMWh }))
  );

  const designCap = Math.max(1000, designCapacityMWh || sorted[0].designCapacityMWh || 60000);
  const threshold80 = Math.round(designCap * 0.8);

  const capacities = sorted.map((c) => c.fullChargeCapacityMWh);
  const trendStartYVal = trendOverNormX.predict(xFractions[0]);
  const trendEndYVal = trendOverNormX.predict(xFractions[count - 1]);

  const rawMin = Math.min(...capacities, threshold80, trendStartYVal, trendEndYVal);
  const rawMax = Math.max(...capacities, designCap, trendStartYVal, trendEndYVal);
  const minBound = Math.max(0, Math.floor((rawMin * 0.96) / 1000) * 1000);
  const maxBound = Math.max(minBound + 2000, Math.ceil((rawMax * 1.02) / 1000) * 1000);
  const spanY = Math.max(1, maxBound - minBound);

  const mapY = (capMWh: number) => {
    const norm = (capMWh - minBound) / spanY;
    return padT + plotH - Math.max(0, Math.min(1, norm)) * plotH;
  };

  const coords = sorted.map((entry, idx) => {
    const x = padL + xFractions[idx] * plotW;
    const y = mapY(entry.fullChargeCapacityMWh);
    const trendVal = Math.round(trendOverNormX.predict(xFractions[idx]));
    const yTrend = mapY(trendVal);
    return { idx, x, y, yTrend, trendVal, entry };
  });

  const capPath = coords
    .map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
    .join(' ');
  const areaPath =
    count >= 2
      ? `${capPath} L${coords[count - 1].x.toFixed(1)},${(padT + plotH).toFixed(1)} L${coords[0].x.toFixed(1)},${(padT + plotH).toFixed(1)} Z`
      : '';

  const trendLineX1 = coords[0].x;
  const trendLineY1 = mapY(trendStartYVal);
  const trendLineX2 = coords[count - 1].x;
  const trendLineY2 = mapY(trendEndYVal);
  const isDegrading = trendOverCycle.slope < -1;
  const trendColor = isDegrading ? '#f43f5e' : '#10b981';
  const slopeLabel = `${trendOverCycle.slope >= 0 ? '+' : ''}${Math.round(trendOverCycle.slope)} mWh/cykl`;

  const yDesign = mapY(designCap);
  const yThresh80 = mapY(threshold80);

  const gridLines = [0, 0.25, 0.5, 0.75, 1]
    .map((f) => {
      const y = padT + plotH * (1 - f);
      const val = Math.round(minBound + spanY * f);
      return `
        <line x1="${padL}" y1="${y.toFixed(1)}" x2="${width - padR}" y2="${y.toFixed(1)}" stroke="var(--border-hairline)" stroke-width="1" />
        <text x="${padL - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" fill="var(--text-muted)" font-size="10" font-family="JetBrains Mono, monospace">${val.toLocaleString('pl-PL')}</text>
      `;
    })
    .join('');

  const hitColumns = coords
    .map((c, idx) => {
      const prevX = idx > 0 ? (coords[idx - 1].x + c.x) / 2 : padL;
      const nextX = idx < count - 1 ? (c.x + coords[idx + 1].x) / 2 : width - padR;
      const rx = Math.max(padL, prevX);
      const rw = Math.max(10, Math.min(width - padR, nextX) - rx);
      return `
        <circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="3.8" fill="#06b6d4" stroke="var(--bg-canvas)" stroke-width="1.5" pointer-events="none" />
        <rect
          class="chart-hit-col"
          x="${rx.toFixed(1)}"
          y="${padT}"
          width="${rw.toFixed(1)}"
          height="${plotH}"
          fill="transparent"
          data-deg-idx="${c.idx}"
          data-cycle="#${c.entry.cycleNumber}"
          data-date="${escapeAttr(c.entry.dateLabel)}"
          data-full-cap="${c.entry.fullChargeCapacityMWh}"
          data-trend-cap="${c.trendVal}"
          data-wear="${c.entry.cumulativeWearPct.toFixed(1)}"
          data-delta="${c.entry.degradationFromPrevMWh}"
          data-x="${c.x.toFixed(1)}"
          data-y="${c.y.toFixed(1)}"
        />
      `;
    })
    .join('');

  const firstLbl = `${sorted[0].dateLabel} (#${sorted[0].cycleNumber})`;
  const midIdx = Math.floor(count / 2);
  const midLbl = count >= 3 ? `${sorted[midIdx].dateLabel} (#${sorted[midIdx].cycleNumber})` : '';
  const lastLbl =
    count >= 2 ? `${sorted[count - 1].dateLabel} (#${sorted[count - 1].cycleNumber})` : '';

  return `
    <div class="chart-box chart-interactive-wrap" data-degradation-chart-wrap="true">
      <div class="row-between" style="margin-bottom:8px;font-size:12px;flex-wrap:wrap;gap:8px;">
        <div class="row-wrap" style="gap:14px;">
          <span style="display:inline-flex;align-items:center;gap:6px;color:var(--text-secondary);">
            <span style="display:inline-block;width:14px;height:2.5px;background:#06b6d4;"></span>
            Pełna pojemność (mWh)
          </span>
          <span style="display:inline-flex;align-items:center;gap:6px;color:var(--text-secondary);">
            <span style="display:inline-block;width:14px;height:0;border-top:2px dashed ${trendColor};"></span>
            Linia trendu (<strong class="font-mono" style="color:${trendColor};">${slopeLabel}</strong>)
          </span>
          <span style="display:inline-flex;align-items:center;gap:6px;color:var(--text-muted);font-size:11px;">
            <span style="display:inline-block;width:12px;height:0;border-top:1.5px dashed #f59e0b;"></span>
            Próg 80% (${threshold80.toLocaleString('pl-PL')} mWh)
          </span>
        </div>
        <span class="font-mono" style="color:var(--text-muted);font-size:11px;">${count} cykli · najedź na punkt</span>
      </div>
      <div style="position:relative;">
        <svg viewBox="0 0 ${width} ${height}" data-degradation-chart-svg="true" style="width:100%;height:${height}px;display:block;overflow:visible;">
          ${gridLines}
          <line x1="${padL}" y1="${yDesign.toFixed(1)}" x2="${width - padR}" y2="${yDesign.toFixed(1)}" stroke="var(--text-muted)" stroke-width="1" stroke-dasharray="2 4" opacity="0.55" />
          <text x="${width - padR - 4}" y="${Math.max(padT + 10, yDesign - 4).toFixed(1)}" text-anchor="end" fill="var(--text-muted)" font-size="9.5" font-family="JetBrains Mono, monospace">Fabr. ${designCap.toLocaleString('pl-PL')} mWh</text>
          <line x1="${padL}" y1="${yThresh80.toFixed(1)}" x2="${width - padR}" y2="${yThresh80.toFixed(1)}" stroke="#f59e0b" stroke-width="1.2" stroke-dasharray="4 4" opacity="0.7" />
          <text x="${width - padR - 4}" y="${Math.max(padT + 10, yThresh80 - 4).toFixed(1)}" text-anchor="end" fill="#f59e0b" font-size="9.5" font-family="JetBrains Mono, monospace">Próg 80%</text>
          ${areaPath ? `<path d="${areaPath}" fill="rgba(6, 182, 212, 0.11)" />` : ''}
          ${count >= 2 ? `<path d="${capPath}" fill="none" stroke="#06b6d4" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" />` : ''}
          ${
            count >= 2
              ? `<line data-deg-trend-line="true" x1="${trendLineX1.toFixed(1)}" y1="${trendLineY1.toFixed(1)}" x2="${trendLineX2.toFixed(1)}" y2="${trendLineY2.toFixed(1)}" stroke="${trendColor}" stroke-width="2" stroke-dasharray="6 4" opacity="0.92" />`
              : ''
          }
          <line data-deg-crosshair="true" x1="0" y1="${padT}" x2="0" y2="${padT + plotH}" stroke="var(--accent-cyan)" stroke-width="1.2" stroke-dasharray="3 3" opacity="0" pointer-events="none" />
          <circle data-deg-active-dot="true" cx="0" cy="0" r="5.5" fill="#06b6d4" stroke="var(--bg-canvas)" stroke-width="2" opacity="0" pointer-events="none" />
          ${hitColumns}
          <text x="${padL}" y="${height - 6}" text-anchor="start" fill="var(--text-muted)" font-size="10" font-family="JetBrains Mono, monospace">${escapeAttr(firstLbl)}</text>
          ${midLbl ? `<text x="${padL + plotW / 2}" y="${height - 6}" text-anchor="middle" fill="var(--text-muted)" font-size="10" font-family="JetBrains Mono, monospace">${escapeAttr(midLbl)}</text>` : ''}
          ${lastLbl ? `<text x="${width - padR}" y="${height - 6}" text-anchor="end" fill="var(--text-muted)" font-size="10" font-family="JetBrains Mono, monospace">${escapeAttr(lastLbl)}</text>` : ''}
        </svg>
        <div class="chart-tooltip" data-deg-tooltip="true" role="tooltip" hidden></div>
      </div>
    </div>
  `;
}

export function bindBatteryDegradationChartTooltip(container: HTMLElement): void {
  const hideTooltip = () => {
    const tooltip = container.querySelector<HTMLElement>('[data-deg-tooltip]');
    const crosshair = container.querySelector<SVGLineElement>('[data-deg-crosshair]');
    const activeDot = container.querySelector<SVGCircleElement>('[data-deg-active-dot]');
    if (tooltip) tooltip.hidden = true;
    if (crosshair) crosshair.setAttribute('opacity', '0');
    if (activeDot) activeDot.setAttribute('opacity', '0');
  };

  const showForHit = (hit: Element) => {
    const tooltip = container.querySelector<HTMLElement>('[data-deg-tooltip]');
    const crosshair = container.querySelector<SVGLineElement>('[data-deg-crosshair]');
    const activeDot = container.querySelector<SVGCircleElement>('[data-deg-active-dot]');
    if (!tooltip) return;

    const cycleStr = hit.getAttribute('data-cycle') || '';
    const dateStr = hit.getAttribute('data-date') || '';
    const fullCap = Number(hit.getAttribute('data-full-cap') || '0');
    const trendCap = Number(hit.getAttribute('data-trend-cap') || '0');
    const wearStr = hit.getAttribute('data-wear') || '0.0';
    const deltaVal = Number(hit.getAttribute('data-delta') || '0');
    const xVal = Number(hit.getAttribute('data-x') || '0');
    const yVal = Number(hit.getAttribute('data-y') || '0');

    if (crosshair) {
      crosshair.setAttribute('x1', String(xVal));
      crosshair.setAttribute('x2', String(xVal));
      crosshair.setAttribute('opacity', '0.85');
    }
    if (activeDot) {
      activeDot.setAttribute('cx', String(xVal));
      activeDot.setAttribute('cy', String(yVal));
      activeDot.setAttribute('opacity', '1');
    }

    const deltaSign = deltaVal > 0 ? '+' : '';
    const deltaCls = deltaVal < -350 ? 'status-err' : deltaVal < 0 ? 'status-warn' : 'status-ok';

    tooltip.innerHTML = `
      <div class="chart-tooltip-date">Cykl ${escapeAttr(cycleStr)} · ${escapeAttr(dateStr)}</div>
      <div class="chart-tooltip-row">
        <span class="chart-tooltip-label"><span class="chart-tooltip-swatch" style="background:#06b6d4;"></span>Pełna pojemność</span>
        <strong class="font-mono status-cyan">${fullCap.toLocaleString('pl-PL')} mWh</strong>
      </div>
      <div class="chart-tooltip-row">
        <span class="chart-tooltip-label"><span class="chart-tooltip-swatch" style="background:#f43f5e;"></span>Trend (regresja)</span>
        <strong class="font-mono">${trendCap.toLocaleString('pl-PL')} mWh</strong>
      </div>
      <div class="chart-tooltip-row">
        <span class="chart-tooltip-label">Zużycie (Wear)</span>
        <strong class="font-mono">${escapeAttr(wearStr)}%</strong>
      </div>
      <div class="chart-tooltip-row">
        <span class="chart-tooltip-label">Zmiana vs poprz.</span>
        <strong class="font-mono ${deltaCls}">${deltaSign}${deltaVal.toLocaleString('pl-PL')} mWh</strong>
      </div>
    `;

    const pctX = (xVal / 680) * 100;
    tooltip.hidden = false;
    if (pctX > 64) {
      tooltip.style.left = 'auto';
      tooltip.style.right = `${Math.max(2, 100 - pctX + 2).toFixed(1)}%`;
    } else {
      tooltip.style.right = 'auto';
      tooltip.style.left = `${Math.min(70, Math.max(2, pctX + 2)).toFixed(1)}%`;
    }
    tooltip.style.top = '8px';
  };

  container.addEventListener('mousemove', (ev) => {
    const target = ev.target as Element | null;
    const hit = target?.closest?.('[data-deg-idx]');
    if (hit) {
      showForHit(hit);
    }
  });

  container.addEventListener('mouseleave', hideTooltip);
}

export function renderRadarChart(axes: Array<{ label: string; value: number }>): string {
  const size = 270;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = 92;
  const n = axes.length;

  const pointAt = (i: number, ratio: number) => {
    const angle = -Math.PI / 2 + (i * Math.PI * 2) / n;
    return {
      x: cx + Math.cos(angle) * maxR * ratio,
      y: cy + Math.sin(angle) * maxR * ratio,
    };
  };

  const rings = [0.25, 0.5, 0.75, 1]
    .map((r) => {
      const pts = axes.map((_, i) => {
        const p = pointAt(i, r);
        return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      });
      return `<polygon points="${pts.join(' ')}" fill="none" stroke="var(--border-hairline)" stroke-width="1" />`;
    })
    .join('');

  const spokes = axes
    .map((a, i) => {
      const outer = pointAt(i, 1);
      const lbl = pointAt(i, 1.24);
      return `
        <line x1="${cx}" y1="${cy}" x2="${outer.x.toFixed(1)}" y2="${outer.y.toFixed(1)}" stroke="var(--border-hairline)" stroke-width="1" />
        <text x="${lbl.x.toFixed(1)}" y="${(lbl.y + 4).toFixed(1)}" text-anchor="middle" fill="var(--text-secondary)" font-size="11" font-family="JetBrains Mono, monospace">${a.label} (${a.value})</text>
      `;
    })
    .join('');

  const dataPts = axes
    .map((a, i) => {
      const p = pointAt(i, Math.max(0.08, Math.min(1, a.value / 100)));
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(' ');

  const dots = axes
    .map((a, i) => {
      const p = pointAt(i, Math.max(0.08, Math.min(1, a.value / 100)));
      return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" fill="var(--accent-cyan)" />`;
    })
    .join('');

  return `
    <svg viewBox="0 0 ${size} ${size}" style="width:100%;max-width:290px;height:auto;margin:0 auto;display:block;">
      ${rings}
      ${spokes}
      <polygon points="${dataPts}" fill="var(--accent-cyan-dim)" stroke="var(--accent-cyan)" stroke-width="2" />
      ${dots}
    </svg>
  `;
}

export interface BatteryWearLevelTrendPoint {
  id: string;
  date: Date;
  timestamp: number;
  dateLabel: string;
  cycleNumber: number;
  wearLevelPct: number;
  healthPct: number;
  fullChargeCapacityMWh: number;
  designCapacityMWh: number;
  degradationFromPrevMWh: number;
  source: 'auto' | 'manual' | 'baseline';
}

export interface BatteryWearLevelTrendSummary {
  points: BatteryWearLevelTrendPoint[];
  firstWearPct: number;
  latestWearPct: number;
  wearIncreasePct: number;
  spanDays: number;
  wearRatePctPerMonth: number;
  wearRatePctPerCycle: number;
  trendSlopePerDay: number;
  trendStartWearPct: number;
  trendEndWearPct: number;
}

export function buildBatteryWearLevelTrendSeries(
  powerCycles: BatteryPowerCycleEntry[]
): BatteryWearLevelTrendSummary {
  const sorted = [...(powerCycles || [])]
    .filter((c) => Number.isFinite(c.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp || a.cycleNumber - b.cycleNumber);

  if (sorted.length === 0) {
    return {
      points: [],
      firstWearPct: 0,
      latestWearPct: 0,
      wearIncreasePct: 0,
      spanDays: 0,
      wearRatePctPerMonth: 0,
      wearRatePctPerCycle: 0,
      trendSlopePerDay: 0,
      trendStartWearPct: 0,
      trendEndWearPct: 0,
    };
  }

  const points: BatteryWearLevelTrendPoint[] = sorted.map((entry) => {
    const design = Math.max(1, entry.designCapacityMWh || 56000);
    const full = Math.max(0, Math.min(design, entry.fullChargeCapacityMWh || design));
    const computedWear = Number(
      Math.max(0, Math.min(100, ((design - full) / design) * 100)).toFixed(2)
    );
    const wearLevelPct =
      Number.isFinite(entry.cumulativeWearPct) && entry.cumulativeWearPct >= 0
        ? Number(Math.min(100, entry.cumulativeWearPct).toFixed(2))
        : computedWear;
    const healthPct = Number(Math.max(0, 100 - wearLevelPct).toFixed(2));
    return {
      id: entry.id,
      date: new Date(entry.timestamp),
      timestamp: entry.timestamp,
      dateLabel:
        entry.dateLabel ||
        new Date(entry.timestamp).toLocaleDateString('pl-PL', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }),
      cycleNumber: entry.cycleNumber,
      wearLevelPct,
      healthPct,
      fullChargeCapacityMWh: Math.round(full),
      designCapacityMWh: Math.round(design),
      degradationFromPrevMWh: Math.round(entry.degradationFromPrevMWh || 0),
      source: entry.source,
    };
  });

  const first = points[0];
  const last = points[points.length - 1];
  const spanDays = Number(
    Math.max(0, (last.timestamp - first.timestamp) / 86_400_000).toFixed(1)
  );
  const wearIncreasePct = Number((last.wearLevelPct - first.wearLevelPct).toFixed(2));
  const cycleSpan = Math.max(1, last.cycleNumber - first.cycleNumber);
  const wearRatePctPerCycle = Number(
    (Math.max(0, wearIncreasePct) / cycleSpan).toFixed(4)
  );

  // OLS linear regression of wearLevelPct over elapsed days
  const trendInput = points.map((p, idx) => ({
    x: spanDays > 0 ? (p.timestamp - first.timestamp) / 86_400_000 : idx,
    y: p.wearLevelPct,
  }));
  const trend = computeLinearTrend(trendInput);
  const xStart = trendInput[0].x;
  const xEnd = trendInput[trendInput.length - 1].x;
  const trendStartWearPct = Number(
    Math.max(0, Math.min(100, trend.predict(xStart))).toFixed(2)
  );
  const trendEndWearPct = Number(
    Math.max(0, Math.min(100, trend.predict(xEnd))).toFixed(2)
  );
  const trendSlopePerDay = spanDays > 0 ? Number(trend.slope.toFixed(5)) : 0;
  const wearRatePctPerMonth =
    spanDays >= 1
      ? Number(Math.max(0, trend.slope * 30.4375).toFixed(2))
      : Number(Math.max(0, wearRatePctPerCycle * 20).toFixed(2));

  return {
    points,
    firstWearPct: first.wearLevelPct,
    latestWearPct: last.wearLevelPct,
    wearIncreasePct,
    spanDays,
    wearRatePctPerMonth,
    wearRatePctPerCycle,
    trendSlopePerDay,
    trendStartWearPct,
    trendEndWearPct,
  };
}

export function renderBatteryWearLevelTrendChartD3(
  container: HTMLElement,
  powerCycles: BatteryPowerCycleEntry[],
  height = 235
): BatteryWearLevelTrendSummary {
  const summary = buildBatteryWearLevelTrendSeries(powerCycles);
  const root = d3.select(container);
  root.selectAll('*').remove();

  if (summary.points.length === 0) {
    root
      .append('div')
      .attr('class', 'chart-box')
      .style('height', `${height}px`)
      .style('display', 'flex')
      .style('align-items', 'center')
      .style('justify-content', 'center')
      .style('color', 'var(--text-muted)')
      .style('font-size', '12px')
      .text(
        'Brak zapisanych cykli w powerCycles — zarejestruj sesję ładowania, aby wyświetlić trend zużycia (Wear Level %).'
      );
    return summary;
  }

  const data = summary.points;
  const width = Math.max(580, Math.min(1100, container.clientWidth || 780));
  const margin = { top: 28, right: 62, bottom: 42, left: 56 };
  const plotW = Math.max(220, width - margin.left - margin.right);
  const plotH = Math.max(120, height - margin.top - margin.bottom);

  // Compact header summary bar
  const headerBar = root
    .append('div')
    .attr('class', 'row-between')
    .style('margin-bottom', '6px')
    .style('font-size', '11.5px')
    .style('flex-wrap', 'wrap')
    .style('gap', '8px');

  headerBar.html(`
    <div class="row-wrap" style="gap:14px;align-items:center;">
      <span style="display:inline-flex;align-items:center;gap:6px;color:var(--text-secondary);">
        <span style="display:inline-block;width:14px;height:2.5px;background:#06b6d4;"></span>
        Wear Level (%) — dane z powerCycles
      </span>
      <span style="display:inline-flex;align-items:center;gap:6px;color:var(--text-secondary);">
        <span style="display:inline-block;width:14px;height:0;border-top:2px dashed #f43f5e;"></span>
        Trend regresji (<strong class="font-mono" style="color:#fb7185;">+${summary.wearRatePctPerMonth.toFixed(2)}%/mies.</strong>)
      </span>
      <span style="display:inline-flex;align-items:center;gap:6px;color:var(--text-secondary);">
        <span style="display:inline-block;width:14px;height:0;border-top:2px dashed #f59e0b;"></span>
        Cykle ładowania (#)
      </span>
    </div>
    <span class="font-mono" style="color:var(--text-muted);font-size:11px;">
      ${data.length} wpisów · Zakres: ${summary.spanDays >= 1 ? `${summary.spanDays.toFixed(0)} dni` : 'bieżąca sesja'} · Zużycie: <strong style="color:${summary.latestWearPct >= 30 ? '#fb7185' : summary.latestWearPct >= 20 ? '#fbbf24' : '#22d3ee'};">${summary.latestWearPct.toFixed(1)}%</strong>
    </span>
  `);

  const wrapper = root
    .append('div')
    .style('position', 'relative')
    .style('width', '100%')
    .style('overflow-x', 'auto');

  const svg = wrapper
    .append('svg')
    .attr('class', 'bat-wear-trend-d3-svg')
    .attr('width', '100%')
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('role', 'img')
    .attr('aria-label', 'Wykres trendu zużycia baterii (Wear Level %) w czasie na podstawie powerCycles')
    .style('display', 'block');

  const defs = svg.append('defs');
  const wearGrad = defs
    .append('linearGradient')
    .attr('id', 'bat-wear-powercycles-grad')
    .attr('x1', '0%')
    .attr('y1', '0%')
    .attr('x2', '0%')
    .attr('y2', '100%');
  wearGrad.append('stop').attr('offset', '0%').attr('stop-color', '#06b6d4').attr('stop-opacity', 0.34);
  wearGrad.append('stop').attr('offset', '100%').attr('stop-color', '#06b6d4').attr('stop-opacity', 0.02);

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  // Time scale across actual powerCycles span (handle single-point or identical-timestamp edge cases)
  const minTs = data[0].timestamp;
  const maxTs = data[data.length - 1].timestamp;
  const paddedDomain: [Date, Date] =
    maxTs > minTs
      ? [new Date(minTs), new Date(maxTs)]
      : [new Date(minTs - 86_400_000), new Date(maxTs + 86_400_000)];

  const xScale = d3.scaleTime().domain(paddedDomain).range([0, plotW]);

  const peakWear = Math.max(
    25,
    summary.latestWearPct,
    summary.trendEndWearPct,
    d3.max(data, (d) => d.wearLevelPct) || 15
  );
  const yWearMax = Math.min(100, Math.max(35, Math.ceil((peakWear * 1.2) / 5) * 5));
  const yWearScale = d3.scaleLinear().domain([0, yWearMax]).range([plotH, 0]);

  const maxCycles = Math.max(20, d3.max(data, (d) => d.cycleNumber) || 50);
  const yCyclesScale = d3
    .scaleLinear()
    .domain([0, Math.ceil((maxCycles * 1.15) / 10) * 10])
    .range([plotH, 0]);

  // Shaded critical wear band (>= 30% wear = <= 70% health)
  if (yWearMax >= 30) {
    const y30 = yWearScale(30);
    g.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', plotW)
      .attr('height', Math.max(0, y30))
      .attr('fill', 'rgba(244, 63, 94, 0.09)');
  }

  // Horizontal gridlines
  g.append('g')
    .selectAll('line')
    .data(yWearScale.ticks(5))
    .join('line')
    .attr('x1', 0)
    .attr('x2', plotW)
    .attr('y1', (d) => yWearScale(d))
    .attr('y2', (d) => yWearScale(d))
    .attr('stroke', 'rgba(148, 163, 184, 0.14)')
    .attr('stroke-dasharray', '2,3');

  // Reference wear lines: 20% (warning) and 30% (critical)
  const drawWearRef = (pct: number, color: string, label: string) => {
    if (pct > yWearMax) return;
    const y = yWearScale(pct);
    g.append('line')
      .attr('class', `bat-wear-ref-${pct}`)
      .attr('x1', 0)
      .attr('x2', plotW)
      .attr('y1', y)
      .attr('y2', y)
      .attr('stroke', color)
      .attr('stroke-width', 1.25)
      .attr('stroke-dasharray', '5,4')
      .attr('opacity', 0.85);
    g.append('text')
      .attr('x', plotW - 4)
      .attr('y', Math.max(10, y - 4))
      .attr('text-anchor', 'end')
      .attr('fill', color)
      .attr('font-size', '9.5px')
      .attr('font-weight', '700')
      .attr('font-family', 'JetBrains Mono, monospace')
      .text(label);
  };
  drawWearRef(20, '#f59e0b', '20% zużycia (80% kondycji)');
  drawWearRef(30, '#f43f5e', '30% zużycia (próg wymiany)');

  // Wear area & line
  const wearArea = d3
    .area<BatteryWearLevelTrendPoint>()
    .x((d) => xScale(d.date))
    .y0(plotH)
    .y1((d) => yWearScale(d.wearLevelPct))
    .curve(d3.curveMonotoneX);

  const wearLine = d3
    .line<BatteryWearLevelTrendPoint>()
    .x((d) => xScale(d.date))
    .y((d) => yWearScale(d.wearLevelPct))
    .curve(d3.curveMonotoneX);

  if (data.length >= 2) {
    g.append('path')
      .datum(data)
      .attr('fill', 'url(#bat-wear-powercycles-grad)')
      .attr('d', wearArea);

    g.append('path')
      .datum(data)
      .attr('class', 'bat-wear-level-line')
      .attr('fill', 'none')
      .attr('stroke', '#06b6d4')
      .attr('stroke-width', 2.5)
      .attr('d', wearLine);

    // OLS regression trendline for long-term wear trajectory
    g.append('line')
      .attr('class', 'bat-wear-regression-line')
      .attr('x1', xScale(data[0].date))
      .attr('y1', yWearScale(summary.trendStartWearPct))
      .attr('x2', xScale(data[data.length - 1].date))
      .attr('y2', yWearScale(summary.trendEndWearPct))
      .attr('stroke', '#f43f5e')
      .attr('stroke-width', 1.8)
      .attr('stroke-dasharray', '6,4')
      .attr('opacity', 0.9);

    // Secondary curve: power cycle count
    const cyclesLine = d3
      .line<BatteryWearLevelTrendPoint>()
      .x((d) => xScale(d.date))
      .y((d) => yCyclesScale(d.cycleNumber))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(data)
      .attr('class', 'bat-wear-cycles-line')
      .attr('fill', 'none')
      .attr('stroke', '#f59e0b')
      .attr('stroke-width', 1.9)
      .attr('stroke-dasharray', '4,3')
      .attr('d', cyclesLine);
  }

  // Data point circles for every powerCycle entry
  g.selectAll('circle.bat-wear-cycle-dot')
    .data(data)
    .join('circle')
    .attr('class', 'bat-wear-cycle-dot')
    .attr('cx', (d) => xScale(d.date))
    .attr('cy', (d) => yWearScale(d.wearLevelPct))
    .attr('r', (d) => (d.source === 'manual' || d.source === 'auto' ? 4.5 : 3.6))
    .attr('fill', (d) =>
      d.wearLevelPct >= 30 ? '#f43f5e' : d.wearLevelPct >= 20 ? '#f59e0b' : '#06b6d4'
    )
    .attr('stroke', '#070b14')
    .attr('stroke-width', 1.5);

  // Axes
  const timeFmt = summary.spanDays > 120 ? d3.timeFormat('%m.%Y') : d3.timeFormat('%d.%m');
  const xAxis = d3
    .axisBottom(xScale)
    .ticks(Math.min(6, Math.max(2, data.length)))
    .tickFormat(timeFmt as any);
  g.append('g')
    .attr('transform', `translate(0,${plotH})`)
    .call(xAxis)
    .call((sel) => sel.select('.domain').attr('stroke', 'rgba(148,163,184,0.28)'))
    .call((sel) => sel.selectAll('.tick line').attr('stroke', 'rgba(148,163,184,0.25)'))
    .selectAll('text')
    .style('fill', 'var(--text-muted)')
    .style('font-size', '10px')
    .style('font-family', 'JetBrains Mono, monospace');

  g.append('g')
    .call(d3.axisLeft(yWearScale).ticks(5).tickFormat((d) => `${d}%`))
    .call((sel) => sel.select('.domain').attr('stroke', 'rgba(148,163,184,0.28)'))
    .selectAll('text')
    .style('fill', '#06b6d4')
    .style('font-size', '10px')
    .style('font-family', 'JetBrains Mono, monospace');

  g.append('g')
    .attr('transform', `translate(${plotW},0)`)
    .call(d3.axisRight(yCyclesScale).ticks(5).tickFormat((d) => `#${d}`))
    .call((sel) => sel.select('.domain').attr('stroke', 'rgba(148,163,184,0.28)'))
    .selectAll('text')
    .style('fill', '#f59e0b')
    .style('font-size', '10px')
    .style('font-family', 'JetBrains Mono, monospace');

  g.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -plotH / 2)
    .attr('y', -42)
    .attr('text-anchor', 'middle')
    .style('fill', '#06b6d4')
    .style('font-size', '10.5px')
    .style('font-weight', '600')
    .text('Wear Level (%)');

  g.append('text')
    .attr('transform', 'rotate(90)')
    .attr('x', plotH / 2)
    .attr('y', -plotW - 46)
    .attr('text-anchor', 'middle')
    .style('fill', '#f59e0b')
    .style('font-size', '10.5px')
    .style('font-weight', '600')
    .text('Power Cycles (#)');

  // Interactive hover crosshair & tooltip
  const focusLine = g
    .append('line')
    .attr('y1', 0)
    .attr('y2', plotH)
    .attr('stroke', 'rgba(226, 232, 240, 0.35)')
    .attr('stroke-dasharray', '3,3')
    .style('display', 'none');

  const focusDot = g
    .append('circle')
    .attr('r', 6)
    .attr('fill', '#06b6d4')
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
    .style('border', '1px solid rgba(6, 182, 212, 0.45)')
    .style('border-radius', '8px')
    .style('padding', '8px 10px')
    .style('font-size', '11px')
    .style('line-height', '1.45')
    .style('color', '#e2e8f0')
    .style('box-shadow', '0 8px 24px rgba(0,0,0,0.45)');

  g.append('rect')
    .attr('width', plotW)
    .attr('height', plotH)
    .attr('fill', 'transparent')
    .style('cursor', 'crosshair')
    .on('mousemove', (event: MouseEvent) => {
      const [mx] = d3.pointer(event);
      const hoverTs = xScale.invert(mx).getTime();
      let nearest = data[0];
      let bestDist = Infinity;
      for (const pt of data) {
        const dist = Math.abs(pt.timestamp - hoverTs);
        if (dist < bestDist) {
          bestDist = dist;
          nearest = pt;
        }
      }
      if (!nearest) return;

      const cx = xScale(nearest.date);
      const cy = yWearScale(nearest.wearLevelPct);
      const srcName =
        nearest.source === 'auto'
          ? 'Auto Battery API'
          : nearest.source === 'manual'
            ? 'Wpis ręczny'
            : 'Kalibracja bazowa';

      focusLine.style('display', null).attr('x1', cx).attr('x2', cx);
      focusDot
        .style('display', null)
        .attr('cx', cx)
        .attr('cy', cy)
        .attr(
          'fill',
          nearest.wearLevelPct >= 30
            ? '#f43f5e'
            : nearest.wearLevelPct >= 20
              ? '#f59e0b'
              : '#06b6d4'
        );

      tooltip
        .style('display', 'block')
        .html(
          `<div class="font-mono"><strong>Cykl #${nearest.cycleNumber}</strong> · ${escapeAttr(nearest.dateLabel)}</div>
           <div class="font-mono">Zużycie (Wear): <strong style="color:${nearest.wearLevelPct >= 30 ? '#fb7185' : nearest.wearLevelPct >= 20 ? '#fbbf24' : '#22d3ee'};">${nearest.wearLevelPct.toFixed(2)}%</strong> (Kondycja ${nearest.healthPct.toFixed(1)}%)</div>
           <div class="font-mono">Pojemność: <strong>${nearest.fullChargeCapacityMWh.toLocaleString('pl-PL')}</strong> / ${nearest.designCapacityMWh.toLocaleString('pl-PL')} mWh</div>
           <div class="font-mono">Zmiana vs poprz.: <strong style="color:${nearest.degradationFromPrevMWh < 0 ? '#fbbf24' : '#34d399'};">${nearest.degradationFromPrevMWh > 0 ? '+' : ''}${nearest.degradationFromPrevMWh.toLocaleString('pl-PL')} mWh</strong> · ${srcName}</div>`
        );

      const leftPx = Math.min(Math.max(8, margin.left + cx + 12), Math.max(8, width - 255));
      const topPx = Math.max(8, margin.top + cy - 60);
      tooltip.style('left', `${leftPx}px`).style('top', `${topPx}px`);
    })
    .on('mouseleave', () => {
      focusLine.style('display', 'none');
      focusDot.style('display', 'none');
      tooltip.style('display', 'none');
    });

  return summary;
}

export function renderBatteryWearLevel30DaysChartD3(
  container: HTMLElement,
  powerCycles: BatteryPowerCycleEntry[],
  height = 230
): void {
  renderBatteryWearLevelTrendChartD3(container, powerCycles, height);
}

export interface GpuVramPoint {
  timeSec: number;
  allocatedVramMB: number;
  textureVramMB: number;
}

export function renderGpuVramUsageChartD3(
  points: GpuVramPoint[],
  containerEl: HTMLElement,
  height = 200
): void {
  containerEl.innerHTML = '';
  const width = containerEl.clientWidth || 680;
  const padL = 54;
  const padR = 24;
  const padT = 20;
  const padB = 32;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  if (!points || points.length < 2) {
    containerEl.innerHTML = `
      <div style="height:${height}px;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:12px;">
        Oczekiwanie na próbki VRAM GPU (uruchom test 3D)...
      </div>
    `;
    return;
  }

  const svg = d3
    .select(containerEl)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('width', '100%')
    .style('height', `${height}px`)
    .style('display', 'block');

  const g = svg.append('g').attr('transform', `translate(${padL},${padT})`);

  const maxVram = Math.max(16384, ...points.map((p) => Math.max(p.allocatedVramMB, p.textureVramMB)));
  const xScale = d3.scaleLinear()
    .domain([points[0].timeSec, points[points.length - 1].timeSec + 1])
    .range([0, plotW]);

  const yScale = d3.scaleLinear()
    .domain([0, Math.ceil(maxVram / 2048) * 2048])
    .range([plotH, 0]);

  g.append('g')
    .attr('class', 'grid')
    .call(d3.axisLeft(yScale).ticks(5).tickSize(-plotW).tickFormat(() => ''))
    .selectAll('line')
    .style('stroke', 'var(--border-hairline)')
    .style('stroke-opacity', '0.7');

  const areaAlloc = d3.area<GpuVramPoint>()
    .x((d) => xScale(d.timeSec))
    .y0(plotH)
    .y1((d) => yScale(d.allocatedVramMB))
    .curve(d3.curveMonotoneX);

  const lineAlloc = d3.line<GpuVramPoint>()
    .x((d) => xScale(d.timeSec))
    .y((d) => yScale(d.allocatedVramMB))
    .curve(d3.curveMonotoneX);

  g.append('path')
    .datum(points)
    .attr('fill', 'rgba(6, 182, 212, 0.12)')
    .attr('d', areaAlloc);

  g.append('path')
    .datum(points)
    .attr('fill', 'none')
    .attr('stroke', '#06b6d4')
    .attr('stroke-width', 2.2)
    .attr('d', lineAlloc);

  const lineTexture = d3.line<GpuVramPoint>()
    .x((d) => xScale(d.timeSec))
    .y((d) => yScale(d.textureVramMB))
    .curve(d3.curveMonotoneX);

  g.append('path')
    .datum(points)
    .attr('fill', 'none')
    .attr('stroke', '#f59e0b')
    .attr('stroke-width', 2)
    .attr('stroke-dasharray', '4 3')
    .attr('d', lineTexture);

  const xAxis = d3.axisBottom(xScale).ticks(6).tickFormat((d: d3.NumberValue) => `${d}s`);
  g.append('g')
    .attr('transform', `translate(0,${plotH})`)
    .call(xAxis)
    .selectAll('text')
    .style('fill', 'var(--text-muted)')
    .style('font-size', '10px')
    .style('font-family', 'JetBrains Mono, monospace');

  const yAxis = d3.axisLeft(yScale).ticks(5).tickFormat((d: d3.NumberValue) => `${Math.round(Number(d) / 1024)}GB`);
  g.append('g')
    .call(yAxis)
    .selectAll('text')
    .style('fill', 'var(--text-secondary)')
    .style('font-size', '10px')
    .style('font-family', 'JetBrains Mono, monospace');

  const tooltip = d3.select(containerEl)
    .append('div')
    .attr('class', 'chart-tooltip')
    .style('opacity', 0);

  const bisect = d3.bisector((d: GpuVramPoint) => d.timeSec).left;

  g.append('rect')
    .attr('width', plotW)
    .attr('height', plotH)
    .attr('fill', 'transparent')
    .on('mousemove', (event) => {
      const [mx] = d3.pointer(event);
      const xVal = xScale.invert(mx);
      const idx = bisect(points, xVal, 1);
      const d0 = points[idx - 1];
      const d1 = points[idx];
      if (!d0) return;
      const d = d1 && xVal - d0.timeSec > d1.timeSec - xVal ? d1 : d0;

      tooltip
        .style('opacity', 1)
        .style('left', `${event.offsetX + 12}px`)
        .style('top', `${event.offsetY - 28}px`)
        .html(`
          <div class="chart-tooltip-date">Czas: ${d.timeSec}s (Ostatnie 60s)</div>
          <div class="chart-tooltip-row">
            <span class="chart-tooltip-label"><span class="chart-tooltip-swatch" style="background:#06b6d4"></span>Przydzielony VRAM:</span>
            <strong>${(d.allocatedVramMB / 1024).toFixed(2)} GB</strong>
          </div>
          <div class="chart-tooltip-row">
            <span class="chart-tooltip-label"><span class="chart-tooltip-swatch" style="background:#f59e0b"></span>Tekstury (Rzeczywiste):</span>
            <strong>${(d.textureVramMB / 1024).toFixed(2)} GB</strong>
          </div>
        `);
    })
    .on('mouseleave', () => {
      tooltip.style('opacity', 0);
    });
}

export interface GameFpsDayPoint {
  dayLabel: string;
  nativeFps: number;
  upscaledFps: number;
  withFgFps: number;
}

export function generate30DayGameFpsHistory(baseFps: number): GameFpsDayPoint[] {
  const points: GameFpsDayPoint[] = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    const dayLabel = d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' });
    const variance = Math.sin(i * 0.4) * 4 + (i > 15 ? 3 : 0);
    const nat = Math.max(15, Math.round(baseFps * 0.72 + variance));
    const up = Math.max(20, Math.round(baseFps * 0.95 + variance * 1.2));
    const fg = Math.max(25, Math.round(baseFps * 1.45 + variance * 1.5));
    points.push({ dayLabel, nativeFps: nat, upscaledFps: up, withFgFps: fg });
  }
  return points;
}

export function renderGame30DayFpsTrendChartD3(
  gameTitle: string,
  dataPoints: GameFpsDayPoint[],
  containerEl: HTMLElement,
  height = 210
): void {
  containerEl.innerHTML = '';
  const width = containerEl.clientWidth || 680;
  const padL = 50;
  const padR = 24;
  const padT = 20;
  const padB = 36;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  if (!dataPoints || dataPoints.length < 2) {
    containerEl.innerHTML = `
      <div style="height:${height}px;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:12px;">
        Brak danych historycznych dla wybranej gry...
      </div>
    `;
    return;
  }

  const svg = d3
    .select(containerEl)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('width', '100%')
    .style('height', `${height}px`)
    .style('display', 'block');

  const g = svg.append('g').attr('transform', `translate(${padL},${padT})`);

  const maxFps = Math.max(120, ...dataPoints.map((d) => Math.max(d.nativeFps, d.upscaledFps, d.withFgFps)));
  const xScale = d3.scalePoint()
    .domain(dataPoints.map((d) => d.dayLabel))
    .range([0, plotW])
    .padding(0.1);

  const yScale = d3.scaleLinear()
    .domain([0, Math.ceil(maxFps / 50) * 50])
    .range([plotH, 0]);

  g.append('g')
    .attr('class', 'grid')
    .call(d3.axisLeft(yScale).ticks(5).tickSize(-plotW).tickFormat(() => ''))
    .selectAll('line')
    .style('stroke', 'var(--border-hairline)')
    .style('stroke-opacity', '0.7');

  const lineNative = d3.line<GameFpsDayPoint>()
    .x((d) => (xScale(d.dayLabel) || 0) + (xScale.bandwidth() || 0) / 2)
    .y((d) => yScale(d.nativeFps))
    .curve(d3.curveMonotoneX);

  const lineUpscale = d3.line<GameFpsDayPoint>()
    .x((d) => (xScale(d.dayLabel) || 0) + (xScale.bandwidth() || 0) / 2)
    .y((d) => yScale(d.upscaledFps))
    .curve(d3.curveMonotoneX);

  const lineFg = d3.line<GameFpsDayPoint>()
    .x((d) => (xScale(d.dayLabel) || 0) + (xScale.bandwidth() || 0) / 2)
    .y((d) => yScale(d.withFgFps))
    .curve(d3.curveMonotoneX);

  g.append('path')
    .datum(dataPoints)
    .attr('fill', 'none')
    .attr('stroke', '#06b6d4')
    .attr('stroke-width', 2)
    .attr('d', lineNative);

  g.append('path')
    .datum(dataPoints)
    .attr('fill', 'none')
    .attr('stroke', '#f59e0b')
    .attr('stroke-width', 2)
    .attr('stroke-dasharray', '4 3')
    .attr('d', lineUpscale);

  g.append('path')
    .datum(dataPoints)
    .attr('fill', 'none')
    .attr('stroke', '#10b981')
    .attr('stroke-width', 2.2)
    .attr('d', lineFg);

  const tickVals = dataPoints.filter((_, i) => i % 6 === 0 || i === dataPoints.length - 1).map((d) => d.dayLabel);
  const xAxis = d3.axisBottom(xScale).tickValues(tickVals);
  g.append('g')
    .attr('transform', `translate(0,${plotH})`)
    .call(xAxis)
    .selectAll('text')
    .style('fill', 'var(--text-muted)')
    .style('font-size', '10px')
    .style('font-family', 'JetBrains Mono, monospace');

  const yAxis = d3.axisLeft(yScale).ticks(5).tickFormat((d: d3.NumberValue) => `${d} FPS`);
  g.append('g')
    .call(yAxis)
    .selectAll('text')
    .style('fill', 'var(--text-secondary)')
    .style('font-size', '10px')
    .style('font-family', 'JetBrains Mono, monospace');

  const tooltip = d3.select(containerEl)
    .append('div')
    .attr('class', 'chart-tooltip')
    .style('opacity', 0);

  dataPoints.forEach((d) => {
    const xPos = (xScale(d.dayLabel) || 0) + (xScale.bandwidth() || 0) / 2;
    g.append('circle')
      .attr('cx', xPos)
      .attr('cy', yScale(d.withFgFps))
      .attr('r', 3.5)
      .attr('fill', '#10b981')
      .on('mousemove', (event) => {
        tooltip
          .style('opacity', 1)
          .style('left', `${event.offsetX + 12}px`)
          .style('top', `${event.offsetY - 30}px`)
          .html(`
            <div class="chart-tooltip-date">${gameTitle} · ${d.dayLabel}</div>
            <div class="chart-tooltip-row">
              <span class="chart-tooltip-label"><span class="chart-tooltip-swatch" style="background:#10b981"></span>Z Frame Gen:</span>
              <strong>${d.withFgFps} FPS</strong>
            </div>
            <div class="chart-tooltip-row">
              <span class="chart-tooltip-label"><span class="chart-tooltip-swatch" style="background:#f59e0b"></span>Upscaling (Q):</span>
              <strong>${d.upscaledFps} FPS</strong>
            </div>
            <div class="chart-tooltip-row">
              <span class="chart-tooltip-label"><span class="chart-tooltip-swatch" style="background:#06b6d4"></span>Natywne:</span>
              <strong>${d.nativeFps} FPS</strong>
            </div>
          `);
      })
      .on('mouseleave', () => {
        tooltip.style('opacity', 0);
      });
  });
}

export interface GpuFrameTimePoint {
  timeSec: number;
  frameTimeMs: number;
}

export function renderGpuFrameTimeConsistencyChartD3(
  points: GpuFrameTimePoint[],
  containerEl: HTMLElement,
  height = 190
): void {
  containerEl.innerHTML = '';
  const width = containerEl.clientWidth || 680;
  const padL = 50;
  const padR = 24;
  const padT = 20;
  const padB = 32;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  if (!points || points.length < 2) {
    containerEl.innerHTML = `
      <div style="height:${height}px;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:12px;">
        Oczekiwanie na próbki czasu klatki (uruchom stres-test GPU)...
      </div>
    `;
    return;
  }

  const svg = d3
    .select(containerEl)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('width', '100%')
    .style('height', `${height}px`)
    .style('display', 'block');

  const g = svg.append('g').attr('transform', `translate(${padL},${padT})`);

  const maxFt = Math.max(33.3, ...points.map((p) => p.frameTimeMs));
  const xScale = d3.scaleLinear()
    .domain([points[0].timeSec, points[points.length - 1].timeSec + 1])
    .range([0, plotW]);

  const yScale = d3.scaleLinear()
    .domain([0, Math.ceil(maxFt / 10) * 10])
    .range([plotH, 0]);

  g.append('g')
    .attr('class', 'grid')
    .call(d3.axisLeft(yScale).ticks(5).tickSize(-plotW).tickFormat(() => ''))
    .selectAll('line')
    .style('stroke', 'var(--border-hairline)')
    .style('stroke-opacity', '0.7');

  const area = d3.area<GpuFrameTimePoint>()
    .x((d) => xScale(d.timeSec))
    .y0(plotH)
    .y1((d) => yScale(d.frameTimeMs))
    .curve(d3.curveMonotoneX);

  const line = d3.line<GpuFrameTimePoint>()
    .x((d) => xScale(d.timeSec))
    .y((d) => yScale(d.frameTimeMs))
    .curve(d3.curveMonotoneX);

  g.append('path')
    .datum(points)
    .attr('fill', 'rgba(245, 158, 11, 0.14)')
    .attr('d', area);

  g.append('path')
    .datum(points)
    .attr('fill', 'none')
    .attr('stroke', '#f59e0b')
    .attr('stroke-width', 2.2)
    .attr('d', line);

  g.append('line')
    .attr('x1', 0)
    .attr('y1', yScale(16.6))
    .attr('x2', plotW)
    .attr('y2', yScale(16.6))
    .attr('stroke', '#10b981')
    .attr('stroke-dasharray', '3 3')
    .attr('stroke-width', 1);

  g.append('text')
    .attr('x', plotW - 4)
    .attr('y', yScale(16.6) - 4)
    .attr('text-anchor', 'end')
    .style('fill', '#10b981')
    .style('font-size', '10px')
    .text('60 FPS (16.6ms)');

  const xAxis = d3.axisBottom(xScale).ticks(6).tickFormat((d: d3.NumberValue) => `${d}s`);
  g.append('g')
    .attr('transform', `translate(0,${plotH})`)
    .call(xAxis)
    .selectAll('text')
    .style('fill', 'var(--text-muted)')
    .style('font-size', '10px')
    .style('font-family', 'JetBrains Mono, monospace');

  const yAxis = d3.axisLeft(yScale).ticks(5).tickFormat((d: d3.NumberValue) => `${d}ms`);
  g.append('g')
    .call(yAxis)
    .selectAll('text')
    .style('fill', 'var(--text-secondary)')
    .style('font-size', '10px')
    .style('font-family', 'JetBrains Mono, monospace');

  const tooltip = d3.select(containerEl)
    .append('div')
    .attr('class', 'chart-tooltip')
    .style('opacity', 0);

  const bisect = d3.bisector((d: GpuFrameTimePoint) => d.timeSec).left;

  g.append('rect')
    .attr('width', plotW)
    .attr('height', plotH)
    .attr('fill', 'transparent')
    .on('mousemove', (event) => {
      const [mx] = d3.pointer(event);
      const xVal = xScale.invert(mx);
      const idx = bisect(points, xVal, 1);
      const d0 = points[idx - 1];
      const d1 = points[idx];
      if (!d0) return;
      const d = d1 && xVal - d0.timeSec > d1.timeSec - xVal ? d1 : d0;
      const fpsCalc = d.frameTimeMs > 0 ? (1000 / d.frameTimeMs).toFixed(1) : '0';

      tooltip
        .style('opacity', 1)
        .style('left', `${event.offsetX + 12}px`)
        .style('top', `${event.offsetY - 28}px`)
        .html(`
          <div class="chart-tooltip-date">Czas: ${d.timeSec}s</div>
          <div class="chart-tooltip-row">
            <span class="chart-tooltip-label"><span class="chart-tooltip-swatch" style="background:#f59e0b"></span>Czas klatki (Frame-Time):</span>
            <strong>${d.frameTimeMs} ms</strong>
          </div>
          <div class="chart-tooltip-row">
            <span class="chart-tooltip-label">Odpowiada FPS:</span>
            <strong>${fpsCalc} FPS</strong>
          </div>
        `);
    })
    .on('mouseleave', () => {
      tooltip.style('opacity', 0);
    });
}

export interface GpuThermalPoint {
  timeSec: number;
  estTempC: number;
  coreClockMhz: number;
  thermalThrottle: boolean;
}

export function renderGpuThermalLoadChartD3(
  points: GpuThermalPoint[],
  containerEl: HTMLElement,
  height = 200
): void {
  containerEl.innerHTML = '';
  const width = containerEl.clientWidth || 680;
  const padL = 54;
  const padR = 54;
  const padT = 20;
  const padB = 32;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  if (!points || points.length < 2) {
    containerEl.innerHTML = `
      <div style="height:${height}px;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:12px;">
        Oczekiwanie na próbki termiczne GPU (uruchom stres-test)...
      </div>
    `;
    return;
  }

  const svg = d3
    .select(containerEl)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('width', '100%')
    .style('height', `${height}px`)
    .style('display', 'block');

  const g = svg.append('g').attr('transform', `translate(${padL},${padT})`);

  const maxTemp = Math.max(100, ...points.map((p) => p.estTempC));
  const maxClock = Math.max(3000, ...points.map((p) => p.coreClockMhz));

  const xScale = d3.scaleLinear()
    .domain([points[0].timeSec, points[points.length - 1].timeSec + 1])
    .range([0, plotW]);

  const yTempScale = d3.scaleLinear()
    .domain([30, Math.ceil(maxTemp / 10) * 10])
    .range([plotH, 0]);

  const yClockScale = d3.scaleLinear()
    .domain([0, Math.ceil(maxClock / 500) * 500])
    .range([plotH, 0]);

  g.append('g')
    .attr('class', 'grid')
    .call(d3.axisLeft(yTempScale).ticks(5).tickSize(-plotW).tickFormat(() => ''))
    .selectAll('line')
    .style('stroke', 'var(--border-hairline)')
    .style('stroke-opacity', '0.7');

  const lineTemp = d3.line<GpuThermalPoint>()
    .x((d) => xScale(d.timeSec))
    .y((d) => yTempScale(d.estTempC))
    .curve(d3.curveMonotoneX);

  const lineClock = d3.line<GpuThermalPoint>()
    .x((d) => xScale(d.timeSec))
    .y((d) => yClockScale(d.coreClockMhz))
    .curve(d3.curveMonotoneX);

  g.append('path')
    .datum(points)
    .attr('fill', 'none')
    .attr('stroke', '#f59e0b')
    .attr('stroke-width', 2.4)
    .attr('d', lineTemp);

  g.append('path')
    .datum(points)
    .attr('fill', 'none')
    .attr('stroke', '#38bdf8')
    .attr('stroke-width', 2)
    .attr('stroke-dasharray', '4 3')
    .attr('d', lineClock);

  points.forEach((d) => {
    if (d.thermalThrottle) {
      g.append('circle')
        .attr('cx', xScale(d.timeSec))
        .attr('cy', yTempScale(d.estTempC))
        .attr('r', 4.5)
        .attr('fill', '#f43f5e')
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 1.5);
    }
  });

  const xAxis = d3.axisBottom(xScale).ticks(6).tickFormat((d: d3.NumberValue) => `${d}s`);
  g.append('g')
    .attr('transform', `translate(0,${plotH})`)
    .call(xAxis)
    .selectAll('text')
    .style('fill', 'var(--text-muted)')
    .style('font-size', '10px')
    .style('font-family', 'JetBrains Mono, monospace');

  const yAxisLeft = d3.axisLeft(yTempScale).ticks(5).tickFormat((d: d3.NumberValue) => `${d}°C`);
  g.append('g')
    .call(yAxisLeft)
    .selectAll('text')
    .style('fill', '#f59e0b')
    .style('font-size', '10px')
    .style('font-family', 'JetBrains Mono, monospace');

  const yAxisRight = d3.axisRight(yClockScale).ticks(5).tickFormat((d: d3.NumberValue) => `${d}MHz`);
  g.append('g')
    .attr('transform', `translate(${plotW},0)`)
    .call(yAxisRight)
    .selectAll('text')
    .style('fill', '#38bdf8')
    .style('font-size', '10px')
    .style('font-family', 'JetBrains Mono, monospace');

  const tooltip = d3.select(containerEl)
    .append('div')
    .attr('class', 'chart-tooltip')
    .style('opacity', 0);

  const bisect = d3.bisector((d: GpuThermalPoint) => d.timeSec).left;

  g.append('rect')
    .attr('width', plotW)
    .attr('height', plotH)
    .attr('fill', 'transparent')
    .on('mousemove', (event) => {
      const [mx] = d3.pointer(event);
      const xVal = xScale.invert(mx);
      const idx = bisect(points, xVal, 1);
      const d0 = points[idx - 1];
      const d1 = points[idx];
      if (!d0) return;
      const d = d1 && xVal - d0.timeSec > d1.timeSec - xVal ? d1 : d0;

      tooltip
        .style('opacity', 1)
        .style('left', `${event.offsetX + 12}px`)
        .style('top', `${event.offsetY - 28}px`)
        .html(`
          <div class="chart-tooltip-date">Czas: ${d.timeSec}s</div>
          <div class="chart-tooltip-row">
            <span class="chart-tooltip-label"><span class="chart-tooltip-swatch" style="background:#f59e0b"></span>Temperatura GPU:</span>
            <strong>${d.estTempC}°C ${d.thermalThrottle ? '<span class="status-err">(THROTTLING)</span>' : ''}</strong>
          </div>
          <div class="chart-tooltip-row">
            <span class="chart-tooltip-label"><span class="chart-tooltip-swatch" style="background:#38bdf8"></span>Zegar rdzenia:</span>
            <strong>${d.coreClockMhz} MHz</strong>
          </div>
        `);
    })
    .on('mouseleave', () => {
      tooltip.style('opacity', 0);
    });
}





