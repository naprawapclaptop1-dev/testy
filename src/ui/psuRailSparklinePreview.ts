export type PsuRailName = '+12V' | '+5V' | '+3.3V';

export interface PsuRailHistoryEntry {
  timeLabel: string;
  timestamp: number;
  rail12V: number;
  rail5V: number;
  rail3P3V: number;
  powerW: number;
}

export interface PsuRail5sSample {
  timestamp: number;
  timeLabel: string;
  voltageV: number;
  powerW: number;
}

export interface PsuRail5sCoord {
  x: number;
  y: number;
  xRatio: number;
  voltageV: number;
  timestamp: number;
  timeLabel: string;
  deviationPct: number;
  out: boolean;
}

export function getRailNominalVoltage(railName: PsuRailName): number {
  return railName === '+12V' ? 12.0 : railName === '+5V' ? 5.0 : 3.3;
}

function pickRailVoltage(entry: PsuRailHistoryEntry, railName: PsuRailName): number {
  return railName === '+12V' ? entry.rail12V : railName === '+5V' ? entry.rail5V : entry.rail3P3V;
}

export function extractRail5sWindow(
  railHistory: PsuRailHistoryEntry[],
  railName: PsuRailName,
  currentV: number,
  resetAtMs: number = 0,
  nowMs: number = Date.now()
): PsuRail5sSample[] {
  const effectiveHistory =
    resetAtMs > 0 ? railHistory.filter((pt) => pt.timestamp >= resetAtMs) : railHistory;

  const cutoff5s = Math.max(nowMs - 5000, resetAtMs);
  const inWindow = effectiveHistory.filter((pt) => pt.timestamp >= cutoff5s);

  let source: PsuRailHistoryEntry[];
  if (inWindow.length >= 3) {
    source = inWindow;
  } else if (resetAtMs > 0) {
    source = inWindow;
  } else {
    // Include enough recent points (~5-7.5s at 2.5s tick) so the sparkline shows real fluctuation shape
    source = effectiveHistory.slice(-4);
  }

  if (source.length === 0) {
    const label = new Date(nowMs).toLocaleTimeString('pl-PL', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    return [
      { timestamp: nowMs - 5000, timeLabel: '-5s', voltageV: currentV, powerW: 0 },
      { timestamp: nowMs, timeLabel: label, voltageV: currentV, powerW: 0 },
    ];
  }

  const mapped = source.map((pt) => ({
    timestamp: pt.timestamp,
    timeLabel: pt.timeLabel,
    voltageV: pickRailVoltage(pt, railName),
    powerW: pt.powerW,
  }));

  if (mapped.length === 1) {
    return [
      {
        ...mapped[0],
        timestamp: mapped[0].timestamp - 2500,
        timeLabel: '-2.5s',
      },
      mapped[0],
    ];
  }

  return mapped;
}

export function buildRail5sSparklineModel(
  samples: PsuRail5sSample[],
  railName: PsuRailName,
  currentV: number,
  thresholdPct: number
): {
  minV: number;
  maxV: number;
  spanMv: number;
  coords: PsuRail5sCoord[];
  bandTopY: number;
  bandBotY: number;
  nomY: number;
  width: number;
  height: number;
  padX: number;
  padY: number;
} {
  const nominalV = getRailNominalVoltage(railName);
  const upperBound = nominalV * (1 + thresholdPct / 100);
  const lowerBound = nominalV * (1 - thresholdPct / 100);
  const vals = samples.map((s) => s.voltageV);
  const minV = vals.length > 0 ? Math.min(...vals) : currentV;
  const maxV = vals.length > 0 ? Math.max(...vals) : currentV;
  const spanMv = Math.max(0, (maxV - minV) * 1000);

  // Tight viewport padding around the observed 5s fluctuations so small ripples stay visible
  const fluctuationSpan = Math.max(maxV - minV, nominalV * 0.004);
  const yMin = minV - fluctuationSpan * 0.35;
  const yMax = maxV + fluctuationSpan * 0.35;
  const ySpan = Math.max(0.001, yMax - yMin);

  const width = 220;
  const height = 42;
  const padX = 4;
  const padY = 5;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const toY = (v: number): number =>
    Math.max(padY, Math.min(height - padY, padY + ((yMax - v) / ySpan) * innerH));
  const toX = (idx: number): number =>
    samples.length <= 1 ? width - padX : padX + (idx / (samples.length - 1)) * innerW;

  const coords: PsuRail5sCoord[] = samples.map((pt, idx) => {
    const devPct = nominalV > 0 ? (Math.abs(pt.voltageV - nominalV) / nominalV) * 100 : 0;
    return {
      x: toX(idx),
      y: toY(pt.voltageV),
      xRatio: samples.length <= 1 ? 1 : idx / (samples.length - 1),
      voltageV: pt.voltageV,
      timestamp: pt.timestamp,
      timeLabel: pt.timeLabel,
      deviationPct: devPct,
      out: devPct > thresholdPct,
    };
  });

  return {
    minV,
    maxV,
    spanMv,
    coords,
    bandTopY: toY(upperBound),
    bandBotY: toY(lowerBound),
    nomY: toY(nominalV),
    width,
    height,
    padX,
    padY,
  };
}

export function renderRail5sSparklinePreviewHtml(
  railHistory: PsuRailHistoryEntry[],
  railName: PsuRailName,
  currentV: number,
  thresholdPct: number,
  resetAtMs: number = 0,
  nowMs: number = Date.now()
): { html: string; coords: PsuRail5sCoord[] } {
  const samples = extractRail5sWindow(railHistory, railName, currentV, resetAtMs, nowMs);
  const model = buildRail5sSparklineModel(samples, railName, currentV, thresholdPct);
  const { width, height, padX, padY, coords, minV, maxV, spanMv, nomY } = model;

  const linePts = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const areaPts =
    coords.length > 0
      ? `${coords[0].x.toFixed(1)},${(height - padY).toFixed(1)} ${linePts} ${coords[coords.length - 1].x.toFixed(1)},${(height - padY).toFixed(1)}`
      : '';
  const hasAlert = coords.some((c) => c.out);
  const strokeColor = hasAlert ? '#fb7185' : '#38bdf8';
  const fillColor = hasAlert ? 'rgba(244, 63, 94, 0.18)' : 'rgba(56, 189, 248, 0.16)';
  const lastCoord = coords[coords.length - 1];

  const html = `
    <div
      class="psu-rail-tooltip-5s-preview ${hasAlert ? 'is-alert' : ''}"
      data-rail="${railName}"
      data-psu-5s-sparkline="true"
      aria-label="5-sekundowy wykres wahań napięcia szyny ${railName}"
    >
      <div class="psu-rail-5s-header">
        <span class="psu-rail-5s-title">⚡ 5s Voltage Preview (${railName})</span>
        <span class="psu-rail-5s-delta">Δ ${spanMv.toFixed(1)} mV · ${minV.toFixed(3)}–${maxV.toFixed(3)}V</span>
      </div>
      <div class="psu-rail-5s-sparkline-plot" data-rail="${railName}">
        <div class="psu-rail-5s-sparkline-tooltip" role="status" aria-live="polite"></div>
        <svg class="psu-rail-5s-sparkline-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
          <line x1="${padX}" y1="${nomY.toFixed(1)}" x2="${width - padX}" y2="${nomY.toFixed(1)}" stroke="rgba(148, 163, 184, 0.38)" stroke-width="0.8" stroke-dasharray="3,2" />
          ${areaPts ? `<polygon points="${areaPts}" fill="${fillColor}" />` : ''}
          ${linePts ? `<polyline points="${linePts}" fill="none" stroke="${strokeColor}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" />` : ''}
          ${coords
            .map(
              (c) =>
                `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="${c.out ? 2.4 : 1.9}" fill="${c.out ? '#fb7185' : '#38bdf8'}" />`
            )
            .join('')}
          ${lastCoord ? `<circle cx="${lastCoord.x.toFixed(1)}" cy="${lastCoord.y.toFixed(1)}" r="3.0" fill="#f8fafc" stroke="${strokeColor}" stroke-width="1.2" />` : ''}
          <line class="psu-rail-5s-crosshair" x1="0" y1="${padY}" x2="0" y2="${height - padY}" stroke="rgba(248, 250, 252, 0.72)" stroke-width="1" stroke-dasharray="2,2" visibility="hidden" />
          <circle class="psu-rail-5s-hover-dot" cx="0" cy="0" r="3.2" fill="#38bdf8" stroke="#0b101c" stroke-width="1.1" visibility="hidden" />
        </svg>
      </div>
      <div class="psu-rail-5s-footer">
        <span>Okno: ostatnie 5 s (${samples.length} próbek)</span>
        <span>Teraz: ${currentV.toFixed(3)} V</span>
      </div>
    </div>
  `;

  return { html, coords };
}
