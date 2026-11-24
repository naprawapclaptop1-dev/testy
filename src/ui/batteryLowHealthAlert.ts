import { BatteryHealthState } from '../types';

export const LOW_BATTERY_HEALTH_THRESHOLD_PCT = 75;

function esc(str: unknown): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function isLowBatteryHealth(healthPct: number): boolean {
  return Number.isFinite(healthPct) && healthPct < LOW_BATTERY_HEALTH_THRESHOLD_PCT;
}

export function renderLowBatteryHealthAlertHtml(
  b: BatteryHealthState,
  compact = false
): string {
  if (!isLowBatteryHealth(b.healthPct)) return '';

  const isCritical = b.healthPct < 60;
  const severity = isCritical ? 'critical' : 'warning';
  const severityBadge = isCritical ? 'KRYTYCZNY SPADEK' : 'LOW BATTERY HEALTH';
  const fullWh = (b.fullChargeCapacityMWh / 1000).toFixed(1);
  const designWh = (b.designCapacityMWh / 1000).toFixed(1);

  if (compact) {
    return `
      <div
        class="battery-low-health-alert battery-low-health-alert--compact ${isCritical ? 'is-critical' : ''}"
        role="alert"
        data-low-battery-health-alert="true"
        data-severity="${severity}"
      >
        <div class="battery-low-health-alert-head">
          <span class="battery-low-health-badge">${severityBadge}</span>
          <strong>Niska kondycja baterii (${b.healthPct}% &lt; ${LOW_BATTERY_HEALTH_THRESHOLD_PCT}%)</strong>
        </div>
        <p class="battery-low-health-copy">
          Pojemność ogniw spadła do ${fullWh} Wh z ${designWh} Wh (zużycie ${b.wearLevelPct}%).
          <strong>Zalecenie: sprawdź gwarancję producenta (manufacturer warranty)</strong> pod kątem bezpłatnej wymiany akumulatora lub zaplanuj serwis.
        </p>
      </div>
    `;
  }

  return `
    <div
      class="battery-low-health-alert ${isCritical ? 'is-critical' : ''}"
      role="alert"
      data-low-battery-health-alert="true"
      data-severity="${severity}"
    >
      <div class="battery-low-health-alert-main">
        <div class="battery-low-health-alert-icon" aria-hidden="true">⚠</div>
        <div class="battery-low-health-alert-body">
          <div class="battery-low-health-alert-head">
            <span class="battery-low-health-badge">${severityBadge}</span>
            <h3 class="battery-low-health-title">Alert niskiej kondycji baterii: ${b.healthPct}% (próg &lt; ${LOW_BATTERY_HEALTH_THRESHOLD_PCT}%)</h3>
          </div>
          <p class="battery-low-health-copy">
            Rzeczywista pełna pojemność spadła do <strong class="font-mono">${esc(b.fullChargeCapacityMWh.toLocaleString('pl-PL'))} mWh</strong> (${fullWh} Wh) względem fabrycznej <strong class="font-mono">${esc(b.designCapacityMWh.toLocaleString('pl-PL'))} mWh</strong> (${designWh} Wh) — zużycie ogniw wynosi <strong class="font-mono">${b.wearLevelPct}%</strong> przy ok. ${b.estimatedCycles} cyklach ładowania.
          </p>
          <p class="battery-low-health-warranty">
            <strong>Zalecenie serwisowe (Gwarancja Producenta):</strong> Sprawdź warunki gwarancji producenta (<em>manufacturer warranty</em>) lub rozszerzonego pakietu wsparcia — w wielu laptopach spadek pojemności ogniw poniżej 75–80% w okresie gwarancyjnym kwalifikuje baterię do wymiany gwarancyjnej.
          </p>
        </div>
      </div>
    </div>
  `;
}
