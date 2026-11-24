import { FanCurveConfig, FanCurvePreset } from '../types';
import {
  FAN_CURVE_PRESETS,
  evaluateFanCurvePct,
  evaluateFanCurveRpm,
} from '../services/fanTest.service';
import { iconSvg } from './icons';

const TEMP_MIN = 30;
const TEMP_MAX = 100;
const MIN_GAP_C = 4;

export interface FanCurveEditorOptions {
  container: HTMLElement;
  initialCurve: FanCurveConfig;
  getLiveCpuTempC: () => number | null;
  onChange: (nextCurve: FanCurveConfig) => void;
}

export function renderFanCurveEditorPanelHtml(curve: FanCurveConfig): string {
  const presetLabel: Record<FanCurvePreset, string> = {
    silent: 'Cichy',
    balanced: 'Zbalansowany',
    performance: 'Wydajny',
    turbo: 'Turbo 100%',
    custom: 'Własna krzywa',
  };

  return `
    <div class="panel stack-md" id="fan-curve-editor-panel">
      <div class="panel-header" style="margin-bottom:0;flex-wrap:wrap;gap:10px;">
        <div class="row-wrap" style="gap:8px;">
          <span style="color:var(--accent-cyan);">${iconSvg('fan', 18)}</span>
          <div>
            <h2 class="panel-title">Edytor krzywej wentylatorów (Fan Curve Editor)</h2>
            <span class="panel-caption">Przeciągaj punkty kontrolne na wykresie 2D, aby zdefiniować obroty wentylatora (PWM % / RPM) względem progu temperatury CPU (°C)</span>
          </div>
        </div>
        <div class="row-wrap" style="gap:6px;">
          <span id="fc-preset-badge" class="font-mono status-cyan" style="font-size:12px;padding:4px 8px;border:1px solid var(--border-hairline);border-radius:6px;background:var(--bg-inset);">
            Profil: ${presetLabel[curve.preset]}
          </span>
        </div>
      </div>

      <div class="row-between" style="flex-wrap:wrap;gap:10px;">
        <div class="segmented" id="fc-preset-group" role="group" aria-label="Presety krzywej wentylatorów">
          <button type="button" class="segmented-btn ${curve.preset === 'silent' ? 'active' : ''}" data-fc-preset="silent">Cichy</button>
          <button type="button" class="segmented-btn ${curve.preset === 'balanced' ? 'active' : ''}" data-fc-preset="balanced">Zbalansowany</button>
          <button type="button" class="segmented-btn ${curve.preset === 'performance' ? 'active' : ''}" data-fc-preset="performance">Wydajny</button>
          <button type="button" class="segmented-btn ${curve.preset === 'turbo' ? 'active' : ''}" data-fc-preset="turbo">Turbo 100%</button>
        </div>

        <div class="row-wrap" style="gap:8px;align-items:center;">
          <label class="row-wrap" style="gap:6px;font-size:12px;color:var(--text-secondary);">
            <span>Maks. obroty:</span>
            <select id="fc-max-rpm-select" class="field-input font-mono" style="width:auto;padding:5px 8px;font-size:12px;">
              ${[3000, 4000, 5000, 5500, 6000]
                .map(
                  (rpm) =>
                    `<option value="${rpm}" ${curve.maxRpm === rpm ? 'selected' : ''}>${rpm.toLocaleString('pl-PL')} RPM</option>`
                )
                .join('')}
            </select>
          </label>
          <button id="fc-add-point-btn" type="button" class="btn btn-secondary btn-sm">+ Dodaj punkt</button>
          <button id="fc-remove-point-btn" type="button" class="btn btn-secondary btn-sm">Usuń punkt</button>
        </div>
      </div>

      <div class="grid-split-wide" style="align-items:stretch;">
        <div style="position:relative;border:1px solid var(--border-hairline);border-radius:10px;background:var(--bg-inset);padding:10px;min-height:290px;display:flex;flex-direction:column;">
          <canvas id="fc-plot-canvas" style="width:100%;height:265px;display:block;touch-action:none;cursor:crosshair;"></canvas>
          <div id="fc-drag-hint" class="row-between" style="margin-top:6px;font-size:11.5px;color:var(--text-muted);flex-wrap:wrap;gap:6px;">
            <span>Przeciągnij dowolny punkt kontrolny myszką lub dotykiem · Oś X: Próg CPU (°C) · Oś Y: PWM (%) / RPM</span>
            <span id="fc-active-point-readout" class="font-mono status-cyan">Zaznaczony punkt: —</span>
          </div>
        </div>

        <div class="stack-md" style="justify-content:space-between;">
          <div class="metric-card" style="padding:12px 14px;">
            <div class="row-between" style="margin-bottom:6px;">
              <span class="metric-label">Podgląd odpowiedzi wentylatora</span>
              <span id="fc-preview-source" class="font-mono" style="font-size:11px;color:var(--text-muted);">Suwak podglądu</span>
            </div>
            <div class="metric-row" style="gap:12px;flex-wrap:wrap;">
              <div>
                <span id="fc-preview-rpm" class="metric-value status-cyan" style="font-size:24px;">—</span>
                <span class="metric-unit">RPM</span>
              </div>
              <div>
                <span id="fc-preview-pct" class="metric-value" style="font-size:20px;">—</span>
                <span class="metric-unit">% PWM</span>
              </div>
            </div>
            <div style="margin-top:10px;">
              <div class="row-between" style="font-size:11.5px;margin-bottom:4px;">
                <span style="color:var(--text-secondary);">Symuluj temperaturę CPU:</span>
                <strong id="fc-preview-temp-val" class="font-mono status-amber">62 °C</strong>
              </div>
              <input id="fc-preview-temp-slider" type="range" min="30" max="100" step="1" value="62" style="width:100%;accent-color:var(--accent-cyan);" />
            </div>
          </div>

          <div style="overflow-x:auto;border:1px solid var(--border-subtle);border-radius:8px;background:var(--bg-inset);padding:8px 10px;">
            <div style="font-size:11.5px;font-weight:600;color:var(--text-secondary);margin-bottom:6px;">
              Tabela progów krzywej (automatycznie zapisywana w IndexedDB)
            </div>
            <table class="data-table" style="font-size:12px;">
              <thead>
                <tr>
                  <th>Punkt</th>
                  <th>Próg CPU</th>
                  <th>PWM</th>
                  <th>Cel RPM</th>
                </tr>
              </thead>
              <tbody id="fc-points-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function mountFanCurveEditor(opts: FanCurveEditorOptions): () => void {
  const { container, getLiveCpuTempC, onChange } = opts;
  let curve: FanCurveConfig = {
    preset: opts.initialCurve.preset,
    maxRpm: opts.initialCurve.maxRpm,
    points: opts.initialCurve.points.map((p) => ({ ...p })),
  };
  let selectedIdx = Math.min(2, Math.max(0, curve.points.length - 1));
  let hoverIdx = -1;
  let draggingIdx = -1;
  let previewTempC = 62;

  const canvas = container.querySelector<HTMLCanvasElement>('#fc-plot-canvas');
  const tbody = container.querySelector<HTMLElement>('#fc-points-tbody');
  const readoutEl = container.querySelector<HTMLElement>('#fc-active-point-readout');
  const presetBadge = container.querySelector<HTMLElement>('#fc-preset-badge');
  const previewRpmEl = container.querySelector<HTMLElement>('#fc-preview-rpm');
  const previewPctEl = container.querySelector<HTMLElement>('#fc-preview-pct');
  const previewTempValEl = container.querySelector<HTMLElement>('#fc-preview-temp-val');
  const previewSourceEl = container.querySelector<HTMLElement>('#fc-preview-source');
  const previewSlider = container.querySelector<HTMLInputElement>('#fc-preview-temp-slider');
  const maxRpmSelect = container.querySelector<HTMLSelectElement>('#fc-max-rpm-select');
  const addBtn = container.querySelector<HTMLButtonElement>('#fc-add-point-btn');
  const removeBtn = container.querySelector<HTMLButtonElement>('#fc-remove-point-btn');

  if (!canvas) return () => {};
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};

  const PAD = { left: 46, right: 56, top: 20, bottom: 34 };

  const getPlotRect = () => {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(260, Math.floor(rect.width));
    const h = Math.max(200, Math.floor(rect.height));
    return {
      w,
      h,
      plotW: w - PAD.left - PAD.right,
      plotH: h - PAD.top - PAD.bottom,
    };
  };

  const tempToX = (tempC: number, plotW: number) =>
    PAD.left + ((tempC - TEMP_MIN) / (TEMP_MAX - TEMP_MIN)) * plotW;

  const pctToY = (pct: number, plotH: number) =>
    PAD.top + (1 - pct / 100) * plotH;

  const xToTemp = (x: number, plotW: number) =>
    TEMP_MIN + ((x - PAD.left) / plotW) * (TEMP_MAX - TEMP_MIN);

  const yToPct = (y: number, plotH: number) =>
    (1 - (y - PAD.top) / plotH) * 100;

  const presetNames: Record<FanCurvePreset, string> = {
    silent: 'Cichy',
    balanced: 'Zbalansowany',
    performance: 'Wydajny',
    turbo: 'Turbo 100%',
    custom: 'Własna krzywa',
  };

  const syncPresetButtons = () => {
    container.querySelectorAll<HTMLButtonElement>('[data-fc-preset]').forEach((b) => {
      b.classList.toggle('active', b.dataset.fcPreset === curve.preset);
    });
    if (presetBadge) presetBadge.textContent = `Profil: ${presetNames[curve.preset]}`;
  };

  const syncPreviewAndTable = () => {
    const liveTemp = getLiveCpuTempC();
    const evalTemp = liveTemp !== null ? liveTemp : previewTempC;
    const pct = evaluateFanCurvePct(curve, evalTemp);
    const rpm = evaluateFanCurveRpm(curve, evalTemp);

    if (previewRpmEl) previewRpmEl.textContent = rpm.toLocaleString('pl-PL');
    if (previewPctEl) previewPctEl.textContent = String(pct);
    if (previewTempValEl) previewTempValEl.textContent = `${Math.round(evalTemp)} °C`;
    if (previewSourceEl) {
      previewSourceEl.textContent = liveTemp !== null ? 'Czujnik CPU LIVE' : 'Suwak podglądu';
      previewSourceEl.className = `font-mono ${liveTemp !== null ? 'status-ok' : ''}`;
    }

    const activePt = curve.points[selectedIdx];
    if (readoutEl && activePt) {
      const ptRpm = Math.round((activePt.rpmPct / 100) * curve.maxRpm);
      readoutEl.textContent = `Punkt #${selectedIdx + 1}: ${activePt.tempC} °C → ${activePt.rpmPct}% (${ptRpm.toLocaleString('pl-PL')} RPM)`;
    }

    if (tbody) {
      tbody.innerHTML = curve.points
        .map((pt, i) => {
          const ptRpm = Math.round((pt.rpmPct / 100) * curve.maxRpm);
          const isSel = i === selectedIdx;
          return `
            <tr data-fc-row="${i}" style="cursor:pointer;${isSel ? 'background:var(--accent-cyan-dim);' : ''}">
              <td class="font-mono" style="font-weight:700;">#${i + 1}</td>
              <td class="font-mono">${pt.tempC} °C</td>
              <td class="font-mono status-cyan">${pt.rpmPct}%</td>
              <td class="font-mono">${ptRpm.toLocaleString('pl-PL')} RPM</td>
            </tr>`;
        })
        .join('');
    }

    if (addBtn) addBtn.disabled = curve.points.length >= 8;
    if (removeBtn) removeBtn.disabled = curve.points.length <= 3;
  };

  const draw = () => {
    const { w, h, plotW, plotH } = getPlotRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cs = getComputedStyle(document.documentElement);
    const textMuted = cs.getPropertyValue('--text-muted').trim() || '#64748b';
    const textPrimary = cs.getPropertyValue('--text-primary').trim() || '#f1f5f9';
    const borderSubtle = cs.getPropertyValue('--border-subtle').trim() || 'rgba(148,163,184,0.22)';
    const accentCyan = cs.getPropertyValue('--accent-cyan').trim() || '#06b6d4';
    const accentAmber = cs.getPropertyValue('--accent-amber').trim() || '#f59e0b';
    const statusOk = cs.getPropertyValue('--status-ok').trim() || '#10b981';

    ctx.clearRect(0, 0, w, h);

    // Subtle temperature danger zone shading (> 80°C)
    const x80 = tempToX(80, plotW);
    ctx.fillStyle = 'rgba(244, 63, 94, 0.08)';
    ctx.fillRect(x80, PAD.top, PAD.left + plotW - x80, plotH);

    // Gridlines: horizontal (PWM 0..100%)
    ctx.lineWidth = 1;
    ctx.font = '11px "JetBrains Mono", monospace';
    for (let pct = 0; pct <= 100; pct += 25) {
      const y = pctToY(pct, plotH);
      ctx.strokeStyle = borderSubtle;
      ctx.beginPath();
      ctx.moveTo(PAD.left, y);
      ctx.lineTo(PAD.left + plotW, y);
      ctx.stroke();

      // Left axis: PWM %
      ctx.fillStyle = textMuted;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${pct}%`, PAD.left - 8, y);

      // Right axis: RPM
      const rpmTick = Math.round((pct / 100) * curve.maxRpm);
      ctx.textAlign = 'left';
      ctx.fillText(`${rpmTick}`, PAD.left + plotW + 7, y);
    }

    // Gridlines: vertical (Temperature 30..100°C)
    for (let t = TEMP_MIN; t <= TEMP_MAX; t += 10) {
      const x = tempToX(t, plotW);
      ctx.strokeStyle = borderSubtle;
      ctx.beginPath();
      ctx.moveTo(x, PAD.top);
      ctx.lineTo(x, PAD.top + plotH);
      ctx.stroke();

      ctx.fillStyle = t >= 80 ? '#f43f5e' : textMuted;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(`${t}°C`, x, PAD.top + plotH + 8);
    }

    // Right axis unit header
    ctx.fillStyle = textMuted;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('RPM', PAD.left + plotW + 7, PAD.top - 5);

    const pts = curve.points;
    if (pts.length > 0) {
      // Build full curve path extending flat to TEMP_MIN and TEMP_MAX
      const screenPts = [
        { x: tempToX(TEMP_MIN, plotW), y: pctToY(pts[0].rpmPct, plotH) },
        ...pts.map((p) => ({ x: tempToX(p.tempC, plotW), y: pctToY(p.rpmPct, plotH) })),
        { x: tempToX(TEMP_MAX, plotW), y: pctToY(pts[pts.length - 1].rpmPct, plotH) },
      ];

      // Area fill under curve
      const grad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + plotH);
      grad.addColorStop(0, 'rgba(6, 182, 212, 0.30)');
      grad.addColorStop(1, 'rgba(6, 182, 212, 0.02)');
      ctx.beginPath();
      ctx.moveTo(screenPts[0].x, PAD.top + plotH);
      for (const sp of screenPts) ctx.lineTo(sp.x, sp.y);
      ctx.lineTo(screenPts[screenPts.length - 1].x, PAD.top + plotH);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // Main curve stroke
      ctx.beginPath();
      ctx.moveTo(screenPts[0].x, screenPts[0].y);
      for (let i = 1; i < screenPts.length; i++) {
        ctx.lineTo(screenPts[i].x, screenPts[i].y);
      }
      ctx.strokeStyle = accentCyan;
      ctx.lineWidth = 2.6;
      ctx.lineJoin = 'round';
      ctx.stroke();
    }

    // Live or simulated CPU temperature vertical marker
    const liveTemp = getLiveCpuTempC();
    const markerTemp = Math.max(TEMP_MIN, Math.min(TEMP_MAX, liveTemp !== null ? liveTemp : previewTempC));
    const markerPct = evaluateFanCurvePct(curve, markerTemp);
    const mx = tempToX(markerTemp, plotW);
    const my = pctToY(markerPct, plotH);

    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = liveTemp !== null ? statusOk : accentAmber;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(mx, PAD.top);
    ctx.lineTo(mx, PAD.top + plotH);
    ctx.stroke();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(mx, my, 5, 0, Math.PI * 2);
    ctx.fillStyle = liveTemp !== null ? statusOk : accentAmber;
    ctx.fill();

    // Control points
    pts.forEach((pt, idx) => {
      const px = tempToX(pt.tempC, plotW);
      const py = pctToY(pt.rpmPct, plotH);
      const isDrag = idx === draggingIdx;
      const isActive = idx === selectedIdx || idx === hoverIdx || isDrag;

      if (isActive) {
        ctx.beginPath();
        ctx.arc(px, py, isDrag ? 13 : 11, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(6, 182, 212, 0.22)';
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(px, py, isDrag ? 7.5 : 6.5, 0, Math.PI * 2);
      ctx.fillStyle = isDrag ? accentAmber : accentCyan;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = textPrimary;
      ctx.stroke();

      // Compact floating label above active/dragged node
      if (isDrag || idx === selectedIdx) {
        const label = `${pt.tempC}°C · ${pt.rpmPct}%`;
        ctx.font = '600 10.5px "JetBrains Mono", monospace';
        const tw = ctx.measureText(label).width + 10;
        const bx = Math.max(PAD.left + 2, Math.min(PAD.left + plotW - tw - 2, px - tw / 2));
        const by = py < PAD.top + 28 ? py + 12 : py - 26;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
        ctx.strokeStyle = accentCyan;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(bx, by, tw, 18, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#f8fafc';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, bx + tw / 2, by + 9);
      }
    });
  };

  const hitTestPoint = (clientX: number, clientY: number): number => {
    const rect = canvas.getBoundingClientRect();
    const lx = clientX - rect.left;
    const ly = clientY - rect.top;
    const { plotW, plotH } = getPlotRect();
    let bestIdx = -1;
    let bestDist = 18;
    curve.points.forEach((pt, idx) => {
      const px = tempToX(pt.tempC, plotW);
      const py = pctToY(pt.rpmPct, plotH);
      const dist = Math.hypot(lx - px, ly - py);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = idx;
      }
    });
    return bestIdx;
  };

  const commitCurve = () => {
    syncPresetButtons();
    syncPreviewAndTable();
    draw();
    onChange({
      preset: curve.preset,
      maxRpm: curve.maxRpm,
      points: curve.points.map((p) => ({ ...p })),
    });
  };

  const onPointerDown = (e: PointerEvent) => {
    const hit = hitTestPoint(e.clientX, e.clientY);
    if (hit >= 0) {
      draggingIdx = hit;
      selectedIdx = hit;
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = 'grabbing';
      syncPreviewAndTable();
      draw();
    }
  };

  const onPointerMove = (e: PointerEvent) => {
    if (draggingIdx >= 0) {
      const rect = canvas.getBoundingClientRect();
      const lx = e.clientX - rect.left;
      const ly = e.clientY - rect.top;
      const { plotW, plotH } = getPlotRect();

      const minTemp =
        draggingIdx === 0 ? TEMP_MIN : curve.points[draggingIdx - 1].tempC + MIN_GAP_C;
      const maxTemp =
        draggingIdx === curve.points.length - 1
          ? TEMP_MAX
          : curve.points[draggingIdx + 1].tempC - MIN_GAP_C;

      const nextTemp = Math.max(minTemp, Math.min(maxTemp, Math.round(xToTemp(lx, plotW))));
      const nextPct = Math.max(0, Math.min(100, Math.round(yToPct(ly, plotH))));

      curve.points[draggingIdx] = {
        ...curve.points[draggingIdx],
        tempC: nextTemp,
        rpmPct: nextPct,
      };
      curve.preset = 'custom';
      syncPresetButtons();
      syncPreviewAndTable();
      draw();
      return;
    }

    const hit = hitTestPoint(e.clientX, e.clientY);
    if (hit !== hoverIdx) {
      hoverIdx = hit;
      canvas.style.cursor = hit >= 0 ? 'grab' : 'crosshair';
      draw();
    }
  };

  const onPointerUp = (e: PointerEvent) => {
    if (draggingIdx >= 0) {
      draggingIdx = -1;
      if (canvas.hasPointerCapture(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
      }
      canvas.style.cursor = 'grab';
      commitCurve();
    }
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);

  const onPresetClick = (e: Event) => {
    const btn = (e.currentTarget as HTMLButtonElement);
    const p = btn.dataset.fcPreset as Exclude<FanCurvePreset, 'custom'>;
    if (!p || !FAN_CURVE_PRESETS[p]) return;
    curve = {
      preset: p,
      maxRpm: curve.maxRpm,
      points: FAN_CURVE_PRESETS[p].map((pt) => ({ ...pt })),
    };
    selectedIdx = Math.min(selectedIdx, curve.points.length - 1);
    commitCurve();
  };

  const presetBtns = Array.from(container.querySelectorAll<HTMLButtonElement>('[data-fc-preset]'));
  presetBtns.forEach((b) => b.addEventListener('click', onPresetClick));

  const onMaxRpmChange = () => {
    if (!maxRpmSelect) return;
    curve.maxRpm = Number(maxRpmSelect.value) || 5000;
    commitCurve();
  };
  maxRpmSelect?.addEventListener('change', onMaxRpmChange);

  const onSliderInput = () => {
    if (!previewSlider) return;
    previewTempC = Number(previewSlider.value) || 62;
    syncPreviewAndTable();
    draw();
  };
  previewSlider?.addEventListener('input', onSliderInput);

  const onAddPoint = () => {
    if (curve.points.length >= 8) return;
    // Find widest gap between consecutive points
    let bestIdx = 0;
    let bestGap = 0;
    for (let i = 0; i < curve.points.length - 1; i++) {
      const gap = curve.points[i + 1].tempC - curve.points[i].tempC;
      if (gap > bestGap) {
        bestGap = gap;
        bestIdx = i;
      }
    }
    if (bestGap < MIN_GAP_C * 2) return;
    const a = curve.points[bestIdx];
    const b = curve.points[bestIdx + 1];
    const midTemp = Math.round((a.tempC + b.tempC) / 2);
    const midPct = Math.round((a.rpmPct + b.rpmPct) / 2);
    curve.points.splice(bestIdx + 1, 0, {
      id: `p-${Date.now().toString(36)}`,
      tempC: midTemp,
      rpmPct: midPct,
    });
    curve.preset = 'custom';
    selectedIdx = bestIdx + 1;
    commitCurve();
  };
  addBtn?.addEventListener('click', onAddPoint);

  const onRemovePoint = () => {
    if (curve.points.length <= 3) return;
    curve.points.splice(selectedIdx, 1);
    selectedIdx = Math.max(0, Math.min(selectedIdx, curve.points.length - 1));
    curve.preset = 'custom';
    commitCurve();
  };
  removeBtn?.addEventListener('click', onRemovePoint);

  const onTableClick = (e: Event) => {
    const tr = (e.target as HTMLElement).closest<HTMLTableRowElement>('tr[data-fc-row]');
    if (!tr) return;
    const idx = Number(tr.dataset.fcRow);
    if (Number.isFinite(idx) && idx >= 0 && idx < curve.points.length) {
      selectedIdx = idx;
      syncPreviewAndTable();
      draw();
    }
  };
  tbody?.addEventListener('click', onTableClick);

  const onResize = () => draw();
  window.addEventListener('resize', onResize);

  // Refresh live CPU sensor line periodically (if hardware bridge/file is connected)
  const liveTimer = window.setInterval(() => {
    if (getLiveCpuTempC() !== null) {
      syncPreviewAndTable();
      draw();
    }
  }, 1500);

  syncPresetButtons();
  syncPreviewAndTable();
  draw();

  return () => {
    window.clearInterval(liveTimer);
    window.removeEventListener('resize', onResize);
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerUp);
    presetBtns.forEach((b) => b.removeEventListener('click', onPresetClick));
    maxRpmSelect?.removeEventListener('change', onMaxRpmChange);
    previewSlider?.removeEventListener('input', onSliderInput);
    addBtn?.removeEventListener('click', onAddPoint);
    removeBtn?.removeEventListener('click', onRemovePoint);
    tbody?.removeEventListener('click', onTableClick);
  };
}
