import { ThermalHeatMapSnapshot, ThermalZoneLevel, ThermalZoneReading } from '../types';
import { iconSvg } from './icons';

function levelLabel(lvl: ThermalZoneLevel, hasRealTemp: boolean): string {
  if (hasRealTemp) {
    switch (lvl) {
      case 'cool':
        return 'CHŁODNO';
      case 'optimal':
        return 'OPT.';
      case 'warm':
        return 'CIEPŁO';
      case 'hot':
        return 'GORĄCO';
    }
  }
  switch (lvl) {
    case 'cool':
      return 'SPOCZ.';
    case 'optimal':
      return 'AKTYWNE';
    case 'warm':
      return 'OBCIĄŻ.';
    case 'hot':
      return 'MAKS.';
  }
}

function levelStrokeColor(lvl: ThermalZoneLevel): string {
  switch (lvl) {
    case 'cool':
      return '#38bdf8';
    case 'optimal':
      return '#34d399';
    case 'warm':
      return '#fbbf24';
    case 'hot':
      return '#fb7185';
  }
}

function renderZoneSparklineHtml(z: ThermalZoneReading): string {
  const hist = z.history60s || [];
  const tempPoints = hist.filter((p) => p.tempC !== null);
  const usingTemp = z.tempC !== null && tempPoints.length > 0;
  const values = usingTemp
    ? tempPoints.map((p) => p.tempC as number)
    : hist.map((p) => p.loadPct);

  const stroke = levelStrokeColor(z.level);
  const safeId = `spk-${z.id.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  if (values.length === 0) {
    return `
      <div class="thermal-sparkline-box" style="margin-top:6px;padding-top:5px;border-top:1px solid rgba(148,163,184,0.16);">
        <div class="font-mono" style="font-size:10px;color:var(--text-muted);">Zbieranie próbek (60s)...</div>
      </div>`;
  }

  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  let yMin = usingTemp ? rawMin : 0;
  let yMax = usingTemp ? rawMax : 100;

  if (usingTemp) {
    const span = Math.max(4, rawMax - rawMin);
    const mid = (rawMin + rawMax) / 2;
    yMin = mid - span * 0.6;
    yMax = mid + span * 0.6;
  }

  const w = 120;
  const h = 26;
  const padX = 2;
  const padY = 3;
  const innerW = w - padX * 2;
  const innerH = h - padY * 2;

  const coords =
    values.length === 1
      ? [
          { x: padX, y: padY + innerH - ((values[0] - yMin) / Math.max(0.001, yMax - yMin)) * innerH },
          { x: w - padX, y: padY + innerH - ((values[0] - yMin) / Math.max(0.001, yMax - yMin)) * innerH },
        ]
      : values.map((v, i) => {
          const x = padX + (i / (values.length - 1)) * innerW;
          const norm = Math.max(0, Math.min(1, (v - yMin) / Math.max(0.001, yMax - yMin)));
          const y = padY + innerH - norm * innerH;
          return { x, y };
        });

  const linePath = coords
    .map((pt, idx) => `${idx === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L${coords[coords.length - 1].x.toFixed(1)},${(h - 1).toFixed(1)} L${coords[0].x.toFixed(1)},${(h - 1).toFixed(1)} Z`;
  const last = coords[coords.length - 1];

  const rangeText = usingTemp
    ? `${rawMin.toFixed(1)}–${rawMax.toFixed(1)} °C`
    : `${Math.round(rawMin)}–${Math.round(rawMax)}% obc.`;

  return `
    <div class="thermal-sparkline-box" style="margin-top:6px;padding-top:5px;border-top:1px solid rgba(148,163,184,0.18);">
      <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:26px;display:block;overflow:visible;" role="img" aria-label="Trend 60s dla ${z.label}">
        <defs>
          <linearGradient id="${safeId}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${stroke}" stop-opacity="0.34" />
            <stop offset="100%" stop-color="${stroke}" stop-opacity="0.02" />
          </linearGradient>
        </defs>
        <path d="${areaPath}" fill="url(#${safeId})" />
        <path d="${linePath}" fill="none" stroke="${stroke}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
        <circle cx="${last.x.toFixed(1)}" cy="${last.y.toFixed(1)}" r="2.2" fill="${stroke}" />
      </svg>
      <div class="row-between font-mono" style="font-size:9.5px;color:var(--text-muted);margin-top:2px;">
        <span>60s</span>
        <span>${rangeText}</span>
      </div>
    </div>
  `;
}

export function renderThermalHeatmapInnerHtml(
  snap: ThermalHeatMapSnapshot,
  showSparklines = false
): string {
  const hasReal = snap.sensorMode !== 'load-only';
  const statusCls =
    snap.thermalStatus === 'OPTYMALNA'
      ? 'status-ok'
      : snap.thermalStatus === 'PODWYŻSZONA'
        ? 'status-warn'
        : snap.thermalStatus === 'WYSOKA TEMPERATURA'
          ? 'status-err'
          : 'status-cyan';

  const rowsHtml = snap.rows
    .map(
      (row) => `
      <div class="thermal-row">
        <div class="thermal-row-meta">
          <div class="row-between">
            <strong style="font-size:13px;">${row.name}</strong>
            <span class="font-mono" style="font-size:11px;color:${row.active ? 'var(--accent-cyan)' : 'var(--text-muted)'};">
              ${row.active ? `TEST ${row.loadPct}%` : `IDLE 0%`}
            </span>
          </div>
          <span style="font-size:11px;color:var(--text-muted);">${row.subtitle}</span>
          <span class="font-mono" style="font-size:11.5px;color:var(--text-secondary);">
            ${
              row.avgTempC !== null && row.maxTempC !== null
                ? `Czujnik: Śr. ${row.avgTempC.toFixed(1)} °C · Max ${row.maxTempC.toFixed(1)} °C`
                : `Czujnik °C: brak mostka · Obc. ${row.loadPct}%`
            }
          </span>
        </div>
        ${row.zones
          .map((z) => {
            const cellHasTemp = z.tempC !== null;
            return `
          <div class="thermal-cell heat-${z.level}">
            <div class="thermal-cell-label">
              <span>${z.label}</span>
              <span class="font-mono" style="font-size:10px;">${levelLabel(z.level, cellHasTemp)}</span>
            </div>
            <div class="thermal-cell-temp">
              ${cellHasTemp ? `${z.tempC!.toFixed(1)} °C` : `${z.loadPct}%`}
            </div>
            <div class="thermal-cell-foot">
              ${
                cellHasTemp && z.peakC !== null
                  ? `Szczyt: ${z.peakC.toFixed(1)} °C`
                  : `Szczyt obc.: ${z.peakLoadPct}% · brak °C`
              }
            </div>
            ${showSparklines ? renderZoneSparklineHtml(z) : ''}
          </div>`;
          })
          .join('')}
      </div>`
    )
    .join('');

  return `
    <div style="padding:8px 12px;margin-bottom:10px;border:1px solid ${hasReal ? 'var(--accent-emerald)' : 'var(--border)'};border-radius:var(--radius-sm);background:var(--bg-inset);font-size:12px;color:var(--text-secondary);">
      <strong class="${hasReal ? 'status-ok' : 'status-cyan'}">
        ${
          snap.sensorMode === 'hardware-live'
            ? 'PRAWDZIWE CZUJNIKI SPRZĘTOWE (LIVE):'
            : snap.sensorMode === 'hardware-imported'
              ? 'ZAIMPORTOWANE PRAWDZIWE CZUJNIKI °C:'
              : 'UCZCIWY TRYB TELEMETRII (0 ZMYŚLONYCH °C):'
        }
      </strong>
      ${snap.bridgeStatus}
    </div>

    <div class="row-between" style="flex-wrap:wrap;gap:10px;margin-bottom:12px;">
      <div class="meta-line">
        <span>Stan: <strong class="${statusCls}">${snap.thermalStatus}</strong></span>
        <span class="meta-sep">·</span>
        ${
          snap.avgSystemTempC !== null && snap.hottestTempC !== null
            ? `
          <span>Średnia z czujników: <strong class="font-mono" style="color:var(--text-primary);">${snap.avgSystemTempC.toFixed(1)} °C</strong></span>
          <span class="meta-sep">·</span>
          <span>Najgorętszy czujnik: <strong class="font-mono ${snap.hottestTempC >= 80 ? 'status-err' : snap.hottestTempC >= 65 ? 'status-warn' : 'status-ok'}">${snap.hottestZoneLabel} (${snap.hottestTempC.toFixed(1)} °C)</strong></span>
        `
            : `
          <span>Najbardziej obciążona strefa: <strong class="font-mono status-cyan">${snap.hottestZoneLabel}</strong></span>
        `
        }
      </div>
      <div class="thermal-legend">
        ${
          hasReal
            ? `
          <span><span class="thermal-swatch" style="background:#38bdf8;"></span>&lt; 45 °C</span>
          <span><span class="thermal-swatch" style="background:#34d399;"></span>45–64 °C</span>
          <span><span class="thermal-swatch" style="background:#fbbf24;"></span>65–79 °C</span>
          <span><span class="thermal-swatch" style="background:#fb7185;"></span>≥ 80 °C</span>
        `
            : `
          <span><span class="thermal-swatch" style="background:#38bdf8;"></span>0–19% spocz.</span>
          <span><span class="thermal-swatch" style="background:#34d399;"></span>20–54% akt.</span>
          <span><span class="thermal-swatch" style="background:#fbbf24;"></span>55–84% wys.</span>
          <span><span class="thermal-swatch" style="background:#fb7185;"></span>≥ 85% maks.</span>
        `
        }
      </div>
    </div>

    <div class="thermal-grid">
      ${rowsHtml}
    </div>
  `;
}

export function renderThermalHeatmapPanelHtml(
  snap: ThermalHeatMapSnapshot,
  showSparklines = false
): string {
  const isLive = snap.sensorMode === 'hardware-live';
  return `
    <div class="panel stack-md">
      <div class="panel-header" style="margin-bottom:0;flex-wrap:wrap;gap:8px;">
        <div class="row-wrap" style="gap:8px;">
          <span style="color:var(--accent-amber);">${iconSvg('thermal', 18)}</span>
          <div>
            <h2 class="panel-title">Mapa termiczna i obciążenia sprzętu (Thermal Heat Map)</h2>
            <span class="panel-caption">16 stref (CPU, GPU, Dysk NVMe/SSD, RAM) · Zero udawanych °C — podłącz plik LIVE z HWiNFO64 (.csv), skrypt .bat lub wklej odczyt</span>
          </div>
        </div>
        <div class="row-wrap">
          <button
            id="thermal-sparkline-toggle-btn"
            type="button"
            class="btn ${showSparklines ? 'btn-primary' : 'btn-secondary'} btn-sm"
            aria-pressed="${showSparklines ? 'true' : 'false'}"
            title="Przełącz wyświetlanie mini-wykresu trendu (ostatnie 60 s) wewnątrz każdej karty czujnika"
          >
            ${showSparklines ? 'Wykresy 60s: WŁ.' : 'Wykresy 60s: WYŁ.'}
          </button>
          <button
            id="thermal-download-snapshot-btn"
            type="button"
            class="btn btn-secondary btn-sm"
            title="Pobierz bieżący zrzut stanu termicznego (thermalState + historia 60 s) w formacie JSON do analizy offline"
          >
            ${iconSvg('download', 13)}
            <span>Download Snapshot</span>
          </button>
          <button id="thermal-connect-file-btn" type="button" class="btn ${isLive ? 'btn-danger' : 'btn-primary'} btn-sm" title="Wskaż log .CSV z HWiNFO64 lub plik systempulse-sensors-live.json — działa na HTTPS bez blokad CORS!">
            ${isLive ? 'Rozłącz czujniki LIVE' : 'Podłącz plik LIVE (HWiNFO64 / CSV / JSON)'}
          </button>
          <button id="thermal-download-script-btn" type="button" class="btn btn-secondary btn-sm" title="Pobierz gotowy skrypt Windows .bat zapisujący prawdziwe czujniki co 2 sekundy do pliku JSON">
            Pobierz skrypt LIVE (.bat)
          </button>
          <button id="thermal-connect-bridge-btn" type="button" class="btn btn-secondary btn-sm" title="Bezpośrednie połączenie HTTP z LibreHardwareMonitor (port 8085)">
            Serwer :8085
          </button>
          <button id="thermal-copy-sensor-cmd-btn" type="button" class="btn btn-secondary btn-sm">
            Kopiuj komendę
          </button>
          <button id="thermal-reset-peaks-btn" type="button" class="btn btn-secondary btn-sm">
            Resetuj szczyty
          </button>
        </div>
      </div>

      <div id="dash-thermal-heatmap-body">
        ${renderThermalHeatmapInnerHtml(snap, showSparklines)}
      </div>

      <div class="stack-sm" style="padding-top:8px;border-top:1px solid var(--border-subtle);">
        <div class="row-wrap" style="align-items:stretch;">
          <textarea id="thermal-sensor-paste-input" rows="2" class="field-input font-mono" style="flex:1;min-width:260px;font-size:11.5px;resize:vertical;line-height:1.35;" placeholder="Wklej wynik z PowerShell / nvidia-smi / sensors / HWiNFO CSV lub wpisz ręcznie, np.: CPU: 62 C, GPU: 55 C, SSD: 41 C, RAM: 38 C"></textarea>
          <button id="thermal-sensor-import-btn" type="button" class="btn btn-primary btn-sm" style="align-self:stretch;">
            Wczytaj prawdziwe °C
          </button>
        </div>
        <div style="font-size:11.5px;color:var(--text-muted);">
          <strong>Jak podłączyć prawdziwe °C w 10 sekund (Windows / HWiNFO64):</strong>
          (1) W HWiNFO64 kliknij <em>Start Logging (.csv)</em> <strong>lub</strong> uruchom pobrany <em>SystemPulse-Czujniki-LIVE.bat</em> →
          (2) Kliknij <strong>Podłącz plik LIVE</strong> i wybierz ten plik — wszystkie 16 stref odświeżą się na żywo co 1,5 s bez blokad CORS.
        </div>
      </div>
    </div>
  `;
}
