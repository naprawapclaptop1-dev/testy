import * as d3 from 'd3';

export function renderPcPsuRailsD3Chart(
  container: HTMLElement,
  history: Array<{ timeLabel: string; timestamp: number; rail12V: number; rail5V: number; rail3P3V: number; powerW: number }>,
  alertThresholdPct: number = 5,
  markerResetTimestamp: number = 0
): void {
  const root = d3.select(container);
  root.selectAll('*').remove();

  const height = 220;
  if (!history || history.length === 0) {
    root
      .append('div')
      .attr('class', 'chart-box')
      .style('height', `${height}px`)
      .style('display', 'flex')
      .style('align-items', 'center')
      .style('justify-content', 'center')
      .style('color', 'var(--text-muted)')
      .style('font-size', '12px')
      .text('Brak danych telemetrii szyn zasilacza PC.');
    return;
  }

  const width = 680;
  const margin = { top: 22, right: 26, bottom: 28, left: 52 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  const wrap = root.append('div').attr('class', 'chart-box chart-interactive-wrap');

  // Identify event annotations where any rail crossed the deviation threshold (±5% ATX limit) after the last visual marker reset
  const annotations = history
    .map((d, index) => {
      const dev12 = (Math.abs(d.rail12V - 12.0) / 12.0) * 100;
      const dev5 = (Math.abs(d.rail5V - 5.0) / 5.0) * 100;
      const dev3 = (Math.abs(d.rail3P3V - 3.3) / 3.3) * 100;
      const isExceeded =
        d.timestamp > markerResetTimestamp &&
        (dev12 >= alertThresholdPct || dev5 >= alertThresholdPct || dev3 >= alertThresholdPct);
      return { index, d, dev12, dev5, dev3, isExceeded };
    })
    .filter((a) => a.isExceeded);

  // Legend header
  const header = wrap
    .append('div')
    .attr('class', 'row-between')
    .style('margin-bottom', '8px')
    .style('font-size', '12px')
    .style('flex-wrap', 'wrap')
    .style('gap', '8px');

  const legend = header.append('div').attr('class', 'row-wrap').style('gap', '12px').style('align-items', 'center');
  
  const addLegendItem = (color: string, label: string, isDashed = false) => {
    legend
      .append('span')
      .style('display', 'inline-flex')
      .style('align-items', 'center')
      .style('gap', '5px')
      .style('color', 'var(--text-secondary)')
      .html(
        isDashed
          ? `<span style="display:inline-block;width:14px;height:0;border-top:2px dashed ${color};"></span>${label}`
          : `<span style="display:inline-block;width:12px;height:2.5px;background:${color};"></span>${label}`
      );
  };

  addLegendItem('#06b6d4', '+12V (ATX)');
  addLegendItem('#10b981', '+5V');
  addLegendItem('#f59e0b', '+3.3V');
  if (annotations.length > 0) {
    addLegendItem('#f43f5e', `Odchyłka > ±${alertThresholdPct}% (${annotations.length} zdarzeń)`, true);
  }

  const latest = history[history.length - 1];
  header
    .append('span')
    .attr('class', 'font-mono')
    .style('color', 'var(--text-primary)')
    .style('font-size', '11px')
    .text(`Aktualnie: +12V: ${latest.rail12V.toFixed(2)}V · +5V: ${latest.rail5V.toFixed(2)}V · +3.3V: ${latest.rail3P3V.toFixed(2)}V`);

  const svgWrap = wrap.append('div').style('position', 'relative');
  const svg = svgWrap
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('width', '100%')
    .style('height', `${height}px`)
    .style('display', 'block')
    .style('overflow', 'visible');

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  // Scales
  const xScale = d3
    .scaleLinear()
    .domain([0, Math.max(1, history.length - 1)])
    .range([0, plotW]);

  // Y domain covers 3V to 13V to accommodate all three rails (+3.3V, +5V, +12V)
  const yScale = d3
    .scaleLinear()
    .domain([3.0, 13.0])
    .range([plotH, 0]);

  // Grid lines
  g.append('g')
    .attr('class', 'grid-lines')
    .selectAll('line')
    .data([3.3, 5.0, 12.0])
    .enter()
    .append('line')
    .attr('x1', 0)
    .attr('x2', plotW)
    .attr('y1', (d) => yScale(d))
    .attr('y2', (d) => yScale(d))
    .attr('stroke', 'rgba(255,255,255,0.06)')
    .attr('stroke-dasharray', '3,3');

  // Axes
  const xAxis = d3.axisBottom(xScale).ticks(5).tickFormat((d) => `-${((history.length - 1 - Number(d)) * 2.5).toFixed(0)}s`);
  const yAxis = d3.axisLeft(yScale).ticks(5).tickFormat((d) => `${d}V`);

  g.append('g')
    .attr('transform', `translate(0,${plotH})`)
    .attr('color', 'rgba(255,255,255,0.3)')
    .call(xAxis)
    .selectAll('text')
    .style('font-size', '10px');

  g.append('g')
    .attr('color', 'rgba(255,255,255,0.3)')
    .call(yAxis)
    .selectAll('text')
    .style('font-size', '10px');

  // D3.js Event Annotation Layer: Marks timestamps where a voltage rail crossed ±5% deviation threshold
  if (annotations.length > 0) {
    const annotLayer = g.append('g').attr('class', 'event-annotation-layer');
    annotations.forEach((annot) => {
      const cx = xScale(annot.index);
      annotLayer
        .append('line')
        .attr('x1', cx)
        .attr('x2', cx)
        .attr('y1', 0)
        .attr('y2', plotH)
        .attr('stroke', '#f43f5e')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '3,2')
        .attr('opacity', 0.85);

      const marker = annotLayer
        .append('g')
        .attr('transform', `translate(${cx}, 6)`)
        .style('cursor', 'pointer');

      marker
        .append('circle')
        .attr('r', 6)
        .attr('fill', '#f43f5e')
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 1.2);

      marker
        .append('text')
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
        .attr('fill', '#ffffff')
        .style('font-size', '8px')
        .style('font-weight', 'bold')
        .text('!');
    });
  }

  // Line generators
  const line12 = d3
    .line<(typeof history)[0]>()
    .x((_, i) => xScale(i))
    .y((d) => yScale(d.rail12V))
    .curve(d3.curveMonotoneX);

  const line5 = d3
    .line<(typeof history)[0]>()
    .x((_, i) => xScale(i))
    .y((d) => yScale(d.rail5V))
    .curve(d3.curveMonotoneX);

  const line3P3 = d3
    .line<(typeof history)[0]>()
    .x((_, i) => xScale(i))
    .y((d) => yScale(d.rail3P3V))
    .curve(d3.curveMonotoneX);

  // Draw lines
  g.append('path')
    .datum(history)
    .attr('fill', 'none')
    .attr('stroke', '#06b6d4')
    .attr('stroke-width', 2.2)
    .attr('d', line12);

  g.append('path')
    .datum(history)
    .attr('fill', 'none')
    .attr('stroke', '#10b981')
    .attr('stroke-width', 1.8)
    .attr('d', line5);

  g.append('path')
    .datum(history)
    .attr('fill', 'none')
    .attr('stroke', '#f59e0b')
    .attr('stroke-width', 1.8)
    .attr('d', line3P3);

  // Tooltip hover
  const tooltip = svgWrap
    .append('div')
    .style('position', 'absolute')
    .style('display', 'none')
    .style('background', 'rgba(15, 23, 42, 0.96)')
    .style('border', '1px solid rgba(255,255,255,0.18)')
    .style('padding', '8px 12px')
    .style('border-radius', '8px')
    .style('font-size', '12px')
    .style('color', '#fff')
    .style('pointer-events', 'none')
    .style('box-shadow', '0 6px 16px rgba(0,0,0,0.5)')
    .style('z-index', '20');

  // Hover guide line
  const guideLine = g
    .append('line')
    .attr('y1', 0)
    .attr('y2', plotH)
    .attr('stroke', 'rgba(255,255,255,0.25)')
    .attr('stroke-dasharray', '2,2')
    .style('display', 'none');

  svg
    .append('rect')
    .attr('width', plotW)
    .attr('height', plotH)
    .attr('transform', `translate(${margin.left},${margin.top})`)
    .style('fill', 'none')
    .style('pointer-events', 'all')
    .on('mousemove', (event) => {
      const [mx] = d3.pointer(event);
      const xVal = xScale.invert(mx);
      const idx = Math.max(0, Math.min(history.length - 1, Math.round(xVal)));
      const pt = history[idx];
      if (!pt) return;

      const cx = xScale(idx);
      guideLine.style('display', 'block').attr('x1', cx).attr('x2', cx);

      const dev12 = (Math.abs(pt.rail12V - 12.0) / 12.0) * 100;
      const dev5 = (Math.abs(pt.rail5V - 5.0) / 5.0) * 100;
      const dev3 = (Math.abs(pt.rail3P3V - 3.3) / 3.3) * 100;
      const hasDeviation =
        pt.timestamp > markerResetTimestamp &&
        (dev12 >= alertThresholdPct || dev5 >= alertThresholdPct || dev3 >= alertThresholdPct);

      const alertBadgeHtml = hasDeviation
        ? `
          <div style="margin-top:6px;padding:4px 8px;border-radius:6px;background:rgba(244,63,94,0.25);border:1px solid #f43f5e;color:#fecdd3;font-size:11px;font-weight:600;">
            ⚠️ Przekroczono tolerancję ±${alertThresholdPct}%:
            ${dev12 >= alertThresholdPct ? `<div>• +12V: ${pt.rail12V.toFixed(2)}V (odch. +${dev12.toFixed(1)}%)</div>` : ''}
            ${dev5 >= alertThresholdPct ? `<div>• +5V: ${pt.rail5V.toFixed(2)}V (odch. +${dev5.toFixed(1)}%)</div>` : ''}
            ${dev3 >= alertThresholdPct ? `<div>• +3.3V: ${pt.rail3P3V.toFixed(2)}V (odch. +${dev3.toFixed(1)}%)</div>` : ''}
          </div>
        `
        : '';

      tooltip
        .style('display', 'block')
        .style('left', `${Math.min(plotW - 130, Math.max(20, mx))}px`)
        .style('top', '10px').html(`
          <div style="font-weight:600;margin-bottom:4px;color:var(--text-secondary);">${pt.timeLabel}</div>
          <div style="color:#06b6d4;">Szyna +12V: <strong>${pt.rail12V.toFixed(2)} V</strong></div>
          <div style="color:#10b981;">Szyna +5V: <strong>${pt.rail5V.toFixed(2)} V</strong></div>
          <div style="color:#f59e0b;">Szyna +3.3V: <strong>${pt.rail3P3V.toFixed(2)} V</strong></div>
          <div style="color:var(--text-muted);margin-top:2px;">Obciążenie: ${pt.powerW} W</div>
          ${alertBadgeHtml}
        `);
    })
    .on('mouseleave', () => {
      tooltip.style('display', 'none');
      guideLine.style('display', 'none');
    });
}

export function renderPsuEfficiencyCurveChart(
  container: HTMLElement,
  currentLoadPct: number,
  currentEfficiencyPct: number,
  psuCapacityW: number = 850
): void {
  const root = d3.select(container);
  root.selectAll('*').remove();

  const height = 230;
  const width = 680;
  const margin = { top: 24, right: 26, bottom: 30, left: 52 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  const wrap = root.append('div').attr('class', 'chart-box chart-interactive-wrap');

  // Compute curve points for 80 PLUS Gold model
  function getEffAtLoad(l: number): number {
    const eff = 92.2 - 0.0022 * Math.pow(l - 50, 2);
    return Number(Math.max(82.0, Math.min(92.8, eff)).toFixed(1));
  }

  const curveData: Array<{ load: number; eff: number; dcW: number; lossW: number; acW: number }> = [];
  for (let l = 10; l <= 100; l += 2) {
    const eff = getEffAtLoad(l);
    const dcW = (l / 100) * psuCapacityW;
    const lossW = dcW * (100 / eff - 1);
    const acW = dcW + lossW;
    curveData.push({ load: l, eff, dcW, lossW, acW });
  }

  // Predictive Efficiency Advisor analysis
  const isBelowOptimal = currentLoadPct < 40;
  const isOptimal = currentLoadPct >= 40 && currentLoadPct <= 60;
  const isHighLoad = currentLoadPct > 60;

  // Header & Advisor Callout
  const header = wrap
    .append('div')
    .attr('class', 'row-between')
    .style('margin-bottom', '10px')
    .style('flex-wrap', 'wrap')
    .style('gap', '8px');

  const leftLegend = header.append('div').attr('class', 'row-wrap').style('gap', '10px').style('align-items', 'center');
  leftLegend
    .append('span')
    .style('font-size', '12px')
    .style('color', 'var(--text-secondary)')
    .html('<span style="display:inline-block;width:12px;height:2.5px;background:#06b6d4;margin-right:5px;"></span>Krzywa 80 PLUS Gold');
  leftLegend
    .append('span')
    .style('font-size', '12px')
    .style('color', 'var(--text-secondary)')
    .html('<span style="display:inline-block;width:12px;height:8px;background:rgba(6,182,212,0.18);margin-right:5px;border:1px solid rgba(6,182,212,0.4);border-radius:2px;"></span>Strefa optymalna (40–60%)');

  // Predictive Efficiency Advisor interactive badge
  const advisorBadge = header
    .append('div')
    .attr('class', 'row-wrap')
    .style('align-items', 'center')
    .style('gap', '6px')
    .style('font-size', '11.5px');

  if (isBelowOptimal) {
    advisorBadge.html(`
      <span style="display:inline-flex;align-items:center;gap:5px;padding:3px 8px;border-radius:6px;background:rgba(245,158,11,0.15);border:1px solid #f59e0b;color:#fcd34d;cursor:help;" title="Kliknij lub najedź, aby poznać rekomendacje obniżenia strat energetycznych">
        💡 <strong>Doradca Efektywności:</strong> Obciążenie poniżej optimum (${currentLoadPct}% &lt; 40%)
      </span>
    `);
  } else if (isOptimal) {
    advisorBadge.html(`
      <span style="display:inline-flex;align-items:center;gap:5px;padding:3px 8px;border-radius:6px;background:rgba(16,185,129,0.15);border:1px solid #10b981;color:#6ee7b7;">
        ✅ <strong>Doradca Efektywności:</strong> Optymalna strefa sprawności (~92% 80 PLUS)
      </span>
    `);
  } else {
    advisorBadge.html(`
      <span style="display:inline-flex;align-items:center;gap:5px;padding:3px 8px;border-radius:6px;background:rgba(6,182,212,0.15);border:1px solid #06b6d4;color:#67e8f9;">
        ⚡ <strong>Doradca Efektywności:</strong> Wysokie obciążenie (${currentLoadPct}%)
      </span>
    `);
  }

  // Predictive Efficiency Advisor detail box (especially active when below optimal zone)
  const advisorCallout = wrap
    .append('div')
    .style('margin-bottom', '10px')
    .style('padding', '10px 14px')
    .style('border-radius', '8px')
    .style('background', isBelowOptimal ? 'rgba(245, 158, 11, 0.08)' : 'rgba(255, 255, 255, 0.03)')
    .style('border', isBelowOptimal ? '1px solid rgba(245, 158, 11, 0.25)' : '1px solid rgba(255, 255, 255, 0.08)')
    .style('font-size', '12px')
    .style('color', 'var(--text-secondary)')
    .style('line-height', '1.45');

  if (isBelowOptimal) {
    advisorCallout.html(`
      <div style="font-weight:600;color:#fcd34d;margin-bottom:4px;display:flex;align-items:center;gap:6px;">
        <span>🎯 Predictive Efficiency Advisor — Sugerowane nastawy systemowe:</span>
      </div>
      <div>Obecne obciążenie zasilacza wynosi <strong>${currentLoadPct}%</strong> (${Math.round((currentLoadPct / 100) * psuCapacityW)}W z ${psuCapacityW}W), co lokuje system w strefie niższej sprawności energetycznej zasilacza ATX. Aby zoptymalizować bilans mocy:</div>
      <ul style="margin:6px 0 0 16px;padding:0;color:var(--text-primary);display:flex;flex-direction:column;gap:3px;">
        <li><strong>Limit FPS GPU (Frame Capping):</strong> Ogranicz liczbę klatek do częstotliwości odświeżania monitora (np. 144 / 165 FPS) lub włącz V-Sync w sterowniku, eliminując renderowanie nadmiarowych klatek.</li>
        <li><strong>Limity mocy CPU (PL1 / PL2 / AMD Eco Mode):</strong> Skonfiguruj zbalansowany profil mocy lub limit PL1 równy TDP procesora (np. 65W), zapobiegając nieefektywnym skokom poboru prądu.</li>
        <li><strong>Undervolting (UV) procesora i karty graficznej:</strong> Obniżenie napięcia o 50–75 mV redukuje pobór energii o 15–20% przy zachowaniu identycznego taktowania.</li>
      </ul>
    `);
  } else if (isOptimal) {
    advisorCallout.html(`
      <div style="font-weight:600;color:#6ee7b7;margin-bottom:2px;">
        🎯 Predictive Efficiency Advisor: Idealny punkt pracy zasilacza
      </div>
      <div>System pracuje w przedziale 40–60% mocy znamionowej (${psuCapacityW}W). Straty cieplne są zminimalizowane, a sprawność konwersji AC/DC osiąga szczytowe <strong>${currentEfficiencyPct}%</strong>.</div>
    `);
  } else {
    advisorCallout.html(`
      <div style="font-weight:600;color:#67e8f9;margin-bottom:2px;">
        🎯 Predictive Efficiency Advisor: Wysoki pobór mocy zasilacza
      </div>
      <div>System pobiera <strong>${currentLoadPct}%</strong> mocy zasilacza. Zwiększona emisja strat cieplnych (~${(Math.round(((currentLoadPct / 100) * psuCapacityW) * (100 / currentEfficiencyPct - 1)))}W) podnosi temperaturę wnętrza PSU. Zadbaj o swobodny przepływ powietrza pod obudową.</div>
    `);
  }

  const svgWrap = wrap.append('div').style('position', 'relative');
  const svg = svgWrap
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('width', '100%')
    .style('height', `${height}px`)
    .style('display', 'block')
    .style('overflow', 'visible');

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const xScale = d3.scaleLinear().domain([0, 100]).range([0, plotW]);
  const yScale = d3.scaleLinear().domain([80, 95]).range([plotH, 0]);

  // Grid lines
  g.append('g')
    .attr('class', 'grid-lines')
    .selectAll('line')
    .data([85, 90, 92])
    .enter()
    .append('line')
    .attr('x1', 0)
    .attr('x2', plotW)
    .attr('y1', (d) => yScale(d))
    .attr('y2', (d) => yScale(d))
    .attr('stroke', 'rgba(255,255,255,0.06)')
    .attr('stroke-dasharray', '3,3');

  const xAxis = d3.axisBottom(xScale).ticks(5).tickFormat((d) => `${d}%`);
  const yAxis = d3.axisLeft(yScale).ticks(4).tickFormat((d) => `${d}%`);

  g.append('g')
    .attr('transform', `translate(0,${plotH})`)
    .attr('color', 'rgba(255,255,255,0.3)')
    .call(xAxis)
    .selectAll('text')
    .style('font-size', '10px');

  g.append('g')
    .attr('color', 'rgba(255,255,255,0.3)')
    .call(yAxis)
    .selectAll('text')
    .style('font-size', '10px');

  // Optimal zone shading (40% - 60%)
  const optX1 = xScale(40);
  const optX2 = xScale(60);
  g.append('rect')
    .attr('x', optX1)
    .attr('y', 0)
    .attr('width', optX2 - optX1)
    .attr('height', plotH)
    .attr('fill', 'rgba(6, 182, 212, 0.08)')
    .attr('stroke', 'rgba(6, 182, 212, 0.25)')
    .attr('stroke-dasharray', '2,2');

  g.append('text')
    .attr('x', (optX1 + optX2) / 2)
    .attr('y', 14)
    .attr('text-anchor', 'middle')
    .attr('fill', 'rgba(6, 182, 212, 0.75)')
    .style('font-size', '10px')
    .style('font-weight', '600')
    .text('Optimum (40-60%)');

  // Line generator
  const lineGen = d3
    .line<{ load: number; eff: number }>()
    .x((d) => xScale(d.load))
    .y((d) => yScale(d.eff))
    .curve(d3.curveMonotoneX);

  g.append('path')
    .datum(curveData)
    .attr('fill', 'none')
    .attr('stroke', '#06b6d4')
    .attr('stroke-width', 2.6)
    .attr('d', lineGen);

  // Current operating point on the curve
  const cx = xScale(Math.max(10, Math.min(100, currentLoadPct)));
  const cy = yScale(Math.max(80, Math.min(95, currentEfficiencyPct)));
  const currentDcW = (currentLoadPct / 100) * psuCapacityW;
  const currentLossW = currentDcW * (100 / Math.max(1, currentEfficiencyPct) - 1);

  g.append('circle')
    .attr('cx', cx)
    .attr('cy', cy)
    .attr('r', 6)
    .attr('fill', '#f59e0b')
    .attr('stroke', '#fff')
    .attr('stroke-width', 2);

  g.append('text')
    .attr('x', cx + (cx > plotW - 140 ? -12 : 12))
    .attr('y', cy - 8)
    .attr('text-anchor', cx > plotW - 140 ? 'end' : 'start')
    .attr('fill', '#f59e0b')
    .style('font-size', '11px')
    .style('font-weight', '600')
    .text(`Obecny stan: ${currentLoadPct}% (${currentEfficiencyPct}% · strata ~${currentLossW.toFixed(0)}W)`);

  // Interactive hover guideline & marker for 'Efficiency Insight'
  const hoverLine = g
    .append('line')
    .attr('y1', 0)
    .attr('y2', plotH)
    .attr('stroke', 'rgba(255,255,255,0.35)')
    .attr('stroke-dasharray', '2,2')
    .style('display', 'none');

  const hoverDot = g
    .append('circle')
    .attr('r', 5)
    .attr('fill', '#06b6d4')
    .attr('stroke', '#ffffff')
    .attr('stroke-width', 2)
    .style('display', 'none');

  // Interactive 'Efficiency Insight' Tooltip
  const insightTooltip = svgWrap
    .append('div')
    .style('position', 'absolute')
    .style('display', 'none')
    .style('background', 'rgba(15, 23, 42, 0.96)')
    .style('border', '1px solid rgba(6, 182, 212, 0.4)')
    .style('padding', '10px 14px')
    .style('border-radius', '8px')
    .style('font-size', '12px')
    .style('color', '#fff')
    .style('pointer-events', 'none')
    .style('box-shadow', '0 8px 24px rgba(0,0,0,0.55)')
    .style('z-index', '25')
    .style('min-width', '200px');

  // Overlay rect to capture mouse movements across the curve
  svg
    .append('rect')
    .attr('width', plotW)
    .attr('height', plotH)
    .attr('transform', `translate(${margin.left},${margin.top})`)
    .style('fill', 'none')
    .style('pointer-events', 'all')
    .on('mousemove', (event) => {
      const [mx] = d3.pointer(event);
      const load = Math.max(10, Math.min(100, Math.round(xScale.invert(mx))));
      const eff = getEffAtLoad(load);
      const dcW = (load / 100) * psuCapacityW;
      const lossW = dcW * (100 / eff - 1);
      const acW = dcW + lossW;

      const px = xScale(load);
      const py = yScale(eff);

      hoverLine.style('display', 'block').attr('x1', px).attr('x2', px);
      hoverDot.style('display', 'block').attr('cx', px).attr('cy', py);

      const zoneLabel =
        load >= 40 && load <= 60
          ? '<span style="color:#10b981;font-weight:600;">★ Optymalna strefa 80 PLUS (najniższe straty)</span>'
          : load < 40
            ? '<span style="color:#f59e0b;font-weight:600;">Poniżej optimum (niższa sprawność)</span>'
            : '<span style="color:#06b6d4;font-weight:600;">Wysokie obciążenie zasilacza</span>';

      insightTooltip
        .style('display', 'block')
        .style('left', `${Math.min(plotW - 160, Math.max(10, mx - 40))}px`)
        .style('top', '15px').html(`
          <div style="font-weight:700;font-size:12.5px;margin-bottom:5px;color:#38bdf8;">Efficiency Insight</div>
          <div style="margin-bottom:2px;">Obciążenie zasilacza: <strong>${load}%</strong> (${Math.round(dcW)} W DC)</div>
          <div style="margin-bottom:2px;color:#67e8f9;">Sprawność PSU: <strong>${eff}%</strong></div>
          <div style="margin-bottom:2px;">Pobór z sieci (AC): <strong>${Math.round(acW)} W</strong></div>
          <div style="margin-bottom:6px;color:#fcd34d;">Straty mocy (ciepło): <strong>${lossW.toFixed(1)} W</strong></div>
          <div style="font-size:11px;padding-top:4px;border-top:1px solid rgba(255,255,255,0.1);">${zoneLabel}</div>
        `);
    })
    .on('mouseleave', () => {
      insightTooltip.style('display', 'none');
      hoverLine.style('display', 'none');
      hoverDot.style('display', 'none');
    });
}

export function renderPsuPowerVsEfficiencyBarChart(
  container: HTMLElement,
  currentPowerW: number,
  currentLoadPct: number,
  currentEfficiencyPct: number,
  psuCapacityW: number = 850
): void {
  const root = d3.select(container);
  root.selectAll('*').remove();

  const height = 225;
  const width = 680;
  const margin = { top: 24, right: 48, bottom: 32, left: 52 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  const wrap = root.append('div').attr('class', 'chart-box chart-interactive-wrap');

  const increments = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  const activeBucket = Math.min(100, Math.max(10, Math.round(currentLoadPct / 10) * 10));

  const barData = increments.map((loadPct) => {
    const eff = Number(Math.max(82.0, Math.min(92.8, 92.2 - 0.0022 * Math.pow(loadPct - 50, 2))).toFixed(1));
    const powerW = Math.round((loadPct / 100) * psuCapacityW);
    const isOptimal = loadPct >= 40 && loadPct <= 60;
    const isActive = loadPct === activeBucket;
    return { loadPct, eff, powerW, isOptimal, isActive };
  });

  const header = wrap
    .append('div')
    .attr('class', 'row-between')
    .style('margin-bottom', '8px')
    .style('font-size', '12px')
    .style('flex-wrap', 'wrap')
    .style('gap', '8px');

  const legend = header.append('div').attr('class', 'row-wrap').style('gap', '12px').style('align-items', 'center');
  legend
    .append('span')
    .style('color', 'var(--text-secondary)')
    .html('<span style="display:inline-block;width:10px;height:10px;background:#f59e0b;border-radius:2px;margin-right:5px;"></span>Bieżący przedział mocy');
  legend
    .append('span')
    .style('color', 'var(--text-secondary)')
    .html('<span style="display:inline-block;width:10px;height:10px;background:#10b981;border-radius:2px;margin-right:5px;"></span>Strefa optymalna (40–60%)');
  legend
    .append('span')
    .style('color', 'var(--text-secondary)')
    .html('<span style="display:inline-block;width:12px;height:2.5px;background:#38bdf8;margin-right:5px;"></span>Sprawność 80 PLUS (%)');

  header
    .append('span')
    .attr('class', 'font-mono')
    .style('font-size', '11px')
    .style('color', 'var(--text-primary)')
    .text(`Bieżący pobór: ${currentPowerW}W (${currentLoadPct}%) · Sprawność: ${currentEfficiencyPct}%`);

  const svgWrap = wrap.append('div').style('position', 'relative');
  const svg = svgWrap
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('width', '100%')
    .style('height', `${height}px`)
    .style('display', 'block')
    .style('overflow', 'visible');

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const xScale = d3
    .scaleBand<number>()
    .domain(increments)
    .range([0, plotW])
    .padding(0.28);

  const yPowerScale = d3.scaleLinear().domain([0, psuCapacityW]).range([plotH, 0]);
  const yEffScale = d3.scaleLinear().domain([80, 95]).range([plotH, 0]);

  // Grid lines
  g.append('g')
    .attr('class', 'grid-lines')
    .selectAll('line')
    .data([200, 425, 650, 850])
    .enter()
    .append('line')
    .attr('x1', 0)
    .attr('x2', plotW)
    .attr('y1', (d) => yPowerScale(Math.min(psuCapacityW, d)))
    .attr('y2', (d) => yPowerScale(Math.min(psuCapacityW, d)))
    .attr('stroke', 'rgba(255,255,255,0.06)')
    .attr('stroke-dasharray', '3,3');

  // Axes
  const xAxis = d3.axisBottom(xScale).tickFormat((d) => `${d}%`);
  const yAxisLeft = d3.axisLeft(yPowerScale).ticks(4).tickFormat((d) => `${d}W`);
  const yAxisRight = d3.axisRight(yEffScale).ticks(4).tickFormat((d) => `${d}%`);

  g.append('g')
    .attr('transform', `translate(0,${plotH})`)
    .attr('color', 'rgba(255,255,255,0.3)')
    .call(xAxis)
    .selectAll('text')
    .style('font-size', '10px');

  g.append('g')
    .attr('color', 'rgba(255,255,255,0.3)')
    .call(yAxisLeft)
    .selectAll('text')
    .style('font-size', '10px');

  g.append('g')
    .attr('transform', `translate(${plotW},0)`)
    .attr('color', 'rgba(56, 189, 248, 0.45)')
    .call(yAxisRight)
    .selectAll('text')
    .style('font-size', '10px');

  const tooltip = svgWrap
    .append('div')
    .style('position', 'absolute')
    .style('display', 'none')
    .style('background', 'rgba(15, 23, 42, 0.96)')
    .style('border', '1px solid rgba(56, 189, 248, 0.4)')
    .style('padding', '8px 12px')
    .style('border-radius', '8px')
    .style('font-size', '12px')
    .style('color', '#fff')
    .style('pointer-events', 'none')
    .style('z-index', '25');

  // Draw power bars for each load increment
  g.selectAll('.psu-inc-bar')
    .data(barData)
    .enter()
    .append('rect')
    .attr('class', 'psu-inc-bar')
    .attr('x', (d) => xScale(d.loadPct) || 0)
    .attr('y', (d) => yPowerScale(d.powerW))
    .attr('width', xScale.bandwidth())
    .attr('height', (d) => plotH - yPowerScale(d.powerW))
    .attr('rx', 4)
    .attr('fill', (d) =>
      d.isActive
        ? '#f59e0b'
        : d.isOptimal
          ? 'rgba(16, 185, 129, 0.55)'
          : d.loadPct > 85
            ? 'rgba(244, 63, 94, 0.48)'
            : 'rgba(6, 182, 212, 0.28)'
    )
    .attr('stroke', (d) => (d.isActive ? '#ffffff' : d.isOptimal ? '#10b981' : 'rgba(255,255,255,0.12)'))
    .attr('stroke-width', (d) => (d.isActive ? 1.8 : 1))
    .style('cursor', 'pointer')
    .on('mousemove', (event, d) => {
      const [mx] = d3.pointer(event, svg.node());
      const lossW = (d.powerW * (100 / d.eff - 1)).toFixed(1);
      tooltip
        .style('display', 'block')
        .style('left', `${Math.min(plotW - 140, Math.max(12, mx - 40))}px`)
        .style('top', '10px').html(`
          <div style="font-weight:700;color:#38bdf8;margin-bottom:3px;">Próg obciążenia: ${d.loadPct}% (${d.powerW} W)</div>
          <div>Sprawność zasilacza: <strong>${d.eff}%</strong></div>
          <div style="color:#fcd34d;">Strata mocy (ciepło): <strong>${lossW} W</strong></div>
          <div style="color:var(--text-secondary);font-size:11px;margin-top:3px;">
            Różnica względem bieżącego (${currentPowerW}W): <strong>${d.powerW - currentPowerW >= 0 ? '+' : ''}${d.powerW - currentPowerW} W</strong>
          </div>
        `);
    })
    .on('mouseleave', () => {
      tooltip.style('display', 'none');
    });

  // Draw horizontal reference line for current live system power draw
  const curY = yPowerScale(Math.min(psuCapacityW, Math.max(0, currentPowerW)));
  g.append('line')
    .attr('x1', 0)
    .attr('x2', plotW)
    .attr('y1', curY)
    .attr('y2', curY)
    .attr('stroke', '#f59e0b')
    .attr('stroke-width', 1.6)
    .attr('stroke-dasharray', '4,3');

  g.append('text')
    .attr('x', 6)
    .attr('y', Math.max(10, curY - 5))
    .attr('fill', '#fcd34d')
    .style('font-size', '10px')
    .style('font-weight', '600')
    .text(`Aktualny pobór systemu: ${currentPowerW} W (${currentLoadPct}%)`);

  // Overlay efficiency curve line across bar centers
  const effLine = d3
    .line<(typeof barData)[0]>()
    .x((d) => (xScale(d.loadPct) || 0) + xScale.bandwidth() / 2)
    .y((d) => yEffScale(d.eff))
    .curve(d3.curveMonotoneX);

  g.append('path')
    .datum(barData)
    .attr('fill', 'none')
    .attr('stroke', '#38bdf8')
    .attr('stroke-width', 2.4)
    .attr('d', effLine);

  g.selectAll('.eff-dot')
    .data(barData)
    .enter()
    .append('circle')
    .attr('cx', (d) => (xScale(d.loadPct) || 0) + xScale.bandwidth() / 2)
    .attr('cy', (d) => yEffScale(d.eff))
    .attr('r', (d) => (d.isActive ? 5 : 3.2))
    .attr('fill', (d) => (d.isActive ? '#f59e0b' : '#38bdf8'))
    .attr('stroke', '#fff')
    .attr('stroke-width', 1.2);
}

export function renderPsuEfficiencyTrend1hChart(
  container: HTMLElement,
  data: Array<{ timestamp: number; timeLabel: string; efficiencyPct: number; powerDrawW: number; tempC: number }>,
  psuCapacityW: number = 850
): void {
  const root = d3.select(container);
  root.selectAll('*').remove();

  const height = 235;
  const width = 920;
  const margin = { top: 24, right: 62, bottom: 34, left: 54 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  const wrap = root.append('div').attr('class', 'chart-box chart-interactive-wrap');

  if (!data || data.length === 0) {
    wrap.append('div').attr('class', 'chart-empty').text('Zbieranie danych trendu sprawności (ostatnia godzina)...');
    return;
  }

  const first = data[0];
  const last = data[data.length - 1];
  const effDrop = Number((first.efficiencyPct - last.efficiencyPct).toFixed(1));
  const tempRise = Number((last.tempC - first.tempC).toFixed(1));

  const header = wrap
    .append('div')
    .attr('class', 'row-between')
    .style('margin-bottom', '8px')
    .style('font-size', '12px')
    .style('flex-wrap', 'wrap')
    .style('gap', '8px');

  const legend = header.append('div').attr('class', 'row-wrap').style('gap', '14px').style('align-items', 'center');
  legend
    .append('span')
    .style('color', 'var(--text-secondary)')
    .html('<span style="display:inline-block;width:12px;height:2.5px;background:#10b981;margin-right:5px;"></span>Sprawność PSU (%)');
  legend
    .append('span')
    .style('color', 'var(--text-secondary)')
    .html('<span style="display:inline-block;width:12px;height:2.5px;background:#38bdf8;margin-right:5px;"></span>Pobór mocy systemu (W)');
  legend
    .append('span')
    .style('color', 'var(--text-secondary)')
    .html('<span style="display:inline-block;width:12px;height:2.5px;background:#f43f5e;border-top:1px dashed #f43f5e;margin-right:5px;"></span>Temperatura PSU (°C — wpływ degradacji termicznej)');

  header
    .append('span')
    .attr('class', 'font-mono')
    .style('font-size', '11px')
    .style('color', effDrop > 1.2 ? '#f59e0b' : '#10b981')
    .text(
      `60 min: ΔSprawność ${effDrop > 0 ? '-' : '+'}${Math.abs(effDrop)}% przy ΔTemp ${tempRise >= 0 ? '+' : ''}${tempRise}°C (Obecnie: ${last.efficiencyPct}% @ ${last.powerDrawW}W / ${last.tempC}°C)`
    );

  const svgWrap = wrap.append('div').style('position', 'relative');
  const svg = svgWrap
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('width', '100%')
    .style('height', `${height}px`)
    .style('display', 'block')
    .style('overflow', 'visible');

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const xDomain = d3.extent(data, (d) => new Date(d.timestamp)) as [Date, Date];
  const xScale = d3.scaleTime().domain(xDomain).range([0, plotW]);
  const yEffScale = d3.scaleLinear().domain([80, 95]).range([plotH, 0]);
  const yPowerScale = d3.scaleLinear().domain([0, psuCapacityW]).range([plotH, 0]);
  const yTempScale = d3.scaleLinear().domain([25, 85]).range([plotH, 0]);

  // Grid lines
  g.append('g')
    .attr('class', 'grid-lines')
    .selectAll('line')
    .data([82, 85, 88, 91, 94])
    .enter()
    .append('line')
    .attr('x1', 0)
    .attr('x2', plotW)
    .attr('y1', (d) => yEffScale(d))
    .attr('y2', (d) => yEffScale(d))
    .attr('stroke', 'rgba(255,255,255,0.06)')
    .attr('stroke-dasharray', '3,3');

  const xAxis = d3
    .axisBottom(xScale)
    .ticks(6)
    .tickFormat((d) => {
      const dt = d as Date;
      return `${dt.getHours().toString().padStart(2, '0')}:${dt.getMinutes().toString().padStart(2, '0')}`;
    });
  const yAxisLeft = d3.axisLeft(yEffScale).ticks(5).tickFormat((d) => `${d}%`);
  const yAxisRight = d3.axisRight(yPowerScale).ticks(5).tickFormat((d) => `${d}W`);

  g.append('g')
    .attr('transform', `translate(0,${plotH})`)
    .attr('color', 'rgba(255,255,255,0.3)')
    .call(xAxis)
    .selectAll('text')
    .style('font-size', '10px');

  g.append('g')
    .attr('color', 'rgba(16, 185, 129, 0.55)')
    .call(yAxisLeft)
    .selectAll('text')
    .style('font-size', '10px');

  g.append('g')
    .attr('transform', `translate(${plotW},0)`)
    .attr('color', 'rgba(56, 189, 248, 0.55)')
    .call(yAxisRight)
    .selectAll('text')
    .style('font-size', '10px');

  // Area under power draw
  const powerArea = d3
    .area<(typeof data)[0]>()
    .x((d) => xScale(new Date(d.timestamp)))
    .y0(plotH)
    .y1((d) => yPowerScale(Math.min(psuCapacityW, d.powerDrawW)))
    .curve(d3.curveMonotoneX);

  g.append('path')
    .datum(data)
    .attr('fill', 'rgba(56, 189, 248, 0.08)')
    .attr('d', powerArea);

  // Power Draw Line
  const powerLine = d3
    .line<(typeof data)[0]>()
    .x((d) => xScale(new Date(d.timestamp)))
    .y((d) => yPowerScale(Math.min(psuCapacityW, d.powerDrawW)))
    .curve(d3.curveMonotoneX);

  g.append('path')
    .datum(data)
    .attr('fill', 'none')
    .attr('stroke', '#38bdf8')
    .attr('stroke-width', 2.0)
    .attr('d', powerLine);

  // Component/PSU Temperature Line (dashed red)
  const tempLine = d3
    .line<(typeof data)[0]>()
    .x((d) => xScale(new Date(d.timestamp)))
    .y((d) => yTempScale(Math.max(25, Math.min(85, d.tempC))))
    .curve(d3.curveMonotoneX);

  g.append('path')
    .datum(data)
    .attr('fill', 'none')
    .attr('stroke', '#f43f5e')
    .attr('stroke-width', 1.6)
    .attr('stroke-dasharray', '4,3')
    .attr('d', tempLine);

  // Efficiency Trend Line (primary green)
  const effLine = d3
    .line<(typeof data)[0]>()
    .x((d) => xScale(new Date(d.timestamp)))
    .y((d) => yEffScale(Math.max(80, Math.min(95, d.efficiencyPct))))
    .curve(d3.curveMonotoneX);

  g.append('path')
    .datum(data)
    .attr('fill', 'none')
    .attr('stroke', '#10b981')
    .attr('stroke-width', 2.6)
    .attr('d', effLine);

  // Dots on efficiency line
  g.selectAll('.trend-eff-dot')
    .data(data)
    .enter()
    .append('circle')
    .attr('cx', (d) => xScale(new Date(d.timestamp)))
    .attr('cy', (d) => yEffScale(Math.max(80, Math.min(95, d.efficiencyPct))))
    .attr('r', (_, idx) => (idx === data.length - 1 ? 4.5 : 2.5))
    .attr('fill', (d) => (d.tempC >= 52 ? '#f59e0b' : '#10b981'))
    .attr('stroke', '#fff')
    .attr('stroke-width', 1);

  // Interactive hover crosshair & tooltip
  const hoverLine = g
    .append('line')
    .attr('y1', 0)
    .attr('y2', plotH)
    .attr('stroke', 'rgba(255,255,255,0.35)')
    .attr('stroke-dasharray', '2,2')
    .style('display', 'none');

  const tooltip = svgWrap
    .append('div')
    .style('position', 'absolute')
    .style('display', 'none')
    .style('background', 'rgba(15, 23, 42, 0.96)')
    .style('border', '1px solid rgba(16, 185, 129, 0.45)')
    .style('padding', '9px 13px')
    .style('border-radius', '8px')
    .style('font-size', '12px')
    .style('color', '#fff')
    .style('pointer-events', 'none')
    .style('box-shadow', '0 8px 24px rgba(0,0,0,0.55)')
    .style('z-index', '25');

  svg
    .append('rect')
    .attr('width', plotW)
    .attr('height', plotH)
    .attr('transform', `translate(${margin.left},${margin.top})`)
    .style('fill', 'none')
    .style('pointer-events', 'all')
    .on('mousemove', (event) => {
      const [mx] = d3.pointer(event);
      const hoveredDate = xScale.invert(mx).getTime();
      let closest = data[0];
      let minDiff = Infinity;
      for (const pt of data) {
        const diff = Math.abs(pt.timestamp - hoveredDate);
        if (diff < minDiff) {
          minDiff = diff;
          closest = pt;
        }
      }
      const px = xScale(new Date(closest.timestamp));
      hoverLine.style('display', 'block').attr('x1', px).attr('x2', px);

      const thermalLossPct = Math.max(0, (closest.tempC - 35.0) * 0.095).toFixed(2);
      const heatLossW = (closest.powerDrawW * (100 / Math.max(1, closest.efficiencyPct) - 1)).toFixed(1);

      tooltip
        .style('display', 'block')
        .style('left', `${Math.min(plotW - 190, Math.max(12, px - 50))}px`)
        .style('top', '12px').html(`
          <div style="font-weight:700;color:#10b981;margin-bottom:4px;">Trend Sprawności (${closest.timeLabel})</div>
          <div>Sprawność zasilacza: <strong>${closest.efficiencyPct}%</strong></div>
          <div style="color:#38bdf8;">Pobór mocy systemu: <strong>${closest.powerDrawW} W</strong></div>
          <div style="color:#fb7185;">Temp. komponentów PSU: <strong>${closest.tempC}°C</strong></div>
          <div style="color:#fcd34d;margin-top:3px;font-size:11px;">
            Degradacja termiczna: <strong>-${thermalLossPct}%</strong> · Straty ciepła: <strong>${heatLossW} W</strong>
          </div>
        `);
    })
    .on('mouseleave', () => {
      hoverLine.style('display', 'none');
      tooltip.style('display', 'none');
    });
}

export interface RailFullHistorySample {
  timestamp: number;
  timeLabel: string;
  voltageV: number;
  powerW: number;
}

/**
 * Renders a horizontally scrollable, high-resolution D3.js timeline chart showing up to
 * 5 minutes (300s) of voltage telemetry for a specific PSU rail inside the Full History modal.
 */
export function renderRailFullHistoryD3ModalChart(
  container: HTMLElement,
  railName: '+12V' | '+5V' | '+3.3V',
  samples: RailFullHistorySample[],
  thresholdPct: number,
  nominalV: number,
  zoomFactor: number = 2,
  emptyMessage?: string
): void {
  const prevScrollEl = container.querySelector<HTMLElement>('.psu-full-history-scroll');
  const prevScrollLeft = prevScrollEl ? prevScrollEl.scrollLeft : null;
  const wasNearRight =
    prevScrollEl != null
      ? prevScrollEl.scrollWidth - (prevScrollEl.scrollLeft + prevScrollEl.clientWidth) < 42
      : true;

  const root = d3.select(container);
  root.selectAll('*').remove();

  if (!samples || samples.length === 0) {
    root
      .append('div')
      .style('padding', '48px 16px')
      .style('text-align', 'center')
      .style('color', 'var(--text-muted)')
      .style('font-size', '13px')
      .text(emptyMessage || `Brak próbek telemetrii dla szyny ${railName}.`);
    return;
  }

  const ordered = [...samples].sort((a, b) => a.timestamp - b.timestamp);
  const upperBound = nominalV * (1 + thresholdPct / 100);
  const lowerBound = nominalV * (1 - thresholdPct / 100);
  const vals = ordered.map((d) => d.voltageV);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const padSpan = nominalV * Math.max(thresholdPct / 100, 0.025) * 0.45;
  const yMin = Math.min(minV, lowerBound) - padSpan;
  const yMax = Math.max(maxV, upperBound) + padSpan;

  const railColor = railName === '+12V' ? '#38bdf8' : railName === '+5V' ? '#10b981' : '#f59e0b';
  const clampedZoom = Math.max(1, Math.min(4, zoomFactor));
  const basePxPerSample = 9 * clampedZoom;
  const chartWidth = Math.min(7200, Math.max(960, Math.round(ordered.length * basePxPerSample + 140)));
  const chartHeight = 310;
  const margin = { top: 26, right: 32, bottom: 42, left: 66 };
  const plotW = chartWidth - margin.left - margin.right;
  const plotH = chartHeight - margin.top - margin.bottom;

  const scrollWrap = root
    .append('div')
    .attr('class', 'psu-full-history-scroll');

  const stage = scrollWrap
    .append('div')
    .style('position', 'relative')
    .style('width', `${chartWidth}px`)
    .style('min-height', `${chartHeight}px`);

  const svg = stage
    .append('svg')
    .attr('width', chartWidth)
    .attr('height', chartHeight)
    .attr('viewBox', `0 0 ${chartWidth} ${chartHeight}`)
    .style('display', 'block');

  const defs = svg.append('defs');
  const gradId = `psu-full-grad-${railName.replace(/[^0-9a-z]/gi, '')}`;
  const areaGrad = defs
    .append('linearGradient')
    .attr('id', gradId)
    .attr('x1', '0%')
    .attr('y1', '0%')
    .attr('x2', '0%')
    .attr('y2', '100%');
  areaGrad.append('stop').attr('offset', '0%').attr('stop-color', railColor).attr('stop-opacity', 0.34);
  areaGrad.append('stop').attr('offset', '100%').attr('stop-color', railColor).attr('stop-opacity', 0.02);

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const tMin = ordered[0].timestamp;
  const tMax = Math.max(tMin + 1000, ordered[ordered.length - 1].timestamp);
  const xScale = d3.scaleTime().domain([new Date(tMin), new Date(tMax)]).range([0, plotW]);
  const yScale = d3.scaleLinear().domain([yMin, yMax]).range([plotH, 0]);

  // Horizontal voltage gridlines
  g.append('g')
    .selectAll('line')
    .data(yScale.ticks(7))
    .enter()
    .append('line')
    .attr('x1', 0)
    .attr('x2', plotW)
    .attr('y1', (d) => yScale(d))
    .attr('y2', (d) => yScale(d))
    .attr('stroke', 'rgba(148, 163, 184, 0.14)')
    .attr('stroke-dasharray', '3,3');

  // Vertical timeline gridlines
  const xTicksCount = Math.max(8, Math.min(36, Math.round(plotW / 95)));
  g.append('g')
    .selectAll('line')
    .data(xScale.ticks(xTicksCount))
    .enter()
    .append('line')
    .attr('x1', (d) => xScale(d))
    .attr('x2', (d) => xScale(d))
    .attr('y1', 0)
    .attr('y2', plotH)
    .attr('stroke', 'rgba(148, 163, 184, 0.1)');

  // Shaded safe tolerance band (±thresholdPct%)
  const bandTop = Math.max(0, yScale(upperBound));
  const bandBottom = Math.min(plotH, yScale(lowerBound));
  g.append('rect')
    .attr('x', 0)
    .attr('y', bandTop)
    .attr('width', plotW)
    .attr('height', Math.max(1, bandBottom - bandTop))
    .attr('fill', 'rgba(16, 185, 129, 0.11)');

  // Upper and lower threshold boundary lines
  for (const boundVal of [upperBound, lowerBound]) {
    const by = yScale(boundVal);
    if (by >= 0 && by <= plotH) {
      g.append('line')
        .attr('x1', 0)
        .attr('x2', plotW)
        .attr('y1', by)
        .attr('y2', by)
        .attr('stroke', 'rgba(244, 63, 94, 0.72)')
        .attr('stroke-width', 1.3)
        .attr('stroke-dasharray', '5,4');
      g.append('text')
        .attr('x', plotW - 6)
        .attr('y', by - 4)
        .attr('text-anchor', 'end')
        .attr('fill', '#fda4af')
        .style('font-size', '10px')
        .style('font-family', 'var(--font-mono)')
        .text(`${boundVal === upperBound ? '+' : '-'}${thresholdPct}% (${boundVal.toFixed(2)}V)`);
    }
  }

  // Nominal reference line
  const nomY = yScale(nominalV);
  g.append('line')
    .attr('x1', 0)
    .attr('x2', plotW)
    .attr('y1', nomY)
    .attr('y2', nomY)
    .attr('stroke', 'rgba(148, 163, 184, 0.55)')
    .attr('stroke-width', 1.1)
    .attr('stroke-dasharray', '4,3');

  // Area & high-res voltage curve
  const areaGen = d3
    .area<RailFullHistorySample>()
    .x((d) => xScale(new Date(d.timestamp)))
    .y0(plotH)
    .y1((d) => yScale(d.voltageV))
    .curve(d3.curveMonotoneX);

  const lineGen = d3
    .line<RailFullHistorySample>()
    .x((d) => xScale(new Date(d.timestamp)))
    .y((d) => yScale(d.voltageV))
    .curve(d3.curveMonotoneX);

  g.append('path')
    .datum(ordered)
    .attr('fill', `url(#${gradId})`)
    .attr('d', areaGen);

  g.append('path')
    .datum(ordered)
    .attr('fill', 'none')
    .attr('stroke', railColor)
    .attr('stroke-width', 2.4)
    .attr('d', lineGen);

  // Highlight out-of-threshold excursions
  const excursions = ordered.filter(
    (d) => (Math.abs(d.voltageV - nominalV) / nominalV) * 100 > thresholdPct
  );
  if (excursions.length > 0) {
    const excLayer = g.append('g').attr('class', 'psu-full-excursions');
    excursions.forEach((pt) => {
      const px = xScale(new Date(pt.timestamp));
      const py = yScale(pt.voltageV);
      excLayer
        .append('line')
        .attr('x1', px)
        .attr('x2', px)
        .attr('y1', 0)
        .attr('y2', plotH)
        .attr('stroke', 'rgba(244, 63, 94, 0.24)')
        .attr('stroke-width', 1);
      excLayer
        .append('circle')
        .attr('cx', px)
        .attr('cy', py)
        .attr('r', 4.2)
        .attr('fill', '#f43f5e')
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 1.2);
    });
  }

  // Latest live point marker
  const latestPt = ordered[ordered.length - 1];
  g.append('circle')
    .attr('cx', xScale(new Date(latestPt.timestamp)))
    .attr('cy', yScale(latestPt.voltageV))
    .attr('r', 5)
    .attr('fill', '#38bdf8')
    .attr('stroke', '#ffffff')
    .attr('stroke-width', 1.5);

  // Axes
  const timeFmt = d3.timeFormat('%H:%M:%S');
  const xAxis = d3
    .axisBottom(xScale)
    .ticks(xTicksCount)
    .tickFormat((d) => timeFmt(d as Date));
  const yAxis = d3
    .axisLeft(yScale)
    .ticks(7)
    .tickFormat((d) => `${Number(d).toFixed(2)}V`);

  g.append('g')
    .attr('transform', `translate(0,${plotH})`)
    .attr('color', 'rgba(148, 163, 184, 0.65)')
    .call(xAxis)
    .selectAll('text')
    .style('font-size', '10.5px')
    .style('font-family', 'var(--font-mono)');

  g.append('g')
    .attr('color', 'rgba(148, 163, 184, 0.65)')
    .call(yAxis)
    .selectAll('text')
    .style('font-size', '10.5px')
    .style('font-family', 'var(--font-mono)');

  // Interactive hover crosshair + detailed readout
  const crosshair = g
    .append('line')
    .attr('y1', 0)
    .attr('y2', plotH)
    .attr('stroke', 'rgba(226, 232, 240, 0.55)')
    .attr('stroke-dasharray', '3,3')
    .style('display', 'none');

  const hoverDot = g
    .append('circle')
    .attr('r', 5.5)
    .attr('fill', '#ffffff')
    .attr('stroke', railColor)
    .attr('stroke-width', 2)
    .style('display', 'none');

  const tooltip = stage
    .append('div')
    .attr('class', 'psu-full-history-hover-tooltip')
    .style('display', 'none');

  const bisect = d3.bisector<RailFullHistorySample, number>((d) => d.timestamp).center;

  g.append('rect')
    .attr('width', plotW)
    .attr('height', plotH)
    .style('fill', 'none')
    .style('pointer-events', 'all')
    .style('cursor', 'crosshair')
    .on('mousemove', (event) => {
      const [mx] = d3.pointer(event);
      const hoveredTs = xScale.invert(mx).getTime();
      const idx = Math.max(0, Math.min(ordered.length - 1, bisect(ordered, hoveredTs)));
      const pt = ordered[idx];
      const px = xScale(new Date(pt.timestamp));
      const py = yScale(pt.voltageV);
      const devPct = ((pt.voltageV - nominalV) / nominalV) * 100;
      const absDevPct = Math.abs(devPct);
      const isOut = absDevPct > thresholdPct;
      const ageSec = Math.max(0, Math.round((tMax - pt.timestamp) / 1000));

      crosshair.style('display', 'block').attr('x1', px).attr('x2', px);
      hoverDot
        .style('display', 'block')
        .attr('cx', px)
        .attr('cy', py)
        .attr('stroke', isOut ? '#f43f5e' : railColor);

      const leftPos = Math.min(chartWidth - 228, Math.max(12, margin.left + px + 14));
      const topPos = Math.max(10, Math.min(chartHeight - 118, margin.top + py - 40));
      tooltip
        .style('display', 'block')
        .style('left', `${leftPos}px`)
        .style('top', `${topPos}px`)
        .html(`
          <div style="font-weight:700;color:${isOut ? '#fda4af' : '#bae6fd'};margin-bottom:4px;">
            ${railName} · ${pt.timeLabel} (-${ageSec}s)
          </div>
          <div>Napięcie: <strong>${pt.voltageV.toFixed(3)} V</strong></div>
          <div style="color:${isOut ? '#fb7185' : '#34d399'};">
            Odchyłka: <strong>${devPct >= 0 ? '+' : ''}${devPct.toFixed(2)}%</strong> (${isOut ? 'PRZEKROCZENIE' : 'W NORMIE'})
          </div>
          <div style="color:#94a3b8;font-size:11px;margin-top:2px;">
            Obciążenie systemu: <strong>${pt.powerW.toFixed(1)} W</strong>
          </div>
        `);
    })
    .on('mouseleave', () => {
      crosshair.style('display', 'none');
      hoverDot.style('display', 'none');
      tooltip.style('display', 'none');
    });

  // Auto-scroll to latest (right edge) on first render, or preserve user's scroll offset during live updates
  const scrollNode = scrollWrap.node();
  if (scrollNode) {
    if (prevScrollLeft === null || wasNearRight) {
      scrollNode.scrollLeft = Math.max(0, scrollNode.scrollWidth - scrollNode.clientWidth);
    } else {
      scrollNode.scrollLeft = prevScrollLeft;
    }
  }
}



