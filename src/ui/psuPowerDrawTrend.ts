export interface PowerDrawSample {
  timestamp: number;
  totalPowerW: number;
}

export interface PowerDrawTrendSnapshot {
  currentW: number;
  movingAvg1mW: number;
  peak1mW: number;
  min1mW: number;
  deltaW: number;
  deltaPct: number;
  spikePct: number;
  isTransientSpike: boolean;
  status: 'spike' | 'elevated' | 'steady' | 'drop';
  sampleCount: number;
  sparklineValues: number[];
}

export function computePowerDrawTrend1m(
  samples: PowerDrawSample[],
  currentPowerW: number,
  psuCapacityW: number,
  nowMs: number = Date.now()
): PowerDrawTrendSnapshot {
  const safeCurrent = Number.isFinite(currentPowerW) && currentPowerW >= 0 ? Math.round(currentPowerW) : 0;
  const cutoff = nowMs - 60_000;
  const recent = samples.filter(
    (s) => Number.isFinite(s.timestamp) && s.timestamp >= cutoff && Number.isFinite(s.totalPowerW)
  );
  const series = recent.length > 0 ? recent.map((s) => s.totalPowerW) : [safeCurrent];
  const sum = series.reduce((acc, v) => acc + v, 0);
  const movingAvg1mW = Math.round(sum / series.length);
  const peak1mW = Math.round(Math.max(safeCurrent, ...series));
  const min1mW = Math.round(Math.min(safeCurrent, ...series));
  const deltaW = safeCurrent - movingAvg1mW;
  const deltaPct = movingAvg1mW > 0 ? Number(((deltaW / movingAvg1mW) * 100).toFixed(1)) : 0;
  const spikeDeltaW = peak1mW - movingAvg1mW;
  const spikePct = movingAvg1mW > 0 ? Number(((spikeDeltaW / movingAvg1mW) * 100).toFixed(1)) : 0;

  const isTransientSpike =
    (deltaPct >= 12 && deltaW >= 25) ||
    deltaW >= 65 ||
    (psuCapacityW > 0 && safeCurrent > psuCapacityW * 0.9 && deltaW >= 20) ||
    (spikePct >= 20 && spikeDeltaW >= 45);

  let status: PowerDrawTrendSnapshot['status'] = 'steady';
  if (isTransientSpike) {
    status = 'spike';
  } else if (deltaPct >= 4 || deltaW >= 12) {
    status = 'elevated';
  } else if (deltaPct <= -6 || deltaW <= -15) {
    status = 'drop';
  }

  return {
    currentW: safeCurrent,
    movingAvg1mW,
    peak1mW,
    min1mW,
    deltaW,
    deltaPct,
    spikePct,
    isTransientSpike,
    status,
    sampleCount: series.length,
    sparklineValues: series.slice(-30),
  };
}

export function renderPsuPowerDrawTrendHtml(
  trend: PowerDrawTrendSnapshot,
  psuCapacityW: number
): string {
  const signedW = `${trend.deltaW >= 0 ? '+' : ''}${trend.deltaW} W`;
  const signedPct = `${trend.deltaPct >= 0 ? '+' : ''}${trend.deltaPct.toFixed(1)}%`;

  const badgeText =
    trend.status === 'spike'
      ? '⚡ TRANSIENT SPIKE'
      : trend.status === 'elevated'
        ? '▲ WZROST POBORU'
        : trend.status === 'drop'
          ? '▼ SPADEK POBORU'
          : '→ STABILNY POBÓR';

  // Build compact inline SVG sparkline of 1m system power vs 1m moving average line
  const vals = trend.sparklineValues.length >= 2
    ? trend.sparklineValues
    : [trend.movingAvg1mW, trend.currentW];
  const minVal = Math.min(...vals, trend.movingAvg1mW);
  const maxVal = Math.max(...vals, trend.movingAvg1mW);
  const span = Math.max(15, maxVal - minVal);
  const yMin = Math.max(0, minVal - span * 0.2);
  const yMax = maxVal + span * 0.2;
  const ySpan = Math.max(1, yMax - yMin);
  const W = 136;
  const H = 26;
  const padX = 3;
  const padY = 3;
  const toX = (i: number) =>
    vals.length <= 1 ? W - padX : padX + (i / (vals.length - 1)) * (W - padX * 2);
  const toY = (v: number) =>
    Math.max(padY, Math.min(H - padY, padY + ((yMax - v) / ySpan) * (H - padY * 2)));

  const pts = vals.map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ');
  const avgY = toY(trend.movingAvg1mW).toFixed(1);
  const strokeColor =
    trend.status === 'spike'
      ? '#fb7185'
      : trend.status === 'elevated'
        ? '#fbbf24'
        : trend.status === 'drop'
          ? '#34d399'
          : '#38bdf8';

  const loadAvgPct = psuCapacityW > 0 ? ((trend.movingAvg1mW / psuCapacityW) * 100).toFixed(1) : '0.0';

  return `
    <div
      id="psu-power-draw-trend"
      class="psu-power-draw-trend is-${trend.status}"
      data-psu-power-trend="true"
      data-trend-status="${trend.status}"
      role="status"
      aria-live="polite"
      aria-label="Power Draw Trend: 1-minutowa średnia krocząca poboru mocy systemu wynosi ${trend.movingAvg1mW} W przy bieżącym poborze ${trend.currentW} W (${signedW}, ${signedPct})"
    >
      <div class="psu-power-draw-trend-left">
        <div class="psu-power-draw-trend-header">
          <span class="psu-power-draw-trend-title">Power Draw Trend (1m Moving Avg)</span>
          <span class="psu-power-draw-trend-badge is-${trend.status}">${badgeText}</span>
        </div>
        <div class="psu-power-draw-trend-metrics">
          <span>Śr. 1 min: <strong class="font-mono" data-psu-1m-avg-w="${trend.movingAvg1mW}">${trend.movingAvg1mW} W</strong> (${loadAvgPct}% PSU)</span>
          <span class="psu-power-draw-trend-sep">·</span>
          <span>Δ vs 1m MA: <strong class="font-mono">${signedW} (${signedPct})</strong></span>
          <span class="psu-power-draw-trend-sep">·</span>
          <span>Szczyt 1m: <strong class="font-mono">${trend.peak1mW} W</strong></span>
        </div>
      </div>
      <div class="psu-power-draw-trend-spark" title="Ostatnia minuta poboru mocy vs. przerywana linia średniej 1m (${trend.movingAvg1mW} W)">
        <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">
          <line x1="${padX}" y1="${avgY}" x2="${W - padX}" y2="${avgY}" stroke="rgba(148, 163, 184, 0.55)" stroke-width="1" stroke-dasharray="3,2" />
          <polyline points="${pts}" fill="none" stroke="${strokeColor}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" />
        </svg>
        <span class="psu-power-draw-trend-samples">${trend.sampleCount} pkt / 60s</span>
      </div>
    </div>
  `;
}
