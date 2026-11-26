import { StressSessionRecord } from '../types';
import { iconSvg } from './icons';

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('pl-PL', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function renderStressHistoryPanelHtml(history: StressSessionRecord[]): string {
  const count = history.length;
  const avgStab =
    count > 0
      ? Number((history.reduce((s, r) => s + r.finalStabilityPct, 0) / count).toFixed(1))
      : null;
  const totalSec =
    count > 0 ? Number(history.reduce((s, r) => s + r.durationSec, 0).toFixed(1)) : 0;

  const rowsHtml =
    count === 0
      ? `
        <div style="padding:18px 14px;border:1px dashed var(--border-hairline);border-radius:8px;background:var(--bg-inset);font-size:13px;color:var(--text-muted);">
          Brak zapisanych sesji stres-testów. Uruchom dowolny test obciążeniowy (<strong>CPU Stres</strong>, <strong>GPU 3D</strong>, <strong>Gra 3D MAX</strong>, <strong>Test Wentylatorów</strong> lub <strong>Harmonogram</strong>), aby automatycznie zapisać historię sesji w IndexedDB.
        </div>
      `
      : `
        <div style="overflow-x:auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Moduł / Sesja</th>
                <th>Rozpoczęcie</th>
                <th>Zakończenie (Czas)</th>
                <th>Śr. temp. CPU</th>
                <th>Śr. temp. GPU</th>
                <th>Stabilność końcowa</th>
                <th>Podsumowanie</th>
              </tr>
            </thead>
            <tbody>
              ${[...history]
                .reverse()
                .map((rec) => {
                  const stabCls =
                    rec.finalStabilityPct >= 88
                      ? 'status-ok'
                      : rec.finalStabilityPct >= 72
                        ? 'status-warn'
                        : 'status-err';
                  const cpuTempHtml =
                    rec.avgCpuTempC !== null
                      ? `<span class="font-mono ${rec.avgCpuTempC >= 82 ? 'status-err' : rec.avgCpuTempC >= 68 ? 'status-warn' : 'status-ok'}">${rec.avgCpuTempC.toFixed(1)} °C</span>`
                      : `<span style="color:var(--text-muted);font-size:11.5px;">Brak czujnika</span>`;
                  const gpuTempHtml =
                    rec.avgGpuTempC !== null
                      ? `<span class="font-mono ${rec.avgGpuTempC >= 82 ? 'status-err' : rec.avgGpuTempC >= 68 ? 'status-warn' : 'status-ok'}">${rec.avgGpuTempC.toFixed(1)} °C</span>`
                      : `<span style="color:var(--text-muted);font-size:11.5px;">Brak czujnika</span>`;
                  return `
                    <tr>
                      <td>
                        <div style="font-weight:600;">${esc(rec.module)}</div>
                        <div class="font-mono" style="font-size:11px;color:var(--text-muted);">${fmtDate(rec.startedAt)}</div>
                      </td>
                      <td class="font-mono">${fmtTime(rec.startedAt)}</td>
                      <td class="font-mono">
                        ${fmtTime(rec.endedAt)}
                        <span style="color:var(--text-muted);font-size:11.5px;">(${rec.durationSec.toFixed(1)}s)</span>
                      </td>
                      <td>${cpuTempHtml}</td>
                      <td>${gpuTempHtml}</td>
                      <td>
                        <div class="row-wrap" style="gap:8px;align-items:center;">
                          <span class="font-mono ${stabCls}" style="font-weight:700;min-width:46px;">${rec.finalStabilityPct.toFixed(1)}%</span>
                          <div class="progress-track" style="width:70px;height:6px;">
                            <div class="progress-fill ${rec.finalStabilityPct >= 88 ? 'ok' : rec.finalStabilityPct >= 72 ? 'warn' : 'err'}" style="width:${Math.max(4, Math.min(100, rec.finalStabilityPct))}%;"></div>
                          </div>
                        </div>
                      </td>
                      <td style="font-size:12px;color:var(--text-secondary);">${esc(rec.summaryMetric)}</td>
                    </tr>`;
                })
                .join('')}
            </tbody>
          </table>
        </div>
      `;

  return `
    <div class="panel stack-md" id="dash-stress-history-panel">
      <div class="panel-header" style="margin-bottom:0;flex-wrap:wrap;gap:8px;">
        <div class="row-wrap" style="gap:8px;">
          <span style="color:var(--accent-cyan);">${iconSvg('scheduler', 18)}</span>
          <div>
            <h2 class="panel-title">Historia sesji stres-testów (Stress History)</h2>
            <span class="panel-caption">Dziennik ukończonych sesji obciążeniowych (start/koniec, prawdziwe średnie °C z czujników oraz końcowa stabilność %)</span>
          </div>
        </div>
        <div class="row-wrap" style="gap:8px;align-items:center;">
          <div class="meta-line" style="font-size:12px;">
            <span>Sesje: <strong class="font-mono">${count}</strong></span>
            <span class="meta-sep">·</span>
            <span>Śr. stabilność: <strong class="font-mono ${avgStab !== null && avgStab >= 85 ? 'status-ok' : 'status-cyan'}">${avgStab !== null ? `${avgStab}%` : '—'}</strong></span>
            <span class="meta-sep">·</span>
            <span>Łączny czas: <strong class="font-mono">${totalSec}s</strong></span>
          </div>
          <button
            id="dash-export-stress-xlsx-btn"
            type="button"
            class="btn btn-primary btn-sm"
            ${count === 0 ? 'disabled title="Uruchom przynajmniej jeden stres-test, aby wyeksportować historię do Excela"' : 'title="Eksportuj historię sesji do arkusza Excel (.xlsx) z podsumowaniem"'}
          >
            ${iconSvg('excel', 14)}
            <span>Eksport Excel (.xlsx)</span>
          </button>
          <button
            id="dash-export-stress-csv-btn"
            type="button"
            class="btn btn-secondary btn-sm"
            ${count === 0 ? 'disabled title="Uruchom przynajmniej jeden stres-test, aby wyeksportować historię do CSV"' : 'title="Eksportuj historię sesji do pliku CSV (UTF-8)"'}
          >
            ${iconSvg('csv', 14)}
            <span>Eksport CSV</span>
          </button>
          <button
            id="dash-export-stress-json-btn"
            type="button"
            class="btn btn-secondary btn-sm"
            ${count === 0 ? 'disabled title="Uruchom przynajmniej jeden stres-test, aby wyeksportować szczegółową historię logów do JSON"' : 'title="Eksportuj pełną, ustrukturyzowaną historię sesji stres-testów i logów diagnostycznych do pliku JSON"'}
          >
            ${iconSvg('download', 14)}
            <span>Eksport JSON</span>
          </button>
          ${
            count > 0
              ? `<button id="dash-clear-stress-history-btn" type="button" class="btn btn-secondary btn-sm">Wyczyść historię</button>`
              : ''
          }
        </div>
      </div>

      ${rowsHtml}
    </div>
  `;
}
