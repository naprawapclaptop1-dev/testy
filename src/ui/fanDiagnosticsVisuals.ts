import * as d3 from 'd3';
import {
  FanAcousticHeatmapCell,
  FanAcousticHeatmapState,
  FanBearingHealthDayPoint,
  FanHeatmapSectionTab,
  FanPwmChannelReading,
  FanPwmMonitorState,
} from '../types';
import { iconSvg } from './icons';

function escHtml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderPwmChannelSparklineSvg(ch: FanPwmChannelReading, tolerancePct: number): string {
  const w = 180;
  const h = 38;
  const padX = 4;
  const padY = 5;
  const target = ch.programmedHz;
  const tolHz = Math.max(10, target * (tolerancePct / 100));
  const pts = ch.historyHz.length > 0 ? ch.historyHz : [ch.measuredHz];
  const minVal = Math.min(target - tolHz * 1.45, ...pts);
  const maxVal = Math.max(target + tolHz * 1.45, ...pts);
  const span = Math.max(1, maxVal - minVal);

  const mapY = (hz: number) =>
    padY + (1 - (hz - minVal) / span) * (h - padY * 2);
  const mapX = (idx: number) =>
    pts.length <= 1
      ? w - padX
      : padX + (idx / (pts.length - 1)) * (w - padX * 2);

  const bandTop = Math.max(padY, mapY(target + tolHz));
  const bandBot = Math.min(h - padY, mapY(target - tolHz));
  const targetY = mapY(target);

  const pathCoords = pts
    .map((hz, i) => `${i === 0 ? 'M' : 'L'}${mapX(i).toFixed(1)},${mapY(hz).toFixed(1)}`)
    .join(' ');
  const strokeColor =
    ch.status === 'CRITICAL' ? '#fb7185' : ch.status === 'DEVIATION' ? '#fbbf24' : '#38bdf8';

  const lastX = mapX(pts.length - 1);
  const lastY = mapY(pts[pts.length - 1]);

  return `
    <svg class="fan-pwm-sparkline" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
      <rect x="${padX}" y="${bandTop.toFixed(1)}" width="${w - padX * 2}" height="${Math.max(2, bandBot - bandTop).toFixed(1)}" fill="rgba(16, 185, 129, 0.14)" rx="2" />
      <line x1="${padX}" y1="${targetY.toFixed(1)}" x2="${w - padX}" y2="${targetY.toFixed(1)}" stroke="rgba(148, 163, 184, 0.55)" stroke-dasharray="3 2" stroke-width="1" />
      ${pts.length > 1 ? `<path d="${pathCoords}" fill="none" stroke="${strokeColor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />` : ''}
      <circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="2.8" fill="${strokeColor}" stroke="#ffffff" stroke-width="0.9" />
    </svg>
  `;
}

function bearingTierClass(tier: FanPwmChannelReading['bearingHealthTier']): string {
  switch (tier) {
    case 'CRITICAL':
      return 'is-health-critical';
    case 'DEGRADED':
      return 'is-health-degraded';
    case 'FAIR':
      return 'is-health-fair';
    default:
      return 'is-health-healthy';
  }
}

function bearingTierFromScore(score: number): FanPwmChannelReading['bearingHealthTier'] {
  if (score >= 80) return 'HEALTHY';
  if (score >= 60) return 'FAIR';
  if (score >= 40) return 'DEGRADED';
  return 'CRITICAL';
}

function bearingStrokeColor(tier: FanPwmChannelReading['bearingHealthTier']): string {
  switch (tier) {
    case 'CRITICAL':
      return '#f43f5e';
    case 'DEGRADED':
      return '#f97316';
    case 'FAIR':
      return '#eab308';
    default:
      return '#10b981';
  }
}

function renderBearingHealth7DaySparklineSvg(ch: FanPwmChannelReading, thresholdPct: number): string {
  const history =
    ch.bearingHealth7DayHistory && ch.bearingHealth7DayHistory.length > 0
      ? ch.bearingHealth7DayHistory
      : [{ dayOffset: 0, label: 'Today', score: ch.bearingHealthIndex }];
  const w = 180;
  const h = 42;
  const padX = 7;
  const padY = 6;
  const scores = history.map((pt) => pt.score);
  const minRaw = Math.min(...scores, thresholdPct);
  const maxRaw = Math.max(...scores, thresholdPct);
  const minY = Math.max(0, minRaw - 8);
  const maxY = Math.min(100, Math.max(minY + 18, maxRaw + 6));
  const span = Math.max(1, maxY - minY);

  const mapX = (idx: number) =>
    history.length <= 1 ? w - padX : padX + (idx / (history.length - 1)) * (w - padX * 2);
  const mapY = (score: number) =>
    padY + (1 - (score - minY) / span) * (h - padY * 2);

  const strokeColor = bearingStrokeColor(ch.bearingHealthTier);
  const threshY = mapY(thresholdPct);
  const threshColor = ch.maintenanceAlertTriggered ? '#fb7185' : 'rgba(251, 191, 36, 0.85)';

  const lineCoords = history
    .map((pt, i) => `${i === 0 ? 'M' : 'L'}${mapX(i).toFixed(1)},${mapY(pt.score).toFixed(1)}`)
    .join(' ');
  const firstX = mapX(0);
  const lastX = mapX(history.length - 1);
  const baseY = h - padY + 3;
  const areaCoords =
    history.length > 1
      ? `${lineCoords} L${lastX.toFixed(1)},${baseY.toFixed(1)} L${firstX.toFixed(1)},${baseY.toFixed(1)} Z`
      : '';

  const firstScore = scores[0];
  const lastScore = scores[scores.length - 1];
  const deltaPts = Math.round(lastScore - firstScore);
  const deltaSign = deltaPts > 0 ? '+' : '';
  const deltaCls = deltaPts < -3 ? 'is-down' : deltaPts > 0 ? 'is-up' : 'is-flat';

  const dotsSvg = history
    .map((pt, idx) => {
      const cx = mapX(idx).toFixed(1);
      const cy = mapY(pt.score).toFixed(1);
      const isLast = idx === history.length - 1;
      const belowThresh = pt.score < thresholdPct;
      const fill = belowThresh ? '#f43f5e' : strokeColor;
      const r = isLast ? '3.1' : '2.0';
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" ${
        isLast ? 'stroke="#ffffff" stroke-width="0.9"' : ''
      }><title>${escHtml(pt.label)}: ${pt.score}/100</title></circle>`;
    })
    .join('');

  return `
    <div class="fan-pwm-bearing-sparkline-wrap">
      <div class="fan-pwm-bearing-sparkline-head font-mono">
        <span>7-Day Trend</span>
        <span class="fan-pwm-bearing-sparkline-delta ${deltaCls}">${deltaSign}${deltaPts} pts</span>
      </div>
      <svg class="fan-pwm-bearing-sparkline" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="7-day bearing health trend sparkline for ${escHtml(ch.label)}">
        <line x1="${padX}" y1="${threshY.toFixed(1)}" x2="${w - padX}" y2="${threshY.toFixed(1)}" stroke="${threshColor}" stroke-dasharray="3 2" stroke-width="1" />
        <text x="${w - padX - 1}" y="${Math.max(9, threshY - 2).toFixed(1)}" text-anchor="end" fill="${threshColor}" font-size="7.5" font-family="var(--font-mono)" font-weight="700">${thresholdPct}%</text>
        ${areaCoords ? `<path d="${areaCoords}" fill="${strokeColor}" fill-opacity="0.14" />` : ''}
        ${history.length > 1 ? `<path d="${lineCoords}" fill="none" stroke="${strokeColor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />` : ''}
        ${dotsSvg}
      </svg>
      <div class="fan-pwm-bearing-sparkline-axis font-mono">
        <span>${escHtml(history[0]?.label || '-6d')}</span>
        <span>${escHtml(history[Math.floor(history.length / 2)]?.label || '-3d')}</span>
        <span>${escHtml(history[history.length - 1]?.label || 'Today')}</span>
      </div>
    </div>
  `;
}

export function renderFanPwmMonitorInnerHtml(pwm: FanPwmMonitorState): string {
  const minAllowedHz = Math.round(pwm.programmedHz * (1 - pwm.tolerancePct / 100));
  const maxAllowedHz = Math.round(pwm.programmedHz * (1 + pwm.tolerancePct / 100));
  const hasDeviations = pwm.deviationCount > 0;
  const hasRpmPulseAlerts = pwm.rpmDutyWarningCount > 0;
  const lowestTier = bearingTierFromScore(pwm.lowestBearingHealthIndex);
  const lowestTierCls = bearingTierClass(lowestTier);
  const hasMaintAlerts = pwm.maintenanceAlertCount > 0;
  const maintThreshold = pwm.predictiveMaintenanceThresholdPct;

  return `
    <div class="fan-pwm-summary-strip">
      <div class="fan-pwm-summary-pill ${pwm.active ? 'is-live' : ''}">
        <span class="fan-pwm-dot ${pwm.active ? 'is-live' : ''}"></span>
        <span>${pwm.active ? 'MONITORING AKTYWNY (2 Hz)' : 'GOTOWY — Kliknij Monitoruj sygnał PWM'}</span>
      </div>
      <div class="fan-pwm-summary-item">
        <span>Zegar PWM płyty głównej:</span>
        <strong class="font-mono">${pwm.programmedHz.toLocaleString('pl-PL')} Hz</strong>
      </div>
      <div class="fan-pwm-summary-item">
        <span>Pasmo tolerancji (±${pwm.tolerancePct}%):</span>
        <strong class="font-mono">${minAllowedHz.toLocaleString('pl-PL')} – ${maxAllowedHz.toLocaleString('pl-PL')} Hz</strong>
      </div>
      <div class="fan-pwm-summary-item">
        <span>Odchyłki częstotliwości:</span>
        <strong class="font-mono ${hasDeviations ? 'status-err' : 'status-ok'}">
          ${hasDeviations ? `⚠ ${pwm.deviationCount} / ${pwm.channels.length} went.` : `✓ 0 / ${pwm.channels.length} Zgodne`}
        </strong>
      </div>
      <div class="fan-pwm-summary-item ${hasRpmPulseAlerts ? 'is-pulse-summary' : ''}">
        <span>Błędy RPM/Duty (&gt;${pwm.rpmDeviationThresholdPct}% / &gt;${pwm.rpmDeviationHoldSec}s):</span>
        <strong class="font-mono ${hasRpmPulseAlerts ? 'status-err' : 'status-ok'}">
          ${hasRpmPulseAlerts ? `<span class="fan-pwm-pulse-beacon" aria-hidden="true"></span> ${pwm.rpmDutyWarningCount} ALARM RPM` : '✓ W normie'}
        </strong>
      </div>
      <div class="fan-pwm-summary-item fan-pwm-bearing-summary ${lowestTierCls}">
        <span>Kondycja łożysk (Bearing Health Index):</span>
        <strong class="font-mono fan-pwm-bearing-val ${lowestTierCls}">
          ${pwm.lowestBearingHealthIndex}/100 (${lowestTier === 'HEALTHY' ? 'SPRAWNY' : lowestTier} · Śr. ${pwm.avgBearingHealthIndex})
        </strong>
      </div>
      <div class="fan-pwm-summary-item fan-pwm-bearing-maint-summary ${hasMaintAlerts ? 'is-maint-alert' : ''}" data-maint-summary>
        <span>Alerty łożysk (&lt;<span class="fan-bearing-threshold-num">${maintThreshold}</span>%):</span>
        <strong class="font-mono ${hasMaintAlerts ? 'status-err' : 'status-ok'}" data-maint-summary-count>
          ${hasMaintAlerts ? `⚠ ${pwm.maintenanceAlertCount} Alert` : '✓ Brak alertów (OK)'}
        </strong>
        ${
          hasMaintAlerts
            ? `<button type="button" class="btn btn-danger btn-xs fan-open-bearing-alert-trigger" data-open-bearing-alert="all" style="margin-left:6px;padding:2px 8px;font-size:10.5px;">Pokaż szczegóły i instrukcje</button>`
            : ''
        }
      </div>
    </div>

    <div class="fan-pwm-channel-grid">
      ${pwm.channels
        .map((ch) => {
          const cardCls =
            ch.status === 'CRITICAL'
              ? 'is-critical'
              : ch.status === 'DEVIATION'
                ? 'is-deviation'
                : 'is-ok';
          const pulseCardCls = ch.rpmDutyWarningPulse ? 'is-rpm-warning-pulse' : '';
          const badgeText = ch.rpmDutyWarningPulse
            ? '🚨 ALARM RPM/DUTY'
            : ch.status === 'CRITICAL'
              ? '🚨 KRYTYCZNY DRYFT'
              : ch.status === 'DEVIATION'
                ? '⚠ ODCHYŁKA HZ'
                : '✓ SPRAWNY (SYNC OK)';
          const badgeCls = ch.rpmDutyWarningPulse ? 'is-pulse' : cardCls;
          const devSign = ch.deviationHz >= 0 ? '+' : '';
          const devText = `${devSign}${ch.deviationHz.toLocaleString('pl-PL')} Hz (${devSign}${ch.deviationPct.toFixed(2)}%)`;
          const rpmDevSign = ch.rpmDutyDeviationPct >= 0 ? '+' : '';
          const rpmDevExceeds = Math.abs(ch.rpmDutyDeviationPct) > pwm.rpmDeviationThresholdPct;
          const holdPct = Math.min(100, Math.round((ch.rpmDeviationDurationMs / (pwm.rpmDeviationHoldSec * 1000)) * 100));

          const rpmAlertBlock = ch.rpmDutyWarningPulse
            ? `
              <div class="fan-pwm-rpm-pulse-alert" role="alert">
                <div class="fan-pwm-rpm-pulse-head font-mono">
                  <span class="fan-pwm-pulse-beacon" aria-hidden="true"></span>
                  <strong>ALARM OBROTÓW · RPM/DUTY Δ ${rpmDevSign}${ch.rpmDutyDeviationPct.toFixed(1)}%</strong>
                  <span>${(ch.rpmDeviationDurationMs / 1000).toFixed(1)}s</span>
                </div>
                <div class="fan-pwm-rpm-pulse-text">${escHtml(ch.rpmDutyFaultHint || 'Możliwe zużycie łożyska lub niestabilność kontrolera PWM.')}</div>
              </div>
            `
            : rpmDevExceeds
              ? `
                <div class="fan-pwm-rpm-hold-banner">
                  <div class="fan-pwm-rpm-hold-row font-mono">
                    <span>⚠ Odchyłka RPM/Duty Δ ${rpmDevSign}${ch.rpmDutyDeviationPct.toFixed(1)}% (&gt;${pwm.rpmDeviationThresholdPct}%)</span>
                    <span>${(ch.rpmDeviationDurationMs / 1000).toFixed(1)}s / ${pwm.rpmDeviationHoldSec.toFixed(1)}s</span>
                  </div>
                  <div class="fan-pwm-rpm-hold-track">
                    <span class="fan-pwm-rpm-hold-fill" style="width:${holdPct}%;"></span>
                  </div>
                </div>
              `
              : '';

          const healthCls = bearingTierClass(ch.bearingHealthTier);
          const healthClamped = Math.max(0, Math.min(100, Math.round(ch.bearingHealthIndex)));
          const maintAlertCls = ch.maintenanceAlertTriggered ? 'is-maint-alert' : '';
          const tierPl =
            ch.bearingHealthTier === 'HEALTHY'
              ? 'SPRAWNY'
              : ch.bearingHealthTier === 'FAIR'
                ? 'DOBRY'
                : ch.bearingHealthTier === 'DEGRADED'
                  ? 'ZUŻYCIE'
                  : 'KRYTYCZNY';

          return `
            <div class="fan-pwm-channel-card ${cardCls} ${pulseCardCls}" data-pwm-channel="${escHtml(ch.id)}" data-rpm-warning-pulse="${ch.rpmDutyWarningPulse ? 'true' : 'false'}" data-bearing-tier="${escHtml(ch.bearingHealthTier)}">
              <div class="fan-pwm-card-head">
                <div>
                  <div class="fan-pwm-card-title">${escHtml(ch.label)}</div>
                  <div class="fan-pwm-card-header font-mono">${escHtml(ch.header)}</div>
                </div>
                <span class="fan-pwm-status-badge ${badgeCls}">${badgeText}</span>
              </div>

              <div class="fan-pwm-freq-row">
                <div class="fan-pwm-measured">
                  <span class="fan-pwm-measured-val font-mono">${ch.measuredHz.toLocaleString('pl-PL')}</span>
                  <span class="fan-pwm-measured-unit">Hz</span>
                </div>
                <div class="fan-pwm-target-col font-mono">
                  <span>Cel: ${ch.programmedHz.toLocaleString('pl-PL')} Hz</span>
                  <span class="fan-pwm-dev-val ${cardCls}">Δ ${devText}</span>
                </div>
              </div>

              ${renderPwmChannelSparklineSvg(ch, pwm.tolerancePct)}

              <div class="fan-pwm-meta-row font-mono">
                <span>Wypełnienie: <strong>${ch.dutyPct}%</strong></span>
                <span>Obroty RPM: <strong class="${rpmDevExceeds ? 'status-err' : ''}">${ch.rpm.toLocaleString('pl-PL')}</strong></span>
                <span>Jitter: <strong>±${ch.jitterHz} Hz</strong></span>
              </div>

              <div class="fan-pwm-duty-match-row font-mono">
                <span>Oczekiwane obroty: <strong>${ch.expectedRpm.toLocaleString('pl-PL')} RPM</strong></span>
                <span class="${rpmDevExceeds ? 'status-err' : 'status-ok'}">Δ ${rpmDevSign}${ch.rpmDutyDeviationPct.toFixed(1)}%</span>
              </div>

              <div class="fan-pwm-bearing-box ${healthCls} ${maintAlertCls}" data-bearing-channel="${escHtml(ch.id)}" data-maint-alert="${ch.maintenanceAlertTriggered ? 'true' : 'false'}">
                <div class="fan-pwm-bearing-head font-mono">
                  <span class="fan-pwm-bearing-label-wrap">
                    <span class="fan-pwm-bearing-label">Kondycja łożyska (Bearing Health Index)</span>
                    <button
                      type="button"
                      class="fan-bearing-info-btn"
                      data-bearing-info="${escHtml(ch.id)}"
                      aria-label="Ustaw próg alertu konserwacji dla ${escHtml(ch.label)}"
                      aria-expanded="false"
                      title="Ustaw próg alertu konserwacji łożyska (${maintThreshold}%)"
                    >i</button>
                  </span>
                  <span class="fan-pwm-bearing-score-wrap">
                    <strong class="fan-pwm-bearing-val ${healthCls}">${healthClamped}/100</strong>
                    <span class="fan-pwm-bearing-tier-badge ${healthCls}" title="${escHtml(ch.bearingHealthTier)}">${tierPl}</span>
                  </span>
                </div>
                <div class="fan-pwm-bearing-track" role="progressbar" aria-valuenow="${healthClamped}" aria-valuemin="0" aria-valuemax="100" aria-label="Bearing Health Index ${escHtml(ch.label)}">
                  <span class="fan-pwm-bearing-bar ${healthCls}" style="width:${healthClamped}%;"></span>
                </div>
                <div class="fan-pwm-bearing-meta font-mono">
                  <span>Dryft: <strong>${ch.longTermDriftPct.toFixed(2)}%</strong></span>
                  <span>Żywotność: <strong class="${ch.predictedLifeExpectancyPct < maintThreshold ? 'status-err' : ''}">${ch.predictedLifeExpectancyPct}%</strong> (~${ch.estimatedRemainingHours.toLocaleString('pl-PL')}h)</span>
                  <span class="fan-pwm-bearing-trend ${healthCls}">${ch.driftTrend === 'STABLE' ? 'STABILNY' : ch.driftTrend === 'DRIFTING' ? 'DRYFT' : 'SPADEK'}</span>
                </div>
                ${renderBearingHealth7DaySparklineSvg(ch, maintThreshold)}
                ${
                  ch.maintenanceAlertTriggered
                    ? `<div class="fan-pwm-bearing-maint-pill font-mono" role="alert">
                         <span>⚠ Alert konserwacji (&lt;${maintThreshold}%): Żywotność ${ch.predictedLifeExpectancyPct}%</span>
                         <button type="button" class="fan-bearing-alert-inline-btn" data-open-bearing-alert="${escHtml(ch.id)}">Szczegóły</button>
                       </div>`
                    : ''
                }
                <div class="fan-pwm-bearing-pred">${escHtml(ch.bearingPrediction)}</div>

                <div class="fan-bearing-tooltip" role="tooltip" data-bearing-tooltip="${escHtml(ch.id)}">
                  <div class="fan-bearing-tooltip-head font-mono">
                    <span>Kondycja łożyska · ${escHtml(ch.label)}</span>
                    <strong class="fan-bearing-tooltip-score ${healthCls}">${healthClamped}%</strong>
                  </div>
                  <div class="fan-bearing-tooltip-status ${ch.maintenanceAlertTriggered ? 'is-alert' : 'is-ok'} font-mono">
                    ${
                      ch.maintenanceAlertTriggered
                        ? `⚠ Alert konserwacji — Predictive Maintenance Alert (${healthClamped}% &lt; ${maintThreshold}%)`
                        : `✓ W normie (${healthClamped}% ≥ ${maintThreshold}%)`
                    }
                  </div>
                  <div class="fan-bearing-tooltip-slider-box">
                    <div class="fan-bearing-tooltip-slider-head font-mono">
                      <label for="fan-bearing-thresh-${escHtml(ch.id)}">Próg alertu konserwacji łożyska</label>
                      <strong class="fan-bearing-threshold-val">${maintThreshold}%</strong>
                    </div>
                    <input
                      id="fan-bearing-thresh-${escHtml(ch.id)}"
                      type="range"
                      class="fan-bearing-threshold-slider"
                      data-bearing-channel="${escHtml(ch.id)}"
                      min="30"
                      max="95"
                      step="1"
                      value="${maintThreshold}"
                      aria-label="Próg alertu konserwacji dla ${escHtml(ch.label)}"
                    />
                    <div class="fan-bearing-threshold-scale font-mono">
                      <span>30%</span>
                      <span>70% (Domyślny)</span>
                      <span>95%</span>
                    </div>
                  </div>
                  <div class="fan-bearing-tooltip-note">${escHtml(ch.bearingPrediction)}</div>
                </div>
              </div>

              ${rpmAlertBlock}

              <div class="fan-pwm-reason ${cardCls}">
                ${escHtml(ch.reason)}
              </div>
            </div>
          `;
        })
        .join('')}
    </div>
  `;
}

export function renderFanPwmMonitorPanelHtml(pwm: FanPwmMonitorState): string {
  const freqOptions = [
    { hz: 25000, label: '25 000 Hz (Standard Intel 4-Pin PWM)' },
    { hz: 21000, label: '21 000 Hz (Dolna granica specyfikacji)' },
    { hz: 28000, label: '28 000 Hz (Górna granica specyfikacji)' },
    { hz: 1000, label: '1 000 Hz (Kontroler niskiej częstotliwości)' },
    { hz: 100, label: '100 Hz (Tryb starszy / DC-PWM)' },
  ];

  const tolOptions = [2, 4, 6, 10];

  return `
    <div class="panel stack-md" id="fan-pwm-monitor-panel">
      <div class="panel-header" style="margin-bottom:0;flex-wrap:wrap;gap:10px;">
        <div class="row-wrap" style="gap:8px;align-items:center;">
          <span style="color:var(--accent-cyan);">${iconSvg('pulse', 18)}</span>
          <div>
            <h2 class="panel-title">1A. Monitor częstotliwości PWM i stanu łożysk wentylatorów</h2>
            <span class="panel-caption">Pomiar częstotliwości PWM (Hz) z detekcją odchyleń oraz kontrolą stanu łożysk i rozjazdu RPM względem wypełnienia (&gt;15% przez ponad 3 s)</span>
          </div>
        </div>
        <div class="row-wrap" style="gap:8px;align-items:center;">
          <label class="fan-pwm-select-wrap" for="fan-pwm-target-hz-select">
            <span>Zegar BIOS:</span>
            <select id="fan-pwm-target-hz-select" class="field-input font-mono" style="width:auto;padding:4px 8px;font-size:11.5px;">
              ${freqOptions
                .map(
                  (opt) =>
                    `<option value="${opt.hz}" ${pwm.programmedHz === opt.hz ? 'selected' : ''}>${opt.label}</option>`
                )
                .join('')}
            </select>
          </label>
          <label class="fan-pwm-select-wrap" for="fan-pwm-tolerance-select">
            <span>Tolerancja:</span>
            <select id="fan-pwm-tolerance-select" class="field-input font-mono" style="width:auto;padding:4px 8px;font-size:11.5px;">
              ${tolOptions
                .map(
                  (t) =>
                    `<option value="${t}" ${Math.abs(pwm.tolerancePct - t) < 0.1 ? 'selected' : ''}>±${t}%</option>`
                )
                .join('')}
            </select>
          </label>
          <button
            id="fan-pwm-drift-test-btn"
            type="button"
            class="btn ${pwm.driftTestEnabled ? 'btn-amber' : 'btn-secondary'} btn-sm"
            title="Zasymuluj testowy dryft PWM i rozjazd RPM/Duty (&gt;15%), aby przetestować alarm łożyska"
          >
            ${pwm.driftTestEnabled ? '⚡ Symulacja usterki: WŁ.' : '⚡ Symuluj usterkę / dryft (Test)'}
          </button>
          <button
            id="fan-pwm-monitor-toggle-btn"
            type="button"
            class="btn ${pwm.active ? 'btn-danger' : 'btn-primary'} btn-sm"
            aria-pressed="${pwm.active ? 'true' : 'false'}"
          >
            ${iconSvg(pwm.active ? 'stop' : 'pulse', 14)}
            <span>${pwm.active ? 'Zatrzymaj monitor PWM' : 'Monitoruj sygnał PWM'}</span>
          </button>
        </div>
      </div>

      <div id="fan-pwm-monitor-live-body">
        ${renderFanPwmMonitorInnerHtml(pwm)}
      </div>
    </div>
  `;
}

export function renderFanAcousticHeatmapMetaHtml(hm: FanAcousticHeatmapState): string {
  const modeLabel = hm.micActive
    ? `MIKROFON NA ŻYWO FFT (${hm.fftSize} pkt)`
    : hm.capturing || hm.sweeping
      ? `SKAN HARMONICZNY FFT (${hm.fftSize} pkt)`
      : `WIDMO FFT GOTOWE (${hm.fftSize} pkt)`;
  const topPeak = hm.currentHarmonics[0] || null;

  return `
    <div class="fan-heatmap-telemetry-strip">
      <div class="fan-pwm-summary-pill ${hm.micActive || hm.capturing || hm.sweeping ? 'is-live' : ''}">
        <span class="fan-pwm-dot ${hm.micActive || hm.capturing || hm.sweeping ? 'is-live' : ''}"></span>
        <span>${modeLabel}</span>
      </div>
      <div class="fan-pwm-summary-item">
        <span>Obroty RPM:</span>
        <strong class="font-mono status-cyan">${hm.currentRpm.toLocaleString('pl-PL')}</strong>
      </div>
      <div class="fan-pwm-summary-item">
        <span>1x Wał (f₀):</span>
        <strong class="font-mono">${hm.fundamentalHz.toFixed(1)} Hz</strong>
      </div>
      <div class="fan-pwm-summary-item">
        <span>Łopatki BPF (${hm.bladeCount}x):</span>
        <strong class="font-mono">${hm.bladePassHz.toFixed(0)} Hz</strong>
      </div>
      <div class="fan-pwm-summary-item">
        <span>Hałas mikrofonu:</span>
        <strong class="font-mono">${hm.currentNoiseDb !== null ? `${hm.currentNoiseDb.toFixed(1)} dB` : '—'}</strong>
      </div>
      <div class="fan-pwm-summary-item">
        <span>Wzbudzona harmoniczna:</span>
        <strong class="font-mono ${topPeak?.isExcited ? 'status-err' : 'status-cyan'}">
          ${topPeak ? `${topPeak.hz} Hz (+${topPeak.prominenceDb.toFixed(1)} dB)` : hm.currentDominantHz !== null ? `${hm.currentDominantHz} Hz` : '—'}
        </strong>
      </div>
      <div class="fan-pwm-summary-item">
        <span>Wibracje:</span>
        <strong class="font-mono ${hm.currentVibrationScore >= 60 ? 'status-err' : hm.currentVibrationScore >= 40 ? 'status-warn' : 'status-ok'}">${hm.currentVibrationScore}/100</strong>
      </div>
      <div class="fan-pwm-summary-item">
        <span>Główne harmoniczne:</span>
        <strong class="font-mono ${hm.majorHarmonics.length > 0 ? 'status-err' : 'status-ok'}">
          ${hm.majorHarmonics.length > 0 ? `★ ${hm.majorHarmonics.length} Stałe` : '✓ Brak'}
        </strong>
      </div>
      <div class="fan-pwm-summary-item">
        <span>Próbki:</span>
        <strong class="font-mono">${hm.sampleCount}</strong>
      </div>
    </div>
    ${
      hm.micError
        ? `<div class="fan-heatmap-mic-notice">${escHtml(hm.micError)}</div>`
        : ''
    }
  `;
}

export function renderFanFftHarmonicsStripHtml(hm: FanAcousticHeatmapState): string {
  const combined: FanAcousticHeatmapState['currentHarmonics'] = [];
  for (const mh of hm.majorHarmonics) {
    if (!combined.some((c) => Math.abs(c.hz - mh.hz) <= 20)) {
      combined.push(mh);
    }
  }
  for (const ch of hm.currentHarmonics) {
    const matchIdx = combined.findIndex((c) => Math.abs(c.hz - ch.hz) <= 20);
    if (matchIdx >= 0) {
      combined[matchIdx] = {
        ...combined[matchIdx],
        ...ch,
        isMajorHarmonic: Boolean(combined[matchIdx].isMajorHarmonic || ch.isMajorHarmonic),
        persistenceCount: ch.persistenceCount ?? combined[matchIdx].persistenceCount,
        persistencePct: ch.persistencePct ?? combined[matchIdx].persistencePct,
        avgProminenceDb: ch.avgProminenceDb ?? combined[matchIdx].avgProminenceDb,
      };
    } else {
      combined.push(ch);
    }
  }

  combined.sort((a, b) => {
    const majDiff = Number(Boolean(b.isMajorHarmonic)) - Number(Boolean(a.isMajorHarmonic));
    if (majDiff !== 0) return majDiff;
    return (b.persistencePct ?? 0) - (a.persistencePct ?? 0) || b.prominenceDb - a.prominenceDb;
  });

  if (combined.length === 0) {
    return `
      <div class="fan-fft-harmonics-empty font-mono">
        Brak wyraźnych pików harmonicznych w bieżącym oknie FFT (${hm.fftSize} pkt, ${(hm.sampleRateHz / hm.fftSize).toFixed(1)} Hz/bin). Uruchom Nasłuch mikrofonu lub Skan rezonansu.
      </div>
    `;
  }

  return `
    <div class="fan-fft-harmonics-grid">
      ${combined
        .slice(0, 6)
        .map((h) => {
          const isMajor = Boolean(h.isMajorHarmonic);
          const failPct = h.predictiveBearingFailurePct ?? hm.bearingHealthContext.predictiveFailureProbabilityPct;
          const bIdx = hm.bearingHealthContext.lowestBearingHealthIndex;
          const persLabel =
            h.persistencePct !== undefined && h.persistenceCount !== undefined
              ? `${h.persistenceCount}kl. · ${h.persistencePct}%`
              : `${h.magnitudeDb.toFixed(1)} dBFS`;
          const majorTitle = `Główna harmoniczna (Major Harmonic — Predictive Bearing Failure Probability: ${failPct.toFixed(1)}% · Bearing Health Index: ${bIdx}/100)`;
          return `
          <div class="fan-fft-harmonic-chip ${h.isExcited ? 'is-excited' : ''} ${isMajor ? 'is-major' : ''}" data-major-harmonic="${isMajor ? 'true' : 'false'}">
            <div class="fan-fft-chip-top font-mono">
              <strong>${h.hz} Hz</strong>
              <span class="fan-fft-chip-prom ${h.isExcited ? 'is-excited' : ''}">+${h.prominenceDb.toFixed(1)} dB</span>
            </div>
            ${isMajor ? `<div class="fan-fft-major-badge font-mono" title="${escHtml(majorTitle)}">★ Główna harmoniczna · Ryzyko ${failPct.toFixed(1)}%</div>` : ''}
            <div class="fan-fft-chip-class">${escHtml(h.classification)}</div>
            <div class="fan-fft-chip-meta font-mono">
              <span>${h.harmonicOrder !== null ? `${h.harmonicOrder}× f₀` : 'Tonalna'}</span>
              <span>${persLabel}</span>
            </div>
          </div>
        `;
        })
        .join('')}
    </div>
  `;
}

export function renderFanResonanceZonesHtml(hm: FanAcousticHeatmapState): string {
  if (hm.sampleCount === 0) {
    return `
      <div class="fan-resonance-empty">
        Brak próbek w mapie cieplnej. Kliknij <strong>Uruchom nasłuch mikrofonu</strong> lub <strong>Skan rezonansu (500–5500 RPM)</strong>, albo uruchom 24s test wentylatorów.
      </div>
    `;
  }

  if (hm.resonanceZones.length === 0) {
    return `
      <div class="fan-resonance-ok">
        ✓ Nie wykryto anomalii rezonansu ani drgań mechanicznych w przetestowanych zakresach obrotów (hałas rośnie płynnie zgodnie z krzywą aerodynamiczną).
      </div>
    `;
  }

  const bIdx = hm.bearingHealthContext.lowestBearingHealthIndex;
  return `
    <div class="fan-resonance-zones-grid">
      ${hm.resonanceZones
        .map(
          (z) => `
          <div class="fan-resonance-zone-card ${z.severity === 'HIGH' ? 'is-high' : 'is-moderate'}">
            <div class="fan-resonance-zone-head">
              <strong class="font-mono">⚠ ${z.rpmMin.toLocaleString('pl-PL')}–${z.rpmMax.toLocaleString('pl-PL')} RPM</strong>
              <span class="fan-resonance-badge ${z.severity === 'HIGH' ? 'is-high' : 'is-moderate'}">
                ${z.severity === 'HIGH' ? 'WYSOKI REZONANS' : 'PIK WIBRACJI'} · +${z.excessDb.toFixed(1)} dB
              </span>
            </div>
            <div class="fan-resonance-zone-metrics font-mono">
              <span>Zmierzono: <strong>${z.avgDb.toFixed(1)} dB</strong> (Tło bazowe: ${z.expectedDb.toFixed(1)} dB)</span>
              <span>Wibracje: <strong>${z.vibrationScore}/100</strong>${z.dominantHz ? ` · Dominująca: <strong>${z.dominantHz} Hz</strong>` : ''}</span>
            </div>
            ${
              z.excitedHarmonics.length > 0
                ? `
                  <div class="fan-resonance-harmonics-row font-mono">
                    ${z.excitedHarmonics
                      .map((eh) => {
                        const failPct = eh.predictiveBearingFailurePct ?? hm.bearingHealthContext.predictiveFailureProbabilityPct;
                        const majorTitle = `Major Harmonic — Predictive Bearing Failure Probability: ${failPct.toFixed(1)}% (derived from Bearing Health Index: ${bIdx}/100)`;
                        return `<span class="fan-resonance-harm-tag ${eh.isMajorHarmonic ? 'is-major' : ''}">${
                          eh.isMajorHarmonic
                            ? `<span class="fan-fft-major-badge is-compact" title="${escHtml(majorTitle)}">Główna harmoniczna · Ryzyko ${failPct.toFixed(1)}%</span> `
                            : ''
                        }${eh.hz} Hz · ${escHtml(eh.classification)} (+${eh.prominenceDb.toFixed(1)} dB${
                          eh.persistencePct ? ` · ${eh.persistencePct}%` : ''
                        })</span>`;
                      })
                      .join('')}
                  </div>
                `
                : ''
            }
            <div class="fan-resonance-zone-rec">${escHtml(z.recommendation)}</div>
          </div>
        `
        )
        .join('')}
    </div>
  `;
}

export function renderFanBearingHistorySummaryHtml(pwm: FanPwmMonitorState): string {
  const thresh = pwm.predictiveMaintenanceThresholdPct;
  const worstCh = pwm.channels.reduce(
    (min, ch) => (ch.predictedLifeExpectancyPct < min.predictedLifeExpectancyPct ? ch : min),
    pwm.channels[0]
  );
  return `
    <div class="fan-bearing-history-grid">
      ${pwm.channels
        .map((ch) => {
          const isLow = ch.predictedLifeExpectancyPct < thresh || ch.bearingHealthIndex < thresh;
          const tierCls = bearingTierClass(ch.bearingHealthTier);
          const firstDay = ch.bearingHealth7DayHistory[0]?.score ?? ch.bearingHealthIndex;
          const delta7d = ch.bearingHealthIndex - firstDay;
          const deltaSign = delta7d >= 0 ? '+' : '';
          const tierPl =
            ch.bearingHealthTier === 'HEALTHY'
              ? 'SPRAWNY'
              : ch.bearingHealthTier === 'FAIR'
                ? 'DOBRY'
                : ch.bearingHealthTier === 'DEGRADED'
                  ? 'ZUŻYCIE'
                  : 'KRYTYCZNY';
          return `
            <div class="fan-bearing-history-card ${isLow ? 'is-alert' : ''}">
              <div class="row-between" style="gap:6px;align-items:center;">
                <strong class="font-mono">${escHtml(ch.label)} <span style="opacity:0.65;font-weight:400;">(${escHtml(ch.header)})</span></strong>
                <span class="fan-pwm-bearing-tier-badge ${tierCls}" title="${escHtml(ch.bearingHealthTier)}">${tierPl}</span>
              </div>
              <div class="fan-bearing-history-metrics font-mono">
                <span>Indeks: <strong>${ch.bearingHealthIndex}/100</strong></span>
                <span>Żywotność: <strong class="${isLow ? 'status-err' : 'status-ok'}">${ch.predictedLifeExpectancyPct}%</strong></span>
                <span>7 dni Δ: <strong class="${delta7d < -5 ? 'status-err' : delta7d < 0 ? 'status-warn' : 'status-ok'}">${deltaSign}${delta7d} pkt</strong></span>
                <span>L10: <strong>~${ch.estimatedRemainingHours.toLocaleString('pl-PL')}h</strong></span>
              </div>
              ${
                isLow
                  ? `<button type="button" class="btn btn-danger btn-xs" data-open-bearing-alert="${escHtml(ch.id)}" style="margin-top:6px;width:100%;">⚠ Instrukcje konserwacji (Maintenance Instructions)</button>`
                  : ''
              }
            </div>
          `;
        })
        .join('')}
    </div>
    ${
      worstCh && worstCh.maintenanceAlertTriggered
        ? `<div class="fan-bearing-history-alert-strip" role="alert">
             <span>🚨 <strong>Alert stanu łożyska (Predictive Bearing Health Alert):</strong> Szacowana żywotność ${escHtml(worstCh.label)} (${worstCh.predictedLifeExpectancyPct}%) spadła poniżej progu ${thresh}%.</span>
             <button type="button" class="btn btn-danger btn-xs" data-open-bearing-alert="${escHtml(worstCh.id)}">Otwórz instrukcję konserwacji</button>
           </div>`
        : ''
    }
  `;
}

export function renderFanAcousticHeatmapPanelHtml(
  hm: FanAcousticHeatmapState,
  pwm?: FanPwmMonitorState,
  activeTab: FanHeatmapSectionTab = 'resonance'
): string {
  const bladeOptions = [5, 7, 9, 11];
  const alertCount = pwm?.maintenanceAlertCount ?? 0;
  const thresholdPct = pwm?.predictiveMaintenanceThresholdPct ?? 70;

  return `
    <div class="panel stack-md" id="fan-acoustic-heatmap-panel">
      <div class="panel-header" style="margin-bottom:0;flex-wrap:wrap;gap:10px;">
        <div class="row-wrap" style="gap:8px;align-items:center;">
          <span style="color:var(--accent-amber);">${iconSvg('volume-on', 18)}</span>
          <div>
            <h2 class="panel-title">1C. Mapa cieplna rezonansu akustycznego, widmo FFT i historia łożysk (Bearing Health History)</h2>
            <span class="panel-caption">Korelacja prędkości obrotowej (RPM) z hałasem mikrofonu, analiza harmonicznych FFT oraz 7-dniowy trend kondycji łożysk dla wszystkich wentylatorów</span>
          </div>
        </div>
        <div class="row-wrap" style="gap:8px;align-items:center;">
          <div class="segmented" role="tablist" aria-label="Widok sekcji rezonansu i historii łożysk">
            <button
              type="button"
              role="tab"
              id="fan-tab-btn-resonance"
              aria-selected="${activeTab === 'resonance' ? 'true' : 'false'}"
              class="segmented-btn ${activeTab === 'resonance' ? 'active' : ''}"
              data-fan-heatmap-tab="resonance"
            >Mapa rezonansu i FFT</button>
            <button
              type="button"
              role="tab"
              id="fan-tab-btn-bearing-history"
              aria-selected="${activeTab === 'bearing_history' ? 'true' : 'false'}"
              class="segmented-btn ${activeTab === 'bearing_history' ? 'active' : ''}"
              data-fan-heatmap-tab="bearing_history"
              title="Bearing Health History"
            >
              Historia łożysk (Bearing Health History)
              ${alertCount > 0 ? `<span class="fan-tab-alert-pill font-mono">${alertCount}</span>` : ''}
            </button>
          </div>
          <label class="fan-pwm-select-wrap" for="fan-heatmap-blades-select">
            <span>Łopatki:</span>
            <select id="fan-heatmap-blades-select" class="field-input font-mono" style="width:auto;padding:4px 8px;font-size:11.5px;">
              ${bladeOptions
                .map(
                  (b) => `<option value="${b}" ${hm.bladeCount === b ? 'selected' : ''}>${b} łopatek</option>`
                )
                .join('')}
            </select>
          </label>
          <button
            id="fan-heatmap-mic-btn"
            type="button"
            class="btn ${hm.capturing ? 'btn-danger' : 'btn-primary'} btn-sm"
          >
            ${iconSvg(hm.capturing ? 'stop' : 'volume-on', 14)}
            <span>${hm.capturing ? 'Zatrzymaj nasłuch mikrofonu' : 'Uruchom nasłuch mikrofonu'}</span>
          </button>
          <button
            id="fan-heatmap-sweep-btn"
            type="button"
            class="btn btn-secondary btn-sm"
            ${hm.sweeping ? 'disabled' : ''}
            title="Przeprowadź szybki skan po całym zakresie 500–5500 RPM, aby zmapować strefy rezonansu i harmoniczne FFT"
          >
            <span>${hm.sweeping ? 'Skanowanie RPM…' : 'Skan rezonansu (500–5500 RPM)'}</span>
          </button>
          <button
            id="fan-heatmap-clear-btn"
            type="button"
            class="btn btn-secondary btn-sm"
          >
            <span>Wyczyść mapę</span>
          </button>
        </div>
      </div>

      <div id="fan-heatmap-meta-host">
        ${renderFanAcousticHeatmapMetaHtml(hm)}
      </div>

      <div id="fan-heatmap-tab-resonance" class="stack-md" ${activeTab === 'resonance' ? '' : 'hidden'}>
        <div class="fan-heatmap-stage">
          <div id="fan-acoustic-heatmap-d3" class="fan-heatmap-d3-host"></div>
          <div class="fan-heatmap-legend-row">
            <div class="fan-heatmap-legend-scale">
              <span>Cicho / Niska gęstość</span>
              <span class="fan-heatmap-gradient-bar"></span>
              <span>Głośno / Pik rezonansu</span>
            </div>
            <div class="fan-heatmap-legend-lines font-mono">
              <span><i class="fan-leg-dot is-baseline"></i> Oczekiwane tło przepływu (dB)</span>
              <span><i class="fan-leg-dot is-measured"></i> Zmierzona średnia mikrofonu (dB)</span>
              <span><i class="fan-leg-dot is-res"></i> Strefa rezonansu mechanicznego / wibracji</span>
            </div>
          </div>
        </div>

        <div class="fan-fft-stage" id="fan-acoustic-fft-stage">
          <div class="fan-fft-stage-head">
            <div>
              <strong class="fan-fft-stage-title">Widmo harmoniczne FFT na żywo (20 Hz – 2 400 Hz)</strong>
              <span class="fan-fft-stage-sub">Identyfikacja częstotliwości podstawowej wału (1× f₀), przejścia łopatek (BPF) i harmonicznych rezonansu mechanicznego z wejścia mikrofonu</span>
            </div>
            <div class="row-wrap" style="gap:8px;align-items:center;">
              <span class="fan-fft-res-badge font-mono">${hm.fftSize}-pt FFT · ${(hm.sampleRateHz / hm.fftSize).toFixed(1)} Hz/bin</span>
              <button
                id="fan-heatmap-export-fft-btn"
                type="button"
                class="btn btn-secondary btn-sm"
                title="Pobierz plik JSON z pełnymi danymi koszyków częstotliwości (Export FFT Spectrum)"
              >
                ${iconSvg('download', 14)}
                <span>Eksportuj widmo FFT (Export FFT Spectrum)</span>
              </button>
            </div>
          </div>
          <div id="fan-acoustic-fft-d3" class="fan-fft-d3-host"></div>
          <div id="fan-acoustic-harmonics-host">
            ${renderFanFftHarmonicsStripHtml(hm)}
          </div>
        </div>

        <div id="fan-resonance-zones-host">
          ${renderFanResonanceZonesHtml(hm)}
        </div>
      </div>

      <div id="fan-heatmap-tab-bearing-history" class="fan-bearing-history-panel stack-md" ${activeTab === 'bearing_history' ? '' : 'hidden'}>
        <div class="fan-fft-stage-head">
          <div>
            <strong class="fan-fft-stage-title">Historia stanu łożysk (Bearing Health History — 7 dni)</strong>
            <span class="fan-fft-stage-sub">Wielodniowa progresja indeksu kondycji łożysk (0–100) dla wszystkich kanałów wentylatorów względem progu konserwacji zapobiegawczej (${thresholdPct}%)</span>
          </div>
          <div class="row-wrap" style="gap:8px;align-items:center;">
            <button
              id="fan-open-bearing-alert-btn"
              type="button"
              class="btn ${alertCount > 0 ? 'btn-danger' : 'btn-secondary'} btn-sm"
              data-open-bearing-alert="all"
            >
              <span>${alertCount > 0 ? `⚠ Alert stanu łożysk (${alertCount})` : 'Poradnik konserwacji łożysk'}</span>
            </button>
          </div>
        </div>
        <div id="fan-bearing-history-d3" class="fan-bearing-history-d3-host"></div>
        <div id="fan-bearing-history-summary">
          ${pwm ? renderFanBearingHistorySummaryHtml(pwm) : ''}
        </div>
      </div>
    </div>
  `;
}

/**
 * Renders the interactive D3.js 2D RPM-vs-Microphone Noise Resonance Heatmap.
 */
export function renderFanAcousticHeatmapD3(
  container: HTMLElement,
  hm: FanAcousticHeatmapState
): void {
  const root = d3.select(container);
  root.selectAll('*').remove();

  const width = Math.max(660, Math.min(1080, container.clientWidth || 860));
  const height = 290;
  const margin = { top: 30, right: 24, bottom: 44, left: 78 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  const wrapper = root
    .append('div')
    .style('position', 'relative')
    .style('width', '100%')
    .style('overflow-x', 'auto');

  const svg = wrapper
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('display', 'block')
    .style('margin', '0 auto');

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const xScale = d3
    .scaleBand<number>()
    .domain(hm.rpmBins.map((_, i) => i))
    .range([0, plotW])
    .padding(0.06);

  // Reverse dB bins so loudest (> 60 dB) is at the top and quietest (< 36 dB) is at the bottom
  const yDomain = hm.dbBins.map((_, i) => i).reverse();
  const yScale = d3
    .scaleBand<number>()
    .domain(yDomain)
    .range([0, plotH])
    .padding(0.08);

  // Continuous Y scale for overlaying expected aerodynamic curve & measured mean dB curve
  const yDbScale = d3.scaleLinear().domain([24, 72]).range([plotH, 0]).clamp(true);

  // Highlight vertical bands for RPM ranges with detected resonance
  hm.rpmSummary.forEach((rSum, rIdx) => {
    if (!rSum.isResonance) return;
    const bx = xScale(rIdx);
    if (bx === undefined) return;
    const bw = xScale.bandwidth();
    g.append('rect')
      .attr('x', bx - 2)
      .attr('y', -6)
      .attr('width', bw + 4)
      .attr('height', plotH + 10)
      .attr('rx', 6)
      .attr('fill', 'rgba(244, 63, 94, 0.12)')
      .attr('stroke', 'rgba(251, 113, 133, 0.72)')
      .attr('stroke-width', 1.3)
      .attr('stroke-dasharray', '4,3');

    g.append('text')
      .attr('x', bx + bw / 2)
      .attr('y', -11)
      .attr('text-anchor', 'middle')
      .attr('fill', '#fda4af')
      .style('font-size', '9.5px')
      .style('font-weight', '700')
      .style('font-family', 'var(--font-mono)')
      .text('⚠ RESONANCE');
  });

  // Color scale for active heatmap cells
  const cellColor = (cell: FanAcousticHeatmapCell): string => {
    if (cell.count === 0) return 'rgba(15, 23, 42, 0.62)';
    if (cell.isResonance) {
      return d3.interpolateRgb('#f59e0b', '#f43f5e')(Math.max(0.35, cell.intensity));
    }
    const t = Math.max(0.08, Math.min(1, cell.intensity));
    if (t < 0.45) {
      return d3.interpolateRgb('#0e7490', '#10b981')(t / 0.45);
    }
    if (t < 0.78) {
      return d3.interpolateRgb('#10b981', '#f59e0b')((t - 0.45) / 0.33);
    }
    return d3.interpolateRgb('#f59e0b', '#ef4444')((t - 0.78) / 0.22);
  };

  // Hover tooltip
  const tooltip = wrapper
    .append('div')
    .attr('class', 'fan-heatmap-tooltip')
    .style('display', 'none');

  // Heatmap cells
  const cellGroups = g
    .selectAll<SVGGElement, FanAcousticHeatmapCell>('g.fan-hm-cell')
    .data(hm.cells)
    .enter()
    .append('g')
    .attr('class', 'fan-hm-cell')
    .attr('transform', (d) => `translate(${xScale(d.rpmBinIndex) ?? 0},${yScale(d.dbBinIndex) ?? 0})`);

  cellGroups
    .append('rect')
    .attr('width', xScale.bandwidth())
    .attr('height', yScale.bandwidth())
    .attr('rx', 5)
    .attr('fill', (d) => cellColor(d))
    .attr('fill-opacity', (d) => (d.count === 0 ? 0.55 : 0.84))
    .attr('stroke', (d) =>
      d.isResonance
        ? '#fda4af'
        : d.count > 0
          ? 'rgba(255, 255, 255, 0.22)'
          : 'rgba(148, 163, 184, 0.14)'
    )
    .attr('stroke-width', (d) => (d.isResonance ? 1.8 : 1))
    .style('cursor', 'crosshair')
    .on('mouseenter', function (_ev, d) {
      d3.select(this).attr('stroke', '#ffffff').attr('stroke-width', 2);
      const rSum = hm.rpmSummary[d.rpmBinIndex];
      const statusHtml = d.count === 0
        ? '<span style="color:#94a3b8;">No samples recorded in this cell</span>'
        : d.isResonance
          ? '<span style="color:#fda4af;font-weight:700;">⚠ Mechanical Resonance / Vibration Spike</span>'
          : '<span style="color:#6ee7b7;font-weight:600;">✓ Smooth Aerodynamic Airflow</span>';
      const cellFailPct = d.predictiveBearingFailurePct ?? hm.bearingHealthContext.predictiveFailureProbabilityPct;
      const cellMajorHtml =
        d.count > 0 && d.topHarmonicHz !== null && d.topHarmonicIsMajor
          ? `<div style="margin-top:3px;"><span class="fan-fft-major-badge is-compact">★ Major Harmonic · Predictive Bearing Failure Probability: ${cellFailPct.toFixed(1)}%</span></div>`
          : '';
      tooltip
        .style('display', 'block')
        .html(`
          <div style="font-weight:700;color:#38bdf8;margin-bottom:3px;">${d.rpmMin}–${d.rpmMax} RPM · ${hm.dbBins[d.dbBinIndex].label}</div>
          <div>Samples: <strong class="font-mono">${d.count}</strong>${d.count > 0 ? ` · Avg: <strong class="font-mono">${d.avgDb.toFixed(1)} dB</strong> (Peak ${d.maxDb.toFixed(1)} dB)` : ''}</div>
          <div>Expected Baseline: <strong class="font-mono">${rSum.expectedDb.toFixed(1)} dB</strong>${d.count > 0 ? ` · Vibration: <strong class="font-mono">${d.avgVibrationScore}/100</strong>` : ''}</div>
          ${
            d.count > 0 && d.topHarmonicHz !== null
              ? `<div>FFT Harmonic: <strong class="font-mono" style="color:#fde68a;">${d.topHarmonicHz} Hz</strong>${d.topHarmonicLabel ? ` <span style="color:#cbd5e1;">(${escHtml(d.topHarmonicLabel)})</span>` : ''}</div>${cellMajorHtml}`
              : ''
          }
          ${
            d.count > 0 && d.topHarmonicIsMajor
              ? `<div style="font-size:10.5px;color:#cbd5e1;">Bearing Health Index: <strong class="font-mono">${hm.bearingHealthContext.lowestBearingHealthIndex}/100</strong> (${escHtml(hm.bearingHealthContext.worstTier)})</div>`
              : ''
          }
          <div style="margin-top:4px;">${statusHtml}</div>
        `);
    })
    .on('mousemove', function (ev) {
      const [mx, my] = d3.pointer(ev, wrapper.node());
      const left = Math.min(width - 245, Math.max(8, mx + 14));
      const top = Math.max(8, my - 72);
      tooltip.style('left', `${left}px`).style('top', `${top}px`);
    })
    .on('mouseleave', function (_ev, d) {
      d3.select(this)
        .attr(
          'stroke',
          d.isResonance
            ? '#fda4af'
            : d.count > 0
              ? 'rgba(255, 255, 255, 0.22)'
              : 'rgba(148, 163, 184, 0.14)'
        )
        .attr('stroke-width', d.isResonance ? 1.8 : 1);
      tooltip.style('display', 'none');
    });

  // Cell text readout (avg dB or sample count)
  cellGroups
    .filter((d) => d.count > 0)
    .append('text')
    .attr('x', xScale.bandwidth() / 2)
    .attr('y', yScale.bandwidth() / 2 + 3.5)
    .attr('text-anchor', 'middle')
    .attr('pointer-events', 'none')
    .attr('fill', '#ffffff')
    .style('font-size', '10px')
    .style('font-weight', '700')
    .style('font-family', 'var(--font-mono)')
    .style('text-shadow', '0 1px 2px rgba(0,0,0,0.8)')
    .text((d) => `${d.avgDb.toFixed(0)}dB`);

  // Overlay 1: Smooth Expected Aerodynamic Baseline Curve
  const baselinePoints = hm.rpmSummary.map((r, idx) => ({
    x: (xScale(idx) ?? 0) + xScale.bandwidth() / 2,
    y: yDbScale(r.expectedDb),
  }));
  const curveGen = d3
    .line<{ x: number; y: number }>()
    .x((d) => d.x)
    .y((d) => d.y)
    .curve(d3.curveMonotoneX);

  g.append('path')
    .datum(baselinePoints)
    .attr('fill', 'none')
    .attr('stroke', 'rgba(56, 189, 248, 0.85)')
    .attr('stroke-width', 1.8)
    .attr('stroke-dasharray', '5,4')
    .attr('pointer-events', 'none')
    .attr('d', curveGen);

  // Overlay 2: Measured Mean Microphone dB Curve
  const measuredPoints = hm.rpmSummary
    .map((r, idx) =>
      r.avgDb !== null
        ? {
            x: (xScale(idx) ?? 0) + xScale.bandwidth() / 2,
            y: yDbScale(r.avgDb),
            isResonance: r.isResonance,
          }
        : null
    )
    .filter((p): p is { x: number; y: number; isResonance: boolean } => p !== null);

  if (measuredPoints.length >= 2) {
    g.append('path')
      .datum(measuredPoints)
      .attr('fill', 'none')
      .attr('stroke', '#f8fafc')
      .attr('stroke-width', 2.1)
      .attr('pointer-events', 'none')
      .attr('d', curveGen);
  }

  measuredPoints.forEach((pt) => {
    g.append('circle')
      .attr('cx', pt.x)
      .attr('cy', pt.y)
      .attr('r', pt.isResonance ? 5 : 3.4)
      .attr('fill', pt.isResonance ? '#f43f5e' : '#38bdf8')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 1.3)
      .attr('pointer-events', 'none');
  });

  // X-Axis (RPM ranges)
  const xAxisG = g
    .append('g')
    .attr('transform', `translate(0,${plotH})`)
    .call(d3.axisBottom(xScale).tickFormat((idx) => hm.rpmBins[idx]?.label || ''));
  xAxisG.selectAll('text').attr('fill', '#cbd5e1').style('font-size', '10.5px').style('font-family', 'var(--font-mono)');
  xAxisG.selectAll('path,line').attr('stroke', 'rgba(148, 163, 184, 0.3)');

  g.append('text')
    .attr('x', plotW / 2)
    .attr('y', plotH + 34)
    .attr('text-anchor', 'middle')
    .attr('fill', '#94a3b8')
    .style('font-size', '11px')
    .text('Zakres obrotów wentylatora (RPM)');

  // Y-Axis (Microphone Noise dB bands)
  const yAxisG = g
    .append('g')
    .call(d3.axisLeft(yScale).tickFormat((idx) => hm.dbBins[idx]?.label || ''));
  yAxisG.selectAll('text').attr('fill', '#cbd5e1').style('font-size', '10.5px').style('font-family', 'var(--font-mono)');
  yAxisG.selectAll('path,line').attr('stroke', 'rgba(148, 163, 184, 0.3)');
}

/**
 * Renders the Real-Time D3.js FFT Harmonic Spectrum Analyzer (20 Hz – 2,400 Hz)
 * highlighting shaft fundamental (1x f0), blade pass frequency (BPF), and excited
 * vibration harmonic peaks.
 */
export function renderFanFftSpectrumD3(
  container: HTMLElement,
  hm: FanAcousticHeatmapState
): void {
  const root = d3.select(container);
  root.selectAll('*').remove();

  const width = Math.max(640, Math.min(1080, container.clientWidth || 860));
  const height = 205;
  const margin = { top: 24, right: 20, bottom: 38, left: 54 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  const wrapper = root
    .append('div')
    .style('position', 'relative')
    .style('width', '100%')
    .style('overflow-x', 'auto');

  const svg = wrapper
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('display', 'block')
    .style('margin', '0 auto');

  const defs = svg.append('defs');
  const grad = defs
    .append('linearGradient')
    .attr('id', 'fan-fft-area-grad')
    .attr('x1', '0%')
    .attr('y1', '0%')
    .attr('x2', '0%')
    .attr('y2', '100%');
  grad.append('stop').attr('offset', '0%').attr('stop-color', '#38bdf8').attr('stop-opacity', 0.42);
  grad.append('stop').attr('offset', '60%').attr('stop-color', '#818cf8').attr('stop-opacity', 0.16);
  grad.append('stop').attr('offset', '100%').attr('stop-color', '#0f172a').attr('stop-opacity', 0.02);

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const xScale = d3.scaleLinear().domain([20, 2400]).range([0, plotW]);
  const yScale = d3.scaleLinear().domain([-96, -12]).range([plotH, 0]).clamp(true);

  // Subtle horizontal grid lines
  const yTicks = [-90, -75, -60, -45, -30, -15];
  g.selectAll('line.fft-grid-y')
    .data(yTicks)
    .enter()
    .append('line')
    .attr('x1', 0)
    .attr('x2', plotW)
    .attr('y1', (d) => yScale(d))
    .attr('y2', (d) => yScale(d))
    .attr('stroke', 'rgba(148, 163, 184, 0.12)')
    .attr('stroke-dasharray', '3,3');

  // Reference harmonic markers (1x f0, 2x f0, BPF, 2x BPF) dynamically synced to current RPM
  const refMarkers = [
    { hz: hm.fundamentalHz, label: `1×f₀ ${Math.round(hm.fundamentalHz)}Hz`, color: '#38bdf8' },
    { hz: hm.fundamentalHz * 2, label: `2×f₀`, color: '#60a5fa' },
    { hz: hm.bladePassHz, label: `BPF ${Math.round(hm.bladePassHz)}Hz`, color: '#a78bfa' },
    { hz: hm.bladePassHz * 2, label: `2×BPF`, color: '#c084fc' },
  ].filter((m) => m.hz >= 22 && m.hz <= 2380);

  refMarkers.forEach((m, idx) => {
    const mx = xScale(m.hz);
    g.append('line')
      .attr('x1', mx)
      .attr('x2', mx)
      .attr('y1', 0)
      .attr('y2', plotH)
      .attr('stroke', m.color)
      .attr('stroke-opacity', 0.45)
      .attr('stroke-width', 1.1)
      .attr('stroke-dasharray', '4,3');

    g.append('text')
      .attr('x', mx + 3)
      .attr('y', idx % 2 === 0 ? 10 : 21)
      .attr('fill', m.color)
      .style('font-size', '9px')
      .style('font-weight', '700')
      .style('font-family', 'var(--font-mono)')
      .text(m.label);
  });

  if (hm.fftBins.length > 1) {
    const areaGen = d3
      .area<{ hz: number; magnitudeDb: number }>()
      .x((d) => xScale(d.hz))
      .y0(plotH)
      .y1((d) => yScale(d.magnitudeDb))
      .curve(d3.curveMonotoneX);

    const lineGen = d3
      .line<{ hz: number; magnitudeDb: number }>()
      .x((d) => xScale(d.hz))
      .y((d) => yScale(d.magnitudeDb))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(hm.fftBins)
      .attr('fill', 'url(#fan-fft-area-grad)')
      .attr('d', areaGen);

    g.append('path')
      .datum(hm.fftBins)
      .attr('fill', 'none')
      .attr('stroke', '#38bdf8')
      .attr('stroke-width', 1.8)
      .attr('d', lineGen);
  } else {
    g.append('text')
      .attr('x', plotW / 2)
      .attr('y', plotH / 2)
      .attr('text-anchor', 'middle')
      .attr('fill', '#64748b')
      .style('font-size', '12px')
      .text('Brak aktywnego widma FFT — uruchom Live Mic Capture lub Resonance Sweep');
  }

  const tooltip = wrapper
    .append('div')
    .attr('class', 'fan-heatmap-tooltip')
    .style('display', 'none');

  // Vertical persistence bands for Major Harmonics consistently exceeding the noise baseline
  hm.majorHarmonics.slice(0, 4).forEach((mh) => {
    if (mh.hz < 20 || mh.hz > 2400) return;
    const mx = xScale(mh.hz);
    const bandW = 14;
    g.append('rect')
      .attr('x', Math.max(0, mx - bandW / 2))
      .attr('y', 0)
      .attr('width', bandW)
      .attr('height', plotH)
      .attr('fill', 'rgba(244, 63, 94, 0.14)')
      .attr('stroke', 'rgba(251, 113, 133, 0.35)')
      .attr('stroke-width', 0.8)
      .attr('rx', 3);
  });

  // Merge current frame peaks with consistent major harmonics for interactive pinning
  const chartPeaks = [...hm.currentHarmonics];
  for (const mh of hm.majorHarmonics) {
    if (!chartPeaks.some((p) => Math.abs(p.hz - mh.hz) <= 20)) {
      chartPeaks.push(mh);
    }
  }

  // Highlighted Excited & Major Harmonic Peak pins
  chartPeaks.slice(0, 6).forEach((peak, idx) => {
    if (peak.hz < 20 || peak.hz > 2400) return;
    const isMajor = Boolean(peak.isMajorHarmonic);
    const px = xScale(peak.hz);
    const py = yScale(peak.magnitudeDb);
    const pinColor = isMajor ? '#f43f5e' : peak.isExcited ? '#fb7185' : '#fbbf24';

    g.append('line')
      .attr('x1', px)
      .attr('x2', px)
      .attr('y1', py)
      .attr('y2', plotH)
      .attr('stroke', pinColor)
      .attr('stroke-opacity', isMajor ? 0.8 : 0.55)
      .attr('stroke-width', isMajor ? 1.7 : 1.2);

    if (isMajor) {
      g.append('circle')
        .attr('cx', px)
        .attr('cy', py)
        .attr('r', 9.5)
        .attr('fill', 'rgba(244, 63, 94, 0.18)')
        .attr('stroke', '#fda4af')
        .attr('stroke-width', 1.1)
        .style('pointer-events', 'none');
    }

    g.append('circle')
      .attr('cx', px)
      .attr('cy', py)
      .attr('r', isMajor ? 5.8 : peak.isExcited ? 5.0 : 4)
      .attr('fill', pinColor)
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 1.3)
      .style('cursor', 'pointer')
      .on('mouseenter', function () {
        d3.select(this).attr('r', 7.5);
        const failPct = peak.predictiveBearingFailurePct ?? hm.bearingHealthContext.predictiveFailureProbabilityPct;
        const riskLevel = peak.bearingFailureRiskLevel ?? hm.bearingHealthContext.riskLevel;
        const bCtx = hm.bearingHealthContext;
        const riskColor =
          riskLevel === 'CRITICAL'
            ? '#fb7185'
            : riskLevel === 'ELEVATED'
              ? '#fb923c'
              : riskLevel === 'MODERATE'
                ? '#facc15'
                : '#6ee7b7';
        tooltip
          .style('display', 'block')
          .html(`
            <div style="font-weight:700;color:${pinColor};margin-bottom:4px;display:flex;flex-wrap:wrap;align-items:center;gap:5px;">
              ${isMajor ? `<span class="fan-fft-major-badge is-compact">★ Major Harmonic · Predictive Bearing Failure Probability: ${failPct.toFixed(1)}%</span>` : ''}
              <span>${peak.hz} Hz · ${escHtml(peak.classification)}</span>
            </div>
            <div>Magnitude: <strong class="font-mono">${peak.magnitudeDb.toFixed(1)} dBFS</strong></div>
            <div>Prominence vs Floor: <strong class="font-mono">+${peak.prominenceDb.toFixed(1)} dB</strong></div>
            ${
              peak.persistencePct !== undefined
                ? `<div>Consistency: <strong class="font-mono">${peak.persistenceCount ?? 1} frames (${peak.persistencePct}%) · Avg +${(peak.avgProminenceDb ?? peak.prominenceDb).toFixed(1)} dB</strong></div>`
                : ''
            }
            <div>Harmonic Order: <strong class="font-mono">${peak.harmonicOrder !== null ? `${peak.harmonicOrder}× f₀` : 'Non-synchronous'}</strong></div>
            <div class="fan-fft-tooltip-bearing-block">
              <div>Predictive Bearing Failure Probability: <strong class="font-mono" style="color:${riskColor};">${failPct.toFixed(1)}% (${escHtml(riskLevel)})</strong></div>
              <div style="font-size:10.5px;color:#94a3b8;">Derived from Bearing Health Index: <strong class="font-mono">${bCtx.lowestBearingHealthIndex}/100</strong> (${escHtml(bCtx.worstTier)} · ${escHtml(bCtx.worstChannelLabel)})</div>
              ${peak.bearingImpactSummary ? `<div style="font-size:10.5px;color:#cbd5e1;margin-top:2px;">${escHtml(peak.bearingImpactSummary)}</div>` : ''}
            </div>
          `);
      })
      .on('mousemove', function (ev) {
        const [mx, my] = d3.pointer(ev, wrapper.node());
        const left = Math.min(width - 280, Math.max(8, mx + 12));
        const top = Math.max(6, my - 90);
        tooltip.style('left', `${left}px`).style('top', `${top}px`);
      })
      .on('mouseleave', function () {
        d3.select(this).attr('r', isMajor ? 5.8 : peak.isExcited ? 5.0 : 4);
        tooltip.style('display', 'none');
      });

    if (isMajor || idx < 3) {
      g.append('text')
        .attr('x', px)
        .attr('y', Math.max(10, py - (isMajor ? 12 : 9)))
        .attr('text-anchor', px > plotW - 95 ? 'end' : px < 70 ? 'start' : 'middle')
        .attr('fill', isMajor ? '#ffe4e6' : peak.isExcited ? '#fda4af' : '#fde68a')
        .style('font-size', isMajor ? '9.8px' : '9.5px')
        .style('font-weight', '700')
        .style('font-family', 'var(--font-mono)')
        .style('pointer-events', 'none')
        .text(isMajor ? `★ Major ${peak.hz}Hz` : `${peak.hz}Hz`);
    }
  });

  // X-Axis (Frequency Hz)
  const xAxisG = g
    .append('g')
    .attr('transform', `translate(0,${plotH})`)
    .call(
      d3
        .axisBottom(xScale)
        .tickValues([50, 200, 400, 600, 900, 1200, 1600, 2000, 2400])
        .tickFormat((d) => `${d}Hz`)
    );
  xAxisG.selectAll('text').attr('fill', '#cbd5e1').style('font-size', '10px').style('font-family', 'var(--font-mono)');
  xAxisG.selectAll('path,line').attr('stroke', 'rgba(148, 163, 184, 0.3)');

  g.append('text')
    .attr('x', plotW / 2)
    .attr('y', plotH + 31)
    .attr('text-anchor', 'middle')
    .attr('fill', '#94a3b8')
    .style('font-size', '10.5px')
    .text('Częstotliwość widma FFT (Hz)');

  // Y-Axis (dBFS magnitude)
  const yAxisG = g
    .append('g')
    .call(d3.axisLeft(yScale).tickValues(yTicks).tickFormat((d) => `${d}dB`));
  yAxisG.selectAll('text').attr('fill', '#cbd5e1').style('font-size', '10px').style('font-family', 'var(--font-mono)');
  yAxisG.selectAll('path,line').attr('stroke', 'rgba(148, 163, 184, 0.3)');
}

const BEARING_LINE_PALETTE = ['#38bdf8', '#a78bfa', '#34d399', '#fbbf24', '#fb7185', '#f472b6'];

/**
 * Renders a multi-day D3.js line chart of Bearing Health Index progression for all detected fans.
 */
export function renderFanBearingHistoryChartD3(
  container: HTMLElement,
  pwm: FanPwmMonitorState
): void {
  const root = d3.select(container);
  root.selectAll('*').remove();

  const channels = pwm.channels || [];
  if (channels.length === 0) return;

  const width = Math.max(620, Math.min(1060, container.clientWidth || 840));
  const height = 270;
  const margin = { top: 24, right: 24, bottom: 42, left: 56 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  const wrapper = root
    .append('div')
    .style('position', 'relative')
    .style('width', '100%')
    .style('overflow-x', 'auto');

  const svg = wrapper
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('display', 'block')
    .style('margin', '0 auto');

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const dayLabels =
    channels[0]?.bearingHealth7DayHistory.map((pt) => pt.label) ||
    ['-6d', '-5d', '-4d', '-3d', '-2d', '-1d', 'Today'];

  const xScale = d3
    .scalePoint<string>()
    .domain(dayLabels)
    .range([0, plotW])
    .padding(0.2);

  const yScale = d3.scaleLinear().domain([0, 100]).range([plotH, 0]);
  const thresh = pwm.predictiveMaintenanceThresholdPct;
  const threshY = yScale(thresh);

  // Danger zone shaded below user threshold
  g.append('rect')
    .attr('x', 0)
    .attr('y', threshY)
    .attr('width', plotW)
    .attr('height', Math.max(0, plotH - threshY))
    .attr('fill', 'rgba(244, 63, 94, 0.10)');

  // Subtle horizontal gridlines
  [20, 40, 60, 80, 100].forEach((val) => {
    g.append('line')
      .attr('x1', 0)
      .attr('x2', plotW)
      .attr('y1', yScale(val))
      .attr('y2', yScale(val))
      .attr('stroke', 'rgba(148, 163, 184, 0.14)');
  });

  // Threshold dashed line
  g.append('line')
    .attr('x1', 0)
    .attr('x2', plotW)
    .attr('y1', threshY)
    .attr('y2', threshY)
    .attr('stroke', '#f43f5e')
    .attr('stroke-width', 1.6)
    .attr('stroke-dasharray', '6,4');

  g.append('text')
    .attr('x', plotW - 4)
    .attr('y', Math.max(12, threshY - 6))
    .attr('text-anchor', 'end')
    .attr('fill', '#fda4af')
    .style('font-size', '10px')
    .style('font-weight', '700')
    .style('font-family', 'var(--font-mono)')
    .text(`Predictive Maintenance Threshold (${thresh}%)`);

  const tooltip = wrapper
    .append('div')
    .attr('class', 'fan-heatmap-tooltip')
    .style('display', 'none');

  const lineGen = d3
    .line<FanBearingHealthDayPoint>()
    .x((d) => xScale(d.label) ?? 0)
    .y((d) => yScale(d.score))
    .curve(d3.curveMonotoneX);

  channels.forEach((ch, idx) => {
    const color = BEARING_LINE_PALETTE[idx % BEARING_LINE_PALETTE.length];
    const pts = ch.bearingHealth7DayHistory;

    g.append('path')
      .datum(pts)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', ch.maintenanceAlertTriggered ? 2.8 : 2.1)
      .attr('d', lineGen);

    g.selectAll(`circle.fan-bh-pt-${idx}`)
      .data(pts)
      .enter()
      .append('circle')
      .attr('class', `fan-bh-pt-${idx}`)
      .attr('cx', (d) => xScale(d.label) ?? 0)
      .attr('cy', (d) => yScale(d.score))
      .attr('r', 4.2)
      .attr('fill', (d) => (d.score < thresh ? '#f43f5e' : color))
      .attr('stroke', '#020617')
      .attr('stroke-width', 1.4)
      .style('cursor', 'pointer')
      .on('mouseenter', function (_ev, d) {
        d3.select(this).attr('r', 6);
        tooltip
          .style('display', 'block')
          .html(`
            <div style="font-weight:700;color:${color};margin-bottom:2px;">${escHtml(ch.label)} (${escHtml(ch.header)})</div>
            <div>Day: <strong class="font-mono">${escHtml(d.label)}</strong> · Health Index: <strong class="font-mono">${d.score}/100</strong></div>
            <div>Life Expectancy: <strong class="font-mono">${ch.predictedLifeExpectancyPct}%</strong> (~${ch.estimatedRemainingHours.toLocaleString('en-US')}h)</div>
            <div>Threshold: <strong class="font-mono">${thresh}%</strong> ${d.score < thresh ? '<span style="color:#fda4af;">⚠ BELOW THRESHOLD</span>' : '<span style="color:#6ee7b7;">✓ OK</span>'}</div>
          `);
      })
      .on('mousemove', function (ev) {
        const [mx, my] = d3.pointer(ev, wrapper.node());
        tooltip
          .style('left', `${Math.min(width - 250, Math.max(8, mx + 12))}px`)
          .style('top', `${Math.max(8, my - 64)}px`);
      })
      .on('mouseleave', function () {
        d3.select(this).attr('r', 4.2);
        tooltip.style('display', 'none');
      });
  });

  // Axes
  const xAxisG = g
    .append('g')
    .attr('transform', `translate(0,${plotH})`)
    .call(d3.axisBottom(xScale));
  xAxisG.selectAll('text').attr('fill', '#cbd5e1').style('font-size', '11px').style('font-family', 'var(--font-mono)');
  xAxisG.selectAll('path,line').attr('stroke', 'rgba(148, 163, 184, 0.32)');

  const yAxisG = g
    .append('g')
    .call(d3.axisLeft(yScale).tickValues([0, 25, 50, 75, 100]).tickFormat((d) => `${d}%`));
  yAxisG.selectAll('text').attr('fill', '#cbd5e1').style('font-size', '10.5px').style('font-family', 'var(--font-mono)');
  yAxisG.selectAll('path,line').attr('stroke', 'rgba(148, 163, 184, 0.32)');

  // Inline legend strip at bottom of SVG
  const legendG = wrapper
    .append('div')
    .attr('class', 'fan-bearing-history-legend font-mono');
  legendG
    .selectAll('span')
    .data(channels)
    .enter()
    .append('span')
    .style('display', 'inline-flex')
    .style('align-items', 'center')
    .style('gap', '6px')
    .html((ch, idx) => {
      const color = BEARING_LINE_PALETTE[idx % BEARING_LINE_PALETTE.length];
      return `<i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${color};"></i>${escHtml(ch.label)} (${ch.bearingHealthIndex}%)`;
    });
}

/**
 * Renders the Predictive Bearing Health Alert Modal inner HTML with actionable maintenance steps.
 */
export function renderPredictiveBearingAlertModalHtml(
  pwm: FanPwmMonitorState,
  focusedChannelId?: string | null
): string {
  const thresh = pwm.predictiveMaintenanceThresholdPct;
  const alerted = pwm.channels.filter(
    (c) => c.predictedLifeExpectancyPct < thresh || c.bearingHealthIndex < thresh || c.maintenanceAlertTriggered
  );
  const displayList =
    alerted.length > 0
      ? alerted
      : [
          pwm.channels.reduce(
            (min, ch) => (ch.predictedLifeExpectancyPct < min.predictedLifeExpectancyPct ? ch : min),
            pwm.channels[0]
          ),
        ].filter(Boolean);

  const selected =
    (focusedChannelId ? displayList.find((c) => c.id === focusedChannelId) : undefined) || displayList[0];

  const isHealthy = alerted.length === 0;

  return `
    <div class="psu-full-history-modal fan-bearing-alert-modal" role="document">
      <div class="psu-full-history-modal-head">
        <div>
          <h3 id="predictive-bearing-alert-title" class="psu-full-history-modal-title" style="color:${isHealthy ? '#34d399' : '#fda4af'};">
            ${isHealthy ? '✓ Raport stanu łożysk wentylatorów (Predictive Bearing Health Alert)' : '⚠ Alert stanu łożyska wentylatora (Predictive Bearing Health Alert)'}
          </h3>
          <p class="psu-full-history-modal-sub">
            ${
              isHealthy
                ? `Wszystkie wykryte wentylatory pracują prawidłowo powyżej progu konserwacji zapobiegawczej (${thresh}%). Poniżej znajduje się szczegółowa diagnostyka wybranego kanału.`
                : `Szacowana żywotność łożyska spadła poniżej ustawionego progu konserwacji zapobiegawczej (${thresh}%). Sprawdź poniższą diagnostykę i zalecenia serwisowe.`
            }
          </p>
        </div>
        <div class="psu-full-history-controls">
          <span class="fan-bearing-alert-thresh-badge font-mono">Próg: &lt;${thresh}%</span>
          <button type="button" class="psu-full-history-close-btn" id="predictive-bearing-alert-close-btn" aria-label="Zamknij okno diagnostyki łożysk">✕ Zamknij</button>
        </div>
      </div>

      ${
        displayList.length > 1
          ? `<div class="fan-bearing-alert-tabs">
               ${displayList
                 .map(
                   (ch) => `
                   <button
                     type="button"
                     class="btn ${selected?.id === ch.id ? 'btn-danger' : 'btn-secondary'} btn-sm font-mono"
                     data-alert-select-channel="${escHtml(ch.id)}"
                   >
                     ${escHtml(ch.label)} (${ch.predictedLifeExpectancyPct}%)
                   </button>
                 `
                 )
                 .join('')}
             </div>`
          : ''
      }

      ${
        selected
          ? `
            <div class="fan-bearing-alert-kpi-grid font-mono">
              <div class="fan-bearing-alert-kpi ${isHealthy ? '' : 'is-danger'}">
                <span>Kanał wentylatora (Fan Channel)</span>
                <strong>${escHtml(selected.label)} (${escHtml(selected.header)})</strong>
              </div>
              <div class="fan-bearing-alert-kpi ${isHealthy ? '' : 'is-danger'}">
                <span>Szacowana żywotność (Predicted Life Expectancy)</span>
                <strong>${selected.predictedLifeExpectancyPct}% (Próg ${thresh}%)</strong>
              </div>
              <div class="fan-bearing-alert-kpi">
                <span>Pozostały czas pracy L10 (Est. Remaining L10 Life)</span>
                <strong>~${selected.estimatedRemainingHours.toLocaleString('pl-PL')} godz.</strong>
              </div>
              <div class="fan-bearing-alert-kpi">
                <span>Indeks łożyska / Dryft (Bearing Health / LT Drift)</span>
                <strong>${selected.bearingHealthIndex}/100 · ${selected.longTermDriftPct.toFixed(2)}% (${selected.driftTrend === 'STABLE' ? 'STABILNY' : selected.driftTrend === 'DRIFTING' ? 'DRYFT' : 'SPADEK'})</strong>
              </div>
            </div>

            <div class="fan-bearing-alert-diagnosis">
              <strong>Podsumowanie diagnostyczne (Diagnostic Summary:):</strong> ${escHtml(selected.bearingPrediction)}
            </div>

            <div class="fan-bearing-alert-instructions">
              <h4>Zalecane kroki konserwacyjne (Actionable Maintenance Instructions)</h4>
              <ol>
                ${selected.maintenanceInstructions
                  .map((step) => `<li>${escHtml(step)}</li>`)
                  .join('')}
              </ol>
            </div>
          `
          : '<div class="fan-resonance-ok">Wszystkie wykryte wentylatory pracują prawidłowo powyżej progu konserwacji zapobiegawczej.</div>'
      }

      <div class="fan-bearing-alert-footer">
        <button type="button" class="btn btn-secondary btn-sm" id="predictive-bearing-alert-history-btn">
          Pokaż historię łożysk (View Bearing Health History)
        </button>
        <button type="button" class="btn btn-primary btn-sm" id="predictive-bearing-alert-ack-btn">
          Potwierdź i zamknij
        </button>
      </div>
    </div>
  `;
}

