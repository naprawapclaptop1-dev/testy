import * as d3 from 'd3';
import type { BatteryHealthState } from '../types';

export const DEFAULT_CRITICAL_HEALTH_THRESHOLD_PCT = 70;
export const CRITICAL_HEALTH_PRESETS_PCT = [60, 70, 75, 80] as const;

export interface BatteryEnduranceSeriesPoint {
  index: number;
  label: string;
  dateLabel: string;
  timestamp: number;
  healthPct: number;
  capacityMWh: number;
  wearPct: number;
  cycleNumber: number;
  isForecast: boolean;
  isCurrent?: boolean;
  isCriticalTarget?: boolean;
}

export interface BatteryEnduranceEstimate {
  criticalHealthThresholdPct: number;
  currentHealthPct: number;
  remainingHealthMarginPct: number;
  alreadyCritical: boolean;
  urgency: 'critical' | 'warning' | 'healthy';
  confidence: 'high' | 'medium' | 'baseline';
  confidenceLabel: string;
  currentPowerW: number;
  movingAvgPowerW: number;
  peakPowerW: number;
  nominalPowerW: number;
  powerTrendSlopeWPerMin: number;
  powerTrendDirection: 'rising' | 'stable' | 'falling';
  powerStressFactor: number;
  cRate: number;
  historicalDegradationPctPerCycle: number;
  historicalMonthlyDegradationPct: number;
  correlatedMonthlyDegradationPct: number;
  correlatedDailyDegradationPct: number;
  estimatedDaysToCritical: number;
  estimatedMonthsToCritical: number;
  estimatedCyclesToCritical: number;
  baselineDaysAtNominalPower: number;
  powerTrendImpactDays: number;
  projectedCriticalDateIso: string;
  durationLabel: string;
  recommendation: string;
  historicalPoints: BatteryEnduranceSeriesPoint[];
  forecastPoints: BatteryEnduranceSeriesPoint[];
}

export interface BatteryEnduranceOptions {
  criticalHealthThresholdPct?: number;
  nowMs?: number;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function escHtml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatShortDate(ms: number): string {
  const d = new Date(ms);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function clampCriticalHealthThresholdPct(pct: number): number {
  if (!Number.isFinite(pct)) return DEFAULT_CRITICAL_HEALTH_THRESHOLD_PCT;
  return Math.round(clamp(pct, 50, 90));
}

export function formatEnduranceDurationLabel(days: number, alreadyCritical: boolean): string {
  if (alreadyCritical || days <= 0) {
    return 'Osiągnięto próg krytyczny';
  }
  if (days < 45) {
    return `${days} dni (~${(days / 30.4375).toFixed(1)} mies.)`;
  }
  const totalMonths = Math.round(days / 30.4375);
  if (totalMonths < 24) {
    return `${totalMonths} mies. (~${days} dni)`;
  }
  const years = Math.floor(totalMonths / 12);
  const remMonths = totalMonths % 12;
  const yearWord = years === 1 ? 'rok' : years < 5 ? 'lata' : 'lat';
  return remMonths > 0
    ? `${years} ${yearWord} ${remMonths} mies. (~${days} dni)`
    : `${years} ${yearWord} (~${days} dni)`;
}

/**
 * Correlates live power draw trends (W, trend slope, C-rate & thermal stress) with
 * historical battery health degradation (powerCycles / fullChargeCapacityMWh) to
 * forecast time and cycles remaining until reaching critical health (< threshold%).
 */
export function estimateBatteryEndurance(
  battery: BatteryHealthState,
  options: BatteryEnduranceOptions = {}
): BatteryEnduranceEstimate {
  const nowMs = options.nowMs ?? Date.now();
  const criticalHealthThresholdPct = clampCriticalHealthThresholdPct(
    options.criticalHealthThresholdPct ?? DEFAULT_CRITICAL_HEALTH_THRESHOLD_PCT
  );

  const designMWh = Math.max(10_000, Number(battery.designCapacityMWh) || 60_000);
  const fullMWh = Math.max(
    1_000,
    Math.min(designMWh, Number(battery.fullChargeCapacityMWh) || designMWh)
  );
  const computedHealthPct = Number(((fullMWh / designMWh) * 100).toFixed(1));
  const currentHealthPct = Number.isFinite(battery.healthPct)
    ? Number(clamp(battery.healthPct, 5, 100).toFixed(1))
    : computedHealthPct;
  const remainingHealthMarginPct = Number(
    Math.max(0, currentHealthPct - criticalHealthThresholdPct).toFixed(1)
  );
  const alreadyCritical = currentHealthPct <= criticalHealthThresholdPct;

  // 1. Analyze current power draw & recent power draw trend from battery.history
  const currentPowerW = Number(
    Math.max(0, Number.isFinite(battery.currentPowerDrawW) ? battery.currentPowerDrawW : 0).toFixed(1)
  );
  const validHistory = (battery.history || []).filter(
    (h) => Number.isFinite(h.powerW) && h.powerW >= 0
  );
  const powerSamples = validHistory.length > 0 ? validHistory.map((h) => h.powerW) : [currentPowerW];
  const movingAvgPowerW = Number(
    (powerSamples.reduce((acc, v) => acc + v, 0) / Math.max(1, powerSamples.length)).toFixed(1)
  );
  const peakPowerW = Number(Math.max(currentPowerW, ...powerSamples).toFixed(1));

  // Compute power draw trend slope (W/min)
  let powerTrendSlopeWPerMin = 0;
  if (validHistory.length >= 2) {
    const first = validHistory[0];
    const last = validHistory[validHistory.length - 1];
    const hasTimestamps =
      typeof first.timestamp === 'number' &&
      typeof last.timestamp === 'number' &&
      last.timestamp > first.timestamp;
    const spanMin = hasTimestamps
      ? Math.max(0.25, (last.timestamp! - first.timestamp!) / 60_000)
      : Math.max(0.5, (validHistory.length - 1) * 0.25);

    const split = Math.max(1, Math.floor(validHistory.length / 2));
    const earlyAvg =
      validHistory.slice(0, split).reduce((s, p) => s + p.powerW, 0) / split;
    const lateSlice = validHistory.slice(split);
    const lateAvg =
      lateSlice.reduce((s, p) => s + p.powerW, 0) / Math.max(1, lateSlice.length);
    powerTrendSlopeWPerMin = Number(((lateAvg - earlyAvg) / spanMin).toFixed(2));
  }

  const powerTrendDirection: BatteryEnduranceEstimate['powerTrendDirection'] =
    powerTrendSlopeWPerMin >= 1.2
      ? 'rising'
      : powerTrendSlopeWPerMin <= -1.2
        ? 'falling'
        : 'stable';

  // Nominal reference power scales with battery pack energy (~0.25C typical office/web load)
  const fullWh = fullMWh / 1000;
  const designWh = designMWh / 1000;
  const nominalPowerW = Number(Math.max(12, designWh * 0.25).toFixed(1));
  const effectivePowerW = Math.max(4, currentPowerW * 0.55 + movingAvgPowerW * 0.45);
  const cRate = Number((effectivePowerW / Math.max(10, fullWh)).toFixed(2));

  // Correlate power draw, rising trend, and cell temperature into an electrochemical wear multiplier
  const loadRatio = effectivePowerW / nominalPowerW;
  const cRateStress = 0.72 + loadRatio * 0.28 + Math.max(0, cRate - 0.45) * 0.52;
  const trendMultiplier =
    powerTrendDirection === 'rising'
      ? 1 + Math.min(0.22, Math.abs(powerTrendSlopeWPerMin) * 0.03)
      : powerTrendDirection === 'falling'
        ? Math.max(0.88, 1 - Math.min(0.12, Math.abs(powerTrendSlopeWPerMin) * 0.02))
        : 1.0;
  const cellTempC = Number.isFinite(battery.estTempC) ? battery.estTempC : 32;
  const thermalMultiplier =
    cellTempC > 36 ? 1 + Math.min(0.42, (cellTempC - 36) * 0.032) : 1.0;

  const powerStressFactor = Number(
    clamp(cRateStress * trendMultiplier * thermalMultiplier, 0.75, 2.85).toFixed(2)
  );

  // 2. Analyze historical health degradation from powerCycles
  const sortedCycles = [...(battery.powerCycles || [])]
    .filter(
      (c) =>
        Number.isFinite(c.fullChargeCapacityMWh) &&
        c.fullChargeCapacityMWh > 0 &&
        Number.isFinite(c.timestamp)
    )
    .sort((a, b) => a.timestamp - b.timestamp || a.cycleNumber - b.cycleNumber);

  let historicalDegradationPctPerCycle = 0.038; // Standard Li-Ion baseline (~20% loss over ~525 cycles)
  let observedCyclesPerDay = 0.65;
  let confidence: BatteryEnduranceEstimate['confidence'] = 'baseline';

  if (sortedCycles.length >= 2) {
    const first = sortedCycles[0];
    const last = sortedCycles[sortedCycles.length - 1];
    const refDesign = Math.max(designMWh, first.designCapacityMWh || designMWh);

    // Ordinary least squares regression of healthPct vs cycleNumber
    const xs = sortedCycles.map((c, idx) =>
      Number.isFinite(c.cycleNumber) && c.cycleNumber > 0 ? c.cycleNumber : idx + 1
    );
    const ys = sortedCycles.map((c) =>
      clamp((c.fullChargeCapacityMWh / refDesign) * 100, 5, 100)
    );
    const meanX = xs.reduce((a, b) => a + b, 0) / xs.length;
    const meanY = ys.reduce((a, b) => a + b, 0) / ys.length;
    let num = 0;
    let den = 0;
    for (let i = 0; i < xs.length; i++) {
      const dx = xs[i] - meanX;
      num += dx * (ys[i] - meanY);
      den += dx * dx;
    }
    const slopePerCycle = den > 0 ? -num / den : 0; // positive = degradation % per cycle

    const cycleSpan = Math.max(1, last.cycleNumber - first.cycleNumber);
    const spanDays = (last.timestamp - first.timestamp) / 86_400_000;
    if (spanDays >= 1) {
      observedCyclesPerDay = clamp(cycleSpan / spanDays, 0.2, 2.5);
    }

    if (slopePerCycle > 0.005) {
      historicalDegradationPctPerCycle = Number(clamp(slopePerCycle, 0.012, 0.45).toFixed(4));
    } else if (battery.avgDegradationPerCycleMWh > 0) {
      const pct = (battery.avgDegradationPerCycleMWh / designMWh) * 100;
      historicalDegradationPctPerCycle = Number(clamp(pct, 0.015, 0.45).toFixed(4));
    } else if (battery.wearLevelPct > 0.5 && battery.estimatedCycles > 5) {
      historicalDegradationPctPerCycle = Number(
        clamp(battery.wearLevelPct / battery.estimatedCycles, 0.015, 0.45).toFixed(4)
      );
    }

    confidence = sortedCycles.length >= 6 && spanDays >= 7 ? 'high' : 'medium';
  } else if (battery.wearLevelPct > 0.5 && battery.estimatedCycles > 5) {
    historicalDegradationPctPerCycle = Number(
      clamp(battery.wearLevelPct / battery.estimatedCycles, 0.015, 0.4).toFixed(4)
    );
  }

  const historicalDailyDegradationPct = Math.max(
    0.006,
    historicalDegradationPctPerCycle * observedCyclesPerDay
  );
  const historicalMonthlyDegradationPct = Number(
    (historicalDailyDegradationPct * 30.4375).toFixed(2)
  );

  // 3. Correlate historical degradation rate with current power draw stress multiplier
  const correlatedDailyDegradationPct = Number(
    (historicalDailyDegradationPct * powerStressFactor).toFixed(4)
  );
  const correlatedMonthlyDegradationPct = Number(
    (correlatedDailyDegradationPct * 30.4375).toFixed(2)
  );
  const correlatedDegPerCycle = Math.max(
    0.008,
    historicalDegradationPctPerCycle * powerStressFactor
  );

  const baselineDaysAtNominalPower = alreadyCritical
    ? 0
    : Math.max(1, Math.min(3650, Math.round(remainingHealthMarginPct / historicalDailyDegradationPct)));

  const estimatedDaysToCritical = alreadyCritical
    ? 0
    : Math.max(1, Math.min(3650, Math.round(remainingHealthMarginPct / correlatedDailyDegradationPct)));

  const estimatedMonthsToCritical = Number((estimatedDaysToCritical / 30.4375).toFixed(1));
  const estimatedCyclesToCritical = alreadyCritical
    ? 0
    : Math.max(1, Math.min(3000, Math.round(remainingHealthMarginPct / correlatedDegPerCycle)));

  // Positive = extra days gained due to low power draw; Negative = days lost due to high/rising draw
  const powerTrendImpactDays = estimatedDaysToCritical - baselineDaysAtNominalPower;
  const projectedCriticalDateIso = formatShortDate(
    nowMs + estimatedDaysToCritical * 86_400_000
  );

  const urgency: BatteryEnduranceEstimate['urgency'] =
    alreadyCritical || estimatedDaysToCritical <= 90
      ? 'critical'
      : estimatedDaysToCritical <= 270
        ? 'warning'
        : 'healthy';

  const confidenceLabel =
    confidence === 'high'
      ? `Wysoka (${sortedCycles.length} cykli historycznych)`
      : confidence === 'medium'
        ? `Średnia (${sortedCycles.length} cykli historycznych)`
        : 'Bazowa (model Li-Ion + bieżący pomiar)';

  const durationLabel = formatEnduranceDurationLabel(estimatedDaysToCritical, alreadyCritical);

  let recommendation = '';
  if (alreadyCritical) {
    recommendation = `Bateria osiągnęła lub spadła poniżej krytycznego progu ${criticalHealthThresholdPct}% (${currentHealthPct}%). Zaplanuj wymianę akumulatora lub ogranicz pracę pod wysokim poborem mocy (${currentPowerW} W).`;
  } else if (urgency === 'critical') {
    recommendation = `Przy obecnym trendzie poboru mocy (${currentPowerW} W, mnożnik obciążenia ${powerStressFactor}×) ogniwa osiągną próg krytyczny ${criticalHealthThresholdPct}% za ok. ${durationLabel}. Obniżenie obciążenia do ~${nominalPowerW} W wydłuży żywotność o ok. ${Math.max(0, baselineDaysAtNominalPower - estimatedDaysToCritical)} dni.`;
  } else if (powerStressFactor > 1.2) {
    recommendation = `Podwyższony pobór mocy (${currentPowerW} W vs nominał ${nominalPowerW} W, C-rate ${cRate}C) przyspiesza degradację ogniw (${correlatedMonthlyDegradationPct}%/mies. zamiast ${historicalMonthlyDegradationPct}%/mies.). Włącz limit ładowania 80% podczas długiej pracy pod obciążeniem.`;
  } else {
    recommendation = `Obecny profil poboru mocy (${currentPowerW} W, mnożnik ${powerStressFactor}×) jest łagodny dla ogniw — szacowany czas do osiągnięcia progu krytycznego ${criticalHealthThresholdPct}% to ${durationLabel} (~${estimatedCyclesToCritical} cykli).`;
  }

  // 4. Build historical + forecast point series for D3.js line chart
  const historicalPoints: BatteryEnduranceSeriesPoint[] = [];
  if (sortedCycles.length > 0) {
    sortedCycles.forEach((c, idx) => {
      const refDesign = Math.max(designMWh, c.designCapacityMWh || designMWh);
      const hp = Number(clamp((c.fullChargeCapacityMWh / refDesign) * 100, 5, 100).toFixed(1));
      historicalPoints.push({
        index: idx,
        label: `Cykl #${c.cycleNumber}`,
        dateLabel: c.dateLabel || formatShortDate(c.timestamp),
        timestamp: c.timestamp,
        healthPct: hp,
        capacityMWh: Math.round(c.fullChargeCapacityMWh),
        wearPct: Number((100 - hp).toFixed(1)),
        cycleNumber: c.cycleNumber,
        isForecast: false,
      });
    });
  }

  const lastHist = historicalPoints[historicalPoints.length - 1];
  if (
    !lastHist ||
    Math.abs(lastHist.healthPct - currentHealthPct) >= 0.2 ||
    nowMs - lastHist.timestamp > 12 * 3600_000
  ) {
    historicalPoints.push({
      index: historicalPoints.length,
      label: 'Dzisiaj (LIVE)',
      dateLabel: formatShortDate(nowMs),
      timestamp: nowMs,
      healthPct: currentHealthPct,
      capacityMWh: Math.round(fullMWh),
      wearPct: Number((100 - currentHealthPct).toFixed(1)),
      cycleNumber: Math.max(
        battery.estimatedCycles || 0,
        lastHist ? lastHist.cycleNumber : 0
      ),
      isForecast: false,
      isCurrent: true,
    });
  } else {
    lastHist.isCurrent = true;
    lastHist.label = `Dzisiaj (#${lastHist.cycleNumber})`;
  }

  const anchor = historicalPoints[historicalPoints.length - 1];
  const forecastPoints: BatteryEnduranceSeriesPoint[] = [
    { ...anchor, isForecast: true, isCurrent: true },
  ];

  if (!alreadyCritical && estimatedDaysToCritical > 0) {
    const steps = 4;
    for (let s = 1; s <= steps; s++) {
      const frac = s / steps;
      const dayOffset = Math.round(estimatedDaysToCritical * frac);
      const ts = nowMs + dayOffset * 86_400_000;
      const hp = Number(
        Math.max(
          criticalHealthThresholdPct,
          currentHealthPct - remainingHealthMarginPct * frac
        ).toFixed(1)
      );
      const capMWh = Math.round((hp / 100) * designMWh);
      const cyc = Math.round(anchor.cycleNumber + estimatedCyclesToCritical * frac);
      forecastPoints.push({
        index: anchor.index + s,
        label: s === steps ? `Próg ${criticalHealthThresholdPct}%` : `+${Math.round(dayOffset / 30.4375) || dayOffset}${dayOffset >= 45 ? 'm' : 'd'}`,
        dateLabel: formatShortDate(ts),
        timestamp: ts,
        healthPct: hp,
        capacityMWh: capMWh,
        wearPct: Number((100 - hp).toFixed(1)),
        cycleNumber: cyc,
        isForecast: true,
        isCriticalTarget: s === steps,
      });
    }
  }

  return {
    criticalHealthThresholdPct,
    currentHealthPct,
    remainingHealthMarginPct,
    alreadyCritical,
    urgency,
    confidence,
    confidenceLabel,
    currentPowerW,
    movingAvgPowerW,
    peakPowerW,
    nominalPowerW,
    powerTrendSlopeWPerMin,
    powerTrendDirection,
    powerStressFactor,
    cRate,
    historicalDegradationPctPerCycle,
    historicalMonthlyDegradationPct,
    correlatedMonthlyDegradationPct,
    correlatedDailyDegradationPct,
    estimatedDaysToCritical,
    estimatedMonthsToCritical,
    estimatedCyclesToCritical,
    baselineDaysAtNominalPower,
    powerTrendImpactDays,
    projectedCriticalDateIso,
    durationLabel,
    recommendation,
    historicalPoints,
    forecastPoints,
  };
}

/**
 * Renders the Battery Endurance Estimator panel HTML including KPI metrics,
 * interactive critical health threshold presets, and the D3.js chart container.
 */
export function renderBatteryEnduranceEstimatorPanelHtml(
  est: BatteryEnduranceEstimate
): string {
  const urgencyBadge =
    est.urgency === 'critical'
      ? { cls: 'is-critical', text: est.alreadyCritical ? '⚠ PRÓG KRYTYCZNY OSIĄGNIĘTY' : '⚠ PILNA PROGNOZA (< 3 MIES.)' }
      : est.urgency === 'warning'
        ? { cls: 'is-warning', text: '▲ UMIARKOWANE TEMPO DEGRADACJI' }
        : { cls: 'is-healthy', text: '✓ STABILNA ŻYWOTNOŚĆ OGNIW' };

  const trendArrow =
    est.powerTrendDirection === 'rising'
      ? '▲ Rosnący'
      : est.powerTrendDirection === 'falling'
        ? '▼ Malejący'
        : '→ Stabilny';
  const trendCls =
    est.powerTrendDirection === 'rising'
      ? 'status-warn'
      : est.powerTrendDirection === 'falling'
        ? 'status-ok'
        : 'status-cyan';

  const impactTxt = est.alreadyCritical
    ? 'Wymiana ogniw zalecana'
    : est.powerTrendImpactDays < -3
      ? `${est.powerTrendImpactDays} dni vs nominał (${est.nominalPowerW} W)`
      : est.powerTrendImpactDays > 3
        ? `+${est.powerTrendImpactDays} dni zapasu vs nominał`
        : `Zgodne z nominałem (${est.nominalPowerW} W)`;

  const impactCls =
    est.alreadyCritical || est.powerTrendImpactDays < -30
      ? 'status-err'
      : est.powerTrendImpactDays < -3
        ? 'status-warn'
        : 'status-ok';

  return `
    <div class="panel stack-md bat-endurance-panel" id="bat-endurance-estimator-panel" data-endurance-urgency="${est.urgency}">
      <div class="panel-header" style="margin-bottom:0;flex-wrap:wrap;gap:10px;">
        <div>
          <h2 class="panel-title">Battery Endurance Estimator — Prognoza degradacji do progu krytycznego</h2>
          <span class="panel-caption">
            Korelacja bieżącego trendu poboru mocy (W / C-rate) z historyczną degradacją pojemności ogniw (D3.js)
          </span>
        </div>
        <div class="row-wrap" style="gap:8px;align-items:center;">
          <span class="bat-endurance-badge ${urgencyBadge.cls}">${urgencyBadge.text}</span>
          <div class="segmented" role="group" aria-label="Próg krytycznej kondycji baterii">
            ${CRITICAL_HEALTH_PRESETS_PCT.map(
              (pct) => `
              <button
                type="button"
                class="segmented-btn ${est.criticalHealthThresholdPct === pct ? 'active' : ''}"
                data-bat-endurance-threshold="${pct}"
                title="Ustaw próg krytycznej kondycji na ${pct}%"
              >
                Próg &lt;${pct}%
              </button>`
            ).join('')}
          </div>
        </div>
      </div>

      <div class="grid-4">
        <div class="metric-card">
          <span class="metric-label">Czas do progu &lt; ${est.criticalHealthThresholdPct}%</span>
          <div class="metric-row">
            <span class="metric-value ${est.urgency === 'critical' ? 'status-err' : est.urgency === 'warning' ? 'status-warn' : 'status-ok'}" style="font-size:20px;">
              ${est.alreadyCritical ? '0 dni' : est.estimatedMonthsToCritical >= 24 ? `${(est.estimatedMonthsToCritical / 12).toFixed(1)} lat` : `${est.estimatedMonthsToCritical} mies.`}
            </span>
          </div>
          <span class="metric-foot">Data docelowa: <strong class="font-mono">${escHtml(est.projectedCriticalDateIso)}</strong> (${est.estimatedDaysToCritical} dni)</span>
        </div>

        <div class="metric-card">
          <span class="metric-label">Trend poboru mocy &amp; stres ogniw</span>
          <div class="metric-row">
            <span class="metric-value ${trendCls}" style="font-size:20px;">${est.currentPowerW} W</span>
            <span class="metric-unit font-mono">×${est.powerStressFactor.toFixed(2)}</span>
          </div>
          <span class="metric-foot">${trendArrow} (${est.powerTrendSlopeWPerMin >= 0 ? '+' : ''}${est.powerTrendSlopeWPerMin} W/min) · ${est.cRate}C</span>
        </div>

        <div class="metric-card">
          <span class="metric-label">Tempo degradacji (Skorelowane)</span>
          <div class="metric-row">
            <span class="metric-value status-cyan" style="font-size:20px;">-${est.correlatedMonthlyDegradationPct}%</span>
            <span class="metric-unit">/ mies.</span>
          </div>
          <span class="metric-foot">Historyczne bazowe: -${est.historicalMonthlyDegradationPct}%/mies. (-${est.historicalDegradationPctPerCycle.toFixed(3)}%/cykl)</span>
        </div>

        <div class="metric-card">
          <span class="metric-label">Pozostałe cykle / wpływ poboru</span>
          <div class="metric-row">
            <span class="metric-value" style="font-size:20px;">${est.alreadyCritical ? '0' : `~${est.estimatedCyclesToCritical}`}</span>
            <span class="metric-unit">cykli</span>
          </div>
          <span class="metric-foot ${impactCls}">${escHtml(impactTxt)}</span>
        </div>
      </div>

      <div class="stack-sm">
        <div class="row-between" style="flex-wrap:wrap;gap:6px;">
          <span style="font-size:12.5px;font-weight:600;">
            Wykres D3.js: Historyczna degradacja kondycji baterii (%) + prognoza do progu ${est.criticalHealthThresholdPct}%
          </span>
          <span class="panel-caption">
            Pewność modelu: <strong class="font-mono">${escHtml(est.confidenceLabel)}</strong> · Zapas do progu: <strong class="font-mono">${est.remainingHealthMarginPct}%</strong>
          </span>
        </div>
        <div id="bat-endurance-degradation-d3-chart" class="bat-endurance-chart-host">
          <!-- Rendered via D3.js -->
        </div>
      </div>

      <div style="font-size:12px;color:var(--text-secondary);background:var(--bg-inset);border:1px solid var(--border-hairline);border-radius:8px;padding:10px 12px;line-height:1.5;">
        <strong style="color:var(--text-primary);">Analiza korelacji:</strong> ${escHtml(est.recommendation)}
      </div>
    </div>
  `;
}

/**
 * Renders the D3.js line chart of historical battery health degradation and
 * correlated forecast trajectory down to the critical health threshold.
 */
export function renderBatteryEnduranceDegradationD3Chart(
  container: HTMLElement,
  est: BatteryEnduranceEstimate,
  height = 235
): void {
  if (!container) return;
  const allPoints: BatteryEnduranceSeriesPoint[] = [
    ...est.historicalPoints,
    ...est.forecastPoints.slice(1),
  ];

  container.innerHTML = '';
  if (allPoints.length === 0) {
    container.innerHTML = `<div class="panel-caption" style="padding:20px;text-align:center;">Brak danych historycznych kondycji baterii do wyrysowania wykresu.</div>`;
    return;
  }

  const width = Math.max(320, Math.round(container.clientWidth || 720));
  const margin = { top: 20, right: 26, bottom: 38, left: 48 };
  const innerW = Math.max(160, width - margin.left - margin.right);
  const innerH = Math.max(120, height - margin.top - margin.bottom);

  const wrapper = d3
    .select(container)
    .append('div')
    .style('position', 'relative')
    .style('width', '100%');

  const svg = wrapper
    .append('svg')
    .attr('class', 'bat-endurance-d3-svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('width', '100%')
    .attr('height', height)
    .attr('role', 'img')
    .attr(
      'aria-label',
      `Wykres degradacji kondycji baterii do progu krytycznego ${est.criticalHealthThresholdPct}%`
    );

  const defs = svg.append('defs');
  const histGrad = defs
    .append('linearGradient')
    .attr('id', 'bat-endurance-hist-grad')
    .attr('x1', '0%')
    .attr('y1', '0%')
    .attr('x2', '0%')
    .attr('y2', '100%');
  histGrad.append('stop').attr('offset', '0%').attr('stop-color', '#06b6d4').attr('stop-opacity', 0.34);
  histGrad.append('stop').attr('offset', '100%').attr('stop-color', '#06b6d4').attr('stop-opacity', 0.02);

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const xScale = d3
    .scaleLinear()
    .domain([0, Math.max(1, allPoints.length - 1)])
    .range([0, innerW]);

  const minPointY = Math.min(
    est.criticalHealthThresholdPct - 8,
    ...allPoints.map((p) => p.healthPct)
  );
  const yMin = Math.max(0, Math.floor(Math.min(50, minPointY) / 5) * 5);
  const yMax = 100;
  const yScale = d3.scaleLinear().domain([yMin, yMax]).range([innerH, 0]);

  // Shaded critical danger zone (< criticalHealthThresholdPct)
  const critY = yScale(est.criticalHealthThresholdPct);
  g.append('rect')
    .attr('x', 0)
    .attr('y', critY)
    .attr('width', innerW)
    .attr('height', Math.max(0, innerH - critY))
    .attr('fill', 'rgba(244, 63, 94, 0.10)');

  // Horizontal gridlines
  const yTicks = yScale.ticks(5);
  g.append('g')
    .selectAll('line')
    .data(yTicks)
    .join('line')
    .attr('x1', 0)
    .attr('x2', innerW)
    .attr('y1', (d) => yScale(d))
    .attr('y2', (d) => yScale(d))
    .attr('stroke', 'rgba(148, 163, 184, 0.14)')
    .attr('stroke-dasharray', '2,3');

  // Critical threshold dashed reference line
  g.append('line')
    .attr('class', 'bat-endurance-threshold-line')
    .attr('x1', 0)
    .attr('x2', innerW)
    .attr('y1', critY)
    .attr('y2', critY)
    .attr('stroke', '#f43f5e')
    .attr('stroke-width', 1.6)
    .attr('stroke-dasharray', '6,4');

  g.append('text')
    .attr('x', innerW - 4)
    .attr('y', Math.max(11, critY - 5))
    .attr('text-anchor', 'end')
    .attr('fill', '#fb7185')
    .attr('font-size', '10.5px')
    .attr('font-weight', '700')
    .attr('font-family', 'JetBrains Mono, monospace')
    .text(`Próg krytyczny: ${est.criticalHealthThresholdPct}%`);

  // Historical area & solid line
  const histIndexed = est.historicalPoints.map((pt, i) => ({ pt, xIdx: i }));
  const histArea = d3
    .area<{ pt: BatteryEnduranceSeriesPoint; xIdx: number }>()
    .x((d) => xScale(d.xIdx))
    .y0(innerH)
    .y1((d) => yScale(d.pt.healthPct))
    .curve(d3.curveMonotoneX);

  const histLine = d3
    .line<{ pt: BatteryEnduranceSeriesPoint; xIdx: number }>()
    .x((d) => xScale(d.xIdx))
    .y((d) => yScale(d.pt.healthPct))
    .curve(d3.curveMonotoneX);

  if (histIndexed.length >= 2) {
    g.append('path')
      .datum(histIndexed)
      .attr('fill', 'url(#bat-endurance-hist-grad)')
      .attr('d', histArea);

    g.append('path')
      .datum(histIndexed)
      .attr('class', 'bat-endurance-history-line')
      .attr('fill', 'none')
      .attr('stroke', '#22d3ee')
      .attr('stroke-width', 2.4)
      .attr('d', histLine);
  }

  // Forecast dashed line
  if (est.forecastPoints.length >= 2) {
    const startIdx = Math.max(0, histIndexed.length - 1);
    const forecastIndexed = est.forecastPoints.map((pt, i) => ({
      pt,
      xIdx: startIdx + i,
    }));

    const forecastLine = d3
      .line<{ pt: BatteryEnduranceSeriesPoint; xIdx: number }>()
      .x((d) => xScale(d.xIdx))
      .y((d) => yScale(d.pt.healthPct))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(forecastIndexed)
      .attr('class', 'bat-endurance-forecast-line')
      .attr('fill', 'none')
      .attr('stroke', est.urgency === 'critical' ? '#fb7185' : '#f59e0b')
      .attr('stroke-width', 2.2)
      .attr('stroke-dasharray', '6,4')
      .attr('d', forecastLine);
  }

  // Axes
  const yAxis = d3
    .axisLeft(yScale)
    .ticks(5)
    .tickFormat((d) => `${d}%`);
  g.append('g')
    .call(yAxis)
    .call((sel) => sel.select('.domain').attr('stroke', 'rgba(148,163,184,0.28)'))
    .call((sel) => sel.selectAll('.tick line').attr('stroke', 'rgba(148,163,184,0.25)'))
    .call((sel) =>
      sel
        .selectAll('text')
        .attr('fill', '#94a3b8')
        .attr('font-size', '10.5px')
        .attr('font-family', 'JetBrains Mono, monospace')
    );

  // X-axis sparse labels
  const tickIndices =
    allPoints.length <= 6
      ? allPoints.map((_, i) => i)
      : [
          0,
          Math.floor((allPoints.length - 1) * 0.25),
          Math.floor((allPoints.length - 1) * 0.5),
          Math.floor((allPoints.length - 1) * 0.75),
          allPoints.length - 1,
        ];
  const uniqueTicks = Array.from(new Set(tickIndices));

  const xAxis = d3
    .axisBottom(xScale)
    .tickValues(uniqueTicks)
    .tickFormat((d) => {
      const idx = Math.round(Number(d));
      return allPoints[idx]?.label ?? '';
    });

  g.append('g')
    .attr('transform', `translate(0,${innerH})`)
    .call(xAxis)
    .call((sel) => sel.select('.domain').attr('stroke', 'rgba(148,163,184,0.28)'))
    .call((sel) => sel.selectAll('.tick line').attr('stroke', 'rgba(148,163,184,0.25)'))
    .call((sel) =>
      sel
        .selectAll('text')
        .attr('fill', '#94a3b8')
        .attr('font-size', '10px')
        .attr('font-family', 'JetBrains Mono, monospace')
    );

  // Data dots
  g.selectAll('circle.bat-endurance-dot')
    .data(allPoints.map((pt, xIdx) => ({ pt, xIdx })))
    .join('circle')
    .attr('class', 'bat-endurance-dot')
    .attr('cx', (d) => xScale(d.xIdx))
    .attr('cy', (d) => yScale(d.pt.healthPct))
    .attr('r', (d) => (d.pt.isCurrent || d.pt.isCriticalTarget ? 5 : 3.2))
    .attr('fill', (d) =>
      d.pt.isCriticalTarget
        ? '#f43f5e'
        : d.pt.isCurrent
          ? '#10b981'
          : d.pt.isForecast
            ? '#f59e0b'
            : '#22d3ee'
    )
    .attr('stroke', '#070b14')
    .attr('stroke-width', 1.6);

  // Compact legend at top-left
  const legend = g.append('g').attr('transform', 'translate(6, -6)');
  const legendItems = [
    { color: '#22d3ee', label: 'Historia kondycji (%)', dash: '' },
    {
      color: est.urgency === 'critical' ? '#fb7185' : '#f59e0b',
      label: `Prognoza (×${est.powerStressFactor.toFixed(2)} pobór)`,
      dash: '4,3',
    },
  ];
  let lx = 0;
  legendItems.forEach((item) => {
    legend
      .append('line')
      .attr('x1', lx)
      .attr('x2', lx + 16)
      .attr('y1', 0)
      .attr('y2', 0)
      .attr('stroke', item.color)
      .attr('stroke-width', 2.2)
      .attr('stroke-dasharray', item.dash || null);
    legend
      .append('text')
      .attr('x', lx + 21)
      .attr('y', 3.5)
      .attr('fill', '#cbd5e1')
      .attr('font-size', '10px')
      .text(item.label);
    lx += item.label.length * 6.2 + 34;
  });

  // Hover crosshair & tooltip
  const focusLine = g
    .append('line')
    .attr('y1', 0)
    .attr('y2', innerH)
    .attr('stroke', 'rgba(226, 232, 240, 0.35)')
    .attr('stroke-dasharray', '3,3')
    .style('display', 'none');

  const focusDot = g
    .append('circle')
    .attr('r', 6)
    .attr('fill', '#38bdf8')
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
    .style('border', '1px solid rgba(56, 189, 248, 0.45)')
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
      const rawIdx = xScale.invert(mx);
      const idx = Math.max(0, Math.min(allPoints.length - 1, Math.round(rawIdx)));
      const pt = allPoints[idx];
      if (!pt) return;
      const cx = xScale(idx);
      const cy = yScale(pt.healthPct);

      focusLine.style('display', null).attr('x1', cx).attr('x2', cx);
      focusDot
        .style('display', null)
        .attr('cx', cx)
        .attr('cy', cy)
        .attr(
          'fill',
          pt.isCriticalTarget ? '#f43f5e' : pt.isForecast ? '#f59e0b' : '#22d3ee'
        );

      const typeTag = pt.isCriticalTarget
        ? `<span style="color:#fb7185;font-weight:700;">Prognoza progu krytycznego</span>`
        : pt.isCurrent
          ? `<span style="color:#34d399;font-weight:700;">Stan bieżący (LIVE)</span>`
          : pt.isForecast
            ? `<span style="color:#fbbf24;font-weight:700;">Prognoza degradacji</span>`
            : `<span style="color:#38bdf8;font-weight:700;">Pomiar historyczny</span>`;

      tooltip
        .style('display', 'block')
        .html(
          `<div>${typeTag}</div>
           <div class="font-mono" style="margin-top:2px;"><strong>${escHtml(pt.label)}</strong> · ${escHtml(pt.dateLabel)}</div>
           <div class="font-mono">Kondycja: <strong style="color:${pt.healthPct <= est.criticalHealthThresholdPct ? '#fb7185' : '#34d399'};">${pt.healthPct.toFixed(1)}%</strong> (zużycie ${pt.wearPct.toFixed(1)}%)</div>
           <div class="font-mono">Pojemność: <strong>${pt.capacityMWh.toLocaleString('pl-PL')} mWh</strong> · Cykl ~#${pt.cycleNumber}</div>`
        );

      const leftPx = Math.min(
        Math.max(8, margin.left + cx + 12),
        Math.max(8, width - 225)
      );
      const topPx = Math.max(8, margin.top + cy - 58);
      tooltip.style('left', `${leftPx}px`).style('top', `${topPx}px`);
    })
    .on('mouseleave', () => {
      focusLine.style('display', 'none');
      focusDot.style('display', 'none');
      tooltip.style('display', 'none');
    });
}
