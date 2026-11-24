export const PSU_CAPACITY_ALERT_THRESHOLD_PCT = 95;

export function clampPsuCapacityThresholdPct(thresholdPct?: number): number {
  if (typeof thresholdPct !== 'number' || !Number.isFinite(thresholdPct)) {
    return PSU_CAPACITY_ALERT_THRESHOLD_PCT;
  }
  return Number(Math.max(1, Math.min(100, thresholdPct)).toFixed(1));
}

export function isPsuCapacityOver95(
  totalSystemPowerW: number,
  psuCapacityW: number,
  loadPercentageOfPsu?: number,
  thresholdPct: number = PSU_CAPACITY_ALERT_THRESHOLD_PCT
): boolean {
  if (!Number.isFinite(psuCapacityW) || psuCapacityW <= 0) return false;
  if (!Number.isFinite(totalSystemPowerW) || totalSystemPowerW < 0) return false;
  const safeThreshold = clampPsuCapacityThresholdPct(thresholdPct);
  const pct =
    typeof loadPercentageOfPsu === 'number' && Number.isFinite(loadPercentageOfPsu)
      ? loadPercentageOfPsu
      : (totalSystemPowerW / psuCapacityW) * 100;
  return totalSystemPowerW > psuCapacityW * (safeThreshold / 100) || pct > safeThreshold;
}

export function renderPsuCapacityAlertBannerHtml(
  totalSystemPowerW: number,
  psuCapacityW: number,
  loadPercentageOfPsu?: number,
  thresholdPct: number = PSU_CAPACITY_ALERT_THRESHOLD_PCT
): string {
  const safeThreshold = clampPsuCapacityThresholdPct(thresholdPct);
  if (!isPsuCapacityOver95(totalSystemPowerW, psuCapacityW, loadPercentageOfPsu, safeThreshold)) {
    return '';
  }

  const pctVal =
    typeof loadPercentageOfPsu === 'number' && Number.isFinite(loadPercentageOfPsu)
      ? loadPercentageOfPsu
      : (totalSystemPowerW / psuCapacityW) * 100;
  const thresholdLabel = Number.isInteger(safeThreshold)
    ? `${safeThreshold}%`
    : `${safeThreshold.toFixed(1)}%`;

  return `
    <div class="psu-rail-capacity-alert-banner" role="alert" data-psu-capacity-alert="true" data-psu-threshold-pct="${safeThreshold}">
      <span class="psu-rail-capacity-alert-badge">⚠ &gt;${thresholdLabel} PSU</span>
      <span class="psu-rail-capacity-alert-text">
        Przekroczono ${thresholdLabel} mocy PSU (${Math.round(totalSystemPowerW)} W / ${psuCapacityW} W · ${pctVal.toFixed(1)}%). Ryzyko zadziałania OPP/OCP.
      </span>
    </div>
  `;
}
